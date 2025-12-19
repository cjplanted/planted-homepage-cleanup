import { onRequest, HttpsOptions } from 'firebase-functions/v2/https';
import type { Request, Response } from 'express';
import { initializeFirestore, venues, dishes, discoveredVenues } from '@pad/database';
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

// ============================================================================
// Haversine distance calculation for geo queries
// ============================================================================
function calculateDistance(point1: GeoPoint, point2: { latitude: number; longitude: number }): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((point2.latitude - point1.latitude) * Math.PI) / 180;
  const dLon = ((point2.longitude - point1.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((point1.latitude * Math.PI) / 180) *
      Math.cos((point2.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ============================================================================
// Query discovered_venues with geo filtering (fallback for empty venues collection)
// ============================================================================
interface DiscoveredVenueResult {
  venue: Venue & { distance_km: number };
  dishes: Dish[];
}

async function queryDiscoveredVenuesNearby(
  center: GeoPoint,
  radiusKm: number,
  venueType?: string,
  limit: number = 20
): Promise<DiscoveredVenueResult[]> {
  // Query discovered_venues directly from Firestore without orderBy to avoid index requirements
  // This is a workaround for the missing created_at index on discovered_venues
  const { getFirestore } = await import('firebase-admin/firestore');
  const db = getFirestore();

  console.log('[Nearby] Querying discovered_venues directly from Firestore...');

  // Query without orderBy to avoid index requirement
  const snapshot = await db.collection('discovered_venues')
    .where('status', 'in', ['discovered', 'verified', 'promoted'])
    .limit(500) // Get reasonable batch to filter
    .get();

  console.log(`[Nearby] Direct query returned ${snapshot.size} documents`);

  // Log stats about coordinates
  let withCoords = 0;
  let withoutCoords = 0;
  const countryStats: Record<string, number> = {};

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const country = data.address?.country || 'unknown';
    countryStats[country] = (countryStats[country] || 0) + 1;

    if (data.coordinates?.latitude && data.coordinates?.longitude) {
      withCoords++;
    } else {
      withoutCoords++;
    }
  }
  console.log(`[Nearby] Venues with coords: ${withCoords}, without: ${withoutCoords}`);
  console.log(`[Nearby] By country: ${JSON.stringify(countryStats)}`);

  // Filter by coordinates and calculate distance
  const validVenues: Array<{
    id: string;
    data: FirebaseFirestore.DocumentData;
    distance_km: number;
  }> = [];

  // Calculate bounding box for quick pre-filtering
  const latDelta = radiusKm / 111.32;
  const lngDelta = radiusKm / (111.32 * Math.cos((center.latitude * Math.PI) / 180));
  const minLat = center.latitude - latDelta;
  const maxLat = center.latitude + latDelta;
  const minLng = center.longitude - lngDelta;
  const maxLng = center.longitude + lngDelta;

  // First pass: venues WITH coordinates (geo-based filtering)
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const coords = data.coordinates;

    // Skip if no valid coordinates or if coordinates are 0,0 (invalid/placeholder)
    if (!coords?.latitude || !coords?.longitude ||
        (coords.latitude === 0 && coords.longitude === 0)) {
      console.warn(`[Nearby] Skipping venue ${doc.id} - invalid coordinates`);
      continue;
    }

    const lat = coords.latitude;
    const lng = coords.longitude;

    // Bounding box filter
    if (lat < minLat || lat > maxLat || lng < minLng || lng > maxLng) {
      continue;
    }

    // Calculate actual distance
    const distance = calculateDistance(center, { latitude: lat, longitude: lng });

    if (distance <= radiusKm) {
      validVenues.push({ id: doc.id, data, distance_km: distance });
    }
  }

  console.log(`[Nearby] ${validVenues.length} venues with geo-matching`);

  // If no venues found within radius, return empty results
  if (validVenues.length === 0) {
    console.log('[Nearby] No venues found within radius - returning empty results');
  }

  // Sort by distance and limit
  validVenues.sort((a, b) => a.distance_km - b.distance_km);
  const results = validVenues.slice(0, limit);

  // Convert to expected format
  return results.map(({ id, data: dv, distance_km }) => {
    // Convert discovered venue to Venue format
    const venue: Venue & { distance_km: number } = {
      id,
      type: 'restaurant', // Default type
      name: dv.name || 'Unknown',
      chain_id: dv.chain_id,
      location: {
        latitude: dv.coordinates.latitude,
        longitude: dv.coordinates.longitude,
      },
      address: {
        street: dv.address?.street || '',
        city: dv.address?.city || '',
        postal_code: dv.address?.postal_code || '',
        country: dv.address?.country || '',
      },
      opening_hours: undefined, // Discovered venues don't have opening hours
      contact: {},
      delivery_platforms: (dv.delivery_platforms || []).map((dp: any) => ({
        partner: dp.platform,
        platform: dp.platform,
        url: dp.url,
        active: true,
      })),
      source: {
        type: 'discovery_agent',
        discovery_date: dv.created_at?.toDate?.()?.toISOString?.() || new Date().toISOString(),
      },
      last_verified: dv.created_at?.toDate?.() || new Date(),
      status: 'active',
      created_at: dv.created_at?.toDate?.() || new Date(),
      updated_at: dv.updated_at?.toDate?.() || new Date(),
      distance_km,
    };

    // Convert embedded dishes to Dish format
    const convertedDishes: Dish[] = (dv.dishes || []).map((d: any, idx: number) => ({
      id: `${id}-dish-${idx}`,
      venue_id: id,
      name: d.name || 'Unknown Dish',
      description: d.description || '',
      planted_products: d.planted_products || [],
      price: {
        amount: typeof d.price === 'number' ? d.price :
                typeof d.price === 'string' ? parseFloat(d.price) || 0 :
                d.price?.amount || 0,
        currency: d.price?.currency || 'CHF',
      },
      dietary_tags: [],
      availability: { type: 'permanent' as const },
      source: { type: 'discovered' as const },
      last_verified: dv.created_at?.toDate?.() || new Date(),
      status: 'active',
      created_at: dv.created_at?.toDate?.() || new Date(),
      updated_at: dv.updated_at?.toDate?.() || new Date(),
    }));

    return { venue, dishes: convertedDishes };
  });
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
 * - radius_km: Search radius (default: 5, max: 50)
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

    // Build results - if deduping chains, track which chain_ids we've seen
    const results: NearbyResult[] = [];
    const seenChainIds = new Set<string>();

    // PRIMARY SOURCE: Query discovered_venues (most complete data)
    console.log('[Nearby] Querying discovered_venues as primary source...');
    const discoveredResults = await queryDiscoveredVenuesNearby(
      center,
      params.radius_km,
      params.type === 'all' ? undefined : params.type,
      params.limit + 10
    );

    for (const { venue, dishes: venueDishes } of discoveredResults) {
      // Chain deduplication
      if (params.dedupe_chains && venue.chain_id) {
        if (seenChainIds.has(venue.chain_id)) {
          continue;
        }
        seenChainIds.add(venue.chain_id);
      }

      // Filter by product SKU if specified
      let filteredDishes = venueDishes;
      if (params.product_sku) {
        filteredDishes = venueDishes.filter((dish) =>
          dish.planted_products.includes(params.product_sku!)
        );
        if (filteredDishes.length === 0) {
          continue;
        }
      }

      results.push({
        venue,
        dishes: filteredDishes,
        is_open: true, // Assume open for discovered venues (no hours data)
        next_open: null,
        today_hours: '',
      });

      if (results.length >= params.limit) {
        break;
      }
    }
    console.log(`[Nearby] Found ${results.length} venues from discovered_venues`);

    // SECONDARY: Also check production venues collection for additional results
    if (results.length < params.limit) {
      const nearbyVenues = await venues.queryNearby({
        center,
        radiusKm: params.radius_km,
        type: params.type === 'all' ? undefined : (params.type as 'retail' | 'restaurant' | 'delivery_kitchen' | undefined),
        status: 'active',
        limit: params.limit - results.length + 5,
      });

      if (nearbyVenues.length > 0) {
        // Batch fetch dishes for production venues
        const venueIds = nearbyVenues.map(v => v.id);
        const dishesMap = await dishes.getByVenues(venueIds);

        for (const venue of nearbyVenues) {
          // Skip if already in results (by chain or name match)
          if (params.dedupe_chains && venue.chain_id) {
            if (seenChainIds.has(venue.chain_id)) {
              continue;
            }
            seenChainIds.add(venue.chain_id);
          }

          const is_open = isVenueOpen(venue.opening_hours);

          // Skip closed venues if open_now filter is set
          if (params.open_now && !is_open) {
            continue;
          }

          let venueDishes = dishesMap.get(venue.id) || [];

          if (params.product_sku) {
            venueDishes = venueDishes.filter((dish) =>
              dish.planted_products.includes(params.product_sku!)
            );
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

          if (results.length >= params.limit) {
            break;
          }
        }
      }
    }

    // Sort final results by distance
    results.sort((a, b) => (a.venue.distance_km || 0) - (b.venue.distance_km || 0));

    // Calculate has_more: true if we had more candidates than results returned
    const totalCandidates = discoveredResults.length;
    const hasMore = totalCandidates > results.length;

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
        has_more: hasMore,
      };
    } else {
      response = {
        results,
        total: results.length,
        has_more: hasMore,
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
