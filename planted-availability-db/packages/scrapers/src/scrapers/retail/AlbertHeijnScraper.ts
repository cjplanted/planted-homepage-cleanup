/**
 * Albert Heijn (Netherlands) Retail Scraper
 *
 * Scrapes Planted products from ah.nl using browser automation.
 * Albert Heijn is the largest supermarket chain in the Netherlands with ~1,000+ stores.
 *
 * Target: https://www.ah.nl/producten/merk/planted
 *
 * Known Planted products at AH:
 * - Planted Steak (€4.49/120g)
 * - Planted Steak puntjes (€4.49/180g)
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

export interface AlbertHeijnScraperConfig {
  headless?: boolean;
  minDelay?: number;
  maxDelay?: number;
  maxProducts?: number;
}

interface AlbertHeijnProduct {
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

const DEFAULT_CONFIG: AlbertHeijnScraperConfig = {
  headless: true,
  minDelay: 3000,
  maxDelay: 7000,
  maxProducts: 50,
};

// Known Planted product URLs at Albert Heijn
const KNOWN_PRODUCTS = [
  {
    id: 'wi589939',
    name: 'Planted Steak',
    url: 'https://www.ah.nl/producten/product/wi589939/planted-steak',
  },
  {
    id: 'wi598996',
    name: 'Planted Steak puntjes',
    url: 'https://www.ah.nl/producten/product/wi598996/planted-steak-puntjes',
  },
];

// Search terms for discovery
const SEARCH_TERMS = ['planted', 'planted steak'];

export class AlbertHeijnScraper {
  private config: AlbertHeijnScraperConfig;
  private browser: Browser | null = null;
  private page: Page | null = null;
  private products: AlbertHeijnProduct[] = [];
  private verbose: boolean = false;

  constructor(config: AlbertHeijnScraperConfig = {}) {
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
      this.log('Initializing stealth browser for Albert Heijn...');
      this.browser = await createStealthBrowser({
        headless: this.config.headless,
        slowMo: 100,
      });

      this.page = await this.browser.newPage();
      await configurePage(this.page, {
        minDelay: this.config.minDelay,
        maxDelay: this.config.maxDelay,
      });

      // Set Dutch locale
      await this.page.setExtraHTTPHeaders({
        'Accept-Language': 'nl-NL,nl;q=0.9,en;q=0.8',
      });

      // First try the brand page
      this.log('Checking Planted brand page on Albert Heijn...');
      const brandUrl = 'https://www.ah.nl/producten/merk/planted';

      const navigated = await safeNavigate(this.page, brandUrl, {
        minDelay: this.config.minDelay,
        maxDelay: this.config.maxDelay,
      });

      if (navigated) {
        // Handle cookie consent
        await this.handleCookieConsent();

        // Check for blocking
        if (await isBlocked(this.page)) {
          this.log('CAPTCHA detected', 'warn');
          if (!this.config.headless) {
            this.log('Waiting 30 seconds for manual CAPTCHA solve...');
            await randomDelay(30000, 35000);
          }
        }

        // Human-like scrolling
        await humanScroll(this.page);
        await randomDelay(2000, 4000);

        // Extract products from brand page
        await this.extractProductsFromPage();
      }

      // If brand page didn't work, try search
      if (this.products.length === 0) {
        for (const searchTerm of SEARCH_TERMS) {
          if (this.products.length >= (this.config.maxProducts || 50)) break;

          const searchUrl = `https://www.ah.nl/zoeken?query=${encodeURIComponent(searchTerm)}`;
          this.log(`Searching for: "${searchTerm}"`);

          const searchNavigated = await safeNavigate(this.page, searchUrl, {
            minDelay: this.config.minDelay,
            maxDelay: this.config.maxDelay,
          });

          if (searchNavigated) {
            await this.handleCookieConsent();
            await humanScroll(this.page);
            await randomDelay(2000, 4000);
            await this.extractProductsFromPage();
          }

          await randomDelay(this.config.minDelay!, this.config.maxDelay!);
        }
      }

      // Fallback: try known product URLs directly
      if (this.products.length === 0) {
        this.log('Trying known product URLs...');
        await this.scrapeKnownProducts();
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
      // Albert Heijn cookie consent selectors
      const consentSelectors = [
        'button[data-testid="accept-cookies"]',
        '#accept-cookies',
        'button:has-text("Accepteer alle cookies")',
        'button:has-text("Alles accepteren")',
        'button[class*="cookie-accept"]',
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

  private async extractProductsFromPage(): Promise<void> {
    if (!this.page) return;

    try {
      // Wait for product grid
      await this.page.waitForSelector('[data-testhook="product-card"], [class*="ProductCard"], article[class*="product"]', {
        timeout: 15000,
      }).catch(() => {
        this.log('Product cards not found, trying alternatives...');
      });

      // Try multiple selectors for product cards
      const productSelectors = [
        '[data-testhook="product-card"]',
        '[class*="ProductCard"]',
        'article[class*="product"]',
        'a[href*="/producten/product/"]',
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
        const productLinks = await this.page.$$eval('a[href*="/producten/product/"]', (links) => {
          return links.map((link: any) => ({
            href: link.href as string,
            text: (link.textContent?.trim() || '') as string,
          })).filter((l: { href: string; text: string }) =>
            l.text.toLowerCase().includes('planted')
          );
        });

        this.log(`Found ${productLinks.length} product links containing 'planted'`);

        for (const link of productLinks) {
          const match = link.href.match(/\/product\/([^/]+)/);
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
            const link = el.querySelector('a[href*="/producten/product/"]') || el.closest('a[href*="/producten/product/"]');
            const nameEl = el.querySelector('[data-testhook="product-title"], h2, h3, [class*="title"]');
            const priceEl = el.querySelector('[data-testhook="price"], [class*="Price"], [class*="price"]');
            const imageEl = el.querySelector('img');
            const weightEl = el.querySelector('[data-testhook="product-unit-size"], [class*="unit"]');

            const href = link?.href || '';

            // Parse price - AH shows "€4,49" format
            let priceText = priceEl?.textContent?.trim() || '';
            // Handle split price display (euros and cents in separate elements)
            const priceMatch = priceText.match(/€?\s*(\d+)[,.](\d+)/);
            const price = priceMatch ? parseFloat(`${priceMatch[1]}.${priceMatch[2]}`) : 0;

            return {
              id: href.split('/product/')[1]?.split('/')[0] || '',
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
                currency: 'EUR',
                weight: product.weight,
                imageUrl: product.imageUrl,
                productUrl: product.productUrl,
                available: true,
              });

              if (this.verbose) {
                this.log(`  Found: ${product.name} - €${product.price.toFixed(2)}`);
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

  private async scrapeKnownProducts(): Promise<void> {
    if (!this.page) return;

    for (const knownProduct of KNOWN_PRODUCTS) {
      try {
        this.log(`Checking known product: ${knownProduct.name}`);

        const navigated = await safeNavigate(this.page, knownProduct.url, {
          minDelay: this.config.minDelay,
          maxDelay: this.config.maxDelay,
        });

        if (!navigated) continue;

        await this.handleCookieConsent();
        await randomDelay(2000, 3000);

        // Extract product details from product page
        const productData = await this.page.evaluate(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const doc = (globalThis as any).document;
          const nameEl = doc.querySelector('h1, [data-testhook="product-title"]');
          const priceEl = doc.querySelector('[data-testhook="price"], [class*="price-amount"]');
          const weightEl = doc.querySelector('[data-testhook="product-unit-size"]');
          const imageEl = doc.querySelector('img[class*="product"]');

          let priceText = priceEl?.textContent?.trim() || '';
          const priceMatch = priceText.match(/€?\s*(\d+)[,.](\d+)/);
          const price = priceMatch ? parseFloat(`${priceMatch[1]}.${priceMatch[2]}`) : 0;

          return {
            name: nameEl?.textContent?.trim() || '',
            price,
            weight: weightEl?.textContent?.trim() || '',
            imageUrl: imageEl?.src || '',
            available: !doc.body.textContent?.includes('niet beschikbaar'),
          };
        });

        if (productData.name) {
          this.products.push({
            id: knownProduct.id,
            name: productData.name,
            price: productData.price,
            currency: 'EUR',
            weight: productData.weight,
            imageUrl: productData.imageUrl,
            productUrl: knownProduct.url,
            available: productData.available,
          });

          if (this.verbose) {
            this.log(`  Found: ${productData.name} - €${productData.price.toFixed(2)}`);
          }
        }
      } catch (error) {
        this.log(`Error scraping known product ${knownProduct.name}: ${error}`, 'warn');
      }

      await randomDelay(this.config.minDelay!, this.config.maxDelay!);
    }
  }

  private async saveToDatabase(): Promise<void> {
    this.log('Database save not implemented yet - use with --dry-run for now');
  }

  private logProducts(): void {
    console.log('\n' + '='.repeat(60));
    console.log('ALBERT HEIJN (NETHERLANDS) - PLANTED PRODUCTS');
    console.log('='.repeat(60));

    if (this.products.length === 0) {
      console.log('No products found.');
      console.log('\nPossible reasons:');
      console.log('  - CAPTCHA/bot protection active');
      console.log('  - Products temporarily out of stock');
      console.log('  - Website structure changed');
      console.log('\nTry running with --headful --slow for manual verification');
      console.log('\nKnown products at Albert Heijn:');
      for (const p of KNOWN_PRODUCTS) {
        console.log(`  - ${p.name}: ${p.url}`);
      }
      return;
    }

    for (const product of this.products) {
      console.log(`\n  ${product.name}`);
      console.log(`    ID: ${product.id}`);
      if (product.price > 0) {
        console.log(`    Price: €${product.price.toFixed(2)}`);
      }
      if (product.weight) console.log(`    Weight: ${product.weight}`);
      console.log(`    Available: ${product.available ? 'Yes' : 'No'}`);
      console.log(`    URL: ${product.productUrl}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log(`Total products: ${this.products.length}`);
    console.log('='.repeat(60) + '\n');

    console.log('JSON output:');
    console.log(JSON.stringify(this.products, null, 2));
  }

  private log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const prefix = '[AlbertHeijnScraper]';
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
