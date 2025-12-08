/**
 * Glovo Delivery Platform Scraper
 *
 * Scrapes restaurants serving Planted dishes from Glovo.
 * Glovo operates in Spain, Italy, and other markets.
 *
 * Markets:
 * - Spain: glovoapp.com/es/es/
 * - Italy: glovoapp.com/it/it/
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

export interface GlovoScraperConfig {
  cities?: Array<{
    name: string;
    country: 'ES' | 'IT';
    slug: string;
  }>;
  headless?: boolean;
  minDelay?: number;
  maxDelay?: number;
  maxVenuesPerCity?: number;
}

interface GlovoVenue {
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

const DEFAULT_CONFIG: GlovoScraperConfig = {
  cities: [
    { name: 'Madrid', country: 'ES', slug: 'madrid' },
    { name: 'Barcelona', country: 'ES', slug: 'barcelona' },
    { name: 'Valencia', country: 'ES', slug: 'valencia' },
    { name: 'Milan', country: 'IT', slug: 'milano' },
    { name: 'Rome', country: 'IT', slug: 'roma' },
    { name: 'Turin', country: 'IT', slug: 'torino' },
  ],
  headless: true,
  minDelay: 3000,
  maxDelay: 7000,
  maxVenuesPerCity: 10,
};

// Country-specific URLs
const COUNTRY_CONFIG: Record<string, { baseUrl: string; lang: string }> = {
  ES: {
    baseUrl: 'https://glovoapp.com/es/es',
    lang: 'es-ES',
  },
  IT: {
    baseUrl: 'https://glovoapp.com/it/it',
    lang: 'it-IT',
  },
};

export class GlovoScraper {
  private config: GlovoScraperConfig;
  private browser: Browser | null = null;
  private page: Page | null = null;
  private venues: GlovoVenue[] = [];
  private verbose: boolean = false;

  constructor(config: GlovoScraperConfig = {}) {
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
      this.log('Initializing stealth browser for Glovo...');
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

    const countryConfig = COUNTRY_CONFIG[city.country];
    if (!countryConfig) {
      this.log(`Unknown country: ${city.country}`, 'warn');
      return;
    }

    // Set locale for country
    await this.page.setExtraHTTPHeaders({
      'Accept-Language': `${countryConfig.lang},en;q=0.9`,
    });

    // Glovo search URL pattern
    const searchUrl = `${countryConfig.baseUrl}/${city.slug}/restaurants/?search=planted`;

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
        'button[data-testid="accept-cookies"]',
        'button[id*="accept"]',
        'button:has-text("Aceptar")',
        'button:has-text("Accetta")',
        'button:has-text("Accept")',
        '#onetrust-accept-btn-handler',
        '.cookie-consent__accept',
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
      await this.page.waitForSelector('[data-testid="store-card"], .store-card, a[href*="/store/"]', {
        timeout: 15000,
      }).catch(() => {
        this.log('Store cards not found, trying alternatives...');
      });

      // Extract restaurant data
      const restaurants = await this.page.$$eval('a[href*="/store/"]', (links, cityData) => {
        const seen = new Set<string>();
        return links
          .map((link: any) => {
            const href = link.href as string;
            const match = href.match(/\/store\/([^/?]+)/);
            if (!match) return null;

            const slug = match[1];
            if (seen.has(slug)) return null;
            seen.add(slug);

            // Find name and other details from nearby elements
            const card = link.closest('[data-testid="store-card"]') ||
                        link.closest('.store-card') ||
                        link.closest('article') || link;
            const nameEl = card.querySelector('h2, h3, [class*="name"], [class*="title"]');
            const ratingEl = card.querySelector('[class*="rating"]');
            const deliveryEl = card.querySelector('[class*="time"], [class*="delivery"]');

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

      // Filter for potential Planted restaurants (vegan/vegetarian/plant-based keywords)
      const plantedRestaurants = restaurants.filter((r: any) => {
        const text = `${r.name} ${r.slug}`.toLowerCase();
        return text.includes('plant') || text.includes('vegan') || text.includes('veggie') ||
               text.includes('vegetarian') || text.includes('verde') || text.includes('green');
      });

      this.log(`Found ${restaurants.length} restaurants, ${plantedRestaurants.length} potentially have Planted`);

      // Add to venues (limit per city)
      const maxPerCity = this.config.maxVenuesPerCity || 10;
      for (const restaurant of plantedRestaurants.slice(0, maxPerCity)) {
        if (!this.venues.find(v => v.slug === restaurant.slug && v.country === city.country)) {
          this.venues.push({
            id: `glovo-${city.country.toLowerCase()}-${restaurant.slug}`,
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
    console.log('GLOVO (ES/IT) - PLANTED RESTAURANTS');
    console.log('='.repeat(60));

    if (this.venues.length === 0) {
      console.log('No Planted restaurants found.');
      console.log('\nNote: Planted may have limited restaurant presence on Glovo.');
      console.log('Try running with --headful to debug or verify manually.');
      return;
    }

    // Group by city
    const byCity = this.venues.reduce((acc, v) => {
      const key = `${v.city}, ${v.country}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(v);
      return acc;
    }, {} as Record<string, GlovoVenue[]>);

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
    const prefix = '[GlovoScraper]';
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
