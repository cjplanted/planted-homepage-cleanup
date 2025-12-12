/**
 * Duplicate Venues Detection API
 *
 * GET /adminFindDuplicateVenues - Find venues with identical addresses
 * POST /adminDeleteDuplicateVenues - Delete specified duplicate venues
 */

import { z } from 'zod';
import {
  initializeFirestore,
  venues,
  dishes,
} from '@pad/database';
import { createAdminHandler } from '../../../middleware/adminHandler.js';
import type { Venue, VenueType, VenueStatus } from '@pad/core';

// Initialize Firestore
initializeFirestore();

/**
 * Normalize address for duplicate comparison
 * Returns lowercase, trimmed key: "street|postalcode|city|country"
 */
function normalizeAddress(venue: Venue): string {
  const street = (venue.address.street || '').toLowerCase().trim();
  const postal = (venue.address.postal_code || '').toLowerCase().trim();
  const city = venue.address.city.toLowerCase().trim();
  const country = venue.address.country.toLowerCase().trim();
  return `${street}|${postal}|${city}|${country}`;
}

/**
 * Format address for display
 */
function formatAddress(venue: Venue): string {
  const parts: string[] = [];
  if (venue.address.street) {
    parts.push(venue.address.street);
  }
  const cityPart = [venue.address.postal_code, venue.address.city].filter(Boolean).join(' ');
  if (cityPart) {
    parts.push(cityPart);
  }
  parts.push(venue.address.country);
  return parts.join(', ');
}

interface DuplicateVenue {
  id: string;
  name: string;
  type: VenueType;
  chainId?: string;
  chainName?: string;
  address: {
    street?: string;
    city: string;
    postalCode?: string;
    country: string;
  };
  status: VenueStatus;
  lastVerified: string;
  createdAt: string;
  dishCount: number;
}

interface DuplicateGroup {
  addressKey: string;
  formattedAddress: string;
  venues: DuplicateVenue[];
}

interface FindDuplicatesResponse {
  duplicateGroups: DuplicateGroup[];
  totalDuplicateGroups: number;
  totalDuplicateVenues: number;
  stats: {
    byCountry: Record<string, number>;
    totalVenuesScanned: number;
  };
}

/**
 * GET /adminFindDuplicateVenues
 * Find all venues that share the same address
 */
export const adminFindDuplicateVenuesHandler = createAdminHandler(
  async (req, res) => {
    // Fetch all venues
    const allVenues = await venues.query({});

    // Group by normalized address
    const addressMap = new Map<string, Venue[]>();
    for (const venue of allVenues) {
      const key = normalizeAddress(venue);
      if (!addressMap.has(key)) {
        addressMap.set(key, []);
      }
      addressMap.get(key)!.push(venue);
    }

    // Get dish counts for all venues
    const allDishes = await dishes.query({ status: 'active' });
    const dishCountMap = new Map<string, number>();
    for (const dish of allDishes) {
      const count = dishCountMap.get(dish.venue_id) || 0;
      dishCountMap.set(dish.venue_id, count + 1);
    }

    // Filter to only groups with 2+ venues (duplicates)
    const duplicateGroups: DuplicateGroup[] = [];
    const countByCountry: Record<string, number> = {};

    for (const [addressKey, venueGroup] of Array.from(addressMap)) {
      if (venueGroup.length > 1) {
        // Sort by creation date (oldest first) - typically want to keep the oldest
        venueGroup.sort((a, b) => a.created_at.getTime() - b.created_at.getTime());

        const formattedAddress = formatAddress(venueGroup[0]);

        duplicateGroups.push({
          addressKey,
          formattedAddress,
          venues: venueGroup.map(v => ({
            id: v.id,
            name: v.name,
            type: v.type,
            chainId: v.chain_id,
            chainName: undefined, // Would need chain lookup for names
            address: {
              street: v.address.street,
              city: v.address.city,
              postalCode: v.address.postal_code,
              country: v.address.country,
            },
            status: v.status,
            lastVerified: v.last_verified.toISOString(),
            createdAt: v.created_at.toISOString(),
            dishCount: dishCountMap.get(v.id) || 0,
          })),
        });

        // Track by country
        const country = venueGroup[0].address.country;
        countByCountry[country] = (countByCountry[country] || 0) + venueGroup.length;
      }
    }

    // Sort by number of duplicates (most duplicates first)
    duplicateGroups.sort((a, b) => b.venues.length - a.venues.length);

    const totalDuplicateVenues = duplicateGroups.reduce((sum, g) => sum + g.venues.length, 0);

    const response: FindDuplicatesResponse = {
      duplicateGroups,
      totalDuplicateGroups: duplicateGroups.length,
      totalDuplicateVenues,
      stats: {
        byCountry: countByCountry,
        totalVenuesScanned: allVenues.length,
      },
    };

    res.json(response);
  },
  { allowedMethods: ['GET'] }
);

// Validation schema for delete request
const deleteSchema = z.object({
  venueIds: z.array(z.string().min(1)).min(1).max(100),
});

interface DeleteDuplicatesResponse {
  success: boolean;
  message: string;
  deletedVenues: number;
  deletedDishes: number;
  details: {
    venueId: string;
    venueName: string;
    dishesDeleted: number;
  }[];
}

/**
 * POST /adminDeleteDuplicateVenues
 * Delete specified venue IDs and their associated dishes
 */
export const adminDeleteDuplicateVenuesHandler = createAdminHandler(
  async (req, res) => {
    // Validate request body
    const validation = deleteSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Invalid request body',
        details: validation.error.errors,
      });
      return;
    }

    const { venueIds } = validation.data;
    const details: DeleteDuplicatesResponse['details'] = [];
    let totalDishesDeleted = 0;

    // Process each venue
    for (const venueId of venueIds) {
      // Get venue info first
      const venue = await venues.get(venueId);
      if (!venue) {
        // Skip if venue doesn't exist (may have been deleted already)
        continue;
      }

      // Delete associated dishes first
      const venueDishes = await dishes.getByVenue(venueId, false); // Get all dishes including inactive
      let dishesDeleted = 0;

      for (const dish of venueDishes) {
        await dishes.delete(dish.id);
        dishesDeleted++;
      }
      totalDishesDeleted += dishesDeleted;

      // Delete the venue
      await venues.delete(venueId);

      details.push({
        venueId,
        venueName: venue.name,
        dishesDeleted,
      });
    }

    const response: DeleteDuplicatesResponse = {
      success: true,
      message: `Successfully deleted ${details.length} venues and ${totalDishesDeleted} associated dishes`,
      deletedVenues: details.length,
      deletedDishes: totalDishesDeleted,
      details,
    };

    res.json(response);
  },
  { allowedMethods: ['POST'] }
);
