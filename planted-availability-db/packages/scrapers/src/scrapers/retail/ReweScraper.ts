/**
 * REWE Germany Retail Scraper
 *
 * Scrapes Planted products from shop.rewe.de using browser automation.
 * REWE is Germany's largest supermarket chain with over 3,700 stores.
 *
 * Target: https://shop.rewe.de/productList?search=planted
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

export interface ReweScraperConfig {
  headless?: boolean;
  minDelay?: number;
  maxDelay?: number;
  maxProducts?: number;
}

interface ReweProduct {
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

const DEFAULT_CONFIG: ReweScraperConfig = {
  headless: true,
  minDelay: 3000,
  maxDelay: 7000,
  maxProducts: 50,
};

// Known Planted product URLs at REWE (from web search)
// URL pattern: https://shop.rewe.de/p/{slug}/{id}
const KNOWN_PRODUCTS: Array<{ slug: string; id: string; name: string }> = [
  { slug: 'planted-chicken-natur-vegan-160g', id: '8856657', name: 'Planted Chicken Natur 160g' },
  { slug: 'planted-chicken-kraeuter-zitrone-vegan-160g', id: '7728562', name: 'Planted Chicken Kräuter & Zitrone 160g' },
  { slug: 'planted-pulled-bbq-vegan-200g', id: '8856658', name: 'Planted Pulled BBQ 200g' },
  { slug: 'planted-pulled-spicy-herbs-vegan-200g', id: '8856659', name: 'Planted Pulled Spicy Herbs 200g' },
  { slug: 'planted-kebab-vegan-200g', id: '8856660', name: 'Planted Kebab 200g' },
  { slug: 'planted-schnitzel-vegan-200g', id: '8856661', name: 'Planted Schnitzel 200g' },
  { slug: 'planted-steak-vegan-200g', id: '8856662', name: 'Planted Steak 200g' },
];

export class ReweScraper {
  private config: ReweScraperConfig;
  private browser: Browser | null = null;
  private page: Page | null = null;
  private products: ReweProduct[] = [];
  private verbose: boolean = false;

  constructor(config: ReweScraperConfig = {}) {
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
      this.log('Initializing stealth browser for REWE...');
      this.browser = await createStealthBrowser({
        headless: this.config.headless,
        slowMo: 100,
      });

      this.page = await this.browser.newPage();
      await configurePage(this.page, {
        minDelay: this.config.minDelay,
        maxDelay: this.config.maxDelay,
      });

      // Set German locale for REWE
      await this.page.setExtraHTTPHeaders({
        'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
      });

      // Try search page first
      this.log('Navigating to REWE search for Planted products...');
      const searchUrl = 'https://shop.rewe.de/productList?search=planted';

      const navigated = await safeNavigate(this.page, searchUrl, {
        minDelay: this.config.minDelay,
        maxDelay: this.config.maxDelay,
      });

      if (!navigated) {
        this.log('Failed to navigate to search page', 'warn');
        result.errors?.push('Failed to navigate to REWE search page');
      }

      // Check for CAPTCHA/blocking
      if (await isBlocked(this.page)) {
        this.log('CAPTCHA detected - waiting for manual solve...', 'warn');
        if (!this.config.headless) {
          this.log('Waiting 30 seconds for manual CAPTCHA solve...');
          await randomDelay(30000, 35000);
        }

        if (await isBlocked(this.page)) {
          this.log('Still blocked, trying known product URLs...', 'warn');
        }
      }

      // Human-like scrolling to load lazy content
      await humanScroll(this.page);
      await randomDelay(2000, 4000);
      await humanScroll(this.page);
      await randomDelay(1000, 2000);

      // Try to handle cookie consent
      await this.handleCookieConsent();

      // Extract products from search results
      this.log('Extracting products from search results...');
      await this.extractProductsFromSearch();

      // If search didn't work, try known product URLs
      if (this.products.length === 0) {
        this.log('No products from search, trying known product URLs...');
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

  private async handleCookieConsent(): Promise<void> {
    if (!this.page) return;

    try {
      // REWE uses various cookie consent buttons
      const consentSelectors = [
        '#uc-btn-accept-banner',
        '[data-testid="uc-accept-all-button"]',
        'button[class*="accept"]',
        'button:has-text("Alle akzeptieren")',
        'button:has-text("Akzeptieren")',
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
      await this.page.waitForSelector('.search-service-productList, [data-testid="product-list"], .ProductList', {
        timeout: 15000,
      }).catch(() => {
        this.log('Product list selector not found, trying alternatives...');
      });

      // Try multiple selectors for product tiles
      const productSelectors = [
        '.search-service-productDetailsWrapper',
        '[data-testid="product-tile"]',
        '.ProductTile',
        '[class*="ProductCard"]',
        'article[class*="product"]',
        '.product-item',
        'a[href*="/p/planted"]',
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
        // Fallback: find all links to Planted products
        const productLinks = await this.page.$$eval('a[href*="/p/"]', (links) => {
          return links.map((link: any) => ({
            href: link.href as string,
            text: (link.textContent?.trim() || '') as string,
          })).filter((l: { href: string; text: string }) =>
            l.href.toLowerCase().includes('planted') ||
            l.text.toLowerCase().includes('planted')
          );
        });

        this.log(`Found ${productLinks.length} product links containing 'planted'`);

        for (const link of productLinks) {
          const match = link.href.match(/\/p\/[^/]+\/(\d+)/);
          if (match && !this.products.find(p => p.id === match[1])) {
            this.products.push({
              id: match[1],
              name: link.text || `Planted Product ${match[1]}`,
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
            const link = el.querySelector('a[href*="/p/"]') || el.closest('a[href*="/p/"]');
            const nameEl = el.querySelector('[class*="productName"], [class*="title"], h3, h4, .ProductTitle');
            const priceEl = el.querySelector('[class*="Price"], [class*="price"], [data-testid="price"]');
            const imageEl = el.querySelector('img');
            const weightEl = el.querySelector('[class*="grammage"], [class*="weight"], .ProductWeight');

            const href = link?.href || '';
            const idMatch = href.match(/\/p\/[^/]+\/(\d+)/);

            // Parse price - REWE shows "2,99 €" format
            let priceText = priceEl?.textContent?.trim() || '';
            // Convert German format to number
            const priceMatch = priceText.match(/(\d+)[,.](\d+)/);
            const price = priceMatch ? parseFloat(`${priceMatch[1]}.${priceMatch[2]}`) : 0;

            return {
              id: idMatch ? idMatch[1] : '',
              name: nameEl?.textContent?.trim() || '',
              price,
              weight: weightEl?.textContent?.trim() || '',
              imageUrl: imageEl?.src || '',
              productUrl: href,
            };
          }, element);

          const nameLower = product.name.toLowerCase();
          if (product.id && (nameLower.includes('planted') || product.productUrl.includes('planted'))) {
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

  private async scrapeKnownProducts(options: ScraperOptions): Promise<void> {
    if (!this.page) return;

    const limit = Math.min(
      options.maxItems || this.config.maxProducts || 50,
      KNOWN_PRODUCTS.length
    );

    for (let i = 0; i < limit; i++) {
      const known = KNOWN_PRODUCTS[i];
      const productUrl = `https://shop.rewe.de/p/${known.slug}/${known.id}`;

      this.log(`Fetching product ${i + 1}/${limit}: ${known.name}`);

      try {
        await randomDelay(this.config.minDelay!, this.config.maxDelay!);

        const navigated = await safeNavigate(this.page, productUrl, {
          minDelay: 2000,
          maxDelay: 4000,
        });

        if (!navigated) {
          this.log(`  Failed to navigate to product ${known.id}`, 'warn');
          continue;
        }

        // Check for blocking
        if (await isBlocked(this.page)) {
          this.log('CAPTCHA detected during product scrape', 'warn');
          if (!this.config.headless) {
            await randomDelay(20000, 25000);
            if (await isBlocked(this.page)) break;
          } else {
            break;
          }
        }

        // Handle cookie consent on product page
        await this.handleCookieConsent();

        // Extract product details
        const product = await this.extractProductDetails(known.id, productUrl, known.name);
        if (product) {
          this.products.push(product);
        }
      } catch (error) {
        this.log(`Error fetching product ${known.id}: ${error}`, 'warn');
      }
    }
  }

  private async extractProductDetails(productId: string, productUrl: string, fallbackName: string): Promise<ReweProduct | null> {
    if (!this.page) return null;

    try {
      await randomDelay(1000, 2000);

      const details = await this.page.evaluate(() => {
        const doc = (globalThis as any).document;

        // Product name
        const nameEl = doc.querySelector(
          'h1[class*="productName"], ' +
          '[data-testid="product-title"], ' +
          '.ProductDetailsHeadline, ' +
          'h1'
        );

        // Price - REWE uses various formats
        const priceEl = doc.querySelector(
          '[class*="productPrice"], ' +
          '[data-testid="price"], ' +
          '.Price, ' +
          '[class*="price-value"]'
        );

        // Weight/size
        const weightEl = doc.querySelector(
          '[class*="grammage"], ' +
          '[class*="packSize"], ' +
          '.ProductGrammage'
        );

        // Price per kg
        const pricePerKgEl = doc.querySelector(
          '[class*="basePrice"], ' +
          '[class*="pricePerUnit"]'
        );

        // Image
        const imageEl = doc.querySelector(
          '.ProductImage img, ' +
          '[data-testid="product-image"] img, ' +
          'img[class*="product"]'
        );

        // Availability
        const unavailableEl = doc.querySelector(
          '[class*="outOfStock"], ' +
          '[class*="unavailable"], ' +
          '.NotAvailable'
        );

        // Parse price
        let priceText = priceEl?.textContent?.trim() || '';
        const priceMatch = priceText.match(/(\d+)[,.](\d+)/);
        const price = priceMatch ? parseFloat(`${priceMatch[1]}.${priceMatch[2]}`) : 0;

        return {
          name: nameEl?.textContent?.trim() || '',
          price,
          weight: weightEl?.textContent?.trim() || '',
          pricePerKg: pricePerKgEl?.textContent?.trim() || '',
          imageUrl: imageEl?.src || '',
          available: !unavailableEl,
        };
      });

      // Use fallback name if not found
      const productName = details.name || fallbackName;

      if (!productName.toLowerCase().includes('planted')) {
        this.log(`  Product ${productId} doesn't appear to be a Planted product`, 'warn');
        return null;
      }

      if (this.verbose) {
        this.log(`  Found: ${productName} - EUR ${details.price.toFixed(2)} ${details.available ? '' : '(OUT OF STOCK)'}`);
      }

      return {
        id: productId,
        name: productName,
        price: details.price,
        currency: 'EUR',
        weight: details.weight,
        pricePerKg: details.pricePerKg,
        imageUrl: details.imageUrl,
        productUrl,
        available: details.available,
      };
    } catch (error) {
      this.log(`Error extracting product details: ${error}`, 'warn');
      return null;
    }
  }

  private async saveToDatabase(): Promise<void> {
    // TODO: Implement database save
    // This will create/update:
    // 1. Chain entry for "REWE"
    // 2. Product entries for each Planted product
    // 3. RetailAvailability entries
    this.log('Database save not implemented yet - use with --dry-run for now');
  }

  private logProducts(): void {
    console.log('\n' + '='.repeat(60));
    console.log('REWE GERMANY - PLANTED PRODUCTS');
    console.log('='.repeat(60));

    if (this.products.length === 0) {
      console.log('No products found.');
      console.log('\nPossible reasons:');
      console.log('  - CAPTCHA/bot protection active');
      console.log('  - Products not available in selected region');
      console.log('  - Website structure changed');
      console.log('\nTry running with --headful --slow for manual CAPTCHA solving');
      return;
    }

    for (const product of this.products) {
      console.log(`\n  ${product.name}`);
      console.log(`    ID: ${product.id}`);
      console.log(`    Price: ${product.currency} ${product.price.toFixed(2)}`);
      if (product.weight) console.log(`    Weight: ${product.weight}`);
      if (product.pricePerKg) console.log(`    Price/kg: ${product.pricePerKg}`);
      console.log(`    Available: ${product.available ? 'Yes' : 'No'}`);
      console.log(`    URL: ${product.productUrl}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log(`Total products: ${this.products.length}`);
    const available = this.products.filter(p => p.available).length;
    console.log(`Available: ${available}, Out of stock: ${this.products.length - available}`);
    console.log('='.repeat(60) + '\n');

    // Output as JSON
    console.log('JSON output:');
    console.log(JSON.stringify(this.products, null, 2));
  }

  private log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const prefix = '[ReweScraper]';
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
