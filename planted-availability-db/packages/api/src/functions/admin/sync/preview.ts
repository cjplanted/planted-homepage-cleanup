/**
 * Admin Sync Preview API
 * GET /admin/sync/preview
 *
 * Compares verified discovered entities with production and returns a diff:
 * - New venues/dishes to add
 * - Existing venues/dishes with updates
 * - Stale production items that may need removal
 */

import {
  initializeFirestore,
  discoveredVenues,
  discoveredDishes,
  venues,
} from '@pad/database';
import { createAdminHandler } from '../../../middleware/adminHandler.js';
import type { SupportedCountry } from '@pad/core';

// Initialize Firestore
initializeFirestore();

interface VenuePreview {
  id: string;
  name: string;
  chainId?: string;
  chainName?: string;
  city: string;
  country: SupportedCountry;
  confidenceScore: number;
  dishCount: number;
  verifiedAt: Date;
}

interface DishPreview {
  id: string;
  venueId: string;
  venueName: string;
  name: string;
  product: string;
  price?: string;
  confidenceScore: number;
  verifiedAt?: Date;
}

interface VenueUpdate {
  id: string;
  productionId: string;
  name: string;
  changes: string[];
}

interface DishUpdate {
  id: string;
  productionId: string;
  name: string;
  changes: string[];
}

/**
 * Handler for GET /admin/sync/preview
 */
export const adminSyncPreviewHandler = createAdminHandler(
  async (req, res) => {
    // Get all verified discovered venues (not yet promoted)
    const verifiedVenues = await discoveredVenues.getByStatus('verified');
    const toAddVenues = verifiedVenues.filter(v => !v.production_venue_id && !v.promoted_at);

    // Get verified discovered dishes (not yet promoted)
    const verifiedDishes = await discoveredDishes.getByStatus('verified');
    const toAddDishes = verifiedDishes.filter(d => !d.production_dish_id && !d.promoted_at);

    // Build venue previews with dish counts
    const venueAdditions: VenuePreview[] = await Promise.all(
      toAddVenues.map(async (venue) => {
        const venueDishes = await discoveredDishes.getByVenue(venue.id);
        const verifiedDishCount = venueDishes.filter(d => d.status === 'verified').length;

        return {
          id: venue.id,
          name: venue.name,
          chainId: venue.chain_id,
          chainName: venue.chain_name,
          city: venue.address.city,
          country: venue.address.country,
          confidenceScore: venue.confidence_score,
          dishCount: verifiedDishCount,
          verifiedAt: venue.verified_at || venue.created_at,
        };
      })
    );

    // Build dish previews
    const dishAdditions: DishPreview[] = toAddDishes.map(dish => ({
      id: dish.id,
      venueId: dish.venue_id,
      venueName: dish.venue_name,
      name: dish.name,
      product: dish.planted_product,
      price: Object.values(dish.price_by_country)[0],
      confidenceScore: dish.confidence_score,
      verifiedAt: dish.verified_at,
    }));

    // TODO: Implement update detection
    // For now, we'll return empty arrays for updates
    const venueUpdates: VenueUpdate[] = [];
    const dishUpdates: DishUpdate[] = [];

    // Get stale production venues for potential removal
    const staleVenues = await venues.getStaleVenues(30, 50);
    const staleVenuePreviews = staleVenues.map(v => ({
      id: v.id,
      name: v.name,
      city: v.address.city,
      country: v.address.country,
      lastVerified: v.last_verified,
      daysSinceVerification: Math.floor((Date.now() - v.last_verified.getTime()) / (1000 * 60 * 60 * 24)),
    }));

    // Calculate stats
    const stats = {
      total: venueAdditions.length + dishAdditions.length + venueUpdates.length + dishUpdates.length,
      additions: venueAdditions.length + dishAdditions.length,
      updates: venueUpdates.length + dishUpdates.length,
      removals: 0, // Not implementing automatic removal
      venues: {
        additions: venueAdditions.length,
        updates: venueUpdates.length,
      },
      dishes: {
        additions: dishAdditions.length,
        updates: dishUpdates.length,
      },
    };

    res.json({
      additions: {
        venues: venueAdditions,
        dishes: dishAdditions,
      },
      updates: {
        venues: venueUpdates,
        dishes: dishUpdates,
      },
      removals: {
        venues: [],
        dishes: [],
      },
      staleVenues: staleVenuePreviews,
      stats,
    });
  },
  { allowedMethods: ['GET'] }
);
