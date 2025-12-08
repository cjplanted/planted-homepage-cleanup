/**
 * Waitrose UK Retail Scraper
 *
 * Scrapes Planted products from waitrose.com using browser automation.
 * Waitrose is an upmarket UK supermarket chain with ~380 stores.
 *
 * Target: https://www.waitrose.com/ecom/shop/search?searchTerm=planted
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

export interface WaitroseScraperConfig {
  headless?: boolean;
  minDelay?: number;
  maxDelay?: number;
  maxProducts?: number;
}

interface WaitroseProduct {
  id: string;
  name: string;
  price: number;
  currency: string;
  weight?: string;
  pricePerUnit?: string;
  imageUrl?: string;
  productUrl: string;
  available: boolean;
  category?: string;
}

const DEFAULT_CONFIG: WaitroseScraperConfig = {
  headless: true,
  minDelay: 3000,
  maxDelay: 7000,
  maxProducts: 50,
};

// Search terms to find Planted products
const SEARCH_TERMS = [
  'planted',
  'planted chicken',
  'planted kebab',
];

export class WaitroseScraper {
  private config: WaitroseScraperConfig;
  private browser: Browser | null = null;
  private page: Page | null = null;
  private products: WaitroseProduct[] = [];
  private verbose: boolean = false;

  constructor(config: WaitroseScraperConfig = {}) {
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
      this.log('Initializing stealth browser for Waitrose...');
      this.browser = await createStealthBrowser({
        headless: this.config.headless,
        slowMo: 100,
      });

      this.page = await this.browser.newPage();
      await configurePage(this.page, {
        minDelay: this.config.minDelay,
        maxDelay: this.config.maxDelay,
      });

      // Set UK locale
      await this.page.setExtraHTTPHeaders({
        'Accept-Language': 'en-GB,en;q=0.9',
      });

      // Search for planted products
      this.log('Searching for Planted products on Waitrose...');

      for (const searchTerm of SEARCH_TERMS) {
        if (this.products.length >= (this.config.maxProducts || 50)) break;

        const searchUrl = `https://www.waitrose.com/ecom/shop/search?searchTerm=${encodeURIComponent(searchTerm)}`;
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
      // Waitrose cookie consent selectors
      const consentSelectors = [
        '#onetrust-accept-btn-handler',
        'button[data-testid="accept-all"]',
        'button:has-text("Accept All Cookies")',
        'button:has-text("Accept all")',
        '.accept-cookies',
        '#acceptCookies',
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
      await this.page.waitForSelector('[data-testid="product-pod"], .productPod, article[class*="product"]', {
        timeout: 15000,
      }).catch(() => {
        this.log('Product list selector not found, trying alternatives...');
      });

      // Try multiple selectors for product tiles
      const productSelectors = [
        '[data-testid="product-pod"]',
        '.productPod',
        'article[class*="product"]',
        '[class*="ProductPod"]',
        'li[data-test="product-tile"]',
        '.product-tile',
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
        const productLinks = await this.page.$$eval('a[href*="/products/"]', (links) => {
          return links.map((link: any) => ({
            href: link.href as string,
            text: (link.textContent?.trim() || '') as string,
          })).filter((l: { href: string; text: string }) =>
            l.text.toLowerCase().includes('planted')
          );
        });

        this.log(`Found ${productLinks.length} product links containing 'planted'`);

        for (const link of productLinks) {
          // Extract product ID from URL
          const match = link.href.match(/\/products\/([^/]+)/);
          const id = match ? match[1] : link.href;

          if (!this.products.find(p => p.id === id)) {
            this.products.push({
              id,
              name: link.text,
              price: 0,
              currency: 'GBP',
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
            const link = el.querySelector('a[href*="/products/"]') || el.closest('a[href*="/products/"]');
            const nameEl = el.querySelector('[data-testid="product-name"], .productPod__title, h2, h3, [class*="title"]');
            const priceEl = el.querySelector('[data-testid="product-price"], .productPod__price, [class*="price"]');
            const imageEl = el.querySelector('img');
            const weightEl = el.querySelector('[data-testid="product-size"], .productPod__size');

            const href = link?.href || '';

            // Parse price - Waitrose shows "£2.99" format
            let priceText = priceEl?.textContent?.trim() || '';
            const priceMatch = priceText.match(/£(\d+)\.(\d+)/);
            const price = priceMatch ? parseFloat(`${priceMatch[1]}.${priceMatch[2]}`) : 0;

            return {
              id: href.split('/products/')[1]?.split('/')[0]?.split('-').pop() || '',
              name: nameEl?.textContent?.trim() || '',
              price,
              weight: weightEl?.textContent?.trim() || '',
              imageUrl: imageEl?.src || '',
              productUrl: href,
            };
          }, element);

          const nameLower = product.name.toLowerCase();
          if (product.id && (nameLower.includes('planted') || product.productUrl.toLowerCase().includes('planted'))) {
            if (!this.products.find(p => p.id === product.id)) {
              this.products.push({
                id: product.id,
                name: product.name,
                price: product.price,
                currency: 'GBP',
                weight: product.weight,
                imageUrl: product.imageUrl,
                productUrl: product.productUrl,
                available: true,
              });

              if (this.verbose) {
                this.log(`  Found: ${product.name} - £${product.price.toFixed(2)}`);
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
    // 1. Chain entry for "Waitrose"
    // 2. Product entries for each Planted product
    // 3. RetailAvailability entries
    this.log('Database save not implemented yet - use with --dry-run for now');
  }

  private logProducts(): void {
    console.log('\n' + '='.repeat(60));
    console.log('WAITROSE UK - PLANTED PRODUCTS');
    console.log('='.repeat(60));

    if (this.products.length === 0) {
      console.log('No Planted products found.');
      console.log('\nNote: Planted (Swiss brand) may not yet be available');
      console.log('at Waitrose. The UK market has alternatives like:');
      console.log('  - THIS (plant-based chicken)');
      console.log('  - Heura (Mediterranean plant-based)');
      console.log('  - Quorn (mycoprotein-based)');
      console.log('\nThis scraper will detect Planted products when available.');
      return;
    }

    for (const product of this.products) {
      console.log(`\n  ${product.name}`);
      console.log(`    ID: ${product.id}`);
      if (product.price > 0) {
        console.log(`    Price: £${product.price.toFixed(2)}`);
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
    const prefix = '[WaitroseScraper]';
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
