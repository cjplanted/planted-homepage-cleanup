import * as cheerio from 'cheerio';
import { BaseScraper } from '../base/BaseScraper.js';
import { fetchHTML } from '../utils/http.js';
import { processWithQueue } from '../utils/queue.js';
import { dishes, venues } from '@pad/database';
import { createDishInputSchema, type Dish } from '@pad/core';

interface MenuPage {
  venueId: string;
  url: string;
  html?: string;
}

interface ScrapedDish {
  venueId: string;
  name: string;
  description?: string;
  price?: number;
  currency?: string;
  category?: string;
}

export interface WebMenuScraperConfig {
  venueUrls: Array<{ venueId: string; menuUrl: string }>;
  selectors: {
    menuItem: string;
    name: string;
    description?: string;
    price?: string;
    category?: string;
  };
  priceParser?: (text: string) => number | null;
}

/**
 * Scraper for extracting dish information from restaurant menu pages
 */
export class WebMenuScraper extends BaseScraper<MenuPage, Dish> {
  protected readonly name = 'web-menu-scraper';
  protected readonly scraperId = 'web-menu';
  protected readonly targetCollection = 'dishes';

  private readonly webConfig: WebMenuScraperConfig;
  private scrapedDishes: ScrapedDish[] = [];

  constructor(config: WebMenuScraperConfig) {
    super();
    this.webConfig = config;
  }

  protected async fetchData(): Promise<MenuPage[]> {
    const pages: MenuPage[] = [];

    // Fetch all menu pages with rate limiting
    const results = await processWithQueue(
      this.webConfig.venueUrls,
      async ({ venueId, menuUrl }) => {
        this.log(`Fetching menu from ${menuUrl}`);
        const html = await fetchHTML(menuUrl);
        return { venueId, url: menuUrl, html };
      },
      { concurrency: 2, interval: 2000 }
    );

    for (const result of results) {
      if (result.success && result.result) {
        pages.push(result.result);
      } else {
        this.log(`Failed to fetch page: ${result.error}`, 'error');
      }
    }

    return pages;
  }

  protected async transform(page: MenuPage): Promise<Dish | null> {
    if (!page.html) return null;

    const { selectors } = this.webConfig;
    const $ = cheerio.load(page.html);

    // Extract all menu items from the page
    $(selectors.menuItem).each((_, element) => {
      const $item = $(element);

      const name = $item.find(selectors.name).text().trim();
      if (!name) return;

      const scrapedDish: ScrapedDish = {
        venueId: page.venueId,
        name,
      };

      if (selectors.description) {
        scrapedDish.description = $item.find(selectors.description).text().trim() || undefined;
      }

      if (selectors.price) {
        const priceText = $item.find(selectors.price).text().trim();
        scrapedDish.price = this.parsePrice(priceText) ?? undefined;
        scrapedDish.currency = this.extractCurrency(priceText);
      }

      if (selectors.category) {
        scrapedDish.category = $item.find(selectors.category).text().trim() || undefined;
      }

      this.scrapedDishes.push(scrapedDish);
    });

    // Return the first dish for now - we'll handle batch processing differently
    const firstDish = this.scrapedDishes.shift();
    if (!firstDish) return null;

    return this.convertToDish(firstDish);
  }

  private async convertToDish(scraped: ScrapedDish): Promise<Dish> {
    return {
      id: '', // Will be set by database
      venue_id: scraped.venueId,
      name: scraped.name,
      description: scraped.description || 'Planted dish',
      planted_products: [], // Will need to be matched later
      price: {
        amount: scraped.price || 0,
        currency: scraped.currency || 'CHF',
      },
      dietary_tags: ['vegan', 'plant-based'],
      availability: {
        type: 'permanent',
      },
      source: {
        type: 'scraped',
        url: this.webConfig.venueUrls.find(v => v.venueId === scraped.venueId)?.menuUrl,
      },
      status: 'active',
      last_verified: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
    };
  }

  private parsePrice(text: string): number | null {
    if (this.webConfig.priceParser) {
      return this.webConfig.priceParser(text);
    }

    // Default price parser
    const match = text.match(/[\d.,]+/);
    if (match) {
      return parseFloat(match[0].replace(',', '.'));
    }
    return null;
  }

  private extractCurrency(text: string): string {
    if (text.includes('CHF') || text.includes('Fr.')) return 'CHF';
    if (text.includes('€') || text.includes('EUR')) return 'EUR';
    if (text.includes('£') || text.includes('GBP')) return 'GBP';
    return 'CHF'; // Default
  }

  protected async validate(item: Dish): Promise<{ valid: boolean; errors?: string[] }> {
    const result = createDishInputSchema.safeParse({
      venue_id: item.venue_id,
      name: item.name,
      description: item.description,
      planted_products: item.planted_products,
      price: item.price,
      dietary_tags: item.dietary_tags,
      availability: item.availability,
      source: item.source,
      status: item.status,
    });

    if (!result.success) {
      return {
        valid: false,
        errors: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      };
    }

    // Verify venue exists
    const venue = await venues.getById(item.venue_id);
    if (!venue) {
      return { valid: false, errors: ['Venue not found'] };
    }

    return { valid: true };
  }

  protected async save(item: Dish): Promise<{ action: 'created' | 'updated' | 'unchanged'; id: string }> {
    // Check for existing dish by venue and name
    const existingDishes = await dishes.getByVenue(item.venue_id, false);
    const match = existingDishes.find(
      (d) => d.name.toLowerCase() === item.name.toLowerCase()
    );

    if (match) {
      // Check if any fields changed
      const hasChanges =
        match.description !== item.description ||
        JSON.stringify(match.price) !== JSON.stringify(item.price);

      if (hasChanges) {
        await dishes.update(match.id, {
          description: item.description,
          price: item.price,
          last_verified: new Date(),
        });

        await this.logChange({
          action: 'updated',
          collection: 'dishes',
          documentId: match.id,
          changes: [
            { field: 'description', before: match.description, after: item.description },
            { field: 'price', before: match.price, after: item.price },
          ],
          reason: 'Updated from web scrape',
        });

        return { action: 'updated', id: match.id };
      }

      // Just update last_verified
      await dishes.update(match.id, { last_verified: new Date() });
      return { action: 'unchanged', id: match.id };
    }

    // Create new dish
    const created = await dishes.create({
      venue_id: item.venue_id,
      name: item.name,
      description: item.description,
      planted_products: item.planted_products,
      price: item.price,
      dietary_tags: item.dietary_tags,
      availability: item.availability,
      source: item.source,
      status: item.status,
      last_verified: new Date(),
    });

    await this.logChange({
      action: 'created',
      collection: 'dishes',
      documentId: created.id,
      changes: [{ field: '*', before: null, after: created }],
      reason: 'Created from web scrape',
    });

    return { action: 'created', id: created.id };
  }
}
