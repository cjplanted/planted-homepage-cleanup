/**
 * Coop Switzerland Retail Scraper
 *
 * Scrapes Planted products from coop.ch using browser automation.
 * Coop uses DataDome protection, so we need puppeteer with stealth mode.
 *
 * Target: https://www.coop.ch/en/brands/planted/c/BRAND_planted
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

export interface CoopScraperConfig {
  headless?: boolean;
  minDelay?: number;
  maxDelay?: number;
  maxProducts?: number;
}

interface CoopProduct {
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

const DEFAULT_CONFIG: CoopScraperConfig = {
  headless: true,
  minDelay: 3000,
  maxDelay: 7000,
  maxProducts: 50,
};

// Known Planted product URLs at Coop (fallback if brand page doesn't load)
const KNOWN_PRODUCT_IDS = [
  '6818092', // Planted Kebab
  '6774029', // Planted Pulled Spicy Herbs
  '6774028', // Planted Pulled BBQ
  '6711631', // Planted Chicken Nature
  '6711632', // Planted Chicken Lemon & Herbs
  '6725558', // Planted Schnitzel
  '6818091', // Planted Steak
  '6864537', // Planted Bratwurst
  '6901234', // Planted Nuggets (estimated)
];

export class CoopScraper {
  private config: CoopScraperConfig;
  private browser: Browser | null = null;
  private page: Page | null = null;
  private products: CoopProduct[] = [];
  private verbose: boolean = false;

  constructor(config: CoopScraperConfig = {}) {
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
      this.log('Initializing stealth browser for Coop.ch...');
      this.browser = await createStealthBrowser({
        headless: this.config.headless,
        slowMo: 100,
      });

      this.page = await this.browser.newPage();
      await configurePage(this.page, {
        minDelay: this.config.minDelay,
        maxDelay: this.config.maxDelay,
      });

      // Try to access the Planted brand page
      this.log('Navigating to Coop Planted brand page...');
      const brandPageUrl = 'https://www.coop.ch/en/brands/planted/c/BRAND_planted';

      const navigated = await safeNavigate(this.page, brandPageUrl, {
        minDelay: this.config.minDelay,
        maxDelay: this.config.maxDelay,
      });

      if (!navigated) {
        this.log('Failed to navigate to brand page', 'warn');
        result.errors?.push('Failed to navigate to Coop brand page');
        result.success = false;
        return result;
      }

      // Check for CAPTCHA/blocking
      if (await isBlocked(this.page)) {
        this.log('CAPTCHA detected - waiting for manual solve or skipping...', 'warn');
        // Wait longer to give time for manual solve in headful mode
        if (!this.config.headless) {
          this.log('Waiting 30 seconds for manual CAPTCHA solve...');
          await randomDelay(30000, 35000);
        }

        if (await isBlocked(this.page)) {
          result.errors?.push('Blocked by CAPTCHA');
          result.success = false;
          return result;
        }
      }

      // Human-like scrolling to load lazy content
      await humanScroll(this.page);
      await randomDelay(2000, 4000);
      await humanScroll(this.page);
      await randomDelay(1000, 2000);

      // Extract products from the brand page
      this.log('Extracting products from brand page...');
      await this.extractProductsFromBrandPage();

      // If we didn't find products, try individual product pages
      if (this.products.length === 0) {
        this.log('No products found on brand page, trying known product IDs...');
        await this.scrapeKnownProducts(options);
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

  private async extractProductsFromBrandPage(): Promise<void> {
    if (!this.page) return;

    try {
      // Wait for product grid to load
      await this.page.waitForSelector('[data-testid="product-tile"], .product-tile, .productTile', {
        timeout: 10000
      }).catch(() => {
        this.log('Product tile selector not found, trying alternative selectors...');
      });

      // Try multiple selectors for product tiles
      const productSelectors = [
        '[data-testid="product-tile"]',
        '.product-tile',
        '.productTile',
        '[class*="ProductTile"]',
        'article[class*="product"]',
        '.product-list-item',
      ];

      let productElements: any[] = [];

      for (const selector of productSelectors) {
        const elements = await this.page.$$(selector);
        if (elements.length > 0) {
          this.log(`Found ${elements.length} products using selector: ${selector}`);
          productElements = elements;
          break;
        }
      }

      if (productElements.length === 0) {
        // Try to find any links containing "/p/" (product detail links)
        const productLinks = await this.page.$$eval('a[href*="/p/"]', (links) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return links.map((link: any) => ({
            href: link.href as string,
            text: (link.textContent?.trim() || '') as string,
          })).filter((l: { href: string }) => l.href.includes('planted'));
        });

        this.log(`Found ${productLinks.length} product links`);

        for (const link of productLinks) {
          const match = link.href.match(/\/p\/(\d+)/);
          if (match) {
            this.products.push({
              id: match[1],
              name: link.text || `Product ${match[1]}`,
              price: 0,
              currency: 'CHF',
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const product = await this.page.evaluate((el: any) => {
            const link = el.querySelector('a[href*="/p/"]');
            const nameEl = el.querySelector('[class*="name"], .product-name, h3, h4');
            const priceEl = el.querySelector('[class*="price"], .product-price, [data-testid="price"]');
            const imageEl = el.querySelector('img');

            const href = link?.href || '';
            const idMatch = href.match(/\/p\/(\d+)/);

            return {
              id: idMatch ? idMatch[1] : '',
              name: nameEl?.textContent?.trim() || '',
              priceText: priceEl?.textContent?.trim() || '',
              imageUrl: imageEl?.src || '',
              productUrl: href,
            };
          }, element);

          if (product.id && product.name.toLowerCase().includes('planted')) {
            // Parse price
            const priceMatch = product.priceText.match(/[\d.]+/);
            const price = priceMatch ? parseFloat(priceMatch[0]) : 0;

            this.products.push({
              id: product.id,
              name: product.name,
              price,
              currency: 'CHF',
              imageUrl: product.imageUrl,
              productUrl: product.productUrl,
              available: true,
            });

            if (this.verbose) {
              this.log(`  Found: ${product.name} - CHF ${price}`);
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

  private async scrapeKnownProducts(options: ScraperOptions): Promise<void> {
    if (!this.page) return;

    const limit = Math.min(
      options.maxItems || this.config.maxProducts || 50,
      KNOWN_PRODUCT_IDS.length
    );

    for (let i = 0; i < limit; i++) {
      const productId = KNOWN_PRODUCT_IDS[i];
      const productUrl = `https://www.coop.ch/en/p/${productId}`;

      this.log(`Fetching product ${i + 1}/${limit}: ${productId}`);

      try {
        await randomDelay(this.config.minDelay!, this.config.maxDelay!);

        const navigated = await safeNavigate(this.page, productUrl, {
          minDelay: 2000,
          maxDelay: 4000,
        });

        if (!navigated) {
          this.log(`  Failed to navigate to product ${productId}`, 'warn');
          continue;
        }

        // Check for blocking
        if (await isBlocked(this.page)) {
          this.log('CAPTCHA detected during product scrape', 'warn');
          break;
        }

        // Extract product details
        const product = await this.extractProductDetails(productId, productUrl);
        if (product) {
          this.products.push(product);
        }
      } catch (error) {
        this.log(`Error fetching product ${productId}: ${error}`, 'warn');
      }
    }
  }

  private async extractProductDetails(productId: string, productUrl: string): Promise<CoopProduct | null> {
    if (!this.page) return null;

    try {
      const details = await this.page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const doc = (globalThis as any).document;
        const nameEl = doc.querySelector('h1, [class*="productName"], [data-testid="product-name"]');
        const priceEl = doc.querySelector('[class*="price"], [data-testid="price"]');
        const weightEl = doc.querySelector('[class*="weight"], [class*="packSize"]');
        const imageEl = doc.querySelector('.product-image img, [class*="productImage"] img');

        return {
          name: nameEl?.textContent?.trim() || '',
          priceText: priceEl?.textContent?.trim() || '',
          weight: weightEl?.textContent?.trim() || '',
          imageUrl: imageEl?.src || '',
        };
      });

      if (!details.name || !details.name.toLowerCase().includes('planted')) {
        return null;
      }

      const priceMatch = details.priceText.match(/[\d.]+/);
      const price = priceMatch ? parseFloat(priceMatch[0]) : 0;

      if (this.verbose) {
        this.log(`  Found: ${details.name} - CHF ${price}`);
      }

      return {
        id: productId,
        name: details.name,
        price,
        currency: 'CHF',
        weight: details.weight,
        imageUrl: details.imageUrl,
        productUrl,
        available: true,
      };
    } catch (error) {
      this.log(`Error extracting product details: ${error}`, 'warn');
      return null;
    }
  }

  private async saveToDatabase(): Promise<void> {
    // TODO: Implement database save
    // This will create/update:
    // 1. Chain entry for "Coop"
    // 2. Product entries for each Planted product
    // 3. RetailAvailability entries
    this.log('Database save not implemented yet - use with --dry-run for now');
  }

  private logProducts(): void {
    console.log('\n' + '='.repeat(60));
    console.log('COOP SWITZERLAND - PLANTED PRODUCTS');
    console.log('='.repeat(60));

    if (this.products.length === 0) {
      console.log('No products found.');
      return;
    }

    for (const product of this.products) {
      console.log(`\n  ${product.name}`);
      console.log(`    ID: ${product.id}`);
      console.log(`    Price: ${product.currency} ${product.price.toFixed(2)}`);
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
    const prefix = '[CoopScraper]';
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
