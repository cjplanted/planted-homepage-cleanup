import { BaseScraper } from '../../base/BaseScraper.js';
import { processWithQueue, sleep } from '../../utils/queue.js';
import { dishes, venues } from '@pad/database';
import { createVenueInputSchema, type Dish, type Venue } from '@pad/core';

interface UberEatsStoreResult {
  store?: {
    storeUuid: string;
    title: string;
    slug?: string;
    location?: {
      address?: string;
      streetAddress?: string;
      city?: string;
      latitude?: number;
      longitude?: number;
    };
    rating?: {
      ratingValue?: number;
      reviewCount?: number;
    };
    heroImageUrl?: string;
  };
}

interface UberEatsMenuItem {
  uuid: string;
  title: string;
  description?: string;
  imageUrl?: string;
  price: number;
  currency?: string;
}

/**
 * City configuration for scraping
 */
interface UberEatsCity {
  name: string;
  country: string;
  slug: string;
  lat: number;
  lon: number;
}

/**
 * Scraped data structure
 */
interface UberEatsScrapedData {
  venue: UberEatsStoreResult;
  dishes: UberEatsMenuItem[];
  city: UberEatsCity;
}

/**
 * Uber Eats Scraper Configuration
 */
export interface UberEatsScraperConfig {
  cities?: UberEatsCity[];
  searchTerms?: string[];
  maxVenuesPerCity?: number;
  maxDishesPerVenue?: number;
  proxyUrl?: string;
  requestDelay?: number;
}

/**
 * Default cities to scrape (major cities in DE/AT where Uber Eats operates)
 */
const DEFAULT_CITIES: UberEatsCity[] = [
  // Germany
  { name: 'Berlin', country: 'DE', slug: 'berlin-de', lat: 52.52, lon: 13.405 },
  { name: 'Munich', country: 'DE', slug: 'munchen-de', lat: 48.1351, lon: 11.582 },
  { name: 'Hamburg', country: 'DE', slug: 'hamburg-de', lat: 53.5511, lon: 9.9937 },
  { name: 'Frankfurt', country: 'DE', slug: 'frankfurt-am-main-de', lat: 50.1109, lon: 8.6821 },
  { name: 'Cologne', country: 'DE', slug: 'koeln-de', lat: 50.9375, lon: 6.9603 },
  { name: 'Dusseldorf', country: 'DE', slug: 'duesseldorf-de', lat: 51.2277, lon: 6.7735 },
  // Austria
  { name: 'Vienna', country: 'AT', slug: 'vienna-at', lat: 48.2082, lon: 16.3738 },
  { name: 'Graz', country: 'AT', slug: 'graz-at', lat: 47.0707, lon: 15.4395 },
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
 * Uber Eats Delivery Platform Scraper
 *
 * Scrapes Uber Eats for restaurants serving Planted products in DE/AT markets.
 *
 * Note: Uber Eats has strong anti-bot protections. This scraper provides
 * the structure for scraping but actual production use requires:
 * 1. A proxy service (ScraperAPI or similar)
 * 2. Browser automation (Puppeteer/Playwright) for dynamic content
 * 3. Proper session/cookie handling
 */
export class UberEatsScraper extends BaseScraper<UberEatsScrapedData, { venue: Venue; dishes: Dish[] }> {
  protected readonly name = 'Uber Eats Scraper (DE/AT)';
  protected readonly scraperId = 'ubereats-de-at';
  protected readonly targetCollection = 'venues';

  private readonly config: UberEatsScraperConfig;
  // Note: Uber Eats API base URL - requires browser automation in production
  // private readonly baseUrl = 'https://www.ubereats.com';

  constructor(config?: Partial<UberEatsScraperConfig>) {
    super();
    this.config = {
      cities: config?.cities || DEFAULT_CITIES,
      searchTerms: config?.searchTerms || DEFAULT_SEARCH_TERMS,
      maxVenuesPerCity: config?.maxVenuesPerCity || 20,
      maxDishesPerVenue: config?.maxDishesPerVenue || 50,
      proxyUrl: config?.proxyUrl,
      requestDelay: config?.requestDelay || 4000, // 4 seconds default (Uber Eats is stricter)
    };
  }

  /**
   * Fetch data from Uber Eats API
   */
  protected async fetchData(): Promise<UberEatsScrapedData[]> {
    const results: UberEatsScrapedData[] = [];

    // Process each city
    for (const city of this.config.cities!) {
      this.log(`Searching in ${city.name}, ${city.country}...`);

      try {
        // Search for planted products in this city
        const venuesWithPlanted = await this.searchCity(city);
        this.log(`Found ${venuesWithPlanted.length} venues in ${city.name}`);

        // Fetch menu for each venue
        const menuResults = await processWithQueue(
          venuesWithPlanted.slice(0, this.config.maxVenuesPerCity),
          async (venue) => {
            const menuItems = await this.fetchVenueMenu(venue, city);
            return { venue, dishes: menuItems, city };
          },
          { concurrency: 1, interval: this.config.requestDelay! }
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
  private async searchCity(city: UberEatsCity): Promise<UberEatsStoreResult[]> {
    const foundVenues = new Map<string, UberEatsStoreResult>();

    for (const term of this.config.searchTerms!) {
      try {
        // Note: Uber Eats API requires proper authentication and anti-bot measures
        // This is a simplified structure - in production, use browser automation
        // URL would be: `${this.baseUrl}/api/getSearchSuggestionsV1?q=${term}&latitude=${city.lat}&longitude=${city.lon}&localeCode=de-DE`

        // In production, this would need:
        // 1. Browser automation to get session cookies
        // 2. Proxy service to avoid rate limits
        // 3. CSRF token handling

        this.log(`Searching for "${term}" in ${city.name}... (API access limited)`, 'info');

        // Simulate delay for demonstration
        await sleep(this.config.requestDelay!);

        // In production: Parse actual API response
        // For now, return empty as Uber Eats blocks direct API access
      } catch (error) {
        this.log(`Search error for "${term}" in ${city.name}: ${error}`, 'warn');
      }
    }

    return Array.from(foundVenues.values());
  }

  /**
   * Fetch menu for a specific venue
   */
  private async fetchVenueMenu(venue: UberEatsStoreResult, _city: UberEatsCity): Promise<UberEatsMenuItem[]> {
    try {
      const storeUuid = venue.store?.storeUuid;
      if (!storeUuid) return [];

      // In production, this would:
      // 1. Load the store page with browser automation
      // 2. Extract menu data from rendered HTML or XHR calls
      // 3. Filter for Planted product mentions

      this.log(`Fetching menu for ${venue.store?.title}... (API access limited)`, 'info');

      // Return empty for now - Uber Eats requires browser automation
      return [];
    } catch (error) {
      this.log(`Menu fetch error for ${venue.store?.storeUuid}: ${error}`, 'warn');
      return [];
    }
  }

  /**
   * Transform Uber Eats data to our schema
   */
  protected async transform(data: UberEatsScrapedData): Promise<{ venue: Venue; dishes: Dish[] } | null> {
    const { venue: uberVenue, dishes: uberDishes, city } = data;

    if (!uberVenue.store) return null;

    // Transform venue
    const venue: Venue = {
      id: '', // Will be set by database
      type: 'restaurant',
      name: uberVenue.store.title,
      location: {
        latitude: uberVenue.store.location?.latitude || city.lat,
        longitude: uberVenue.store.location?.longitude || city.lon,
      },
      address: {
        street: uberVenue.store.location?.streetAddress || 'See Uber Eats for address',
        city: uberVenue.store.location?.city || city.name,
        postal_code: '00000', // Not available from Uber Eats
        country: city.country,
      },
      opening_hours: {
        regular: this.getDefaultOpeningHours(),
      },
      contact: {
        website: `https://www.ubereats.com/store/${uberVenue.store.slug || uberVenue.store.storeUuid}`,
      },
      source: {
        type: 'scraped',
        url: `https://www.ubereats.com/store/${uberVenue.store.slug || uberVenue.store.storeUuid}`,
        scraper_id: this.scraperId,
      },
      status: 'active',
      last_verified: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
    };

    // Transform dishes
    const transformedDishes: Dish[] = uberDishes.map((uberDish) => ({
      id: '', // Will be set by database
      venue_id: '', // Will be set after venue is saved
      name: uberDish.title,
      description: uberDish.description || 'Planted dish available on Uber Eats',
      planted_products: this.detectPlantedProducts(uberDish.title, uberDish.description),
      price: {
        amount: uberDish.price / 100, // Assuming price is in cents
        currency: uberDish.currency || 'EUR',
      },
      image_url: uberDish.imageUrl,
      dietary_tags: this.extractDietaryTags(uberDish.title, uberDish.description),
      availability: {
        type: 'permanent',
      },
      delivery_partners: [{
        partner: 'uber_eats',
        url: `https://www.ubereats.com/store/${uberVenue.store!.slug || uberVenue.store!.storeUuid}`,
      }],
      source: {
        type: 'scraped',
        url: `https://www.ubereats.com/store/${uberVenue.store!.slug || uberVenue.store!.storeUuid}`,
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
   * Extract dietary tags from item
   */
  private extractDietaryTags(name: string, description?: string): string[] {
    const tags: string[] = ['plant-based'];
    const searchText = `${name} ${description || ''}`.toLowerCase();

    if (searchText.includes('vegan')) {
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
        reason: `Discovered via Uber Eats scraper in ${venue.address.city}`,
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
          reason: `Discovered via Uber Eats scraper`,
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
