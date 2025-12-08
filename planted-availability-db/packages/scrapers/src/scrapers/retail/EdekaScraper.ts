/**
 * EDEKA Germany Retail Scraper
 *
 * Scrapes Planted products from edeka24.de using browser automation.
 * EDEKA is Germany's largest supermarket cooperative with over 11,000 stores.
 *
 * Target: https://www.edeka24.de/suchen.html?q=planted
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

export interface EdekaScraperConfig {
  headless?: boolean;
  minDelay?: number;
  maxDelay?: number;
  maxProducts?: number;
}

interface EdekaProduct {
  id: string;
  name: string;
  price: number;
  currency: string;
  weight?: string;
  pricePerKg?: string;
  imageUrl?: string;
  productUrl: string;
  available: boolean;
  category?: string;
}

const DEFAULT_CONFIG: EdekaScraperConfig = {
  headless: true,
  minDelay: 3000,
  maxDelay: 7000,
  maxProducts: 50,
};

// Known Planted products at EDEKA
// EDEKA carries the Planted Crispy range: schnitzel, burger, nuggets
const SEARCH_TERMS = [
  'planted',
  'planted chicken',
  'planted schnitzel',
  'planted nuggets',
];

export class EdekaScraper {
  private config: EdekaScraperConfig;
  private browser: Browser | null = null;
  private page: Page | null = null;
  private products: EdekaProduct[] = [];
  private verbose: boolean = false;

  constructor(config: EdekaScraperConfig = {}) {
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
      this.log('Initializing stealth browser for EDEKA...');
      this.browser = await createStealthBrowser({
        headless: this.config.headless,
        slowMo: 100,
      });

      this.page = await this.browser.newPage();
      await configurePage(this.page, {
        minDelay: this.config.minDelay,
        maxDelay: this.config.maxDelay,
      });

      // Set German locale
      await this.page.setExtraHTTPHeaders({
        'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
      });

      // Search for planted products
      this.log('Searching for Planted products on EDEKA24...');

      for (const searchTerm of SEARCH_TERMS) {
        if (this.products.length >= (this.config.maxProducts || 50)) break;

        const searchUrl = `https://www.edeka24.de/suchen.html?q=${encodeURIComponent(searchTerm)}`;
        this.log(`Searching for: "${searchTerm}"`);

        const navigated = await safeNavigate(this.page, searchUrl, {
          minDelay: this.config.minDelay,
          maxDelay: this.config.maxDelay,
        });

        if (!navigated) {
          this.log(`Failed to navigate to search for "${searchTerm}"`, 'warn');
          continue;
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
            result.errors?.push('Blocked by CAPTCHA');
            break;
          }
        }

        // Human-like scrolling
        await humanScroll(this.page);
        await randomDelay(2000, 4000);

        // Extract products from search results
        await this.extractProductsFromSearch();

        // Delay between searches
        await randomDelay(this.config.minDelay!, this.config.maxDelay!);
      }

      // Log results
      this.logProducts();

      result.stats.created = this.products.length;
      result.success = this.products.length > 0;

      // Save to database if not dry run
      if (!options.dryRun && this.products.length > 0) {
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

  private async handleCookieConsent(): Promise<void> {
    if (!this.page) return;

    try {
      // EDEKA uses various cookie consent buttons
      const consentSelectors = [
        '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
        '#CybotCookiebotDialogBodyButtonAccept',
        'button[data-testid="cookie-accept"]',
        'button:has-text("Alle akzeptieren")',
        'button:has-text("Alle Cookies akzeptieren")',
        '.consent-accept',
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

  private async extractProductsFromSearch(): Promise<void> {
    if (!this.page) return;

    try {
      // Wait for product list to load
      await this.page.waitForSelector('.product-list, .search-results, [class*="ProductList"]', {
        timeout: 15000,
      }).catch(() => {
        this.log('Product list selector not found, trying alternatives...');
      });

      // Try multiple selectors for product tiles
      const productSelectors = [
        '.product-teaser',
        '.product-item',
        '[data-testid="product-tile"]',
        '.ProductTile',
        'article[class*="product"]',
        '.search-result-item',
        'a[href*="/Marken/"]',
        'a[href*="/Kuehlprodukte/"]',
      ];

      let productElements: any[] = [];

      for (const selector of productSelectors) {
        const elements = await this.page.$$(selector);
        if (elements.length > 0) {
          this.log(`Found ${elements.length} elements using selector: ${selector}`);
          productElements = elements;
          break;
        }
      }

      if (productElements.length === 0) {
        // Fallback: find all product links
        const productLinks = await this.page.$$eval('a[href*=".html"]', (links) => {
          return links.map((link: any) => ({
            href: link.href as string,
            text: (link.textContent?.trim() || '') as string,
          })).filter((l: { href: string; text: string }) =>
            l.text.toLowerCase().includes('planted') &&
            (l.href.includes('/Marken/') || l.href.includes('/Kuehlprodukte/') || l.href.includes('-Planted-'))
          );
        });

        this.log(`Found ${productLinks.length} product links containing 'planted'`);

        for (const link of productLinks) {
          // Extract product ID from URL
          const match = link.href.match(/\/([^/]+)\.html$/);
          const id = match ? match[1] : link.href;

          if (!this.products.find(p => p.id === id)) {
            this.products.push({
              id,
              name: link.text,
              price: 0,
              currency: 'EUR',
              productUrl: link.href,
              available: true,
            });
          }
        }
        return;
      }

      // Extract data from product elements
      for (const element of productElements) {
        try {
          const product = await this.page.evaluate((el: any) => {
            const link = el.querySelector('a[href*=".html"]') || el.closest('a[href*=".html"]');
            const nameEl = el.querySelector('.product-title, .product-name, h3, h4, [class*="title"]');
            const priceEl = el.querySelector('.price, [class*="Price"], [data-testid="price"]');
            const imageEl = el.querySelector('img');
            const weightEl = el.querySelector('.product-weight, [class*="grammage"]');

            const href = link?.href || '';

            // Parse price - EDEKA shows "2,99 €" format
            let priceText = priceEl?.textContent?.trim() || '';
            const priceMatch = priceText.match(/(\d+)[,.](\d+)/);
            const price = priceMatch ? parseFloat(`${priceMatch[1]}.${priceMatch[2]}`) : 0;

            return {
              id: href.split('/').pop()?.replace('.html', '') || '',
              name: nameEl?.textContent?.trim() || '',
              price,
              weight: weightEl?.textContent?.trim() || '',
              imageUrl: imageEl?.src || '',
              productUrl: href,
            };
          }, element);

          const nameLower = product.name.toLowerCase();
          if (product.id && (nameLower.includes('planted') || product.productUrl.includes('planted') || product.productUrl.includes('Planted'))) {
            if (!this.products.find(p => p.id === product.id)) {
              this.products.push({
                id: product.id,
                name: product.name,
                price: product.price,
                currency: 'EUR',
                weight: product.weight,
                imageUrl: product.imageUrl,
                productUrl: product.productUrl,
                available: true,
              });

              if (this.verbose) {
                this.log(`  Found: ${product.name} - EUR ${product.price.toFixed(2)}`);
              }
            }
          }
        } catch (err) {
          // Skip this product
        }
      }
    } catch (error) {
      this.log(`Error extracting products: ${error}`, 'warn');
    }
  }

  private async saveToDatabase(): Promise<void> {
    // TODO: Implement database save
    // This will create/update:
    // 1. Chain entry for "EDEKA"
    // 2. Product entries for each Planted product
    // 3. RetailAvailability entries
    this.log('Database save not implemented yet - use with --dry-run for now');
  }

  private logProducts(): void {
    console.log('\n' + '='.repeat(60));
    console.log('EDEKA GERMANY - PLANTED PRODUCTS');
    console.log('='.repeat(60));

    if (this.products.length === 0) {
      console.log('No products found.');
      console.log('\nPossible reasons:');
      console.log('  - CAPTCHA/bot protection active');
      console.log('  - Products not available online');
      console.log('  - Website structure changed');
      console.log('\nTry running with --headful --slow for manual CAPTCHA solving');
      console.log('\nNote: EDEKA physical stores (11,000+) carry Planted products');
      console.log('Online availability may differ from in-store.');
      return;
    }

    for (const product of this.products) {
      console.log(`\n  ${product.name}`);
      console.log(`    ID: ${product.id}`);
      if (product.price > 0) {
        console.log(`    Price: ${product.currency} ${product.price.toFixed(2)}`);
      }
      if (product.weight) console.log(`    Weight: ${product.weight}`);
      console.log(`    URL: ${product.productUrl}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log(`Total products: ${this.products.length}`);
    console.log('='.repeat(60) + '\n');

    // Output as JSON
    console.log('JSON output:');
    console.log(JSON.stringify(this.products, null, 2));
  }

  private log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const prefix = '[EdekaScraper]';
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
