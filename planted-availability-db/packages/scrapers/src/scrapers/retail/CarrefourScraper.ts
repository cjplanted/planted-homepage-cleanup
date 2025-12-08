/**
 * Carrefour Multi-Market Retail Scraper
 *
 * Scrapes Planted products from Carrefour in France, Spain, and Italy.
 * Carrefour is one of the world's largest hypermarket chains.
 *
 * Targets:
 * - carrefour.fr (France)
 * - carrefour.es (Spain)
 * - carrefour.it (Italy)
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

export interface CarrefourScraperConfig {
  countries?: Array<'FR' | 'ES' | 'IT'>;
  headless?: boolean;
  minDelay?: number;
  maxDelay?: number;
  maxProducts?: number;
}

interface CarrefourProduct {
  id: string;
  name: string;
  price: number;
  currency: string;
  weight?: string;
  imageUrl?: string;
  productUrl: string;
  available: boolean;
  country: string;
}

const DEFAULT_CONFIG: CarrefourScraperConfig = {
  countries: ['FR', 'ES', 'IT'],
  headless: true,
  minDelay: 3000,
  maxDelay: 7000,
  maxProducts: 50,
};

// Country-specific configurations
const COUNTRY_CONFIG: Record<string, {
  domain: string;
  searchPath: string;
  locale: string;
  currency: string;
}> = {
  FR: {
    domain: 'www.carrefour.fr',
    searchPath: '/s?q=',
    locale: 'fr-FR',
    currency: 'EUR',
  },
  ES: {
    domain: 'www.carrefour.es',
    searchPath: '/s?q=',
    locale: 'es-ES',
    currency: 'EUR',
  },
  IT: {
    domain: 'www.carrefour.it',
    searchPath: '/spesa-online/ricerca?q=',
    locale: 'it-IT',
    currency: 'EUR',
  },
};

// Search terms by language
const SEARCH_TERMS: Record<string, string[]> = {
  FR: ['planted', 'planted chicken', 'viande végétale planted'],
  ES: ['planted', 'planted chicken', 'carne vegetal planted'],
  IT: ['planted', 'planted chicken', 'carne vegetale planted'],
};

export class CarrefourScraper {
  private config: CarrefourScraperConfig;
  private browser: Browser | null = null;
  private page: Page | null = null;
  private products: CarrefourProduct[] = [];
  private verbose: boolean = false;

  constructor(config: CarrefourScraperConfig = {}) {
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
      this.log('Initializing stealth browser for Carrefour...');
      this.browser = await createStealthBrowser({
        headless: this.config.headless,
        slowMo: 100,
      });

      this.page = await this.browser.newPage();
      await configurePage(this.page, {
        minDelay: this.config.minDelay,
        maxDelay: this.config.maxDelay,
      });

      const countries = this.config.countries || DEFAULT_CONFIG.countries!;

      for (const country of countries) {
        this.log(`\nSearching for Planted products on Carrefour ${country}...`);

        try {
          await this.scrapeCountry(country);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.log(`Error scraping Carrefour ${country}: ${errorMessage}`, 'warn');
          result.errors?.push(`${country}: ${errorMessage}`);
        }

        // Delay between countries
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

  private async scrapeCountry(country: 'FR' | 'ES' | 'IT'): Promise<void> {
    if (!this.page) return;

    const config = COUNTRY_CONFIG[country];
    const searchTerms = SEARCH_TERMS[country];

    // Set appropriate locale
    await this.page.setExtraHTTPHeaders({
      'Accept-Language': `${config.locale},en;q=0.8`,
    });

    for (const searchTerm of searchTerms) {
      if (this.products.filter(p => p.country === country).length >= (this.config.maxProducts || 50)) break;

      const searchUrl = `https://${config.domain}${config.searchPath}${encodeURIComponent(searchTerm)}`;
      this.log(`Searching ${country} for: "${searchTerm}"`);

      const navigated = await safeNavigate(this.page, searchUrl, {
        minDelay: this.config.minDelay,
        maxDelay: this.config.maxDelay,
      });

      if (!navigated) {
        this.log(`Failed to navigate to ${country} search`, 'warn');
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
          throw new Error('Blocked by CAPTCHA');
        }
      }

      // Human-like scrolling
      await humanScroll(this.page);
      await randomDelay(2000, 4000);

      // Extract products
      await this.extractProductsFromSearch(country, config.currency);

      // Delay between searches
      await randomDelay(this.config.minDelay!, this.config.maxDelay!);
    }
  }

  private async handleCookieConsent(): Promise<void> {
    if (!this.page) return;

    try {
      const consentSelectors = [
        '#onetrust-accept-btn-handler',
        'button[data-testid="accept-cookies"]',
        'button:has-text("Tout accepter")',
        'button:has-text("Aceptar todo")',
        'button:has-text("Accetta tutti")',
        'button:has-text("Accept All")',
        '.cookie-consent-accept',
        '#accept-all-cookies',
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

  private async extractProductsFromSearch(country: string, currency: string): Promise<void> {
    if (!this.page) return;

    try {
      // Wait for product list
      await this.page.waitForSelector('[data-testid="product-card"], .product-card, article[class*="product"]', {
        timeout: 15000,
      }).catch(() => {
        this.log('Product cards not found, trying alternatives...');
      });

      // Try multiple selectors for product cards
      const productSelectors = [
        '[data-testid="product-card"]',
        '.product-card',
        'article[class*="product"]',
        'a[href*="/p/"]',
        'a[href*="/product/"]',
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
        const productLinks = await this.page.$$eval('a[href*="/p/"], a[href*="/product/"]', (links) => {
          return links.map((link: any) => ({
            href: link.href as string,
            text: (link.textContent?.trim() || '') as string,
          })).filter((l: { href: string; text: string }) =>
            l.text.toLowerCase().includes('planted')
          );
        });

        this.log(`Found ${productLinks.length} product links containing 'planted'`);

        for (const link of productLinks) {
          const match = link.href.match(/\/p\/([^/?]+)/) || link.href.match(/\/product\/([^/?]+)/);
          const id = match ? match[1] : link.href;

          if (!this.products.find(p => p.id === id && p.country === country)) {
            this.products.push({
              id,
              name: link.text,
              price: 0,
              currency,
              productUrl: link.href,
              available: true,
              country,
            });
          }
        }
        return;
      }

      // Extract data from product elements
      for (const element of productElements) {
        try {
          const product = await this.page.evaluate((el: any) => {
            const link = el.querySelector('a[href*="/p/"], a[href*="/product/"]') || el.closest('a');
            const nameEl = el.querySelector('[data-testid="product-name"], h2, h3, [class*="title"], [class*="name"]');
            const priceEl = el.querySelector('[data-testid="product-price"], [class*="price"]');
            const imageEl = el.querySelector('img');
            const weightEl = el.querySelector('[data-testid="product-unit"], [class*="unit"], [class*="weight"]');

            const href = link?.href || '';

            // Parse price - Carrefour shows "2,99 €" or "€2.99" format
            let priceText = priceEl?.textContent?.trim() || '';
            const priceMatch = priceText.match(/(\d+)[,.](\d+)/);
            const price = priceMatch ? parseFloat(`${priceMatch[1]}.${priceMatch[2]}`) : 0;

            const pathMatch = href.match(/\/p\/([^/?]+)/) || href.match(/\/product\/([^/?]+)/);

            return {
              id: pathMatch ? pathMatch[1] : '',
              name: nameEl?.textContent?.trim() || '',
              price,
              weight: weightEl?.textContent?.trim() || '',
              imageUrl: imageEl?.src || '',
              productUrl: href,
            };
          }, element);

          const nameLower = product.name.toLowerCase();
          if (product.id && (nameLower.includes('planted') || product.productUrl.toLowerCase().includes('planted'))) {
            if (!this.products.find(p => p.id === product.id && p.country === country)) {
              this.products.push({
                id: product.id,
                name: product.name,
                price: product.price,
                currency,
                weight: product.weight,
                imageUrl: product.imageUrl,
                productUrl: product.productUrl,
                available: true,
                country,
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

  private async saveToDatabase(): Promise<void> {
    this.log('Database save not implemented yet - use with --dry-run for now');
  }

  private logProducts(): void {
    console.log('\n' + '='.repeat(60));
    console.log('CARREFOUR (FR/ES/IT) - PLANTED PRODUCTS');
    console.log('='.repeat(60));

    if (this.products.length === 0) {
      console.log('No Planted products found.');
      console.log('\nNote: Planted may have limited availability at Carrefour.');
      console.log('Try running with --headful --slow to debug.');
      return;
    }

    // Group by country
    const byCountry = this.products.reduce((acc, p) => {
      if (!acc[p.country]) acc[p.country] = [];
      acc[p.country].push(p);
      return acc;
    }, {} as Record<string, CarrefourProduct[]>);

    for (const [country, products] of Object.entries(byCountry)) {
      console.log(`\n  Carrefour ${country}:`);
      for (const product of products) {
        console.log(`    ${product.name}`);
        console.log(`      ID: ${product.id}`);
        if (product.price > 0) {
          console.log(`      Price: €${product.price.toFixed(2)}`);
        }
        if (product.weight) console.log(`      Weight: ${product.weight}`);
        console.log(`      URL: ${product.productUrl}`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`Total products: ${this.products.length}`);
    console.log('='.repeat(60) + '\n');

    console.log('JSON output:');
    console.log(JSON.stringify(this.products, null, 2));
  }

  private log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const prefix = '[CarrefourScraper]';
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
