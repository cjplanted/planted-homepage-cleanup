/**
 * Get dishes for a specific venue
 * GET /adminVenueDishes?venueId=xxx
 *
 * Returns all dishes associated with a production venue.
 */

import { z } from 'zod';
import { initializeFirestore, dishes } from '@pad/database';
import { createAdminHandler } from '../../../middleware/adminHandler.js';

// Initialize Firestore
initializeFirestore();

// Validation schema for query parameters
const querySchema = z.object({
  venueId: z.string().min(1, 'venueId is required'),
});

interface VenueDish {
  id: string;
  name: string;
  description: string;
  plantedProducts: string[];
  price: {
    amount: number;
    currency: string;
  };
  dietaryTags: string[];
  cuisineType?: string;
  imageUrl?: string;
  status: string;
  lastVerified: string;
}

interface VenueDishesResponse {
  venueId: string;
  dishes: VenueDish[];
  total: number;
}

export const adminVenueDishesHandler = createAdminHandler<VenueDishesResponse>({
  methods: ['GET'],
  handler: async (req) => {
    // Parse and validate query params
    const { venueId } = querySchema.parse(req.query);

    // Fetch all dishes for this venue (including inactive for admin view)
    const venueDishes = await dishes.getByVenue(venueId, false);

    // Transform to response format
    return {
      venueId,
      dishes: venueDishes.map((dish) => ({
        id: dish.id,
        name: dish.name,
        description: dish.description,
        plantedProducts: dish.planted_products,
        price: dish.price,
        dietaryTags: dish.dietary_tags,
        cuisineType: dish.cuisine_type,
        imageUrl: dish.image_url,
        status: dish.status,
        lastVerified: dish.last_verified.toISOString(),
      })),
      total: venueDishes.length,
    };
  },
});
