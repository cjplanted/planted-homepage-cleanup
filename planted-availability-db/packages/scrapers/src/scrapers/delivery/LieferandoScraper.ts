/**
 * Lieferando (Germany/Austria/Netherlands) Browser Scraper
 *
 * Scrapes restaurants with Planted products from lieferando.de/at/nl
 * using browser automation with puppeteer stealth mode.
 *
 * Lieferando is part of Just Eat Takeaway.com and is the dominant
 * food delivery platform in Germany.
 *
 * Target URLs:
 * - DE: https://www.lieferando.de/speisekarte/{restaurant-slug}
 * - AT: https://www.lieferando.at/speisekarte/{restaurant-slug}
 * - NL: https://www.thuisbezorgd.nl/menu/{restaurant-slug}
 */

import type { Browser, Page } from 'puppeteer';
import {
  createStealthBrowser,
  configurePage,
  safeNavigate,
  randomDelay,
  humanScroll,
  closeBrowser,
  isBlocked,
} from '../../browser/BrowserScraper.js';
import type { ScraperResult, ScraperOptions } from '../../base/BaseScraper.js';

export interface LieferandoScraperConfig {
  cities?: LieferandoCity[];
  headless?: boolean;
  minDelay?: number;
  maxDelay?: number;
  maxVenuesPerCity?: number;
}

interface LieferandoCity {
  name: string;
  country: 'DE' | 'AT' | 'NL';
  postalCode: string; // Used for location-based search
  slug: string; // City slug for URL
}

interface LieferandoVenue {
  name: string;
  slug: string;
  address: string;
  city: string;
  country: string;
  rating?: number;
  reviewCount?: number;
  deliveryTime?: string;
  deliveryFee?: string;
  cuisineTypes: string[];
  productUrl: string;
}

interface LieferandoMenuItem {
  name: string;
  description?: string;
  price: number;
  currency: string;
  category?: string;
}

interface LieferandoScrapedData {
  venue: LieferandoVenue;
  menuItems: LieferandoMenuItem[];
}

const DEFAULT_CONFIG: LieferandoScraperConfig = {
  headless: true,
  minDelay: 3000,
  maxDelay: 7000,
  maxVenuesPerCity: 10,
};

// Default cities to search - focused on major German cities
const DEFAULT_CITIES: LieferandoCity[] = [
  { name: 'Berlin', country: 'DE', postalCode: '10115', slug: 'berlin' },
  { name: 'Munich', country: 'DE', postalCode: '80331', slug: 'muenchen' },
  { name: 'Hamburg', country: 'DE', postalCode: '20095', slug: 'hamburg' },
  { name: 'Frankfurt', country: 'DE', postalCode: '60311', slug: 'frankfurt-am-main' },
  { name: 'Stuttgart', country: 'DE', postalCode: '70173', slug: 'stuttgart' },
  { name: 'Cologne', country: 'DE', postalCode: '50667', slug: 'koeln' },
  { name: 'Düsseldorf', country: 'DE', postalCode: '40213', slug: 'duesseldorf' },
  { name: 'Vienna', country: 'AT', postalCode: '1010', slug: 'wien' },
];

// Known restaurant slugs with Planted products (discovered via WebSearch)
const KNOWN_PLANTED_RESTAURANTS: Array<{ slug: string; city: string; country: 'DE' | 'AT' | 'NL' }> = [
  { slug: 'doen-doen-planted-kebap-berlin', city: 'Berlin', country: 'DE' },
  { slug: 'doen-doen-planted-kebap-stuttgart', city: 'Stuttgart', country: 'DE' },
  { slug: 'doen-doen-planted-burger', city: 'Stuttgart', country: 'DE' },
  { slug: 'doen-doen-kebap', city: 'Stuttgart', country: 'DE' },
];

// Lieferando domain mapping
const LIEFERANDO_DOMAINS: Record<string, string> = {
  DE: 'www.lieferando.de',
  AT: 'www.lieferando.at',
  NL: 'www.thuisbezorgd.nl',
};

export class LieferandoScraper {
  private config: LieferandoScraperConfig;
  private browser: Browser | null = null;
  private page: Page | null = null;
  private results: LieferandoScrapedData[] = [];
  private verbose: boolean = false;

  constructor(config: LieferandoScraperConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    if (!this.config.cities) {
      this.config.cities = DEFAULT_CITIES;
    }
  }

  async run(options: ScraperOptions = {}): Promise<ScraperResult> {
    this.verbose = options.verbose ?? false;

    const result: ScraperResult = {
      success: true,
      stats: { created: 0, updated: 0, unchanged: 0, failed: 0 },
      errors: [],
    };

    try {
      this.log('Initializing stealth browser for Lieferando...');
      this.browser = await createStealthBrowser({
        headless: this.config.headless,
        slowMo: 100,
      });

      this.page = await this.browser.newPage();
      await configurePage(this.page, {
        minDelay: this.config.minDelay,
        maxDelay: this.config.maxDelay,
      });

      // First, try known Planted restaurants
      this.log('Scraping known Planted restaurants...');
      await this.scrapeKnownRestaurants(options);

      // Then search in each city for "planted"
      if (this.results.length < (options.maxItems || 50)) {
        this.log('Searching for additional Planted restaurants...');
        await this.searchCitiesForPlanted(options);
      }

      // Log and output results
      this.logResults();

      result.stats.created = this.results.length;
      result.success = this.results.length > 0;

      // Save to database if not dry run
      if (!options.dryRun && this.results.length > 0) {
        await this.saveToDatabase();
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log(`Fatal error: ${errorMessage}`, 'error');
      result.errors?.push(errorMessage);
      result.success = false;
    } finally {
      if (this.browser) {
        await closeBrowser(this.browser);
      }
    }

    return result;
  }

  private async scrapeKnownRestaurants(options: ScraperOptions): Promise<void> {
    if (!this.page) return;

    const limit = Math.min(
      options.maxItems || this.config.maxVenuesPerCity || 10,
      KNOWN_PLANTED_RESTAURANTS.length
    );

    for (let i = 0; i < limit; i++) {
      const restaurant = KNOWN_PLANTED_RESTAURANTS[i];
      const domain = LIEFERANDO_DOMAINS[restaurant.country];
      const menuPath = restaurant.country === 'NL' ? 'menu' : 'speisekarte';
      const restaurantUrl = `https://${domain}/${menuPath}/${restaurant.slug}`;

      this.log(`Fetching known restaurant ${i + 1}/${limit}: ${restaurant.slug}`);

      try {
        await randomDelay(this.config.minDelay!, this.config.maxDelay!);

        const navigated = await safeNavigate(this.page, restaurantUrl, {
          minDelay: 2000,
          maxDelay: 4000,
        });

        if (!navigated) {
          this.log(`  Failed to navigate to ${restaurant.slug}`, 'warn');
          continue;
        }

        // Check for blocking/CAPTCHA
        if (await isBlocked(this.page)) {
          this.log('Blocking detected - waiting...', 'warn');
          if (!this.config.headless) {
            this.log('Waiting 30 seconds for manual intervention...');
            await randomDelay(30000, 35000);
          }
          if (await isBlocked(this.page)) {
            this.log('Still blocked, skipping...', 'warn');
            break;
          }
        }

        // Human-like scrolling to load lazy content
        await humanScroll(this.page);
        await randomDelay(1000, 2000);

        // Extract restaurant data
        const data = await this.extractRestaurantData(restaurantUrl, restaurant.city, restaurant.country);
        if (data && data.menuItems.length > 0) {
          this.results.push(data);
          this.log(`  Found ${data.menuItems.length} Planted menu items at ${data.venue.name}`);
        }
      } catch (error) {
        this.log(`Error fetching ${restaurant.slug}: ${error}`, 'warn');
      }
    }
  }

  private async searchCitiesForPlanted(options: ScraperOptions): Promise<void> {
    if (!this.page) return;

    const seenSlugs = new Set(this.results.map(r => r.venue.slug));

    for (const city of this.config.cities!) {
      if (this.results.length >= (options.maxItems || 50)) break;

      this.log(`Searching for Planted restaurants in ${city.name}...`);

      try {
        const domain = LIEFERANDO_DOMAINS[city.country];
        // Search URL format varies by country
        const searchUrl = city.country === 'NL'
          ? `https://${domain}/eten-bestellen/${city.slug}`
          : `https://${domain}/lieferservice/essen/${city.slug}`;

        await randomDelay(this.config.minDelay!, this.config.maxDelay!);

        const navigated = await safeNavigate(this.page, searchUrl, {
          minDelay: 2000,
          maxDelay: 4000,
        });

        if (!navigated) {
          this.log(`  Failed to navigate to ${city.name} search`, 'warn');
          continue;
        }

        // Check for blocking
        if (await isBlocked(this.page)) {
          this.log('Blocking detected during city search', 'warn');
          break;
        }

        // Wait for page to load
        await randomDelay(3000, 5000);
        await humanScroll(this.page);
        await randomDelay(1000, 2000);

        // Find restaurant links
        const restaurantLinks = await this.findPlantedRestaurants();

        this.log(`  Found ${restaurantLinks.length} potential Planted restaurants`);

        // Visit each restaurant
        for (const link of restaurantLinks.slice(0, this.config.maxVenuesPerCity! - this.results.length)) {
          const slug = this.extractSlugFromUrl(link.href);
          if (seenSlugs.has(slug)) continue;
          seenSlugs.add(slug);

          try {
            await randomDelay(this.config.minDelay!, this.config.maxDelay!);

            const navigated = await safeNavigate(this.page, link.href, {
              minDelay: 2000,
              maxDelay: 4000,
            });

            if (!navigated) continue;

            await humanScroll(this.page);
            await randomDelay(1000, 2000);

            const data = await this.extractRestaurantData(link.href, city.name, city.country);
            if (data && data.menuItems.length > 0) {
              this.results.push(data);
              this.log(`    Found ${data.menuItems.length} Planted items at ${data.venue.name}`);
            }
          } catch (error) {
            this.log(`Error scraping ${slug}: ${error}`, 'warn');
          }
        }
      } catch (error) {
        this.log(`Error searching ${city.name}: ${error}`, 'warn');
      }
    }
  }

  private async findPlantedRestaurants(): Promise<Array<{ href: string; text: string }>> {
    if (!this.page) return [];

    try {
      // Look for restaurant cards/links that mention "planted" or "vegan"
      const restaurants = await this.page.$$eval(
        'a[href*="/speisekarte/"], a[href*="/menu/"]',
        (links) => {
          return links
            .map(link => ({
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              href: (link as any).href as string,
              text: (link.textContent?.trim() || '').toLowerCase(),
              // Check parent elements for planted mentions
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              parentText: ((link as any).closest('[class*="restaurant"], [class*="card"], article')?.textContent || '').toLowerCase(),
            }))
            .filter(l =>
              l.text.includes('planted') ||
              l.text.includes('plant-based') ||
              l.parentText.includes('planted') ||
              l.text.includes('vegan') ||
              l.text.includes('doen doen')
            )
            .map(l => ({ href: l.href, text: l.text }));
        }
      );

      return restaurants;
    } catch (error) {
      this.log(`Error finding restaurants: ${error}`, 'warn');
      return [];
    }
  }

  private async extractRestaurantData(
    url: string,
    city: string,
    country: string
  ): Promise<LieferandoScrapedData | null> {
    if (!this.page) return null;

    try {
      // Wait for restaurant header to load
      await this.page.waitForSelector('h1, [class*="restaurant-name"], [data-qa="restaurant-header-name"]', {
        timeout: 10000,
      }).catch(() => {
        this.log('Restaurant name selector not found...');
      });

      // Extract venue information
      const venueInfo = await this.page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const doc = (globalThis as any).document;

        // Restaurant name
        const nameEl = doc.querySelector('h1, [class*="restaurant-name"], [data-qa="restaurant-header-name"]');
        const name = nameEl?.textContent?.trim() || '';

        // Address
        const addressEl = doc.querySelector('[class*="address"], [data-qa="restaurant-header-address"]');
        const address = addressEl?.textContent?.trim() || '';

        // Rating
        const ratingEl = doc.querySelector('[class*="rating"] [class*="value"], [data-qa="restaurant-rating"]');
        const ratingText = ratingEl?.textContent?.trim() || '';
        const rating = parseFloat(ratingText.replace(',', '.')) || undefined;

        // Review count
        const reviewEl = doc.querySelector('[class*="rating"] [class*="count"], [class*="reviews"]');
        const reviewText = reviewEl?.textContent?.trim() || '';
        const reviewMatch = reviewText.match(/\d+/);
        const reviewCount = reviewMatch ? parseInt(reviewMatch[0], 10) : undefined;

        // Delivery time
        const deliveryTimeEl = doc.querySelector('[class*="delivery-time"], [data-qa="delivery-time"]');
        const deliveryTime = deliveryTimeEl?.textContent?.trim() || undefined;

        // Delivery fee
        const deliveryFeeEl = doc.querySelector('[class*="delivery-fee"], [data-qa="delivery-fee"]');
        const deliveryFee = deliveryFeeEl?.textContent?.trim() || undefined;

        // Cuisine types
        const cuisineEls = doc.querySelectorAll('[class*="cuisine"], [class*="category-tag"]');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cuisineTypes = Array.from(cuisineEls).map((el: any) => el.textContent?.trim() || '').filter(Boolean);

        return {
          name,
          address,
          rating,
          reviewCount,
          deliveryTime,
          deliveryFee,
          cuisineTypes,
        };
      });

      if (!venueInfo.name) {
        this.log('Could not extract restaurant name', 'warn');
        return null;
      }

      // Extract menu items containing "planted"
      const menuItems = await this.extractPlantedMenuItems();

      if (menuItems.length === 0) {
        this.log(`No Planted menu items found at ${venueInfo.name}`);
        return null;
      }

      const slug = this.extractSlugFromUrl(url);
      const currency = country === 'NL' ? 'EUR' : country === 'AT' ? 'EUR' : 'EUR';

      return {
        venue: {
          name: venueInfo.name,
          slug,
          address: venueInfo.address,
          city,
          country,
          rating: venueInfo.rating,
          reviewCount: venueInfo.reviewCount,
          deliveryTime: venueInfo.deliveryTime,
          deliveryFee: venueInfo.deliveryFee,
          cuisineTypes: venueInfo.cuisineTypes,
          productUrl: url,
        },
        menuItems: menuItems.map(item => ({
          ...item,
          currency,
        })),
      };
    } catch (error) {
      this.log(`Error extracting restaurant data: ${error}`, 'warn');
      return null;
    }
  }

  private async extractPlantedMenuItems(): Promise<Array<Omit<LieferandoMenuItem, 'currency'>>> {
    if (!this.page) return [];

    try {
      // Scroll to load menu content
      for (let i = 0; i < 5; i++) {
        await humanScroll(this.page);
        await randomDelay(500, 1000);
      }

      // Try multiple selectors for menu items
      const menuSelectors = [
        '[class*="menu-item"]',
        '[class*="dish-card"]',
        '[data-qa="menu-product"]',
        '[class*="product-card"]',
        'article[class*="dish"]',
      ];

      let menuItemElements: string = '';
      for (const selector of menuSelectors) {
        const count = await this.page.$$eval(selector, els => els.length);
        if (count > 0) {
          menuItemElements = selector;
          this.log(`  Using menu selector: ${selector} (${count} items)`);
          break;
        }
      }

      if (!menuItemElements) {
        // Fallback: try to find all text containing "planted"
        const plantedItems = await this.page.evaluate(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const doc = (globalThis as any).document;
          const items: Array<{ name: string; description?: string; price: number }> = [];

          // Find all elements containing "planted" (case-insensitive)
          const walker = doc.createTreeWalker(
            doc.body,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (globalThis as any).NodeFilter.SHOW_TEXT,
            null
          );

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const plantedNodes: any[] = [];
          while (walker.nextNode()) {
            if (walker.currentNode.textContent?.toLowerCase().includes('planted')) {
              plantedNodes.push(walker.currentNode);
            }
          }

          // For each planted text node, try to extract menu item info
          for (const node of plantedNodes.slice(0, 20)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const parent = (node.parentElement as any)?.closest('[class*="item"], [class*="product"], [class*="dish"], article');
            if (parent) {
              const nameEl = parent.querySelector('h3, h4, [class*="name"], [class*="title"]');
              const descEl = parent.querySelector('p, [class*="description"]');
              const priceEl = parent.querySelector('[class*="price"]');

              const name = nameEl?.textContent?.trim() || node.textContent?.trim() || '';
              if (name && name.length > 2) {
                const priceText = priceEl?.textContent?.trim() || '';
                const priceMatch = priceText.match(/[\d,.]+/);
                const price = priceMatch ? parseFloat(priceMatch[0].replace(',', '.')) : 0;

                items.push({
                  name,
                  description: descEl?.textContent?.trim() || undefined,
                  price,
                });
              }
            }
          }

          return items;
        });

        return plantedItems.filter((item, index, self) =>
          self.findIndex(i => i.name === item.name) === index
        );
      }

      // Extract from menu items
      const menuItems = await this.page.evaluate((selector) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const doc = (globalThis as any).document;
        const items: Array<{ name: string; description?: string; price: number; category?: string }> = [];

        const elements = doc.querySelectorAll(selector);
        for (const el of elements) {
          const text = el.textContent?.toLowerCase() || '';

          // Only include items mentioning "planted"
          if (!text.includes('planted') && !text.includes('plant-based')) continue;

          const nameEl = el.querySelector('h3, h4, [class*="name"], [class*="title"]');
          const descEl = el.querySelector('p, [class*="description"]');
          const priceEl = el.querySelector('[class*="price"]');
          const categoryEl = el.closest('[class*="category"]')?.querySelector('h2, h3');

          const name = nameEl?.textContent?.trim() || '';
          if (!name) continue;

          const priceText = priceEl?.textContent?.trim() || '';
          const priceMatch = priceText.match(/[\d,.]+/);
          const price = priceMatch ? parseFloat(priceMatch[0].replace(',', '.')) : 0;

          items.push({
            name,
            description: descEl?.textContent?.trim() || undefined,
            price,
            category: categoryEl?.textContent?.trim() || undefined,
          });
        }

        return items;
      }, menuItemElements);

      return menuItems;
    } catch (error) {
      this.log(`Error extracting menu items: ${error}`, 'warn');
      return [];
    }
  }

  private extractSlugFromUrl(url: string): string {
    // Extract slug from URLs like:
    // https://www.lieferando.de/speisekarte/doen-doen-planted-kebap-berlin
    // https://www.thuisbezorgd.nl/menu/restaurant-slug
    const match = url.match(/\/(?:speisekarte|menu)\/([^/?]+)/);
    return match ? match[1] : '';
  }

  private async saveToDatabase(): Promise<void> {
    // TODO: Implement database save
    // This will create/update:
    // 1. Venue entries
    // 2. Dish entries for each Planted menu item
    // 3. Link to delivery platform (Lieferando)
    this.log('Database save not implemented yet - use with --dry-run for now');
  }

  private logResults(): void {
    console.log('\n' + '='.repeat(60));
    console.log('LIEFERANDO - PLANTED RESTAURANTS');
    console.log('='.repeat(60));

    if (this.results.length === 0) {
      console.log('No restaurants found.');
      return;
    }

    for (const data of this.results) {
      console.log(`\n  ${data.venue.name}`);
      console.log(`    City: ${data.venue.city}, ${data.venue.country}`);
      console.log(`    Address: ${data.venue.address}`);
      if (data.venue.rating) {
        console.log(`    Rating: ${data.venue.rating}${data.venue.reviewCount ? ` (${data.venue.reviewCount} reviews)` : ''}`);
      }
      if (data.venue.deliveryTime) console.log(`    Delivery: ${data.venue.deliveryTime}`);
      console.log(`    URL: ${data.venue.productUrl}`);
      console.log(`    Planted Menu Items (${data.menuItems.length}):`);
      for (const item of data.menuItems.slice(0, 5)) {
        console.log(`      - ${item.name} (${item.currency} ${item.price.toFixed(2)})`);
      }
      if (data.menuItems.length > 5) {
        console.log(`      ... and ${data.menuItems.length - 5} more`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`Total restaurants: ${this.results.length}`);
    console.log(`Total Planted menu items: ${this.results.reduce((sum, r) => sum + r.menuItems.length, 0)}`);
    console.log('='.repeat(60) + '\n');

    // Output as JSON
    console.log('JSON output:');
    console.log(JSON.stringify(this.results, null, 2));
  }

  private log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const prefix = '[LieferandoScraper]';
    switch (level) {
      case 'error':
        console.error(`${prefix} ERROR: ${message}`);
        break;
      case 'warn':
        console.warn(`${prefix} WARN: ${message}`);
        break;
      default:
        if (this.verbose || level !== 'info') {
          console.log(`${prefix} ${message}`);
        }
    }
  }
}
