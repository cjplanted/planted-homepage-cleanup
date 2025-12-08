import type { Venue, Dish, VenueWithDistance, DishWithVenue } from '@pad/core';

export interface PADClientConfig {
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
}

export interface NearbyQuery {
  latitude: number;
  longitude: number;
  radiusKm?: number;
  type?: 'retail' | 'restaurant' | 'delivery_kitchen';
  limit?: number;
}

export interface DeliveryQuery {
  postalCode?: string;
  address?: string;
  country?: string;
  limit?: number;
}

export interface VenueQuery {
  country?: string;
  city?: string;
  type?: string;
  limit?: number;
  offset?: number;
}

export interface DishQuery {
  venueId?: string;
  productSku?: string;
  limit?: number;
}


export class PADClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly timeout: number;

  constructor(config: PADClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.timeout = config.timeout ?? 30000;
  }

  private async fetch<T>(endpoint: string, params?: Record<string, string | number | undefined>): Promise<T> {
    const url = new URL(`${this.baseUrl}${endpoint}`);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new PADError(
          error.message || `HTTP ${response.status}`,
          response.status,
          error.code
        );
      }

      return response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Find venues near a location
   */
  async findNearby(query: NearbyQuery): Promise<VenueWithDistance[]> {
    const response = await this.fetch<{ venues: VenueWithDistance[] }>('/api/v1/nearby', {
      lat: query.latitude,
      lng: query.longitude,
      radius: query.radiusKm,
      type: query.type,
      limit: query.limit,
    });
    return response.venues;
  }

  /**
   * Check delivery availability for a location
   */
  async checkDelivery(query: DeliveryQuery): Promise<{
    available: boolean;
    options: Array<{
      venue: Pick<Venue, 'id' | 'name' | 'type' | 'address'>;
      dishes: Array<Pick<Dish, 'id' | 'name' | 'price' | 'image_url'>>;
      partners: Array<{ partner: string; url: string }>;
    }>;
  }> {
    return this.fetch('/api/v1/delivery/check', {
      postal_code: query.postalCode,
      address: query.address,
      country: query.country,
      limit: query.limit,
    });
  }

  /**
   * Get venues with optional filtering
   */
  async getVenues(query?: VenueQuery): Promise<{ venues: Venue[]; total: number }> {
    return this.fetch('/api/v1/venues', query as Record<string, string | number | undefined>);
  }

  /**
   * Get a single venue by ID
   */
  async getVenue(id: string): Promise<Venue> {
    return this.fetch(`/api/v1/venues/${id}`);
  }

  /**
   * Get dishes with optional filtering
   */
  async getDishes(query?: DishQuery): Promise<{ dishes: DishWithVenue[]; total: number }> {
    return this.fetch('/api/v1/dishes', {
      venue_id: query?.venueId,
      product_sku: query?.productSku,
      limit: query?.limit,
    });
  }

  /**
   * Get a single dish by ID
   */
  async getDish(id: string): Promise<DishWithVenue> {
    return this.fetch(`/api/v1/dishes/${id}`);
  }
}

export class PADError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'PADError';
  }
}
