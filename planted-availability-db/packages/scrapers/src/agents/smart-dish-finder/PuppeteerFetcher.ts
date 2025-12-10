/**
 * Puppeteer-based Page Fetcher
 *
 * Fetches delivery platform pages using a headless browser to handle
 * JavaScript-rendered content. Includes stealth mode to avoid detection.
 */

import type { Browser, Page } from 'puppeteer';
import type {
  VenuePage,
  DeliveryPlatform,
  SupportedCountry,
  DishFinderConfig,
} from '@pad/core';

// Puppeteer-extra is loaded dynamically due to ESM compatibility issues
let puppeteerInitialized = false;
let puppeteerModule: { use: (plugin: unknown) => void; launch: (opts: unknown) => Promise<Browser> };

async function initPuppeteer(): Promise<typeof puppeteerModule> {
  if (puppeteerInitialized) return puppeteerModule;

  const puppeteerExtra = await import('puppeteer-extra');
  const puppeteer = (puppeteerExtra.default || puppeteerExtra) as unknown as typeof puppeteerModule;
  const stealthModule = await import('puppeteer-extra-plugin-stealth');
  const StealthPlugin = stealthModule.default || stealthModule;

  puppeteer.use(StealthPlugin());
  puppeteerModule = puppeteer;
  puppeteerInitialized = true;
  return puppeteer;
}

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
  'deliveroo': '[data-test-id="menu-item"], .menu-item',
  'glovo': '.product-row, .menu-item, [data-test-id="product"]',
};

// Platform URL patterns for country detection
const PLATFORM_COUNTRY_PATTERNS: Record<DeliveryPlatform, Partial<Record<SupportedCountry, RegExp>>> = {
  'uber-eats': {
    CH: /ubereats\.com\/ch/i,
    DE: /ubereats\.com\/de/i,
    AT: /ubereats\.com\/at/i,
    NL: /ubereats\.com\/nl/i,
    UK: /ubereats\.com\/gb/i,
    FR: /ubereats\.com\/fr/i,
    ES: /ubereats\.com\/es/i,
    IT: /ubereats\.com\/it/i,
    BE: /ubereats\.com\/be/i,
    PL: /ubereats\.com\/pl/i,
  },
  'lieferando': {
    CH: /eat\.ch/i, // Just Eat owns eat.ch but sometimes Lieferando links redirect
    DE: /lieferando\.de/i,
    AT: /lieferando\.at/i,
    NL: /thuisbezorgd\.nl/i,
    BE: /takeaway\.com\/be/i,
    PL: /pyszne\.pl/i,
  },
  'wolt': {
    CH: /wolt\.com\/[a-z]{2}\/che/i,
    DE: /wolt\.com\/[a-z]{2}\/deu/i,
    AT: /wolt\.com\/[a-z]{2}\/aut/i,
    PL: /wolt\.com\/[a-z]{2}\/pol/i,
  },
  'just-eat': {
    CH: /just-eat\.ch|eat\.ch/i,
    DE: /just-eat\.de/i,
    AT: /just-eat\.at/i,
    NL: /thuisbezorgd\.nl/i,
    UK: /just-eat\.co\.uk/i,
    FR: /just-eat\.fr/i,
    ES: /just-eat\.es/i,
    IT: /justeat\.it/i,
    BE: /takeaway\.com\/be/i,
    PL: /pyszne\.pl/i,
  },
  'smood': {
    CH: /smood\.ch/i,
  },
  'deliveroo': {
    UK: /deliveroo\.co\.uk/i,
    FR: /deliveroo\.fr/i,
    ES: /deliveroo\.es/i,
    IT: /deliveroo\.it/i,
    BE: /deliveroo\.be/i,
    NL: /deliveroo\.nl/i,
  },
  'glovo': {
    ES: /glovoapp\.com\/es/i,
    IT: /glovoapp\.com\/it/i,
    PL: /glovoapp\.com\/pl/i,
  },
};

export class PuppeteerFetcher {
  private browser: Browser | null = null;
  private config: DishFinderConfig['puppeteer'];
  private userAgentIndex = 0;
  private consecutiveFailures = 0;
  private maxConsecutiveFailures = 3;

  constructor(config?: Partial<DishFinderConfig['puppeteer']>) {
    // Import the default config - use dynamic import for ESM compatibility
    this.config = {
      headless: true,
      timeout_ms: 30000,
      viewport: { width: 1280, height: 800 },
      ...config,
    };
  }

  /**
   * Check if the browser is healthy
   */
  private async isBrowserHealthy(): Promise<boolean> {
    if (!this.browser) return false;
    try {
      // Try to get the browser version - this will fail if disconnected
      await this.browser.version();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Initialize the browser
   */
  async init(): Promise<void> {
    if (this.browser && await this.isBrowserHealthy()) return;

    // Close existing browser if it exists but is unhealthy
    if (this.browser) {
      try {
        await this.browser.close();
      } catch {
        // Ignore close errors
      }
      this.browser = null;
    }

    const puppeteer = await initPuppeteer();
    this.browser = await puppeteer.launch({
      headless: this.config.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1280,800',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-sync',
        '--disable-translate',
        '--metrics-recording-only',
        '--mute-audio',
        '--no-first-run',
        '--safebrowsing-disable-auto-update',
      ],
    }) as Browser;

    this.consecutiveFailures = 0;
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
   * Returns 'unknown' for unrecognized platforms to allow AI-based extraction
   */
  detectPlatform(url: string): DeliveryPlatform | 'unknown' {
    if (url.includes('ubereats.com')) return 'uber-eats';
    if (url.includes('lieferando.de') || url.includes('lieferando.at')) return 'lieferando';
    if (url.includes('wolt.com')) return 'wolt';
    if (url.includes('just-eat.ch') || url.includes('eat.ch')) return 'just-eat';
    if (url.includes('smood.ch')) return 'smood';
    // Return 'unknown' for unrecognized platforms - AI will analyze the page
    return 'unknown';
  }

  /**
   * Detect country from URL domain for unknown platforms
   */
  detectCountryFromDomain(url: string): SupportedCountry | null {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.toLowerCase();

      // Check TLD
      if (domain.endsWith('.ch')) return 'CH';
      if (domain.endsWith('.de')) return 'DE';
      if (domain.endsWith('.at')) return 'AT';

      // Check common country indicators in domain
      if (domain.includes('-ch') || domain.includes('swiss') || domain.includes('schweiz')) return 'CH';
      if (domain.includes('-de') || domain.includes('german') || domain.includes('deutsch')) return 'DE';
      if (domain.includes('-at') || domain.includes('austria') || domain.includes('österreich')) return 'AT';

      return null;
    } catch {
      return null;
    }
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
   * Restart the browser if needed after consecutive failures
   */
  private async restartBrowserIfNeeded(): Promise<void> {
    if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
      console.log(`[PuppeteerFetcher] ${this.consecutiveFailures} consecutive failures, restarting browser...`);
      await this.close();
      await this.init();
    }
  }

  /**
   * Fetch a venue page with retry logic
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
    const maxRetries = 2;
    let lastError: string = '';

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const result = await this.fetchPageOnce(url, venueInfo, options);

      if (result.success) {
        this.consecutiveFailures = 0;
        return result;
      }

      lastError = result.error || 'Unknown error';

      // Check if error is retryable
      const isProtocolError = lastError.includes('Protocol error') ||
                              lastError.includes('Connection closed') ||
                              lastError.includes('Target closed');

      if (isProtocolError) {
        this.consecutiveFailures++;
        await this.restartBrowserIfNeeded();

        if (attempt < maxRetries) {
          console.log(`[PuppeteerFetcher] Protocol error on attempt ${attempt + 1}, retrying...`);
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1))); // Backoff
          continue;
        }
      }

      // Non-retryable error or max retries reached
      if (!result.retryable || attempt >= maxRetries) {
        return result;
      }

      // Wait before retrying
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }

    return {
      success: false,
      error: lastError,
      retryable: false,
    };
  }

  /**
   * Fetch a venue page (single attempt)
   */
  private async fetchPageOnce(
    url: string,
    venueInfo: {
      venue_id: string;
      venue_name: string;
      chain_id?: string;
    },
    options?: FetchOptions
  ): Promise<FetchResult> {
    // Ensure browser is initialized and healthy
    if (!this.browser || !(await this.isBrowserHealthy())) {
      await this.init();
    }

    const platform = this.detectPlatform(url);

    // For unknown platforms, try to detect country from domain
    // This enables AI-based extraction from any website
    let country: SupportedCountry | null = null;
    if (platform === 'unknown') {
      country = this.detectCountryFromDomain(url);
      if (!country) {
        // Default to DE for unknown platforms if we can't detect country
        country = 'DE';
        console.log(`[AI Mode] Unknown platform, defaulting to DE for: ${url}`);
      } else {
        console.log(`[AI Mode] Detected country ${country} from domain for: ${url}`);
      }
    } else {
      country = this.detectCountry(url, platform);
      if (!country) {
        return {
          success: false,
          error: `Could not detect country for URL: ${url}`,
          retryable: false,
        };
      }
    }

    let page: Page | null = null;
    let cdpClient: Awaited<ReturnType<Page['createCDPSession']>> | null = null;

    try {
      page = await this.browser!.newPage();

      // Clear browser state to prevent cross-contamination between venues
      // This is critical for platforms like Lieferando that cache menu data in JS state
      cdpClient = await page.createCDPSession();
      await cdpClient.send('Network.clearBrowserCache');
      await cdpClient.send('Network.clearBrowserCookies');
      await cdpClient.send('Storage.clearDataForOrigin', {
        origin: new URL(url).origin,
        storageTypes: 'all',
      });

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
      // For unknown platforms, we skip selector waiting and just wait for content
      if (platform !== 'unknown') {
        const waitSelector = options?.waitForSelector || PLATFORM_WAIT_SELECTORS[platform];
        if (waitSelector) {
          try {
            await page.waitForSelector(waitSelector, {
              timeout: 10000,
            });
          } catch {
            // Menu selector not found, but page might still have content
            console.warn(`Menu selector not found for ${platform}, continuing anyway`);
          }
        }
      } else {
        // For unknown platforms, just wait a bit for dynamic content to load
        console.log(`[AI Mode] Waiting for page content to stabilize...`);
        await new Promise((r) => setTimeout(r, 3000));
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
                       message.includes('net::') ||
                       message.includes('Protocol error') ||
                       message.includes('Connection closed') ||
                       message.includes('Target closed');

      return {
        success: false,
        error: message,
        retryable,
      };
    } finally {
      // Disconnect CDP client first
      if (cdpClient) {
        try {
          await cdpClient.detach();
        } catch {
          // Ignore detach errors
        }
      }
      if (page) {
        try {
          await page.close();
        } catch {
          // Ignore page close errors - page might already be closed
        }
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
  private async extractJsonData(page: Page, platform: DeliveryPlatform | 'unknown'): Promise<unknown> {
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
        case 'unknown':
          // For unknown platforms and generic cases, try multiple extraction methods
          return await page.evaluate(() => {
            const result: { jsonLd?: unknown[]; nextData?: unknown; initialState?: unknown } = {};

            // Try JSON-LD (schema.org)
            const scripts = document.querySelectorAll('script[type="application/ld+json"]');
            if (scripts.length > 0) {
              result.jsonLd = [];
              scripts.forEach((script: Element) => {
                try {
                  result.jsonLd!.push(JSON.parse(script.textContent || '{}'));
                } catch {
                  // Skip invalid JSON
                }
              });
            }

            // Try __NEXT_DATA__ (Next.js)
            const nextData = document.getElementById('__NEXT_DATA__');
            if (nextData) {
              try {
                result.nextData = JSON.parse(nextData.textContent || '{}');
              } catch {
                // Ignore
              }
            }

            // Try window state variables
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const w = window as any;
            if (w.__INITIAL_STATE__) {
              result.initialState = w.__INITIAL_STATE__;
            }
            if (w.__APP_INITIAL_STATE__) {
              result.initialState = w.__APP_INITIAL_STATE__;
            }
            if (w.__PRELOADED_STATE__) {
              result.initialState = w.__PRELOADED_STATE__;
            }

            // Return combined data if any found
            const hasData = result.jsonLd?.length || result.nextData || result.initialState;
            return hasData ? result : null;
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

export function resetPuppeteerFetcher(): void {
  fetcherInstance = null;
}
