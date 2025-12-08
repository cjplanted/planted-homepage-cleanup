/**
 * Migros Switzerland Retail Scraper
 *
 * Scrapes Planted products from migros.ch using browser automation.
 * Migros has anti-bot protection, so we need puppeteer with stealth mode.
 *
 * Target: https://www.migros.ch/en/brand/planted
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

export interface MigrosScraperConfig {
  headless?: boolean;
  minDelay?: number;
  maxDelay?: number;
  maxProducts?: number;
}

interface MigrosProduct {
  id: string;
  name: string;
  price: number;
  currency: string;
  weight?: string;
  pricePerUnit?: string;
  imageUrl?: string;
  productUrl: string;
  available: boolean;
  rating?: number;
  reviewCount?: number;
}

const DEFAULT_CONFIG: MigrosScraperConfig = {
  headless: true,
  minDelay: 3000,
  maxDelay: 7000,
  maxProducts: 50,
};

// Known Planted product IDs at Migros
const KNOWN_PRODUCT_IDS = [
  '130916700000', // planted. Pea protein chicken (Nature)
  '130916800000', // planted. Pea protein chicken Güggeli
  '130927300000', // planted. Kebab
  '130929300000', // planted. pulled BBQ
  '130937200000', // planted. Steak Plain
  '131300600000', // Migros Daily Planted Teriyaki
  '130926100000', // planted. (unknown - from search)
  '130929100000', // planted. pulled Spicy Herbs (estimated)
  '130937100000', // planted. Schnitzel (estimated)
];

export class MigrosScraper {
  private config: MigrosScraperConfig;
  private browser: Browser | null = null;
  private page: Page | null = null;
  private products: MigrosProduct[] = [];
  private verbose: boolean = false;

  constructor(config: MigrosScraperConfig = {}) {
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
      this.log('Initializing stealth browser for Migros.ch...');
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
      this.log('Navigating to Migros Planted brand page...');
      const brandPageUrl = 'https://www.migros.ch/en/brand/planted';

      const navigated = await safeNavigate(this.page, brandPageUrl, {
        minDelay: this.config.minDelay,
        maxDelay: this.config.maxDelay,
      });

      if (!navigated) {
        this.log('Failed to navigate to brand page', 'warn');
        result.errors?.push('Failed to navigate to Migros brand page');
        // Don't fail completely - try known products
      }

      // Check for blocking
      if (this.page && await isBlocked(this.page)) {
        this.log('Blocking detected - waiting for resolution...', 'warn');
        if (!this.config.headless) {
          this.log('Waiting 30 seconds for manual intervention...');
          await randomDelay(30000, 35000);
        }
      }

      // Human-like scrolling to load lazy content
      if (navigated) {
        await humanScroll(this.page);
        await randomDelay(2000, 4000);
        await humanScroll(this.page);
        await randomDelay(1000, 2000);

        // Extract products from the brand page
        this.log('Extracting products from brand page...');
        await this.extractProductsFromBrandPage();
      }

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
      await this.page.waitForSelector('[data-cy="product-card"], .product-card, [class*="ProductCard"]', {
        timeout: 10000
      }).catch(() => {
        this.log('Product card selector not found, trying alternative selectors...');
      });

      // Try multiple selectors for product tiles
      const productSelectors = [
        '[data-cy="product-card"]',
        '.product-card',
        '[class*="ProductCard"]',
        'article[class*="product"]',
        '[data-testid="product-tile"]',
        '.product-list-item',
      ];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        // Try to find any links containing "/product/" (product detail links)
        const productLinks = await this.page.$$eval('a[href*="/product/"]', (links) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return links.map((link: any) => ({
            href: link.href as string,
            text: (link.textContent?.trim() || '') as string,
          })).filter((l: { href: string; text: string }) => l.href.includes('planted') || l.text.toLowerCase().includes('planted'));
        });

        this.log(`Found ${productLinks.length} product links`);

        for (const link of productLinks) {
          const match = link.href.match(/\/product\/(\d+)/);
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
            const link = el.querySelector('a[href*="/product/"]');
            const nameEl = el.querySelector('[class*="name"], .product-name, h3, h4, [data-cy="product-name"]');
            const priceEl = el.querySelector('[class*="price"], .product-price, [data-cy="price"]');
            const imageEl = el.querySelector('img');

            const href = link?.href || '';
            const idMatch = href.match(/\/product\/(\d+)/);

            return {
              id: idMatch ? idMatch[1] : '',
              name: nameEl?.textContent?.trim() || '',
              priceText: priceEl?.textContent?.trim() || '',
              imageUrl: imageEl?.src || '',
              productUrl: href,
            };
          }, element);

          if (product.id && product.name.toLowerCase().includes('planted')) {
            // Parse price (format: CHF 5.95 or 5.95)
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
        } catch {
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
      const productUrl = `https://www.migros.ch/en/product/${productId}`;

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
          this.log('Blocking detected during product scrape', 'warn');
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

  private async extractProductDetails(productId: string, productUrl: string): Promise<MigrosProduct | null> {
    if (!this.page) return null;

    try {
      // Wait for product details to load
      await this.page.waitForSelector('h1, [data-cy="product-name"], [class*="productName"]', {
        timeout: 10000
      }).catch(() => {
        this.log('Product name selector not found...');
      });

      const details = await this.page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const doc = (globalThis as any).document;
        const nameEl = doc.querySelector('h1, [data-cy="product-name"], [class*="productName"]');
        const priceEl = doc.querySelector('[data-cy="price"], [class*="price"]:not([class*="unit"])');
        const unitPriceEl = doc.querySelector('[class*="unitPrice"], [data-cy="unit-price"]');
        const weightEl = doc.querySelector('[class*="weight"], [class*="quantity"]');
        const imageEl = doc.querySelector('.product-image img, [class*="productImage"] img, img[class*="image"]');
        const ratingEl = doc.querySelector('[class*="rating"] [class*="value"], [data-cy="rating"]');
        const reviewCountEl = doc.querySelector('[class*="reviewCount"], [data-cy="review-count"]');

        return {
          name: nameEl?.textContent?.trim() || '',
          priceText: priceEl?.textContent?.trim() || '',
          unitPrice: unitPriceEl?.textContent?.trim() || '',
          weight: weightEl?.textContent?.trim() || '',
          imageUrl: imageEl?.src || '',
          rating: ratingEl?.textContent?.trim() || '',
          reviewCount: reviewCountEl?.textContent?.trim() || '',
        };
      });

      if (!details.name) {
        this.log(`  No product name found for ${productId}`, 'warn');
        return null;
      }

      // Check if it's a Planted product (some IDs might not be)
      if (!details.name.toLowerCase().includes('planted')) {
        this.log(`  Product ${productId} is not a Planted product: ${details.name}`);
        return null;
      }

      const priceMatch = details.priceText.match(/[\d.]+/);
      const price = priceMatch ? parseFloat(priceMatch[0]) : 0;

      const ratingMatch = details.rating.match(/[\d.]+/);
      const rating = ratingMatch ? parseFloat(ratingMatch[0]) : undefined;

      const reviewMatch = details.reviewCount.match(/\d+/);
      const reviewCount = reviewMatch ? parseInt(reviewMatch[0], 10) : undefined;

      if (this.verbose) {
        this.log(`  Found: ${details.name} - CHF ${price}`);
      }

      return {
        id: productId,
        name: details.name,
        price,
        currency: 'CHF',
        weight: details.weight || undefined,
        pricePerUnit: details.unitPrice || undefined,
        imageUrl: details.imageUrl || undefined,
        productUrl,
        available: true,
        rating,
        reviewCount,
      };
    } catch (error) {
      this.log(`Error extracting product details: ${error}`, 'warn');
      return null;
    }
  }

  private async saveToDatabase(): Promise<void> {
    // TODO: Implement database save
    // This will create/update:
    // 1. Chain entry for "Migros"
    // 2. Product entries for each Planted product
    // 3. RetailAvailability entries
    this.log('Database save not implemented yet - use with --dry-run for now');
  }

  private logProducts(): void {
    console.log('\n' + '='.repeat(60));
    console.log('MIGROS SWITZERLAND - PLANTED PRODUCTS');
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
      if (product.rating) console.log(`    Rating: ${product.rating} (${product.reviewCount} reviews)`);
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
    const prefix = '[MigrosScraper]';
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
