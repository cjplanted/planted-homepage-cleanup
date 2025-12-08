/**
 * Browser-based Wolt Scraper using Puppeteer with stealth mode
 *
 * FREE alternative to API-based scraping that avoids rate limits.
 *
 * Cost breakdown:
 * - Local: $0
 * - Cloud Run: ~$5-10/month (pay per invocation)
 * - Small VPS: $5-10/month
 *
 * Install dependencies:
 *   pnpm add puppeteer puppeteer-extra puppeteer-extra-plugin-stealth
 */

import { BaseScraper } from '../../base/BaseScraper.js';
import { sleep } from '../../utils/queue.js';
import { dishes, venues } from '@pad/database';
import { createVenueInputSchema, type Dish, type Venue } from '@pad/core';
import type { Browser, Page } from 'puppeteer';

// Types
interface WoltCity {
  name: string;
  country: string;
  lat: number;
  lon: number;
  woltSlug: string; // e.g., "berlin" for wolt.com/en/deu/berlin
}

interface WoltScrapedVenue {
  name: string;
  slug: string;
  address: string;
  city: string;
  country: string;
  url: string;
}

interface WoltScrapedDish {
  name: string;
  description?: string;
  price?: number;
  imageUrl?: string;
}

interface WoltBrowserScrapedData {
  venue: WoltScrapedVenue;
  dishes: WoltScrapedDish[];
  city: WoltCity;
}

export interface WoltBrowserScraperConfig {
  cities?: WoltCity[];
  searchTerms?: string[];
  maxVenuesPerCity?: number;
  maxDishesPerVenue?: number;
  headless?: boolean;
  minDelay?: number;
  maxDelay?: number;
}

// Default cities - Wolt uses 3-letter ISO country codes in URLs (deu, aut, che)
const DEFAULT_CITIES: WoltCity[] = [
  { name: 'Berlin', country: 'DE', lat: 52.52, lon: 13.405, woltSlug: 'berlin' },
  { name: 'Munich', country: 'DE', lat: 48.1351, lon: 11.582, woltSlug: 'munich' },
  { name: 'Hamburg', country: 'DE', lat: 53.5511, lon: 9.9937, woltSlug: 'hamburg' },
  { name: 'Frankfurt', country: 'DE', lat: 50.1109, lon: 8.6821, woltSlug: 'frankfurt' },
  { name: 'Vienna', country: 'AT', lat: 48.2082, lon: 16.3738, woltSlug: 'vienna' },
  { name: 'Zurich', country: 'CH', lat: 47.3769, lon: 8.5417, woltSlug: 'zurich' },
];

// Map 2-letter to 3-letter Wolt country codes
const WOLT_COUNTRY_CODES: Record<string, string> = {
  DE: 'deu',
  AT: 'aut',
  CH: 'che',
};

// Search terms - "planted" first, then "vegan" as fallback
const DEFAULT_SEARCH_TERMS = ['planted', 'vegan'];

const PLANTED_KEYWORDS: Record<string, string[]> = {
  'planted.chicken': ['planted chicken', 'plant chicken', 'planted huhn'],
  'planted.kebab': ['planted kebab', 'planted döner'],
  'planted.pulled': ['planted pulled'],
  'planted.schnitzel': ['planted schnitzel'],
};

export class WoltBrowserScraper extends BaseScraper<WoltBrowserScrapedData, { venue: Venue; dishes: Dish[] }> {
  protected readonly name = 'Wolt Browser Scraper (DE/AT)';
  protected readonly scraperId = 'wolt-browser-de-at';
  protected readonly targetCollection = 'venues';

  private readonly config: WoltBrowserScraperConfig;
  private browser: Browser | null = null;

  constructor(config?: Partial<WoltBrowserScraperConfig>) {
    super();
    this.config = {
      cities: config?.cities || DEFAULT_CITIES,
      searchTerms: config?.searchTerms || DEFAULT_SEARCH_TERMS,
      maxVenuesPerCity: config?.maxVenuesPerCity || 10,
      maxDishesPerVenue: config?.maxDishesPerVenue || 20,
      headless: config?.headless ?? true,
      minDelay: config?.minDelay || 3000,
      maxDelay: config?.maxDelay || 7000,
    };
  }

  private async initBrowser(): Promise<Browser> {
    if (this.browser) return this.browser;

    // Dynamic imports
    const {
      createStealthBrowser,
    } = await import('../../browser/BrowserScraper.js');

    this.browser = await createStealthBrowser({
      headless: this.config.headless,
      minDelay: this.config.minDelay,
      maxDelay: this.config.maxDelay,
    });

    return this.browser;
  }

  private async closeBrowserInstance(): Promise<void> {
    if (this.browser) {
      const { closeBrowser } = await import('../../browser/BrowserScraper.js');
      await closeBrowser(this.browser);
      this.browser = null;
    }
  }

  private randomDelay(): Promise<void> {
    const delay = this.config.minDelay! + Math.random() * (this.config.maxDelay! - this.config.minDelay!);
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  protected async fetchData(): Promise<WoltBrowserScrapedData[]> {
    const results: WoltBrowserScrapedData[] = [];

    try {
      const browser = await this.initBrowser();
      const {
        configurePage,
        safeNavigate,
        humanScroll,
        isBlocked,
      } = await import('../../browser/BrowserScraper.js');

      for (const city of this.config.cities!) {
        this.log(`Searching in ${city.name}, ${city.country}...`);

        const page = await browser.newPage();
        await configurePage(page, {
          minDelay: this.config.minDelay,
          maxDelay: this.config.maxDelay,
        });

        try {
          const cityResults = await this.scrapeCity(page, city, safeNavigate, humanScroll, isBlocked);
          results.push(...cityResults);
        } catch (error) {
          this.log(`Error scraping ${city.name}: ${error}`, 'error');
        } finally {
          await page.close();
        }

        // Long delay between cities
        await sleep(10000 + Math.random() * 5000);
      }
    } finally {
      await this.closeBrowserInstance();
    }

    return results;
  }

  private async scrapeCity(
    page: Page,
    city: WoltCity,
    safeNavigate: (page: Page, url: string, options?: Record<string, unknown>) => Promise<boolean>,
    humanScroll: (page: Page) => Promise<void>,
    isBlocked: (page: Page) => Promise<boolean>
  ): Promise<WoltBrowserScrapedData[]> {
    const results: WoltBrowserScrapedData[] = [];
    const seenVenues = new Set<string>();

    for (const term of this.config.searchTerms!) {
      if (results.length >= this.config.maxVenuesPerCity!) break;

      // Construct search URL - Wolt uses 3-letter country codes (deu, aut, che)
      const countryCode = WOLT_COUNTRY_CODES[city.country] || city.country.toLowerCase();
      const searchUrl = `https://wolt.com/en/${countryCode}/${city.woltSlug}/search?q=${encodeURIComponent(term)}`;

      this.log(`Searching for "${term}" at ${searchUrl}`);

      const success = await safeNavigate(page, searchUrl, {
        minDelay: this.config.minDelay,
        maxDelay: this.config.maxDelay,
      });

      if (!success) {
        this.log(`Failed to navigate to search page`, 'warn');
        continue;
      }

      // Check for blocks
      if (await isBlocked(page)) {
        this.log(`Detected blocking on ${city.name}, skipping...`, 'warn');
        break;
      }

      // Wait for React to render (Wolt is a SPA)
      this.log('Waiting for page to render...');
      await sleep(5000);

      // Scroll to load more results and trigger lazy loading
      for (let i = 0; i < 5; i++) {
        await humanScroll(page);
        await sleep(2000);
      }

      // Wait more after scrolling
      await sleep(3000);

      // Debug: log all links on page
      const allLinks = await page.$$eval('a', links =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        links.map(l => (l as any).href as string).filter(h => h && (h.includes('restaurant') || h.includes('venue')))
      );
      this.log(`Debug: Found ${allLinks.length} restaurant/venue links on page`);
      if (allLinks.length > 0 && allLinks.length <= 5) {
        allLinks.forEach(l => this.log(`  - ${l}`));
      }

      // Try multiple selectors for restaurant links (Wolt changes these)
      const selectors = [
        'a[href*="/restaurant/"]',
        'a[href*="/venue/"]',
        '[data-test-id="venueCard"] a',
        '[data-test-id*="venue"] a',
        '[class*="VenueCard"] a',
        '[class*="venue-card"] a',
        'a[data-venue-id]',
      ];

      let venueLinks: { href: string; text: string }[] = [];

      for (const selector of selectors) {
        try {
          const links = await page.$$eval(
            selector,
            (els) => els.map(link => ({
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              href: (link as any).href as string,
              text: link.textContent?.trim() || '',
            })).filter(l => l.href && !l.href.includes('/search'))
          );
          if (links.length > 0) {
            this.log(`Found ${links.length} venues using selector: ${selector}`);
            venueLinks = links;
            break;
          }
        } catch {
          // Selector not found, try next
        }
      }

      this.log(`Found ${venueLinks.length} venue links`);

      // Visit each venue
      for (const link of venueLinks.slice(0, this.config.maxVenuesPerCity! - results.length)) {
        const slug = link.href.split('/restaurant/')[1]?.split('?')[0];
        if (!slug || seenVenues.has(slug)) continue;
        seenVenues.add(slug);

        try {
          const venueData = await this.scrapeVenue(page, link.href, city, safeNavigate, isBlocked);
          if (venueData && venueData.dishes.length > 0) {
            results.push(venueData);
            this.log(`Found ${venueData.dishes.length} planted dishes at ${venueData.venue.name}`);
          }
        } catch (error) {
          this.log(`Error scraping venue ${slug}: ${error}`, 'warn');
        }

        await this.randomDelay();
      }

      await this.randomDelay();
    }

    return results;
  }

  private async scrapeVenue(
    page: Page,
    url: string,
    city: WoltCity,
    safeNavigate: (page: Page, url: string, options?: Record<string, unknown>) => Promise<boolean>,
    isBlocked: (page: Page) => Promise<boolean>
  ): Promise<WoltBrowserScrapedData | null> {
    const success = await safeNavigate(page, url, {
      minDelay: this.config.minDelay,
      maxDelay: this.config.maxDelay,
    });

    if (!success) return null;
    if (await isBlocked(page)) return null;

    // Extract venue info
    const venueName = await page.$eval(
      'h1, [data-test-id="venue-header-title"]',
      el => el.textContent?.trim() || ''
    ).catch(() => '');

    if (!venueName) return null;

    const venueAddress = await page.$eval(
      '[data-test-id="venue-header-address"], .venue-address',
      el => el.textContent?.trim() || ''
    ).catch(() => city.name);

    // Scroll to load menu
    for (let i = 0; i < 5; i++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await page.evaluate(() => (globalThis as any).window.scrollBy(0, 500));
      await sleep(500);
    }

    // Extract menu items containing "planted"
    const menuItems = await page.$$eval(
      '[data-test-id="menu-item"], .menu-item, [class*="MenuItem"]',
      (items) => items.map(item => ({
        name: item.querySelector('h3, [class*="name"], [class*="title"]')?.textContent?.trim() || '',
        description: item.querySelector('p, [class*="description"]')?.textContent?.trim() || '',
        price: item.querySelector('[class*="price"]')?.textContent?.trim() || '',
        image: item.querySelector('img')?.src || '',
      }))
    );

    // Filter for planted items
    const plantedItems = menuItems.filter(item => {
      const text = `${item.name} ${item.description}`.toLowerCase();
      return text.includes('planted') || text.includes('plant-based');
    });

    if (plantedItems.length === 0) return null;

    const slug = url.split('/restaurant/')[1]?.split('?')[0] || '';

    return {
      venue: {
        name: venueName,
        slug,
        address: venueAddress,
        city: city.name,
        country: city.country,
        url,
      },
      dishes: plantedItems.slice(0, this.config.maxDishesPerVenue).map(item => ({
        name: item.name,
        description: item.description || undefined,
        price: this.parsePrice(item.price),
        imageUrl: item.image || undefined,
      })),
      city,
    };
  }

  private parsePrice(priceStr: string): number | undefined {
    if (!priceStr) return undefined;
    const match = priceStr.match(/[\d,.]+/);
    if (!match) return undefined;
    return parseFloat(match[0].replace(',', '.'));
  }

  protected async transform(data: WoltBrowserScrapedData): Promise<{ venue: Venue; dishes: Dish[] } | null> {
    const { venue: scrapedVenue, dishes: scrapedDishes, city } = data;

    const venue: Venue = {
      id: '',
      type: 'restaurant',
      name: scrapedVenue.name,
      location: {
        latitude: city.lat,
        longitude: city.lon,
      },
      address: {
        street: scrapedVenue.address,
        city: city.name,
        postal_code: '00000',
        country: city.country,
      },
      opening_hours: { regular: {} },
      contact: {
        website: scrapedVenue.url,
      },
      source: {
        type: 'scraped',
        url: scrapedVenue.url,
        scraper_id: this.scraperId,
      },
      status: 'active',
      last_verified: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
    };

    const transformedDishes: Dish[] = scrapedDishes.map((dish) => ({
      id: '',
      venue_id: '',
      name: dish.name,
      description: dish.description || 'Planted dish',
      planted_products: this.detectPlantedProducts(dish.name, dish.description),
      price: {
        amount: dish.price || 0,
        currency: 'EUR',
      },
      image_url: dish.imageUrl,
      dietary_tags: ['plant-based', 'vegan'],
      availability: { type: 'permanent' },
      delivery_partners: [{
        partner: 'wolt',
        url: scrapedVenue.url,
      }],
      source: {
        type: 'scraped',
        url: scrapedVenue.url,
        scraper_id: this.scraperId,
      },
      status: 'active',
      last_verified: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
    }));

    return { venue, dishes: transformedDishes };
  }

  private detectPlantedProducts(name: string, description?: string): string[] {
    const text = `${name} ${description || ''}`.toLowerCase();
    const detected: string[] = [];

    for (const [product, keywords] of Object.entries(PLANTED_KEYWORDS)) {
      if (keywords.some(kw => text.includes(kw))) {
        detected.push(product);
      }
    }

    if (detected.length === 0 && text.includes('planted')) {
      detected.push('planted.chicken');
    }

    return detected;
  }

  protected async validate(data: { venue: Venue; dishes: Dish[] }): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];

    const venueResult = createVenueInputSchema.safeParse({
      type: data.venue.type,
      name: data.venue.name,
      address: data.venue.address,
      location: data.venue.location,
      opening_hours: data.venue.opening_hours,
      source: data.venue.source,
      status: data.venue.status,
    });

    if (!venueResult.success) {
      errors.push(...venueResult.error.issues.map(i => `Venue: ${i.path.join('.')}: ${i.message}`));
    }

    for (const dish of data.dishes) {
      if (!dish.name || dish.name.length < 2) {
        errors.push(`Dish: Name too short - "${dish.name}"`);
      }
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  protected async save(data: { venue: Venue; dishes: Dish[] }): Promise<{ action: 'created' | 'updated' | 'unchanged'; id: string }> {
    const { venue, dishes: dishesToSave } = data;

    let venueId: string;
    let venueAction: 'created' | 'updated' | 'unchanged' = 'unchanged';

    const existingVenues = await venues.query({
      status: 'active',
      country: venue.address.country,
    });

    const matchingVenue = existingVenues.find(
      v => v.name.toLowerCase() === venue.name.toLowerCase() &&
           v.address.city.toLowerCase() === venue.address.city.toLowerCase()
    );

    if (matchingVenue) {
      venueId = matchingVenue.id;
      await venues.update(venueId, { last_verified: new Date() });
    } else {
      const created = await venues.create({
        type: venue.type,
        name: venue.name,
        address: venue.address,
        location: venue.location,
        opening_hours: venue.opening_hours,
        contact: venue.contact,
        source: venue.source,
        status: venue.status,
        last_verified: new Date(),
      });
      venueId = created.id;
      venueAction = 'created';
    }

    let dishesCreated = 0;

    for (const dish of dishesToSave) {
      dish.venue_id = venueId;

      const existingDishes = await dishes.getByVenue(venueId, false);
      const matchingDish = existingDishes.find(
        d => d.name.toLowerCase() === dish.name.toLowerCase()
      );

      if (matchingDish) {
        await dishes.update(matchingDish.id, { last_verified: new Date() });
      } else {
        await dishes.create({
          venue_id: venueId,
          name: dish.name,
          description: dish.description,
          planted_products: dish.planted_products,
          price: dish.price,
          image_url: dish.image_url,
          dietary_tags: dish.dietary_tags,
          availability: dish.availability,
          delivery_partners: dish.delivery_partners,
          source: dish.source,
          status: dish.status,
          last_verified: new Date(),
        });
        dishesCreated++;
      }
    }

    this.log(`Venue ${venue.name}: ${venueAction}, Dishes: ${dishesCreated} created`);

    return {
      action: venueAction === 'created' || dishesCreated > 0 ? 'created' : 'unchanged',
      id: venueId,
    };
  }
}
