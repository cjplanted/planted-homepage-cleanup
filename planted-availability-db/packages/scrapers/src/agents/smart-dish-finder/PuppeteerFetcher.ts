/**
 * Puppeteer-based Page Fetcher
 *
 * Fetches delivery platform pages using a headless browser to handle
 * JavaScript-rendered content. Includes stealth mode to avoid detection.
 */

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { Browser, Page } from 'puppeteer';
import type {
  VenuePage,
  DeliveryPlatform,
  SupportedCountry,
  DishFinderConfig,
} from '@pad/core';

// Add stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

export interface FetchResult {
  success: boolean;
  page?: VenuePage;
  error?: string;
  retryable?: boolean;
}

export interface FetchOptions {
  waitForSelector?: string;
  scrollToBottom?: boolean;
  extractJson?: boolean;
  timeout?: number;
}

// User agents to rotate
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
];

// Platform-specific selectors for waiting until page is loaded
const PLATFORM_WAIT_SELECTORS: Record<DeliveryPlatform, string> = {
  'uber-eats': '[data-testid="menu-item"]',
  'lieferando': '[data-qa="menu-item"], .menu-item',
  'wolt': '[data-test-id="menu-item"], .MenuItem',
  'just-eat': '.menu-item, [data-test-id="menu-item"]',
  'smood': '.menu-item, .product-card',
};

// Platform URL patterns for country detection
const PLATFORM_COUNTRY_PATTERNS: Record<DeliveryPlatform, Record<SupportedCountry, RegExp>> = {
  'uber-eats': {
    CH: /ubereats\.com\/ch/i,
    DE: /ubereats\.com\/de/i,
    AT: /ubereats\.com\/at/i,
  },
  'lieferando': {
    CH: /eat\.ch/i, // Just Eat owns eat.ch but sometimes Lieferando links redirect
    DE: /lieferando\.de/i,
    AT: /lieferando\.at/i,
  },
  'wolt': {
    CH: /wolt\.com\/[a-z]{2}\/che/i,
    DE: /wolt\.com\/[a-z]{2}\/deu/i,
    AT: /wolt\.com\/[a-z]{2}\/aut/i,
  },
  'just-eat': {
    CH: /just-eat\.ch|eat\.ch/i,
    DE: /just-eat\.de/i, // Rare but possible
    AT: /just-eat\.at/i, // Rare but possible
  },
  'smood': {
    CH: /smood\.ch/i,
    DE: /smood\.de/i, // Doesn't really exist
    AT: /smood\.at/i, // Doesn't really exist
  },
};

export class PuppeteerFetcher {
  private browser: Browser | null = null;
  private config: DishFinderConfig['puppeteer'];
  private userAgentIndex = 0;

  constructor(config?: Partial<DishFinderConfig['puppeteer']>) {
    const { DEFAULT_DISH_FINDER_CONFIG } = require('@pad/core');
    this.config = {
      ...DEFAULT_DISH_FINDER_CONFIG.puppeteer,
      ...config,
    };
  }

  /**
   * Initialize the browser
   */
  async init(): Promise<void> {
    if (this.browser) return;

    this.browser = await puppeteer.launch({
      headless: this.config.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1280,800',
      ],
    });
  }

  /**
   * Close the browser
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Get the next user agent (rotates through list)
   */
  private getNextUserAgent(): string {
    const ua = USER_AGENTS[this.userAgentIndex];
    this.userAgentIndex = (this.userAgentIndex + 1) % USER_AGENTS.length;
    return ua;
  }

  /**
   * Detect platform from URL
   */
  detectPlatform(url: string): DeliveryPlatform | null {
    if (url.includes('ubereats.com')) return 'uber-eats';
    if (url.includes('lieferando.de') || url.includes('lieferando.at')) return 'lieferando';
    if (url.includes('wolt.com')) return 'wolt';
    if (url.includes('just-eat.ch') || url.includes('eat.ch')) return 'just-eat';
    if (url.includes('smood.ch')) return 'smood';
    return null;
  }

  /**
   * Detect country from URL
   */
  detectCountry(url: string, platform: DeliveryPlatform): SupportedCountry | null {
    const patterns = PLATFORM_COUNTRY_PATTERNS[platform];

    for (const [country, pattern] of Object.entries(patterns)) {
      if (pattern.test(url)) {
        return country as SupportedCountry;
      }
    }

    return null;
  }

  /**
   * Fetch a venue page
   */
  async fetchPage(
    url: string,
    venueInfo: {
      venue_id: string;
      venue_name: string;
      chain_id?: string;
    },
    options?: FetchOptions
  ): Promise<FetchResult> {
    if (!this.browser) {
      await this.init();
    }

    const platform = this.detectPlatform(url);
    if (!platform) {
      return {
        success: false,
        error: `Unknown platform for URL: ${url}`,
        retryable: false,
      };
    }

    const country = this.detectCountry(url, platform);
    if (!country) {
      return {
        success: false,
        error: `Could not detect country for URL: ${url}`,
        retryable: false,
      };
    }

    let page: Page | null = null;

    try {
      page = await this.browser!.newPage();

      // Set viewport
      await page.setViewport(this.config.viewport);

      // Set user agent
      await page.setUserAgent(this.getNextUserAgent());

      // Set extra headers
      await page.setExtraHTTPHeaders({
        'Accept-Language': country === 'CH' ? 'de-CH,de;q=0.9,en;q=0.8' :
                          country === 'AT' ? 'de-AT,de;q=0.9,en;q=0.8' :
                          'de-DE,de;q=0.9,en;q=0.8',
      });

      // Navigate to the page
      const response = await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: options?.timeout || this.config.timeout_ms,
      });

      if (!response) {
        return {
          success: false,
          error: 'No response from page',
          retryable: true,
        };
      }

      const status = response.status();
      if (status >= 400) {
        return {
          success: false,
          error: `HTTP ${status}`,
          retryable: status >= 500, // Retry server errors
        };
      }

      // Wait for menu content to load
      const waitSelector = options?.waitForSelector || PLATFORM_WAIT_SELECTORS[platform];
      try {
        await page.waitForSelector(waitSelector, {
          timeout: 10000,
        });
      } catch {
        // Menu selector not found, but page might still have content
        console.warn(`Menu selector not found for ${platform}, continuing anyway`);
      }

      // Scroll to load lazy content if requested
      if (options?.scrollToBottom) {
        await this.scrollToBottom(page);
      }

      // Get page content
      const html = await page.content();

      // Try to extract JSON data if requested
      let jsonData: unknown = undefined;
      if (options?.extractJson !== false) {
        jsonData = await this.extractJsonData(page, platform);
      }

      return {
        success: true,
        page: {
          url,
          platform,
          country,
          venue_name: venueInfo.venue_name,
          venue_id: venueInfo.venue_id,
          chain_id: venueInfo.chain_id,
          html,
          json_data: jsonData,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      // Determine if retryable
      const retryable = message.includes('timeout') ||
                       message.includes('Navigation') ||
                       message.includes('net::');

      return {
        success: false,
        error: message,
        retryable,
      };
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  /**
   * Scroll to bottom of page to trigger lazy loading
   */
  private async scrollToBottom(page: Page): Promise<void> {
    await page.evaluate(async () => {
      await new Promise<void>((resolve) => {
        let totalHeight = 0;
        const distance = 100;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;

          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 100);

        // Safety timeout
        setTimeout(() => {
          clearInterval(timer);
          resolve();
        }, 10000);
      });
    });

    // Wait a bit for content to load
    await new Promise((r) => setTimeout(r, 1000));
  }

  /**
   * Extract JSON data embedded in page (many platforms use this)
   */
  private async extractJsonData(page: Page, platform: DeliveryPlatform): Promise<unknown> {
    try {
      switch (platform) {
        case 'uber-eats':
          // Uber Eats uses Next.js with __NEXT_DATA__
          return await page.evaluate(() => {
            const script = document.getElementById('__NEXT_DATA__');
            if (script) {
              try {
                return JSON.parse(script.textContent || '{}');
              } catch {
                return null;
              }
            }
            return null;
          });

        case 'wolt':
          // Wolt has JSON-LD and also __NEXT_DATA__
          return await page.evaluate(() => {
            // Try __NEXT_DATA__ first
            const nextData = document.getElementById('__NEXT_DATA__');
            if (nextData) {
              try {
                return JSON.parse(nextData.textContent || '{}');
              } catch {
                // Continue to JSON-LD
              }
            }

            // Try JSON-LD
            const jsonLd = document.querySelector('script[type="application/ld+json"]');
            if (jsonLd) {
              try {
                return JSON.parse(jsonLd.textContent || '{}');
              } catch {
                return null;
              }
            }

            return null;
          });

        case 'lieferando':
          // Lieferando embeds menu data in window.__INITIAL_STATE__
          return await page.evaluate(() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const w = window as any;
            if (w.__INITIAL_STATE__) {
              return w.__INITIAL_STATE__;
            }

            // Also check for JSON-LD
            const jsonLd = document.querySelector('script[type="application/ld+json"]');
            if (jsonLd) {
              try {
                return JSON.parse(jsonLd.textContent || '{}');
              } catch {
                return null;
              }
            }

            return null;
          });

        case 'just-eat':
        case 'smood':
          // Try generic JSON-LD extraction
          return await page.evaluate(() => {
            const scripts = document.querySelectorAll('script[type="application/ld+json"]');
            const data: unknown[] = [];

            scripts.forEach((script: Element) => {
              try {
                data.push(JSON.parse(script.textContent || '{}'));
              } catch {
                // Skip invalid JSON
              }
            });

            return data.length > 0 ? (data.length === 1 ? data[0] : data) : null;
          });

        default:
          return null;
      }
    } catch (error) {
      console.warn(`Failed to extract JSON data: ${error}`);
      return null;
    }
  }

  /**
   * Batch fetch multiple pages with rate limiting
   */
  async fetchPages(
    urls: Array<{
      url: string;
      venue_id: string;
      venue_name: string;
      chain_id?: string;
    }>,
    rateLimitMs: number = 3000,
    options?: FetchOptions
  ): Promise<Map<string, FetchResult>> {
    const results = new Map<string, FetchResult>();

    for (const { url, venue_id, venue_name, chain_id } of urls) {
      const result = await this.fetchPage(
        url,
        { venue_id, venue_name, chain_id },
        options
      );

      results.set(venue_id, result);

      // Rate limiting
      if (urls.indexOf({ url, venue_id, venue_name, chain_id }) < urls.length - 1) {
        await new Promise((r) => setTimeout(r, rateLimitMs));
      }
    }

    return results;
  }
}

// Singleton instance
let fetcherInstance: PuppeteerFetcher | null = null;

export function getPuppeteerFetcher(config?: Partial<DishFinderConfig['puppeteer']>): PuppeteerFetcher {
  if (!fetcherInstance) {
    fetcherInstance = new PuppeteerFetcher(config);
  }
  return fetcherInstance;
}

export async function closePuppeteerFetcher(): Promise<void> {
  if (fetcherInstance) {
    await fetcherInstance.close();
    fetcherInstance = null;
  }
}
