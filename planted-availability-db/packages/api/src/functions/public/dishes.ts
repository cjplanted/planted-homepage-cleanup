import { onRequest, HttpsOptions } from 'firebase-functions/v2/https';
import type { Request, Response } from 'express';
import { initializeFirestore, dishes, venues } from '@pad/database';
import { calculateDistance, type GeoPoint } from '@pad/core';

// Initialize Firestore
initializeFirestore();

interface DishWithVenueInfo {
  dish: Awaited<ReturnType<typeof dishes.getById>>;
  venue: {
    id: string;
    name: string;
    type: string;
    location: GeoPoint;
    address: {
      city: string;
      country: string;
    };
  };
  distance_km?: number;
  delivery_available: boolean;
}

const functionOptions: HttpsOptions = {
  region: 'europe-west6',
  cors: true,
  invoker: 'public', // Allow unauthenticated access
};

/**
 * GET /api/v1/dishes
 * Search dishes with filters
 */
export const dishesHandler = onRequest(functionOptions, async (req: Request, res: Response) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Parse query parameters
    const productSku = req.query.product_sku as string | undefined;
    const lat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
    const lng = req.query.lng ? parseFloat(req.query.lng as string) : undefined;
    const radiusKm = req.query.radius_km ? parseFloat(req.query.radius_km as string) : 50;
    const tags = req.query.tags ? (req.query.tags as string).split(',') : undefined;
    const cuisine = req.query.cuisine as string | undefined;
    const minPrice = req.query.min_price ? parseFloat(req.query.min_price as string) : undefined;
    const maxPrice = req.query.max_price ? parseFloat(req.query.max_price as string) : undefined;
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100);

    // Build query options
    const queryOptions: Parameters<typeof dishes.query>[0] = {
      status: 'active',
      limit: limit * 2, // Fetch extra for filtering
    };

    if (productSku) {
      queryOptions.plantedProducts = [productSku];
    }

    if (cuisine) {
      queryOptions.cuisineType = cuisine;
    }

    if (tags) {
      queryOptions.dietaryTags = tags;
    }

    // Query dishes
    let dishResults = await dishes.query(queryOptions);

    // Filter by price range
    if (minPrice !== undefined || maxPrice !== undefined) {
      dishResults = dishResults.filter((dish) => {
        const price = dish.price.amount;
        if (minPrice !== undefined && price < minPrice) return false;
        if (maxPrice !== undefined && price > maxPrice) return false;
        return true;
      });
    }

    // Get unique venue IDs
    const venueIds = [...new Set(dishResults.map((d) => d.venue_id))];

    // Fetch venues
    const venueMap = new Map<string, Awaited<ReturnType<typeof venues.getById>>>();
    const venueList = await venues.getByIds(venueIds);
    venueList.forEach((v) => {
      if (v) venueMap.set(v.id, v);
    });

    // Calculate distances if location provided
    const hasLocation = lat !== undefined && lng !== undefined;
    const center: GeoPoint | undefined = hasLocation
      ? { latitude: lat!, longitude: lng! }
      : undefined;

    // Build results with venue info
    const results: DishWithVenueInfo[] = [];

    for (const dish of dishResults) {
      const venue = venueMap.get(dish.venue_id);
      if (!venue) continue;

      // Filter by distance if location provided
      let distance_km: number | undefined;
      if (center) {
        distance_km = calculateDistance(center, venue.location);
        if (distance_km > radiusKm) continue;
      }

      results.push({
        dish,
        venue: {
          id: venue.id,
          name: venue.name,
          type: venue.type,
          location: venue.location,
          address: {
            city: venue.address.city,
            country: venue.address.country,
          },
        },
        distance_km,
        delivery_available:
          (dish.delivery_partners && dish.delivery_partners.length > 0) || false,
      });

      if (results.length >= limit) break;
    }

    // Sort by distance if location provided
    if (hasLocation) {
      results.sort((a, b) => (a.distance_km || 0) - (b.distance_km || 0));
    }

    // Set cache headers
    res.set('Cache-Control', 'public, max-age=120'); // 2 minute cache

    res.status(200).json({
      dishes: results,
      total: results.length,
      has_more: dishResults.length > results.length,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Dishes API error:', errorMessage);
    res.status(500).json({
      error: 'Internal server error',
      message: errorMessage,
    });
  }
});

/**
 * GET /api/v1/dishes/:id
 * Get single dish details
 */
export const dishDetailHandler = onRequest(functionOptions, async (req: Request, res: Response) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Extract dish ID from path
    const pathParts = req.path.split('/').filter(Boolean);
    const dishId = pathParts[pathParts.length - 1];

    if (!dishId) {
      res.status(400).json({
        error: 'Bad request',
        message: 'Dish ID is required',
      });
      return;
    }

    const dish = await dishes.getById(dishId);

    if (!dish) {
      res.status(404).json({
        error: 'Not found',
        message: `Dish ${dishId} not found`,
      });
      return;
    }

    // Get venue info
    const venue = await venues.getById(dish.venue_id);

    // Set cache headers
    res.set('Cache-Control', 'public, max-age=300'); // 5 minute cache

    res.status(200).json({
      dish,
      venue: venue
        ? {
            id: venue.id,
            name: venue.name,
            type: venue.type,
            location: venue.location,
            address: venue.address,
            opening_hours: venue.opening_hours,
          }
        : null,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Dish detail API error:', errorMessage);
    res.status(500).json({
      error: 'Internal server error',
      message: errorMessage,
    });
  }
});

