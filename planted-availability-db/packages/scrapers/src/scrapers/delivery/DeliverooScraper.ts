/**
 * Deliveroo Delivery Platform Scraper
 *
 * Scrapes restaurants serving Planted dishes from Deliveroo.
 * Deliveroo operates in UK, France, Belgium, Netherlands, Italy, and more.
 *
 * Strategy:
 * - Use browser to search for "planted" in different cities
 * - Extract restaurant details and menu items containing "planted"
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

export interface DeliverooScraperConfig {
  cities?: Array<{
    name: string;
    country: 'UK' | 'FR' | 'BE' | 'NL' | 'IT';
    slug: string;
  }>;
  headless?: boolean;
  minDelay?: number;
  maxDelay?: number;
  maxVenuesPerCity?: number;
}

interface DeliverooVenue {
  id: string;
  name: string;
  slug: string;
  city: string;
  country: string;
  rating?: number;
  deliveryTime?: string;
  menuUrl: string;
  plantedDishes: string[];
}

const DEFAULT_CONFIG: DeliverooScraperConfig = {
  cities: [
    { name: 'London', country: 'UK', slug: 'london' },
    { name: 'Manchester', country: 'UK', slug: 'manchester' },
    { name: 'Birmingham', country: 'UK', slug: 'birmingham' },
    { name: 'Paris', country: 'FR', slug: 'paris' },
    { name: 'Lyon', country: 'FR', slug: 'lyon' },
    { name: 'Marseille', country: 'FR', slug: 'marseille' },
  ],
  headless: true,
  minDelay: 3000,
  maxDelay: 7000,
  maxVenuesPerCity: 10,
};

// Country-specific domains
const COUNTRY_DOMAINS: Record<string, string> = {
  UK: 'deliveroo.co.uk',
  FR: 'deliveroo.fr',
  BE: 'deliveroo.be',
  NL: 'deliveroo.nl',
  IT: 'deliveroo.it',
};

export class DeliverooScraper {
  private config: DeliverooScraperConfig;
  private browser: Browser | null = null;
  private page: Page | null = null;
  private venues: DeliverooVenue[] = [];
  private verbose: boolean = false;

  constructor(config: DeliverooScraperConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async run(options: ScraperOptions = {}): Promise<ScraperResult> {
    this.verbose = options.verbose ?? false;

    const result: ScraperResult = {
      success: true,
      stats: { created: 0, updated: 0, unchanged: 0, failed: 0 },
      errors: [],
    };

    try {
      this.log('Initializing stealth browser for Deliveroo...');
      this.browser = await createStealthBrowser({
        headless: this.config.headless,
        slowMo: 100,
      });

      this.page = await this.browser.newPage();
      await configurePage(this.page, {
        minDelay: this.config.minDelay,
        maxDelay: this.config.maxDelay,
      });

      const cities = this.config.cities || DEFAULT_CONFIG.cities!;

      for (const city of cities) {
        if (this.venues.length >= (this.config.maxVenuesPerCity || 10) * cities.length) break;

        this.log(`\nSearching for Planted restaurants in ${city.name}, ${city.country}...`);

        try {
          await this.searchCity(city);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.log(`Error scraping ${city.name}: ${errorMessage}`, 'warn');
          result.errors?.push(`${city.name}: ${errorMessage}`);
        }

        // Delay between cities
        await randomDelay(this.config.minDelay!, this.config.maxDelay!);
      }

      // Log results
      this.logVenues();

      result.stats.created = this.venues.length;
      result.success = this.venues.length > 0;

      // Save to database if not dry run
      if (!options.dryRun && this.venues.length > 0) {
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

  private async searchCity(city: { name: string; country: string; slug: string }): Promise<void> {
    if (!this.page) return;

    const domain = COUNTRY_DOMAINS[city.country] || 'deliveroo.co.uk';
    const searchUrl = `https://${domain}/restaurants/${city.slug}?q=planted`;

    const navigated = await safeNavigate(this.page, searchUrl, {
      minDelay: this.config.minDelay,
      maxDelay: this.config.maxDelay,
    });

    if (!navigated) {
      this.log(`Failed to navigate to ${city.name}`, 'warn');
      return;
    }

    // Handle cookie consent
    await this.handleCookieConsent();

    // Check for blocking
    if (await isBlocked(this.page)) {
      this.log('CAPTCHA detected', 'warn');
      if (!this.config.headless) {
        this.log('Waiting 30 seconds for manual CAPTCHA solve...');
        await randomDelay(30000, 35000);
      }
      if (await isBlocked(this.page)) {
        throw new Error('Blocked by CAPTCHA');
      }
    }

    // Human-like scrolling
    await humanScroll(this.page);
    await randomDelay(2000, 4000);

    // Extract restaurants from search results
    await this.extractRestaurants(city);
  }

  private async handleCookieConsent(): Promise<void> {
    if (!this.page) return;

    try {
      const consentSelectors = [
        'button[data-test-id="accept-button"]',
        'button[data-consent="accept"]',
        'button:has-text("Accept all")',
        'button:has-text("Accept All Cookies")',
        'button:has-text("Tout accepter")',
        '#onetrust-accept-btn-handler',
      ];

      for (const selector of consentSelectors) {
        try {
          const button = await this.page.$(selector);
          if (button) {
            this.log('Found cookie consent button, clicking...');
            await button.click();
            await randomDelay(1000, 2000);
            break;
          }
        } catch {
          // Try next selector
        }
      }
    } catch (error) {
      this.log('Cookie consent handling failed (non-critical)', 'warn');
    }
  }

  private async extractRestaurants(city: { name: string; country: string; slug: string }): Promise<void> {
    if (!this.page) return;

    try {
      // Wait for restaurant list
      await this.page.waitForSelector('[data-test-id="restaurant-card"], [class*="RestaurantCard"], a[href*="/menu/"]', {
        timeout: 15000,
      }).catch(() => {
        this.log('Restaurant cards not found, trying alternatives...');
      });

      // Extract restaurant data
      const restaurants = await this.page.$$eval('a[href*="/menu/"]', (links, cityData) => {
        const seen = new Set<string>();
        return links
          .map((link: any) => {
            const href = link.href as string;
            const match = href.match(/\/menu\/([^/?]+)/);
            if (!match) return null;

            const slug = match[1];
            if (seen.has(slug)) return null;
            seen.add(slug);

            // Find name from nearby elements
            const card = link.closest('[data-test-id="restaurant-card"]') || link.closest('article') || link;
            const nameEl = card.querySelector('h2, h3, [class*="name"], [class*="title"]');
            const ratingEl = card.querySelector('[class*="rating"], [data-test-id="rating"]');
            const deliveryEl = card.querySelector('[class*="time"], [data-test-id="delivery-time"]');

            return {
              slug,
              name: nameEl?.textContent?.trim() || slug,
              rating: ratingEl?.textContent?.trim(),
              deliveryTime: deliveryEl?.textContent?.trim(),
              menuUrl: href,
              city: cityData.name,
              country: cityData.country,
            };
          })
          .filter((r: any): r is NonNullable<typeof r> => r !== null);
      }, city);

      // Filter for potential Planted restaurants
      const plantedRestaurants = restaurants.filter((r: any) => {
        const text = `${r.name} ${r.slug}`.toLowerCase();
        return text.includes('plant') || text.includes('vegan') || text.includes('veggie');
      });

      this.log(`Found ${restaurants.length} restaurants, ${plantedRestaurants.length} potentially have Planted`);

      // Add to venues (limit per city)
      const maxPerCity = this.config.maxVenuesPerCity || 10;
      for (const restaurant of plantedRestaurants.slice(0, maxPerCity)) {
        if (!this.venues.find(v => v.slug === restaurant.slug)) {
          this.venues.push({
            id: `deliveroo-${city.country.toLowerCase()}-${restaurant.slug}`,
            name: restaurant.name,
            slug: restaurant.slug,
            city: city.name,
            country: city.country,
            rating: restaurant.rating ? parseFloat(restaurant.rating) : undefined,
            deliveryTime: restaurant.deliveryTime,
            menuUrl: restaurant.menuUrl,
            plantedDishes: [],
          });

          if (this.verbose) {
            this.log(`  Found: ${restaurant.name}`);
          }
        }
      }
    } catch (error) {
      this.log(`Error extracting restaurants: ${error}`, 'warn');
    }
  }

  private async saveToDatabase(): Promise<void> {
    this.log('Database save not implemented yet - use with --dry-run for now');
  }

  private logVenues(): void {
    console.log('\n' + '='.repeat(60));
    console.log('DELIVEROO - PLANTED RESTAURANTS');
    console.log('='.repeat(60));

    if (this.venues.length === 0) {
      console.log('No Planted restaurants found.');
      console.log('\nNote: Planted may have limited restaurant presence on Deliveroo.');
      console.log('Try running with --headful to debug or verify manually.');
      return;
    }

    // Group by city
    const byCity = this.venues.reduce((acc, v) => {
      const key = `${v.city}, ${v.country}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(v);
      return acc;
    }, {} as Record<string, DeliverooVenue[]>);

    for (const [city, venues] of Object.entries(byCity)) {
      console.log(`\n  ${city}:`);
      for (const venue of venues) {
        console.log(`    - ${venue.name}`);
        if (venue.rating) console.log(`      Rating: ${venue.rating}`);
        if (venue.deliveryTime) console.log(`      Delivery: ${venue.deliveryTime}`);
        console.log(`      URL: ${venue.menuUrl}`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`Total venues: ${this.venues.length}`);
    console.log('='.repeat(60) + '\n');

    console.log('JSON output:');
    console.log(JSON.stringify(this.venues, null, 2));
  }

  private log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const prefix = '[DeliverooScraper]';
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
