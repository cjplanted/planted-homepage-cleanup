/**
 * Search Service - Algolia Integration
 *
 * Provides full-text search with geo-filtering for venues and dishes.
 * Uses Algolia's free tier (10K records, 10K searches/month).
 *
 * Setup:
 * 1. Create Algolia account at algolia.com
 * 2. Create an application
 * 3. Create indexes: 'venues' and 'dishes'
 * 4. Set env vars: ALGOLIA_APP_ID, ALGOLIA_API_KEY, ALGOLIA_SEARCH_KEY
 */

import algoliasearch, { SearchClient, SearchIndex } from 'algoliasearch';
import type { Venue, Dish } from '@pad/core';

// Algolia record types (what we store in the index)
export interface VenueSearchRecord {
  objectID: string;
  name: string;
  type: 'retail' | 'restaurant' | 'delivery_kitchen';
  chain_name?: string;
  address_city: string;
  address_country: string;
  address_street: string;
  address_postal_code: string;
  _geoloc: {
    lat: number;
    lng: number;
  };
  status: string;
  last_verified: number; // Unix timestamp
}

export interface DishSearchRecord {
  objectID: string;
  name: string;
  name_localized?: Record<string, string>;
  description: string;
  venue_id: string;
  venue_name: string;
  venue_city: string;
  venue_country: string;
  planted_products: string[];
  dietary_tags: string[];
  cuisine_type?: string;
  price_amount: number;
  price_currency: string;
  _geoloc: {
    lat: number;
    lng: number;
  };
  status: string;
  last_verified: number;
}

export interface SearchConfig {
  appId: string;
  apiKey: string; // Admin API key for indexing
  searchKey: string; // Search-only key for client
}

export class SearchService {
  private client: SearchClient;
  private venuesIndex: SearchIndex;
  private dishesIndex: SearchIndex;

  constructor(config: SearchConfig) {
    this.client = algoliasearch(config.appId, config.apiKey);
    this.venuesIndex = this.client.initIndex('venues');
    this.dishesIndex = this.client.initIndex('dishes');
  }

  /**
   * Configure index settings (run once during setup)
   */
  async configureIndexes(): Promise<void> {
    // Venues index settings
    await this.venuesIndex.setSettings({
      searchableAttributes: [
        'name',
        'chain_name',
        'address_city',
        'address_street',
      ],
      attributesForFaceting: [
        'filterOnly(type)',
        'filterOnly(status)',
        'filterOnly(address_country)',
        'filterOnly(address_city)',
      ],
      customRanking: ['desc(last_verified)'],
      // Enable geo search
      attributeForDistinct: 'objectID',
    });

    // Dishes index settings
    await this.dishesIndex.setSettings({
      searchableAttributes: [
        'name',
        'name_localized',
        'description',
        'venue_name',
        'planted_products',
        'cuisine_type',
      ],
      attributesForFaceting: [
        'filterOnly(status)',
        'filterOnly(venue_country)',
        'filterOnly(venue_city)',
        'filterOnly(dietary_tags)',
        'filterOnly(cuisine_type)',
        'filterOnly(planted_products)',
      ],
      customRanking: ['desc(last_verified)'],
      attributeForDistinct: 'objectID',
    });

    console.log('Algolia indexes configured successfully');
  }

  /**
   * Index a venue
   */
  async indexVenue(venue: Venue, chainName?: string): Promise<void> {
    const record: VenueSearchRecord = {
      objectID: venue.id,
      name: venue.name,
      type: venue.type,
      chain_name: chainName,
      address_city: venue.address.city,
      address_country: venue.address.country,
      address_street: venue.address.street,
      address_postal_code: venue.address.postal_code,
      _geoloc: {
        lat: venue.location.latitude,
        lng: venue.location.longitude,
      },
      status: venue.status,
      last_verified: venue.last_verified.toDate().getTime(),
    };

    await this.venuesIndex.saveObject(record);
  }

  /**
   * Index multiple venues
   */
  async indexVenues(venues: Array<Venue & { chainName?: string }>): Promise<void> {
    const records: VenueSearchRecord[] = venues.map((venue) => ({
      objectID: venue.id,
      name: venue.name,
      type: venue.type,
      chain_name: venue.chainName,
      address_city: venue.address.city,
      address_country: venue.address.country,
      address_street: venue.address.street,
      address_postal_code: venue.address.postal_code,
      _geoloc: {
        lat: venue.location.latitude,
        lng: venue.location.longitude,
      },
      status: venue.status,
      last_verified: venue.last_verified.toDate().getTime(),
    }));

    await this.venuesIndex.saveObjects(records);
  }

  /**
   * Index a dish with venue location
   */
  async indexDish(
    dish: Dish,
    venue: { name: string; city: string; country: string; lat: number; lng: number }
  ): Promise<void> {
    const record: DishSearchRecord = {
      objectID: dish.id,
      name: dish.name,
      name_localized: dish.name_localized,
      description: dish.description,
      venue_id: dish.venue_id,
      venue_name: venue.name,
      venue_city: venue.city,
      venue_country: venue.country,
      planted_products: dish.planted_products,
      dietary_tags: dish.dietary_tags,
      cuisine_type: dish.cuisine_type,
      price_amount: dish.price.amount,
      price_currency: dish.price.currency,
      _geoloc: {
        lat: venue.lat,
        lng: venue.lng,
      },
      status: dish.status,
      last_verified: dish.last_verified.toDate().getTime(),
    };

    await this.dishesIndex.saveObject(record);
  }

  /**
   * Remove a venue from the index
   */
  async removeVenue(venueId: string): Promise<void> {
    await this.venuesIndex.deleteObject(venueId);
  }

  /**
   * Remove a dish from the index
   */
  async removeDish(dishId: string): Promise<void> {
    await this.dishesIndex.deleteObject(dishId);
  }

  /**
   * Search venues by query with optional geo filter
   */
  async searchVenues(
    query: string,
    options?: {
      lat?: number;
      lng?: number;
      radiusKm?: number;
      type?: 'retail' | 'restaurant' | 'delivery_kitchen';
      country?: string;
      city?: string;
      limit?: number;
    }
  ): Promise<{ hits: VenueSearchRecord[]; nbHits: number }> {
    const filters: string[] = ["status:active"];

    if (options?.type) {
      filters.push(`type:${options.type}`);
    }
    if (options?.country) {
      filters.push(`address_country:${options.country}`);
    }
    if (options?.city) {
      filters.push(`address_city:${options.city}`);
    }

    const searchParams: any = {
      filters: filters.join(' AND '),
      hitsPerPage: options?.limit || 20,
    };

    // Add geo search if coordinates provided
    if (options?.lat !== undefined && options?.lng !== undefined) {
      searchParams.aroundLatLng = `${options.lat}, ${options.lng}`;
      searchParams.aroundRadius = (options.radiusKm || 10) * 1000; // Convert km to meters
    }

    const result = await this.venuesIndex.search<VenueSearchRecord>(query, searchParams);

    return {
      hits: result.hits,
      nbHits: result.nbHits,
    };
  }

  /**
   * Search dishes by query with optional geo filter
   */
  async searchDishes(
    query: string,
    options?: {
      lat?: number;
      lng?: number;
      radiusKm?: number;
      plantedProduct?: string;
      dietaryTags?: string[];
      cuisineType?: string;
      country?: string;
      city?: string;
      limit?: number;
    }
  ): Promise<{ hits: DishSearchRecord[]; nbHits: number }> {
    const filters: string[] = ["status:active"];

    if (options?.plantedProduct) {
      filters.push(`planted_products:${options.plantedProduct}`);
    }
    if (options?.dietaryTags && options.dietaryTags.length > 0) {
      const tagFilters = options.dietaryTags.map((t) => `dietary_tags:${t}`).join(' AND ');
      filters.push(`(${tagFilters})`);
    }
    if (options?.cuisineType) {
      filters.push(`cuisine_type:${options.cuisineType}`);
    }
    if (options?.country) {
      filters.push(`venue_country:${options.country}`);
    }
    if (options?.city) {
      filters.push(`venue_city:${options.city}`);
    }

    const searchParams: any = {
      filters: filters.join(' AND '),
      hitsPerPage: options?.limit || 20,
    };

    // Add geo search if coordinates provided
    if (options?.lat !== undefined && options?.lng !== undefined) {
      searchParams.aroundLatLng = `${options.lat}, ${options.lng}`;
      searchParams.aroundRadius = (options.radiusKm || 10) * 1000;
    }

    const result = await this.dishesIndex.search<DishSearchRecord>(query, searchParams);

    return {
      hits: result.hits,
      nbHits: result.nbHits,
    };
  }

  /**
   * Get search-only API key for client-side use
   */
  static getSearchOnlyConfig(appId: string, searchKey: string) {
    return {
      appId,
      searchKey,
      venuesIndex: 'venues',
      dishesIndex: 'dishes',
    };
  }
}

/**
 * Create search service from environment variables
 */
export function createSearchService(): SearchService | null {
  const appId = process.env.ALGOLIA_APP_ID;
  const apiKey = process.env.ALGOLIA_API_KEY;
  const searchKey = process.env.ALGOLIA_SEARCH_KEY;

  if (!appId || !apiKey || !searchKey) {
    console.warn('Algolia not configured. Set ALGOLIA_APP_ID, ALGOLIA_API_KEY, ALGOLIA_SEARCH_KEY');
    return null;
  }

  return new SearchService({ appId, apiKey, searchKey });
}
