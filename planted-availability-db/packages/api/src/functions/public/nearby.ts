import { onRequest, HttpsOptions } from 'firebase-functions/v2/https';
import type { Request, Response } from 'express';
import { initializeFirestore, venues, dishes } from '@pad/database';
import { isVenueOpen, getNextOpeningTime, getTodayHoursString } from '@pad/core';
import type { Venue, Dish, VenueType, GeoPoint } from '@pad/core';

// Initialize Firestore
initializeFirestore();

interface NearbyRequest {
  lat: number;
  lng: number;
  radius_km?: number;
  type?: VenueType | 'all';
  limit?: number;
  open_now?: boolean;
  product_sku?: string;
}

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
export const nearbyHandler = onRequest(functionOptions, async (req: Request, res: Response) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Parse query parameters
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);

    if (isNaN(lat) || isNaN(lng)) {
      res.status(400).json({
        error: 'Bad request',
        message: 'lat and lng query parameters are required and must be numbers',
      });
      return;
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      res.status(400).json({
        error: 'Bad request',
        message: 'Invalid coordinates',
      });
      return;
    }

    const params: NearbyRequest = {
      lat,
      lng,
      radius_km: Math.min(parseFloat(req.query.radius_km as string) || 10, 50),
      type: (req.query.type as VenueType | 'all') || 'all',
      limit: Math.min(parseInt(req.query.limit as string, 10) || 20, 100),
      open_now: req.query.open_now === 'true',
      product_sku: req.query.product_sku as string,
    };

    const center: GeoPoint = { latitude: params.lat, longitude: params.lng };

    // Query nearby venues
    const nearbyVenues = await venues.queryNearby({
      center,
      radiusKm: params.radius_km!,
      type: params.type === 'all' ? undefined : params.type,
      status: 'active',
      limit: params.limit! + 10, // Fetch extra for filtering
    });

    // Get dishes for each venue
    const results: NearbyResult[] = [];

    for (const venue of nearbyVenues) {
      const is_open = isVenueOpen(venue.opening_hours);

      // Skip closed venues if open_now filter is set
      if (params.open_now && !is_open) {
        continue;
      }

      // Get dishes for this venue
      let venueDishes = await dishes.getByVenue(venue.id);

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
      if (results.length >= params.limit!) {
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
});
