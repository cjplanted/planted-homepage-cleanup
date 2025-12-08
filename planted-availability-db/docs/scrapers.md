# Scraper Development Guide

## Overview

PAD scrapers collect Planted product availability data from retail websites, restaurant menus, and delivery platforms. They use browser automation (Puppeteer) with stealth plugins to avoid detection.

## Architecture

```
packages/scrapers/
├── src/
│   ├── base/
│   │   └── BaseScraper.ts      # Abstract base class
│   ├── browser/
│   │   └── BrowserScraper.ts   # Puppeteer utilities
│   ├── scrapers/
│   │   ├── retail/             # Supermarket scrapers
│   │   │   ├── CoopScraper.ts
│   │   │   ├── MigrosScraper.ts
│   │   │   ├── REWEScraper.ts
│   │   │   └── ...
│   │   ├── delivery/           # Delivery platform scrapers
│   │   │   ├── WoltScraper.ts
│   │   │   ├── UberEatsScraper.ts
│   │   │   └── ...
│   │   └── discovery/          # Discovery tools
│   │       └── GoogleSearchDiscovery.ts
│   └── cli.ts                  # Command-line interface
```

## Creating a New Scraper

### 1. Create the Scraper File

```typescript
// src/scrapers/retail/NewStoreScraper.ts

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

export interface NewStoreScraperConfig {
  headless?: boolean;
  minDelay?: number;
  maxDelay?: number;
}

export class NewStoreScraper {
  private config: NewStoreScraperConfig;
  private browser: Browser | null = null;
  private page: Page | null = null;
  private products: any[] = [];

  constructor(config: NewStoreScraperConfig = {}) {
    this.config = {
      headless: true,
      minDelay: 2000,
      maxDelay: 5000,
      ...config,
    };
  }

  async run(options: ScraperOptions = {}): Promise<ScraperResult> {
    const result: ScraperResult = {
      success: true,
      stats: { created: 0, updated: 0, unchanged: 0, failed: 0 },
      errors: [],
    };

    try {
      // Initialize browser
      this.browser = await createStealthBrowser({
        headless: this.config.headless,
      });
      this.page = await this.browser.newPage();
      await configurePage(this.page, this.config);

      // Navigate to target
      await safeNavigate(this.page, 'https://example.com/planted', this.config);

      // Handle cookie consent
      await this.handleCookieConsent();

      // Check for blocking
      if (await isBlocked(this.page)) {
        throw new Error('Bot detection triggered');
      }

      // Scroll like a human
      await humanScroll(this.page);

      // Extract products
      await this.extractProducts();

      result.stats.created = this.products.length;

      // Save to database (unless dry run)
      if (!options.dryRun && this.products.length > 0) {
        await this.saveToDatabase();
      }

    } catch (error) {
      result.success = false;
      result.errors?.push(error instanceof Error ? error.message : String(error));
    } finally {
      if (this.browser) {
        await closeBrowser(this.browser);
      }
    }

    return result;
  }

  private async handleCookieConsent(): Promise<void> {
    // Implement cookie consent handling
  }

  private async extractProducts(): Promise<void> {
    // Use page.evaluate to extract product data
    // Remember to use (globalThis as any).document for TypeScript
  }

  private async saveToDatabase(): Promise<void> {
    // Save to Firestore
  }
}
```

### 2. Add to CLI

```typescript
// src/cli.ts

import { NewStoreScraper } from './scrapers/retail/NewStoreScraper.js';

// Add to switch statement
case 'new-store':
  scraper = new NewStoreScraper({ headless });
  break;
```

### 3. Export from Index

```typescript
// src/index.ts

export { NewStoreScraper } from './scrapers/retail/NewStoreScraper.js';
```

## Browser Utilities

### createStealthBrowser()

Creates a Puppeteer browser with stealth plugins enabled.

```typescript
const browser = await createStealthBrowser({
  headless: true,  // false for debugging
  slowMo: 50,      // Slow down actions
  proxy: 'http://proxy:8080',  // Optional proxy
});
```

### safeNavigate()

Navigates with retry logic and random delays.

```typescript
const success = await safeNavigate(page, url, {
  minDelay: 2000,
  maxDelay: 5000,
  maxRetries: 3,
});
```

### humanScroll()

Scrolls the page like a human would.

```typescript
await humanScroll(page, {
  direction: 'down',
  distance: 500,
  speed: 'medium',
});
```

### randomDelay()

Adds random delays between actions.

```typescript
await randomDelay(2000, 5000); // 2-5 seconds
```

### isBlocked()

Checks for common bot detection indicators.

```typescript
if (await isBlocked(page)) {
  // Handle CAPTCHA or blocking
}
```

## TypeScript in page.evaluate()

When using `document` or `window` in `page.evaluate()`, use the globalThis pattern:

```typescript
const data = await page.evaluate(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = (globalThis as any).document;
  const win = (globalThis as any).window;

  const title = doc.querySelector('h1')?.textContent;
  return { title };
});
```

## Testing Scrapers

### Dry Run Mode

Test without saving to database:

```bash
pnpm --filter @pad/scrapers run cli run new-store --dry-run --verbose
```

### Visual Debugging

Run with visible browser:

```bash
pnpm --filter @pad/scrapers run cli run new-store --headful --slow
```

### Specific Product

Test a known product URL:

```bash
pnpm --filter @pad/scrapers run cli run new-store --url "https://example.com/product/123"
```

## Anti-Bot Measures

### Stealth Techniques

- User agent rotation
- Viewport randomization
- Mouse movement simulation
- Keyboard timing variation
- Canvas fingerprint protection

### Rate Limiting

Always use delays between requests:

```typescript
const config = {
  minDelay: 3000,  // Minimum 3 seconds
  maxDelay: 7000,  // Maximum 7 seconds
};
```

### Proxy Support

For heavily protected sites:

```bash
PROXY_URL=http://user:pass@proxy:port pnpm --filter @pad/scrapers run cli run coop-ch
```

## Scheduling

Scrapers run on Cloud Scheduler:

```bash
# View schedules
gcloud scheduler jobs list

# Create schedule
gcloud scheduler jobs create http scraper-new-store \
  --schedule="0 6,18 * * *" \
  --uri="https://pad-api.planted.ch/scraper/run/new-store" \
  --http-method=POST \
  --headers="Authorization=Bearer ${SCRAPER_TOKEN}"
```

Recommended frequencies:
- Retail: 2x daily (6am, 6pm)
- Delivery: 1x daily
- Discovery: 1x weekly

## Monitoring

### Health Check

```bash
pnpm --filter @pad/scrapers run cli health
```

### Recent Runs

```bash
pnpm --filter @pad/scrapers run cli runs --last 10
```

### Error Investigation

Check Cloud Functions logs:

```bash
firebase functions:log --only pad-scraper
```

## Common Issues

### CAPTCHA Detection

1. Increase delays
2. Use residential proxy
3. Wait 24-48 hours

### Selector Changes

1. Use data-testid selectors when available
2. Fall back to multiple selector strategies
3. Log actual HTML for debugging

### Memory Issues

1. Close pages after use
2. Limit concurrent scrapers
3. Increase function memory if needed
