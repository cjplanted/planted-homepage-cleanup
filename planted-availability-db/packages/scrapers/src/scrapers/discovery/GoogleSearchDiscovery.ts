/**
 * Google Search-based Discovery Tool for Planted Restaurant Partners
 *
 * Uses browser automation to search Google for Planted restaurant partners
 * and extract restaurant information from search results.
 *
 * This is a discovery tool, not a full scraper - it helps identify
 * potential restaurant partners that can then be verified and added manually.
 */

import type { Browser, Page } from 'puppeteer';
import {
  createStealthBrowser,
  configurePage,
  safeNavigate,
  randomDelay,
  humanScroll,
  closeBrowser,
} from '../../browser/BrowserScraper.js';

export interface GoogleSearchDiscoveryConfig {
  cities?: Array<{
    name: string;
    country: string;
  }>;
  headless?: boolean;
  minDelay?: number;
  maxDelay?: number;
  maxResultsPerCity?: number;
  maxSearchesPerCity?: number;  // Limit number of search queries per city
}

interface DiscoveredRestaurant {
  name: string;
  url: string;
  snippet: string;
  city: string;
  country: string;
  source: string;
  searchQuery: string;
}

interface DiscoveryResult {
  success: boolean;
  stats: {
    created: number;
    updated: number;
    unchanged: number;
    failed: number;
  };
  errors?: string[];
}

// Default cities to search
const DEFAULT_CITIES = [
  { name: 'Berlin', country: 'DE' },
  { name: 'Munich', country: 'DE' },
  { name: 'Hamburg', country: 'DE' },
  { name: 'Frankfurt', country: 'DE' },
  { name: 'Vienna', country: 'AT' },
  { name: 'Zurich', country: 'CH' },
  { name: 'Geneva', country: 'CH' },
  { name: 'Basel', country: 'CH' },
];

// Search queries to find Planted restaurants
const SEARCH_TEMPLATES = [
  'planted chicken restaurant {city}',
  'planted.chicken {city} delivery',
  '{city} restaurant planted meat',
  'planted foods partner restaurant {city}',
];

// Delivery platforms to look for in results
const DELIVERY_PLATFORMS = ['wolt', 'ubereats', 'uber eats', 'lieferando', 'deliveroo', 'doordash'];

export class GoogleSearchDiscovery {
  private config: GoogleSearchDiscoveryConfig;
  private browser: Browser | null = null;
  private page: Page | null = null;
  private discoveredRestaurants: DiscoveredRestaurant[] = [];
  private verbose: boolean = false;

  constructor(config: GoogleSearchDiscoveryConfig = {}) {
    this.config = {
      cities: config.cities || DEFAULT_CITIES,
      headless: config.headless ?? true,
      minDelay: config.minDelay ?? 5000,
      maxDelay: config.maxDelay ?? 15000,
      maxResultsPerCity: config.maxResultsPerCity ?? 20,
      maxSearchesPerCity: config.maxSearchesPerCity ?? 4,  // Default: all 4 templates
    };
  }

  /**
   * Run the discovery tool
   */
  async run(options: { dryRun?: boolean; verbose?: boolean; maxItems?: number } = {}): Promise<DiscoveryResult> {
    this.verbose = options.verbose ?? false;

    const results: DiscoveryResult = {
      success: true,
      stats: { created: 0, updated: 0, unchanged: 0, failed: 0 },
      errors: [],
    };

    try {
      // Initialize browser
      this.log('Initializing stealth browser...');
      this.browser = await createStealthBrowser({
        headless: this.config.headless,
        slowMo: 100,
      });

      this.page = await this.browser.newPage();
      await configurePage(this.page, {
        minDelay: this.config.minDelay,
        maxDelay: this.config.maxDelay,
      });

      // Search for each city
      for (const city of this.config.cities!) {
        if (options.maxItems && this.discoveredRestaurants.length >= options.maxItems) {
          this.log(`Reached max items limit (${options.maxItems}), stopping...`);
          break;
        }

        await this.searchCity(city, options);
      }

      // Log discovered restaurants
      this.logDiscoveries();

      results.stats.created = this.discoveredRestaurants.length;
      results.success = true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log(`Fatal error: ${errorMessage}`, 'error');
      results.errors?.push(errorMessage);
      results.success = false;
    } finally {
      // Cleanup
      if (this.browser) {
        await closeBrowser(this.browser);
      }
    }

    return results;
  }

  private async searchCity(
    city: { name: string; country: string },
    options: { maxItems?: number }
  ): Promise<void> {
    this.log(`\n=== Searching for Planted restaurants in ${city.name}, ${city.country} ===`);

    // Limit search queries per city
    const templatesToUse = SEARCH_TEMPLATES.slice(0, this.config.maxSearchesPerCity);
    let searchCount = 0;

    // Try each search template (limited by maxSearchesPerCity)
    for (const template of templatesToUse) {
      if (options.maxItems && this.discoveredRestaurants.length >= options.maxItems) {
        break;
      }

      const query = template.replace('{city}', city.name);
      await this.performSearch(query, city);
      searchCount++;

      // Rate limiting between searches
      this.log(`Waiting ${Math.round(this.config.minDelay!/1000)}-${Math.round(this.config.maxDelay!/1000)}s before next search...`);
      await randomDelay(this.config.minDelay!, this.config.maxDelay!);
    }

    this.log(`Completed ${searchCount} searches for ${city.name}`);
  }

  private async performSearch(
    query: string,
    city: { name: string; country: string }
  ): Promise<void> {
    if (!this.page) return;

    this.log(`Searching: "${query}"`);

    // Build Google search URL
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=20`;

    // Navigate to search
    const navigated = await safeNavigate(this.page, searchUrl, {
      minDelay: 2000,
      maxDelay: 5000,
    });

    if (!navigated) {
      this.log('Failed to navigate to Google search', 'warn');
      return;
    }

    // Wait for results to load
    await randomDelay(2000, 4000);

    // Check for CAPTCHA
    const pageContent = await this.page.content();
    if (pageContent.includes('unusual traffic') || pageContent.includes('CAPTCHA')) {
      this.log('Google CAPTCHA detected - need to solve manually or wait', 'warn');
      // Wait longer if CAPTCHA detected
      await randomDelay(30000, 60000);
      return;
    }

    // Scroll to load more results
    await humanScroll(this.page);
    await randomDelay(1000, 2000);

    // Extract search results
    const searchResults = await this.extractSearchResults(query, city);

    if (this.verbose) {
      this.log(`Found ${searchResults.length} potential results`);
    }

    // Add to discovered restaurants (deduplicate by URL)
    for (const result of searchResults) {
      const exists = this.discoveredRestaurants.some(r => r.url === result.url);
      if (!exists) {
        this.discoveredRestaurants.push(result);
        if (this.verbose) {
          this.log(`  + ${result.name} (${result.source})`);
        }
      }
    }
  }

  private async extractSearchResults(
    query: string,
    city: { name: string; country: string }
  ): Promise<DiscoveredRestaurant[]> {
    if (!this.page) return [];

    const results: DiscoveredRestaurant[] = [];

    try {
      // Extract search result elements
      const searchResults = await this.page.$$('div.g');

      for (const resultElement of searchResults) {
        try {
          // Extract link
          const linkElement = await resultElement.$('a');
          if (!linkElement) continue;

          const url = await this.page.evaluate(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            el => (el as any).href as string,
            linkElement
          );

          if (!url || url.startsWith('https://www.google.com')) continue;

          // Extract title
          const titleElement = await resultElement.$('h3');
          const title = titleElement
            ? await this.page.evaluate(el => el.textContent || '', titleElement)
            : '';

          // Extract snippet
          const snippetElement = await resultElement.$('div[data-sncf]');
          const snippet = snippetElement
            ? await this.page.evaluate(el => el.textContent || '', snippetElement)
            : '';

          // Determine source type
          let source = 'website';
          const urlLower = url.toLowerCase();
          for (const platform of DELIVERY_PLATFORMS) {
            if (urlLower.includes(platform.replace(' ', ''))) {
              source = platform.replace(' ', '');
              break;
            }
          }

          // Filter: must contain "planted" in title or snippet
          const combined = `${title} ${snippet}`.toLowerCase();
          if (!combined.includes('planted')) continue;

          results.push({
            name: title.trim(),
            url,
            snippet: snippet.trim().slice(0, 200),
            city: city.name,
            country: city.country,
            source,
            searchQuery: query,
          });
        } catch {
          // Skip this result
        }
      }
    } catch (error) {
      this.log(`Error extracting results: ${error}`, 'warn');
    }

    return results;
  }

  private logDiscoveries(): void {
    console.log('\n' + '='.repeat(80));
    console.log('DISCOVERED PLANTED RESTAURANT PARTNERS');
    console.log('='.repeat(80));

    if (this.discoveredRestaurants.length === 0) {
      console.log('No restaurants discovered.');
      return;
    }

    // Group by city
    const byCity = new Map<string, DiscoveredRestaurant[]>();
    for (const r of this.discoveredRestaurants) {
      const key = `${r.city}, ${r.country}`;
      if (!byCity.has(key)) byCity.set(key, []);
      byCity.get(key)!.push(r);
    }

    for (const [city, restaurants] of byCity) {
      console.log(`\n  ${city} (${restaurants.length} results)`);
      console.log('-'.repeat(40));

      for (const r of restaurants) {
        console.log(`\n    ${r.name}`);
        console.log(`      Source: ${r.source}`);
        console.log(`      URL: ${r.url}`);
        if (r.snippet) {
          console.log(`      Snippet: ${r.snippet.slice(0, 100)}...`);
        }
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log(`Total discovered: ${this.discoveredRestaurants.length} restaurants`);
    console.log('='.repeat(80) + '\n');

    // Also output as JSON for easy processing
    console.log('\nJSON output for processing:');
    console.log(JSON.stringify(this.discoveredRestaurants, null, 2));
  }

  private log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const prefix = '[GoogleSearchDiscovery]';
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
