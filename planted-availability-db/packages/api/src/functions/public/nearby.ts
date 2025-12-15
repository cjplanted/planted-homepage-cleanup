import { onRequest, HttpsOptions } from 'firebase-functions/v2/https';
import type { Request, Response } from 'express';
import { initializeFirestore, venues, dishes } from '@pad/database';
import { isVenueOpen, getNextOpeningTime, getTodayHoursString } from '@pad/core';
import type { Venue, Dish, GeoPoint } from '@pad/core';
import { publicRateLimit } from '../../middleware/withRateLimit.js';
import { nearbyQuerySchema, parseQuery } from '../../schemas/requests.js';

// Initialize Firestore
initializeFirestore();

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

const functionOptions: HttpsOptions = {
  region: 'europe-west6',
  cors: true,
  invoker: 'public', // Allow unauthenticated access
};

/**
 * GET /api/v1/nearby
 * Returns venues and dishes near a location
 */
export const nearbyHandler = onRequest(functionOptions, publicRateLimit(async (req: Request, res: Response) => {
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

    // Set cache headers
    res.set('Cache-Control', 'public, max-age=60'); // 1 minute cache

    const response: NearbyResponse = {
      results,
      total: results.length,
      has_more: nearbyVenues.length > results.length,
    };

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
