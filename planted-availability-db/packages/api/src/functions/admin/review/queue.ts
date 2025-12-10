/**
 * Admin Review Queue API
 * GET /admin/review/queue
 *
 * Returns venues in a hierarchical structure for efficient review:
 * - Grouped by Country → VenueType (chain/independent) → Chain → Venue
 * - Includes dishes for each venue
 * - Supports filtering by status, country, confidence
 * - Uses cursor-based pagination
 */

import { z } from 'zod';
import {
  initializeFirestore,
  discoveredVenues,
  discoveredDishes,
} from '@pad/database';
import { createAdminHandler } from '../../../middleware/adminHandler.js';
import type { SupportedCountry, DiscoveredVenueStatus } from '@pad/core';

// Initialize Firestore
initializeFirestore();

// Validation schema for query parameters
const queueQuerySchema = z.object({
  country: z.enum(['CH', 'DE', 'AT']).optional(),
  status: z.enum(['discovered', 'verified', 'rejected', 'promoted', 'stale']).optional(),
  minConfidence: z.string().transform(Number).optional(),
  search: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.string().transform(Number).optional().default('50'),
});

interface CountryGroup {
  country: SupportedCountry;
  venueTypes: VenueTypeGroup[];
  totalVenues: number;
}

interface VenueTypeGroup {
  type: 'chain' | 'independent';
  chains?: ChainGroup[];
  venues?: ReviewVenue[];
  totalVenues: number;
}

interface ChainGroup {
  chainId: string;
  chainName: string;
  venues: ReviewVenue[];
  totalVenues: number;
}

interface ReviewVenue {
  id: string;
  name: string;
  chainId?: string;
  chainName?: string;
  address: {
    street?: string;
    city: string;
    postalCode?: string;
    country: SupportedCountry;
  };
  confidenceScore: number;
  status: DiscoveredVenueStatus;
  createdAt: Date;
  dishes: ReviewDish[];
}

interface ReviewDish {
  id: string;
  name: string;
  description?: string;
  product: string;
  confidence: number;
  price?: string;
  imageUrl?: string;
  status: string;
}

/**
 * Handler for GET /admin/review/queue
 */
export const adminReviewQueueHandler = createAdminHandler(
  async (req, res) => {
    // Validate query parameters
    const validation = queueQuerySchema.safeParse(req.query);
    if (!validation.success) {
      res.status(400).json({
        error: 'Invalid query parameters',
        details: validation.error.errors,
      });
      return;
    }

    const {
      country,
      status = 'discovered',
      minConfidence = 0,
      search,
      cursor,
      limit = 50,
    } = validation.data;

    // Fetch venues based on filters
    let venues = await discoveredVenues.getByStatus(status as DiscoveredVenueStatus);

    // Apply filters
    if (country) {
      venues = venues.filter(v => v.address.country === country);
    }

    if (minConfidence > 0) {
      venues = venues.filter(v => v.confidence_score >= minConfidence);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      venues = venues.filter(v =>
        v.name.toLowerCase().includes(searchLower) ||
        v.address.city.toLowerCase().includes(searchLower) ||
        v.chain_name?.toLowerCase().includes(searchLower)
      );
    }

    // Sort by confidence score descending, then by creation date
    venues.sort((a, b) => {
      if (b.confidence_score !== a.confidence_score) {
        return b.confidence_score - a.confidence_score;
      }
      return b.created_at.getTime() - a.created_at.getTime();
    });

    // Handle cursor-based pagination
    let startIndex = 0;
    if (cursor) {
      // Cursor is the ID of the last item from previous page
      const cursorIndex = venues.findIndex(v => v.id === cursor);
      if (cursorIndex !== -1) {
        startIndex = cursorIndex + 1;
      }
    }

    const paginatedVenues = venues.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < venues.length;
    const nextCursor = hasMore ? paginatedVenues[paginatedVenues.length - 1]?.id : undefined;

    // Fetch dishes for each venue
    const venuesWithDishes = await Promise.all(
      paginatedVenues.map(async (venue) => {
        const venueDishes = await discoveredDishes.getByVenue(venue.id);

        const reviewDishes: ReviewDish[] = venueDishes.map(dish => ({
          id: dish.id,
          name: dish.name,
          description: dish.description,
          product: dish.planted_product,
          confidence: dish.confidence_score,
          price: dish.price_by_country[venue.address.country],
          imageUrl: dish.image_url,
          status: dish.status,
        }));

        const reviewVenue: ReviewVenue = {
          id: venue.id,
          name: venue.name,
          chainId: venue.chain_id,
          chainName: venue.chain_name,
          address: {
            street: venue.address.street,
            city: venue.address.city,
            postalCode: venue.address.postal_code,
            country: venue.address.country,
          },
          confidenceScore: venue.confidence_score,
          status: venue.status,
          createdAt: venue.created_at,
          dishes: reviewDishes,
        };

        return reviewVenue;
      })
    );

    // Build hierarchical structure
    const hierarchy = buildHierarchy(venuesWithDishes);

    // Calculate statistics
    const stats = await calculateStats(country, status as DiscoveredVenueStatus);

    res.json({
      items: venuesWithDishes,
      hierarchy,
      stats,
      pagination: {
        cursor: nextCursor,
        hasMore,
        total: venues.length,
        pageSize: paginatedVenues.length,
      },
    });
  },
  { allowedMethods: ['GET'] }
);

/**
 * Build hierarchical structure: Country → VenueType → Chain → Venue
 */
function buildHierarchy(venues: ReviewVenue[]): CountryGroup[] {
  const countryMap = new Map<SupportedCountry, ReviewVenue[]>();

  // Group by country
  for (const venue of venues) {
    const country = venue.address.country;
    if (!countryMap.has(country)) {
      countryMap.set(country, []);
    }
    countryMap.get(country)!.push(venue);
  }

  // Build country groups
  const countryGroups: CountryGroup[] = [];

  for (const [country, countryVenues] of Array.from(countryMap)) {
    // Separate chains and independent venues
    const chainVenues = countryVenues.filter(v => v.chainId);
    const independentVenues = countryVenues.filter(v => !v.chainId);

    const venueTypes: VenueTypeGroup[] = [];

    // Build chain groups
    if (chainVenues.length > 0) {
      const chainMap = new Map<string, ReviewVenue[]>();

      for (const venue of chainVenues) {
        const chainId = venue.chainId!;
        if (!chainMap.has(chainId)) {
          chainMap.set(chainId, []);
        }
        chainMap.get(chainId)!.push(venue);
      }

      const chains: ChainGroup[] = [];
      for (const [chainId, venues] of Array.from(chainMap)) {
        chains.push({
          chainId,
          chainName: venues[0].chainName || 'Unknown Chain',
          venues,
          totalVenues: venues.length,
        });
      }

      // Sort chains by total venues descending
      chains.sort((a, b) => b.totalVenues - a.totalVenues);

      venueTypes.push({
        type: 'chain',
        chains,
        totalVenues: chainVenues.length,
      });
    }

    // Add independent venues
    if (independentVenues.length > 0) {
      venueTypes.push({
        type: 'independent',
        venues: independentVenues,
        totalVenues: independentVenues.length,
      });
    }

    countryGroups.push({
      country,
      venueTypes,
      totalVenues: countryVenues.length,
    });
  }

  // Sort by country name
  countryGroups.sort((a, b) => a.country.localeCompare(b.country));

  return countryGroups;
}

/**
 * Calculate statistics for the queue
 */
async function calculateStats(
  country?: SupportedCountry,
  status?: DiscoveredVenueStatus
) {
  // Get all venues for stats
  const allVenues = await discoveredVenues.getAll();

  // Filter by country if specified
  const filteredVenues = country
    ? allVenues.filter(v => v.address.country === country)
    : allVenues;

  // Count by status
  const byStatus = {
    pending: filteredVenues.filter(v => v.status === 'discovered').length,
    verified: filteredVenues.filter(v => v.status === 'verified').length,
    rejected: filteredVenues.filter(v => v.status === 'rejected').length,
    promoted: filteredVenues.filter(v => v.status === 'promoted').length,
    stale: filteredVenues.filter(v => v.status === 'stale').length,
  };

  // Count by country
  const byCountry: Record<string, number> = {};
  for (const venue of allVenues) {
    byCountry[venue.address.country] = (byCountry[venue.address.country] || 0) + 1;
  }

  // Count by confidence level
  const byConfidence = {
    low: filteredVenues.filter(v => v.confidence_score < 40).length,
    medium: filteredVenues.filter(v => v.confidence_score >= 40 && v.confidence_score < 70).length,
    high: filteredVenues.filter(v => v.confidence_score >= 70).length,
  };

  return {
    pending: byStatus.pending,
    verified: byStatus.verified,
    rejected: byStatus.rejected,
    promoted: byStatus.promoted,
    stale: byStatus.stale,
    byCountry,
    byConfidence,
    total: filteredVenues.length,
  };
}
