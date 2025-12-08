/**
 * Browser-based scraper using Puppeteer with stealth mode
 *
 * This provides a FREE alternative to paid proxy services by:
 * 1. Using puppeteer-extra with stealth plugin to avoid detection
 * 2. Implementing human-like behavior (random delays, mouse movements)
 * 3. Using aggressive rate limiting
 * 4. Rotating user agents and headers
 *
 * Cost: $0 locally, ~$5-10/month on a small VPS or Cloud Run
 */

import type { Browser, Page } from 'puppeteer';

// User agents to rotate through
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

// Languages to appear more human
const ACCEPT_LANGUAGES = [
  'en-US,en;q=0.9,de;q=0.8',
  'de-DE,de;q=0.9,en;q=0.8',
  'en-GB,en;q=0.9,de;q=0.8',
];

export interface BrowserScraperOptions {
  headless?: boolean;
  slowMo?: number;
  timeout?: number;
  minDelay?: number;
  maxDelay?: number;
}

const DEFAULT_OPTIONS: BrowserScraperOptions = {
  headless: true,
  slowMo: 50, // Slow down operations by 50ms
  timeout: 60000, // Increased timeout for slow connections
  minDelay: 2000,
  maxDelay: 5000,
};

/**
 * Get a random user agent
 */
export function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Get random accept language
 */
export function getRandomAcceptLanguage(): string {
  return ACCEPT_LANGUAGES[Math.floor(Math.random() * ACCEPT_LANGUAGES.length)];
}

/**
 * Random delay between min and max milliseconds
 */
export function randomDelay(min: number, max: number): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Create a stealth browser instance
 *
 * Uses puppeteer-extra with stealth plugin to avoid detection.
 * Install with: pnpm add puppeteer puppeteer-extra puppeteer-extra-plugin-stealth
 */
export async function createStealthBrowser(options: BrowserScraperOptions = {}): Promise<Browser> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Dynamic import to make this optional
  const puppeteerExtra = await import('puppeteer-extra');
  const puppeteer = puppeteerExtra.default || puppeteerExtra;
  const stealthModule = await import('puppeteer-extra-plugin-stealth');
  const StealthPlugin = stealthModule.default || stealthModule;

  // Add stealth plugin
  (puppeteer as unknown as { use: (plugin: unknown) => void }).use(StealthPlugin());

  const browser = await (puppeteer as unknown as { launch: (opts: unknown) => Promise<Browser> }).launch({
    headless: opts.headless ? 'new' : false,
    slowMo: opts.slowMo,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920,1080',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  return browser;
}

/**
 * Configure a page with anti-detection measures
 */
export async function configurePage(page: Page, options: BrowserScraperOptions = {}): Promise<void> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Set random user agent
  await page.setUserAgent(getRandomUserAgent());

  // Set viewport to common resolution
  await page.setViewport({
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
  });

  // Set extra headers
  await page.setExtraHTTPHeaders({
    'Accept-Language': getRandomAcceptLanguage(),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
  });

  // Set default timeout
  page.setDefaultTimeout(opts.timeout!);
  page.setDefaultNavigationTimeout(opts.timeout!);

  // Override webdriver detection
  await page.evaluateOnNewDocument(() => {
    // Remove webdriver flag
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
    });

    // Override plugins
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });

    // Override languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en', 'de'],
    });
  });
}

/**
 * Simulate human-like mouse movement
 */
export async function humanMouseMove(page: Page): Promise<void> {
  const x = 100 + Math.random() * 800;
  const y = 100 + Math.random() * 600;
  await page.mouse.move(x, y, { steps: 10 });
}

/**
 * Simulate human-like scrolling
 */
export async function humanScroll(page: Page): Promise<void> {
  const scrollAmount = 100 + Math.random() * 300;
  await page.evaluate((amount) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).window.scrollBy({ top: amount, behavior: 'smooth' });
  }, scrollAmount);
  await randomDelay(500, 1500);
}

/**
 * Wait for element with random delay
 */
export async function waitAndClick(page: Page, selector: string, options: BrowserScraperOptions = {}): Promise<void> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  await page.waitForSelector(selector, { timeout: opts.timeout });
  await randomDelay(opts.minDelay!, opts.maxDelay!);
  await humanMouseMove(page);
  await page.click(selector);
}

/**
 * Extract text content safely
 */
export async function extractText(page: Page, selector: string): Promise<string | null> {
  try {
    const element = await page.$(selector);
    if (!element) return null;
    return await page.evaluate(el => el.textContent?.trim() || null, element);
  } catch {
    return null;
  }
}

/**
 * Extract multiple elements' text
 */
export async function extractAllText(page: Page, selector: string): Promise<string[]> {
  try {
    const elements = await page.$$(selector);
    const texts: string[] = [];
    for (const el of elements) {
      const text = await page.evaluate(e => e.textContent?.trim() || '', el);
      if (text) texts.push(text);
    }
    return texts;
  } catch {
    return [];
  }
}

/**
 * Safe navigation with retry
 */
export async function safeNavigate(
  page: Page,
  url: string,
  options: BrowserScraperOptions = {},
  maxRetries = 3
): Promise<boolean> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await randomDelay(opts.minDelay!, opts.maxDelay!);

      // Use 'domcontentloaded' instead of 'networkidle2' to avoid frame issues
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: opts.timeout,
      });

      // Wait a bit for JS to render
      await randomDelay(3000, 5000);

      // Random actions to appear human
      try {
        await humanMouseMove(page);
      } catch {
        // Ignore mouse move errors
      }
      await randomDelay(1000, 2000);

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      // Ignore frame detached errors on retry - page may have loaded successfully
      if (errorMessage.includes('detached Frame') && attempt > 1) {
        console.log(`Frame detached but continuing (attempt ${attempt})...`);
        return true;
      }
      console.log(`Navigation attempt ${attempt}/${maxRetries} failed:`, errorMessage);
      if (attempt < maxRetries) {
        await randomDelay(5000, 10000); // Longer delay before retry
      }
    }
  }

  return false;
}

/**
 * Check if page has CAPTCHA or is blocked
 * Very conservative - only triggers on actual blocking pages, not embedded scripts
 */
export async function isBlocked(page: Page): Promise<boolean> {
  try {
    // Check for actual CAPTCHA elements visible on page
    const captchaSelectors = [
      'iframe[src*="recaptcha"]',
      'iframe[src*="hcaptcha"]',
      '#cf-challenge-running',
      '.cf-browser-verification',
      '[data-testid="captcha-container"]',
    ];

    for (const selector of captchaSelectors) {
      const element = await page.$(selector);
      if (element) {
        console.log(`CAPTCHA element detected: ${selector}`);
        return true;
      }
    }

    // Check page title for Cloudflare challenge
    const title = await page.title();
    if (title.includes('Just a moment') || title.includes('Attention Required')) {
      console.log('Cloudflare challenge page detected');
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Clean up browser resources
 */
export async function closeBrowser(browser: Browser): Promise<void> {
  try {
    const pages = await browser.pages();
    for (const page of pages) {
      await page.close();
    }
    await browser.close();
  } catch (error) {
    console.error('Error closing browser:', error);
  }
}
