/**
 * Planted Availability Database API Client
 *
 * Fetches live venue data from the PAD API for the store locator.
 */

const PAD_API_BASE = 'https://europe-west6-get-planted-db.cloudfunctions.net';

export interface PadVenue {
  id: string;
  type: 'retail' | 'restaurant' | 'delivery_kitchen';
  name: string;
  chain_id?: string;
  location: {
    latitude: number;
    longitude: number;
  };
  address: {
    street: string;
    city: string;
    postal_code: string;
    country: string;
  };
  logo_url?: string;
  source: {
    type: string;
    url?: string;
  };
  status: string;
  last_verified: string;
  distance_km?: number;
}

export interface PadDish {
  id: string;
  venue_id: string;
  name: string;
  description?: string;
  planted_products: string[];
  price?: {
    amount: number;
    currency: string;
  };
  dietary_tags?: string[];
}

export interface NearbyResult {
  venue: PadVenue;
  dishes: PadDish[];
  is_open?: boolean;
}

export interface VenuesResponse {
  venues: PadVenue[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export interface NearbyResponse {
  results: NearbyResult[];
  total: number;
  has_more: boolean;
}

/**
 * Fetch venues with optional filters
 */
export async function fetchVenues(options: {
  country?: string;
  type?: 'retail' | 'restaurant' | 'delivery_kitchen';
  limit?: number;
  offset?: number;
} = {}): Promise<VenuesResponse> {
  const params = new URLSearchParams();

  if (options.country) params.set('country', options.country);
  if (options.type) params.set('type', options.type);
  if (options.limit) params.set('limit', options.limit.toString());
  if (options.offset) params.set('offset', options.offset.toString());

  const url = `${PAD_API_BASE}/venues?${params.toString()}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching venues:', error);
    return { venues: [], total: 0, limit: 0, offset: 0, has_more: false };
  }
}

/**
 * Fetch nearby venues based on coordinates
 */
export async function fetchNearbyVenues(options: {
  lat: number;
  lng: number;
  radius_km?: number;
  type?: 'retail' | 'restaurant' | 'delivery_kitchen';
  limit?: number;
}): Promise<NearbyResponse> {
  const params = new URLSearchParams({
    lat: options.lat.toString(),
    lng: options.lng.toString(),
  });

  if (options.radius_km) params.set('radius_km', options.radius_km.toString());
  if (options.type) params.set('type', options.type);
  if (options.limit) params.set('limit', options.limit.toString());

  const url = `${PAD_API_BASE}/nearby?${params.toString()}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching nearby venues:', error);
    return { results: [], total: 0, has_more: false };
  }
}

/**
 * Get stats for a specific country
 */
export async function fetchCountryStats(country: string): Promise<{
  totalVenues: number;
  restaurants: number;
  stores: number;
}> {
  try {
    const [restaurants, stores] = await Promise.all([
      fetchVenues({ country, type: 'restaurant', limit: 1 }),
      fetchVenues({ country, type: 'retail', limit: 1 }),
    ]);

    return {
      totalVenues: restaurants.total + stores.total,
      restaurants: restaurants.total,
      stores: stores.total,
    };
  } catch (error) {
    console.error('Error fetching country stats:', error);
    return { totalVenues: 0, restaurants: 0, stores: 0 };
  }
}

/**
 * Country code mapping for PAD API
 */
export const countryCodeToPad: Record<string, string> = {
  'Switzerland': 'CH',
  'Germany': 'DE',
  'Austria': 'AT',
  'United Kingdom': 'UK',
  'Italy': 'IT',
  'France': 'FR',
  'Netherlands': 'NL',
  'Spain': 'ES',
};

/**
 * Reverse mapping: PAD country code to name
 */
export const padToCountryName: Record<string, string> = {
  'CH': 'Switzerland',
  'DE': 'Germany',
  'AT': 'Austria',
  'UK': 'United Kingdom',
  'IT': 'Italy',
  'FR': 'France',
  'NL': 'Netherlands',
  'ES': 'Spain',
};

/**
 * Get all venue stats (used at build time)
 */
export async function fetchAllStats(): Promise<{
  total: number;
  byCountry: Record<string, { stores: number; restaurants: number }>;
  byType: { stores: number; restaurants: number };
}> {
  const countries = ['CH', 'DE', 'AT', 'UK', 'IT'];
  const byCountry: Record<string, { stores: number; restaurants: number }> = {};

  let totalStores = 0;
  let totalRestaurants = 0;

  for (const country of countries) {
    const stats = await fetchCountryStats(country);
    byCountry[country] = {
      stores: stats.stores,
      restaurants: stats.restaurants,
    };
    totalStores += stats.stores;
    totalRestaurants += stats.restaurants;
  }

  return {
    total: totalStores + totalRestaurants,
    byCountry,
    byType: {
      stores: totalStores,
      restaurants: totalRestaurants,
    },
  };
}
