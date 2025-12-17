import { onRequest, HttpsOptions } from 'firebase-functions/v2/https';
import type { Request, Response } from 'express';
import { initializeFirestore, venues, dishes } from '@pad/database';
import { isVenueOpen, getNextOpeningTime, getTodayHoursString } from '@pad/core';
import type { Venue, Dish, GeoPoint } from '@pad/core';
import { publicRateLimit } from '../../middleware/withRateLimit.js';
import { nearbyQuerySchema, parseQuery } from '../../schemas/requests.js';

// Initialize Firestore
initializeFirestore();

// ============================================================================
// In-Memory LRU Cache for nearby queries (T028 - Performance Optimization)
// ============================================================================
interface CacheEntry {
  data: NearbyResponse | SlimNearbyResponse;
  expiry: number;
}

class NearbyCache {
  private cache = new Map<string, CacheEntry>();
  private readonly maxSize = 100;
  private readonly ttlMs = 60000; // 1 minute TTL

  private generateKey(lat: number, lng: number, radiusKm: number, type: string, limit: number, slim: boolean): string {
    // Round coordinates to 3 decimal places (~100m precision) for cache key
    const roundedLat = Math.round(lat * 1000) / 1000;
    const roundedLng = Math.round(lng * 1000) / 1000;
    return `${roundedLat}:${roundedLng}:${radiusKm}:${type}:${limit}:${slim}`;
  }

  get(lat: number, lng: number, radiusKm: number, type: string, limit: number, slim: boolean): NearbyResponse | SlimNearbyResponse | null {
    const key = this.generateKey(lat, lng, radiusKm, type, limit, slim);
    const entry = this.cache.get(key);

    if (!entry) return null;

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.data;
  }

  set(lat: number, lng: number, radiusKm: number, type: string, limit: number, slim: boolean, data: NearbyResponse | SlimNearbyResponse): void {
    const key = this.generateKey(lat, lng, radiusKm, type, limit, slim);

    // Evict oldest entries if at capacity
    while (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      data,
      expiry: Date.now() + this.ttlMs,
    });
  }
}

const nearbyCache = new NearbyCache();

interface NearbyResult {
  venue: Venue & { distance_km: number };
  dishes: Dish[];
  is_open: boolean;
  next_open: string | null;
  today_hours: string;
}

interface NearbyResponse {
  results: NearbyResult[];
  total: number;
  has_more: boolean;
}

// ============================================================================
// Slim Response Types (T028 - Reduced payload for locator display)
// ============================================================================
interface SlimVenue {
  id: string;
  name: string;
  type: string;
  chain_id?: string;
  location: { latitude: number; longitude: number };
  address: { city: string; country: string };
  delivery_platforms?: Array<{ platform: string; url: string; active?: boolean }>;
  distance_km: number;
}

interface SlimDish {
  id: string;
  name: string;
  description?: string;
  price: { amount: number; currency: string };
  image_url?: string;
  dietary_tags?: string[];
  planted_products: string[];
  cuisine_type?: string;
}

interface SlimNearbyResult {
  venue: SlimVenue;
  dishes: SlimDish[];
  is_open: boolean;
  today_hours: string;
}

interface SlimNearbyResponse {
  results: SlimNearbyResult[];
  total: number;
  has_more: boolean;
}

/**
 * Convert full venue to slim venue (only fields needed for display)
 */
function toSlimVenue(venue: Venue & { distance_km: number }): SlimVenue {
  return {
    id: venue.id,
    name: venue.name,
    type: venue.type,
    chain_id: venue.chain_id,
    location: venue.location,
    address: {
      city: venue.address?.city || '',
      country: venue.address?.country || '',
    },
    delivery_platforms: venue.delivery_platforms?.map(dp => ({
      platform: dp.platform,
      url: dp.url,
      active: dp.active,
    })),
    distance_km: venue.distance_km,
  };
}

/**
 * Convert full dish to slim dish (only fields needed for display)
 */
function toSlimDish(dish: Dish): SlimDish {
  return {
    id: dish.id,
    name: dish.name,
    description: dish.description,
    price: dish.price,
    image_url: dish.image_url,
    dietary_tags: dish.dietary_tags,
    planted_products: dish.planted_products,
    cuisine_type: dish.cuisine_type,
  };
}

const functionOptions: HttpsOptions = {
  region: 'europe-west6',
  cors: true,
  invoker: 'public', // Allow unauthenticated access
};

/**
 * GET /api/v1/nearby
 * Returns venues and dishes near a location
 *
 * Query Parameters:
 * - lat, lng: Required coordinates
 * - radius_km: Search radius (default: 10, max: 50)
 * - type: Filter by venue type (restaurant, retail, delivery_kitchen, all)
 * - limit: Max results (default: 20, max: 100)
 * - slim: Return reduced payload for faster locator display (default: false)
 * - open_now: Filter to only open venues
 * - product_sku: Filter to venues with specific planted product
 * - dedupe_chains: Deduplicate chain venues (default: true)
 *
 * Performance (T028):
 * - In-memory LRU cache with 1-minute TTL
 * - Slim mode reduces payload from ~18KB to ~6KB for typical responses
 * - CDN cache headers for edge caching
 */
export const nearbyHandler = onRequest(functionOptions, publicRateLimit(async (req: Request, res: Response) => {
  const startTime = Date.now();

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Validate query parameters with Zod
    const parseResult = parseQuery(req.query, nearbyQuerySchema);
    if (!parseResult.success) {
      res.status(400).json({
        error: 'Bad request',
        message: 'Invalid query parameters',
        details: parseResult.error,
      });
      return;
    }

    const params = parseResult.data;
    const center: GeoPoint = { latitude: params.lat, longitude: params.lng };

    // T028: Check for slim parameter (default false for backwards compatibility)
    const slimMode = req.query.slim === 'true' || req.query.slim === '1';

    // T028: Check in-memory cache first
    const cached = nearbyCache.get(
      params.lat,
      params.lng,
      params.radius_km,
      params.type || 'all',
      params.limit,
      slimMode
    );

    if (cached) {
      const cacheTime = Date.now() - startTime;
      res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      res.set('X-Cache', 'HIT');
      res.set('X-Response-Time', `${cacheTime}ms`);
      res.status(200).json(cached);
      return;
    }

    // Query nearby venues
    const nearbyVenues = await venues.queryNearby({
      center,
      radiusKm: params.radius_km,
      type: params.type === 'all' ? undefined : (params.type as 'retail' | 'restaurant' | 'delivery_kitchen' | undefined),
      status: 'active',
      limit: params.limit + 10, // Fetch extra for filtering
    });

    // Batch fetch dishes for all venues (much more efficient than N+1 queries)
    const venueIds = nearbyVenues.map(v => v.id);
    const dishesMap = await dishes.getByVenues(venueIds);

    // Build results - if deduping chains, track which chain_ids we've seen
    const results: NearbyResult[] = [];
    const seenChainIds = new Set<string>();

    for (const venue of nearbyVenues) {
      const is_open = isVenueOpen(venue.opening_hours);

      // Skip closed venues if open_now filter is set
      if (params.open_now && !is_open) {
        continue;
      }

      // Chain deduplication: skip if we already have a venue from this chain
      // (venues are sorted by distance, so we keep the closest)
      if (params.dedupe_chains && venue.chain_id) {
        if (seenChainIds.has(venue.chain_id)) {
          continue;
        }
        seenChainIds.add(venue.chain_id);
      }

      // Get dishes for this venue from the batch result
      let venueDishes = dishesMap.get(venue.id) || [];

      // Filter by product SKU if specified
      if (params.product_sku) {
        venueDishes = venueDishes.filter((dish) =>
          dish.planted_products.includes(params.product_sku!)
        );
        // Skip venues with no matching dishes
        if (venueDishes.length === 0) {
          continue;
        }
      }

      const next_open = is_open ? null : getNextOpeningTime(venue.opening_hours);

      results.push({
        venue: venue as Venue & { distance_km: number },
        dishes: venueDishes,
        is_open,
        next_open: next_open ? next_open.toISOString() : null,
        today_hours: getTodayHoursString(venue.opening_hours),
      });

      // Stop if we have enough results
      if (results.length >= params.limit) {
        break;
      }
    }

    // Set cache headers for CDN
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.set('X-Cache', 'MISS');

    // T028: Return slim or full response based on parameter
    let response: NearbyResponse | SlimNearbyResponse;

    if (slimMode) {
      // Convert to slim response format (reduced payload size)
      const slimResults: SlimNearbyResult[] = results.map(r => ({
        venue: toSlimVenue(r.venue),
        dishes: r.dishes.map(toSlimDish),
        is_open: r.is_open,
        today_hours: r.today_hours,
      }));

      response = {
        results: slimResults,
        total: slimResults.length,
        has_more: nearbyVenues.length > results.length,
      };
    } else {
      response = {
        results,
        total: results.length,
        has_more: nearbyVenues.length > results.length,
      };
    }

    // T028: Store in cache
    nearbyCache.set(
      params.lat,
      params.lng,
      params.radius_km,
      params.type || 'all',
      params.limit,
      slimMode,
      response
    );

    const totalTime = Date.now() - startTime;
    res.set('X-Response-Time', `${totalTime}ms`);

    res.status(200).json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('Nearby API error:', errorMessage, errorStack);
    res.status(500).json({
      error: 'Internal server error',
      message: errorMessage,
      stack: process.env.NODE_ENV === 'development' ? errorStack : undefined,
    });
  }
}));
