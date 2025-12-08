import { BaseScraper } from '../../base/BaseScraper.js';
import { fetchJSON } from '../../utils/http.js';
import { processWithQueue, sleep } from '../../utils/queue.js';
import { dishes, venues } from '@pad/database';
import { createVenueInputSchema, type Dish, type Venue } from '@pad/core';

/**
 * Wolt API Response Types
 */
interface WoltSearchResponse {
  sections?: WoltSection[];
}

interface WoltSection {
  name: string;
  items?: WoltVenueItem[];
}

interface WoltVenueItem {
  venue?: WoltVenue;
  link?: {
    target: string;
  };
}

interface WoltVenue {
  id: string;
  name: string;
  slug: string;
  address: string;
  city: string;
  location: {
    coordinates: {
      lat: number;
      lon: number;
    };
  };
  rating?: {
    score: number;
    count: number;
  };
  delivery_specs?: {
    delivery_enabled: boolean;
  };
  short_description?: string;
  tags?: string[];
}

interface WoltMenuResponse {
  items?: WoltMenuItem[];
  categories?: WoltCategory[];
}

interface WoltCategory {
  id: string;
  name: string;
}

interface WoltMenuItem {
  id: string;
  name: string;
  description?: string;
  image?: {
    url: string;
  };
  baseprice?: number;
  category?: string;
  tags?: string[];
  enabled?: boolean;
}

/**
 * City configuration for scraping
 */
interface WoltCity {
  name: string;
  country: string;
  lat: number;
  lon: number;
}

/**
 * Scraped data structure
 */
interface WoltScrapedData {
  venue: WoltVenue;
  dishes: WoltMenuItem[];
  city: WoltCity;
}

/**
 * Wolt Scraper Configuration
 */
export interface WoltScraperConfig {
  cities: WoltCity[];
  searchTerms?: string[];
  maxVenuesPerCity?: number;
  maxDishesPerVenue?: number;
  /** Proxy URL for scraping (e.g., ScraperAPI URL) */
  proxyUrl?: string;
  /** Delay between requests in ms (default: 3000) */
  requestDelay?: number;
}

/**
 * Default cities to scrape (major cities in DE/AT where Wolt operates)
 */
const DEFAULT_CITIES: WoltCity[] = [
  // Germany
  { name: 'Berlin', country: 'DE', lat: 52.5200, lon: 13.4050 },
  { name: 'Munich', country: 'DE', lat: 48.1351, lon: 11.5820 },
  { name: 'Hamburg', country: 'DE', lat: 53.5511, lon: 9.9937 },
  { name: 'Frankfurt', country: 'DE', lat: 50.1109, lon: 8.6821 },
  { name: 'Stuttgart', country: 'DE', lat: 48.7758, lon: 9.1829 },
  { name: 'Cologne', country: 'DE', lat: 50.9375, lon: 6.9603 },
  { name: 'Dusseldorf', country: 'DE', lat: 51.2277, lon: 6.7735 },
  // Austria
  { name: 'Vienna', country: 'AT', lat: 48.2082, lon: 16.3738 },
  { name: 'Salzburg', country: 'AT', lat: 47.8095, lon: 13.0550 },
  { name: 'Graz', country: 'AT', lat: 47.0707, lon: 15.4395 },
];

/**
 * Keywords to search for Planted products
 */
const DEFAULT_SEARCH_TERMS = ['planted', 'plant-based', 'vegan chicken', 'vegan kebab'];

/**
 * Planted product keyword matching
 */
const PLANTED_PRODUCT_KEYWORDS: Record<string, string[]> = {
  'planted.chicken': ['planted chicken', 'plant chicken', 'planted huhn', 'planted hähnchen'],
  'planted.kebab': ['planted kebab', 'planted kebap', 'planted döner'],
  'planted.pulled': ['planted pulled', 'planted pastrami'],
  'planted.schnitzel': ['planted schnitzel'],
  'planted.burger': ['planted burger', 'planted patty'],
};

/**
 * Wolt Delivery Platform Scraper
 *
 * Scrapes Wolt for restaurants serving Planted products in DE/AT markets.
 */
export class WoltScraper extends BaseScraper<WoltScrapedData, { venue: Venue; dishes: Dish[] }> {
  protected readonly name = 'Wolt Scraper (DE/AT)';
  protected readonly scraperId = 'wolt-de-at';
  protected readonly targetCollection = 'venues';

  private readonly config: WoltScraperConfig;
  private readonly baseUrl = 'https://restaurant-api.wolt.com';

  constructor(config?: Partial<WoltScraperConfig>) {
    super();
    this.config = {
      cities: config?.cities || DEFAULT_CITIES,
      searchTerms: config?.searchTerms || DEFAULT_SEARCH_TERMS,
      maxVenuesPerCity: config?.maxVenuesPerCity || 20,
      maxDishesPerVenue: config?.maxDishesPerVenue || 50,
      proxyUrl: config?.proxyUrl,
      requestDelay: config?.requestDelay || 3000, // 3 seconds default
    };
  }

  /**
   * Fetch data from Wolt API
   */
  protected async fetchData(): Promise<WoltScrapedData[]> {
    const results: WoltScrapedData[] = [];

    // Process each city
    for (const city of this.config.cities) {
      this.log(`Searching in ${city.name}, ${city.country}...`);

      try {
        // Search for planted products in this city
        const venuesWithPlanted = await this.searchCity(city);
        this.log(`Found ${venuesWithPlanted.length} venues in ${city.name}`);

        // Fetch menu for each venue
        const menuResults = await processWithQueue(
          venuesWithPlanted.slice(0, this.config.maxVenuesPerCity),
          async (venue) => {
            const dishes = await this.fetchVenueMenu(venue.slug, city);
            return { venue, dishes, city };
          },
          { concurrency: 1, interval: this.config.requestDelay! } // Rate limit: 1 concurrent with configured delay
        );

        for (const result of menuResults) {
          if (result.success && result.result && result.result.dishes.length > 0) {
            results.push(result.result);
          }
        }

        // Delay between cities
        await sleep(this.config.requestDelay! * 2);
      } catch (error) {
        this.log(`Error searching ${city.name}: ${error}`, 'error');
      }
    }

    return results;
  }

  /**
   * Search for venues with Planted products in a city
   */
  private async searchCity(city: WoltCity): Promise<WoltVenue[]> {
    const foundVenues = new Map<string, WoltVenue>();

    for (const term of this.config.searchTerms!) {
      try {
        const url = `${this.baseUrl}/v1/pages/search`;
        const params = new URLSearchParams({
          q: term,
          lat: city.lat.toString(),
          lon: city.lon.toString(),
        });

        const response = await fetchJSON<WoltSearchResponse>(`${url}?${params}`, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          timeout: 15000,
        });

        // Extract venues from response
        for (const section of response.sections || []) {
          for (const item of section.items || []) {
            if (item.venue && item.venue.delivery_specs?.delivery_enabled) {
              foundVenues.set(item.venue.id, item.venue);
            }
          }
        }

        await sleep(this.config.requestDelay!); // Delay between search terms
      } catch (error) {
        this.log(`Search error for "${term}" in ${city.name}: ${error}`, 'warn');
      }
    }

    return Array.from(foundVenues.values());
  }

  /**
   * Fetch menu for a specific venue
   */
  private async fetchVenueMenu(slug: string, city: WoltCity): Promise<WoltMenuItem[]> {
    try {
      const url = `${this.baseUrl}/v3/venues/slug/${slug}/menu`;
      const params = new URLSearchParams({
        lat: city.lat.toString(),
        lon: city.lon.toString(),
      });

      const response = await fetchJSON<WoltMenuResponse>(`${url}?${params}`, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 15000,
      });

      // Filter for items that mention "planted" or related terms
      const plantedItems = (response.items || []).filter((item) => {
        if (!item.enabled) return false;
        const searchText = `${item.name} ${item.description || ''}`.toLowerCase();
        return searchText.includes('planted') ||
               searchText.includes('plant-based') ||
               searchText.includes('pflanzlich');
      });

      return plantedItems.slice(0, this.config.maxDishesPerVenue);
    } catch (error) {
      this.log(`Menu fetch error for ${slug}: ${error}`, 'warn');
      return [];
    }
  }

  /**
   * Transform Wolt data to our schema
   */
  protected async transform(data: WoltScrapedData): Promise<{ venue: Venue; dishes: Dish[] } | null> {
    const { venue: woltVenue, dishes: woltDishes, city } = data;

    // Transform venue
    const venue: Venue = {
      id: '', // Will be set by database
      type: 'restaurant',
      name: woltVenue.name,
      location: {
        latitude: woltVenue.location.coordinates.lat,
        longitude: woltVenue.location.coordinates.lon,
      },
      address: {
        street: woltVenue.address || 'See Wolt for address',
        city: city.name,
        postal_code: '00000', // Not available from Wolt
        country: city.country,
      },
      opening_hours: {
        regular: this.getDefaultOpeningHours(),
      },
      contact: {
        website: `https://wolt.com/en/${city.country.toLowerCase()}/restaurant/${woltVenue.slug}`,
      },
      source: {
        type: 'scraped',
        url: `https://wolt.com/en/${city.country.toLowerCase()}/restaurant/${woltVenue.slug}`,
        scraper_id: this.scraperId,
      },
      status: 'active',
      last_verified: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
    };

    // Transform dishes
    const transformedDishes: Dish[] = woltDishes.map((woltDish) => ({
      id: '', // Will be set by database
      venue_id: '', // Will be set after venue is saved
      name: woltDish.name,
      description: woltDish.description || 'Planted dish available on Wolt',
      planted_products: this.detectPlantedProducts(woltDish.name, woltDish.description),
      price: {
        amount: (woltDish.baseprice || 0) / 100, // Wolt prices are in cents
        currency: 'EUR',
      },
      image_url: woltDish.image?.url,
      dietary_tags: this.extractDietaryTags(woltDish),
      cuisine_type: woltDish.category,
      availability: {
        type: 'permanent',
      },
      delivery_partners: [{
        partner: 'wolt',
        url: `https://wolt.com/en/${city.country.toLowerCase()}/restaurant/${woltVenue.slug}`,
      }],
      source: {
        type: 'scraped',
        url: `https://wolt.com/en/${city.country.toLowerCase()}/restaurant/${woltVenue.slug}`,
        scraper_id: this.scraperId,
      },
      status: 'active',
      last_verified: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
    }));

    return { venue, dishes: transformedDishes };
  }

  /**
   * Detect which Planted products are in a dish
   */
  private detectPlantedProducts(name: string, description?: string): string[] {
    const searchText = `${name} ${description || ''}`.toLowerCase();
    const detected: string[] = [];

    for (const [product, keywords] of Object.entries(PLANTED_PRODUCT_KEYWORDS)) {
      if (keywords.some((kw) => searchText.includes(kw))) {
        detected.push(product);
      }
    }

    // Default to planted.chicken if nothing specific detected but "planted" mentioned
    if (detected.length === 0 && searchText.includes('planted')) {
      detected.push('planted.chicken');
    }

    return detected;
  }

  /**
   * Extract dietary tags from Wolt item
   */
  private extractDietaryTags(item: WoltMenuItem): string[] {
    const tags: string[] = ['plant-based'];
    const searchText = `${item.name} ${item.description || ''}`.toLowerCase();

    if (searchText.includes('vegan') || item.tags?.includes('vegan')) {
      tags.push('vegan');
    }
    if (searchText.includes('gluten-free') || searchText.includes('glutenfrei')) {
      tags.push('gluten-free');
    }
    if (searchText.includes('high-protein') || searchText.includes('proteinreich')) {
      tags.push('high-protein');
    }

    return tags;
  }

  /**
   * Get default opening hours (typical restaurant hours)
   */
  private getDefaultOpeningHours(): Record<string, Array<{ open: string; close: string }>> {
    return {
      monday: [{ open: '11:00', close: '22:00' }],
      tuesday: [{ open: '11:00', close: '22:00' }],
      wednesday: [{ open: '11:00', close: '22:00' }],
      thursday: [{ open: '11:00', close: '22:00' }],
      friday: [{ open: '11:00', close: '23:00' }],
      saturday: [{ open: '11:00', close: '23:00' }],
      sunday: [{ open: '12:00', close: '21:00' }],
    };
  }

  /**
   * Validate transformed data
   */
  protected async validate(data: { venue: Venue; dishes: Dish[] }): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];

    // Validate venue
    const venueResult = createVenueInputSchema.safeParse({
      type: data.venue.type,
      name: data.venue.name,
      address: data.venue.address,
      location: data.venue.location,
      opening_hours: data.venue.opening_hours,
      source: data.venue.source,
      status: data.venue.status,
    });

    if (!venueResult.success) {
      errors.push(...venueResult.error.issues.map((i) => `Venue: ${i.path.join('.')}: ${i.message}`));
    }

    // Validate dishes
    for (const dish of data.dishes) {
      if (!dish.name || dish.name.length < 2) {
        errors.push(`Dish: Name too short - "${dish.name}"`);
      }
      if (dish.planted_products.length === 0) {
        errors.push(`Dish: No planted products detected - "${dish.name}"`);
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Save venue and dishes to database
   */
  protected async save(data: { venue: Venue; dishes: Dish[] }): Promise<{ action: 'created' | 'updated' | 'unchanged'; id: string }> {
    const { venue, dishes: dishesToSave } = data;

    // Find or create venue
    let venueId: string;
    let venueAction: 'created' | 'updated' | 'unchanged' = 'unchanged';

    // Search for existing venue by name and city
    const existingVenues = await venues.query({
      status: 'active',
      country: venue.address.country,
    });

    const matchingVenue = existingVenues.find(
      (v) => v.name.toLowerCase() === venue.name.toLowerCase() &&
             v.address.city.toLowerCase() === venue.address.city.toLowerCase()
    );

    if (matchingVenue) {
      venueId = matchingVenue.id;

      // Update last_verified
      await venues.update(venueId, { last_verified: new Date() });
      venueAction = 'unchanged';
    } else {
      // Create new venue
      const created = await venues.create({
        type: venue.type,
        name: venue.name,
        address: venue.address,
        location: venue.location,
        opening_hours: venue.opening_hours,
        contact: venue.contact,
        source: venue.source,
        status: venue.status,
        last_verified: new Date(),
      });
      venueId = created.id;
      venueAction = 'created';

      await this.logChange({
        action: 'created',
        collection: 'venues',
        documentId: venueId,
        changes: [{ field: '*', before: null, after: created }],
        reason: `Discovered via Wolt scraper in ${venue.address.city}`,
      });
    }

    // Save dishes
    let dishesCreated = 0;
    let dishesUpdated = 0;

    for (const dish of dishesToSave) {
      dish.venue_id = venueId;

      // Check for existing dish
      const existingDishes = await dishes.getByVenue(venueId, false);
      const matchingDish = existingDishes.find(
        (d) => d.name.toLowerCase() === dish.name.toLowerCase()
      );

      if (matchingDish) {
        // Update existing dish
        const hasChanges =
          matchingDish.price.amount !== dish.price.amount ||
          matchingDish.description !== dish.description;

        if (hasChanges) {
          await dishes.update(matchingDish.id, {
            description: dish.description,
            price: dish.price,
            image_url: dish.image_url,
            last_verified: new Date(),
          });
          dishesUpdated++;
        } else {
          await dishes.update(matchingDish.id, { last_verified: new Date() });
        }
      } else {
        // Create new dish
        const created = await dishes.create({
          venue_id: venueId,
          name: dish.name,
          description: dish.description,
          planted_products: dish.planted_products,
          price: dish.price,
          image_url: dish.image_url,
          dietary_tags: dish.dietary_tags,
          cuisine_type: dish.cuisine_type,
          availability: dish.availability,
          delivery_partners: dish.delivery_partners,
          source: dish.source,
          status: dish.status,
          last_verified: new Date(),
        });
        dishesCreated++;

        await this.logChange({
          action: 'created',
          collection: 'dishes',
          documentId: created.id,
          changes: [{ field: '*', before: null, after: created }],
          reason: `Discovered via Wolt scraper`,
        });
      }
    }

    this.log(`Venue ${venue.name}: ${venueAction}, Dishes: ${dishesCreated} created, ${dishesUpdated} updated`);

    return {
      action: venueAction === 'created' || dishesCreated > 0 ? 'created' :
              dishesUpdated > 0 ? 'updated' : 'unchanged',
      id: venueId,
    };
  }
}
