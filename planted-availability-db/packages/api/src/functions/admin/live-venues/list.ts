/**
 * Admin Live Venues List API
 * GET /adminLiveVenues
 *
 * Returns production venues in a hierarchical structure for browsing:
 * - Grouped by Country > VenueType > Chain > Venue
 * - Supports filtering by status, country, type, search
 * - Uses pagination
 */

import { z } from 'zod';
import {
  initializeFirestore,
  venues,
  chains,
  dishes,
} from '@pad/database';
import { createAdminHandler } from '../../../middleware/adminHandler.js';
import type { VenueStatus, VenueType, Chain, Venue } from '@pad/core';

// Initialize Firestore
initializeFirestore();

// Validation schema for query parameters
const listQuerySchema = z.object({
  country: z.enum(['CH', 'DE', 'AT']).optional(),
  status: z.enum(['active', 'stale', 'archived']).optional(),
  venueType: z.enum(['restaurant', 'retail', 'delivery_kitchen']).optional(),
  search: z.string().optional(),
  page: z.string().transform(Number).optional().default('1'),
  pageSize: z.string().transform(Number).optional().default('100'),
});

/**
 * LiveVenue - Venue with additional fields for display
 */
interface LiveVenue {
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
  location: {
    latitude: number;
    longitude: number;
  };
  status: VenueStatus;
  lastVerified: Date;
  createdAt: Date;
  deliveryPlatforms: {
    platform: string;
    url: string;
    active: boolean;
  }[];
  dishCount: number;
}

/**
 * HierarchyNode for frontend consumption
 */
interface HierarchyNode {
  id: string;
  type: 'country' | 'venueType' | 'chain' | 'venue';
  label: string;
  count: number;
  children?: HierarchyNode[];
  venue?: LiveVenue;
}

/**
 * Stats for the live venues
 */
interface LiveVenuesStats {
  active: number;
  stale: number;
  archived: number;
  total: number;
  byCountry: Record<string, number>;
  byType: Record<string, number>;
  avgDaysSinceVerification: number;
}

/**
 * Handler for GET /adminLiveVenues
 */
export const adminLiveVenuesHandler = createAdminHandler(
  async (req, res) => {
    // Validate query parameters
    const validation = listQuerySchema.safeParse(req.query);
    if (!validation.success) {
      res.status(400).json({
        error: 'Invalid query parameters',
        details: validation.error.errors,
      });
      return;
    }

    const {
      country,
      status,
      venueType,
      search,
      page = 1,
      pageSize = 100,
    } = validation.data;

    // Load all chains for name lookup
    const allChains = await chains.query({});
    const chainLookup = new Map<string, Chain>(allChains.map(c => [c.id, c]));

    // Fetch all venues (no filters to avoid composite index requirements)
    // Then filter in memory for maximum flexibility
    let venueList = await venues.query({});

    // Apply filters in memory to avoid composite index issues
    if (status) {
      venueList = venueList.filter(v => v.status === status);
    }
    if (venueType) {
      venueList = venueList.filter(v => v.type === venueType);
    }
    if (country) {
      venueList = venueList.filter(v => v.address.country === country);
    }
    if (search) {
      const searchLower = search.toLowerCase();
      venueList = venueList.filter(v =>
        v.name.toLowerCase().includes(searchLower) ||
        v.address.city.toLowerCase().includes(searchLower) ||
        v.address.street?.toLowerCase().includes(searchLower)
      );
    }

    // Sort by last_verified descending (most recently verified first)
    venueList.sort((a, b) => b.last_verified.getTime() - a.last_verified.getTime());

    // Calculate total before pagination
    const total = venueList.length;

    // Build dish count map - fetch all active dishes and count by venue_id
    const dishCountMap = new Map<string, number>();
    const allDishes = await dishes.query({ status: 'active' });
    for (const dish of allDishes) {
      const currentCount = dishCountMap.get(dish.venue_id) || 0;
      dishCountMap.set(dish.venue_id, currentCount + 1);
    }

    // Build hierarchy from ALL filtered venues (before pagination)
    // This ensures the tree shows all venues, not just the current page
    const allLiveVenues: LiveVenue[] = venueList.map(venue => {
      const chain = venue.chain_id ? chainLookup.get(venue.chain_id) : undefined;
      return {
        id: venue.id,
        name: venue.name,
        type: venue.type,
        chainId: venue.chain_id,
        chainName: chain?.name,
        address: {
          street: venue.address.street,
          city: venue.address.city,
          postalCode: venue.address.postal_code,
          country: venue.address.country,
        },
        location: {
          latitude: venue.location.latitude,
          longitude: venue.location.longitude,
        },
        status: venue.status,
        lastVerified: venue.last_verified,
        createdAt: venue.created_at,
        deliveryPlatforms: venue.delivery_platforms?.map(dp => ({
          platform: dp.partner,
          url: dp.url,
          active: dp.active,
        })) || [],
        dishCount: dishCountMap.get(venue.id) || 0,
      };
    });

    // Build hierarchy from all venues
    const hierarchy = buildHierarchy(allLiveVenues, chainLookup);

    // Apply pagination for items list (detail panel uses this)
    const startIndex = (page - 1) * pageSize;
    const paginatedVenues = allLiveVenues.slice(startIndex, startIndex + pageSize);
    const hasMore = startIndex + pageSize < total;

    // Calculate stats
    const stats = await calculateStats(venueList, country);

    res.json({
      items: paginatedVenues,
      hierarchy,
      stats,
      pagination: {
        page,
        pageSize: paginatedVenues.length,
        total,
        totalPages: Math.ceil(total / pageSize),
        hasMore,
      },
    });
  },
  { allowedMethods: ['GET'] }
);

/**
 * Build hierarchical structure: Country > VenueType > Chain > Venue
 */
function buildHierarchy(venueList: LiveVenue[], chainLookup: Map<string, Chain>): HierarchyNode[] {
  const countryMap = new Map<string, LiveVenue[]>();

  // Group by country
  for (const venue of venueList) {
    const country = venue.address.country;
    if (!countryMap.has(country)) {
      countryMap.set(country, []);
    }
    countryMap.get(country)!.push(venue);
  }

  // Build country nodes
  const countryNodes: HierarchyNode[] = [];

  for (const [country, countryVenues] of Array.from(countryMap)) {
    // Group by venue type
    const typeMap = new Map<VenueType, LiveVenue[]>();
    for (const venue of countryVenues) {
      if (!typeMap.has(venue.type)) {
        typeMap.set(venue.type, []);
      }
      typeMap.get(venue.type)!.push(venue);
    }

    const venueTypeNodes: HierarchyNode[] = [];

    for (const [venueType, typeVenues] of Array.from(typeMap)) {
      // Separate into chain and independent
      const chainVenues = typeVenues.filter(v => v.chainId);
      const independentVenues = typeVenues.filter(v => !v.chainId);

      const typeChildren: HierarchyNode[] = [];

      // Build chain groups
      if (chainVenues.length > 0) {
        const chainMap = new Map<string, LiveVenue[]>();

        for (const venue of chainVenues) {
          const chainId = venue.chainId!;
          if (!chainMap.has(chainId)) {
            chainMap.set(chainId, []);
          }
          chainMap.get(chainId)!.push(venue);
        }

        for (const [chainId, chainVenueList] of Array.from(chainMap)) {
          const chainName = chainVenueList[0].chainName || 'Unknown Chain';

          const venueNodes: HierarchyNode[] = chainVenueList.map(v => ({
            id: `venue-${v.id}`,
            type: 'venue' as const,
            label: v.name,
            count: v.dishCount,
            venue: v,
          }));

          typeChildren.push({
            id: `chain-${chainId}`,
            type: 'chain',
            label: chainName,
            count: chainVenueList.length,
            children: venueNodes,
          });
        }
      }

      // Add independent venues under their own group
      if (independentVenues.length > 0) {
        const independentNodes: HierarchyNode[] = independentVenues.map(v => ({
          id: `venue-${v.id}`,
          type: 'venue' as const,
          label: v.name,
          count: v.dishCount,
          venue: v,
        }));

        typeChildren.push({
          id: `${country}-${venueType}-independent`,
          type: 'chain',
          label: 'Independent',
          count: independentVenues.length,
          children: independentNodes,
        });
      }

      // Sort chains by count descending
      typeChildren.sort((a, b) => b.count - a.count);

      const typeLabel = venueType === 'restaurant' ? 'Restaurants' :
                        venueType === 'retail' ? 'Retail' :
                        'Delivery Kitchens';

      venueTypeNodes.push({
        id: `${country}-${venueType}`,
        type: 'venueType',
        label: typeLabel,
        count: typeVenues.length,
        children: typeChildren,
      });
    }

    // Sort venue types
    venueTypeNodes.sort((a, b) => b.count - a.count);

    countryNodes.push({
      id: country,
      type: 'country',
      label: country,
      count: countryVenues.length,
      children: venueTypeNodes,
    });
  }

  // Sort by country name
  countryNodes.sort((a, b) => a.label.localeCompare(b.label));

  return countryNodes;
}

/**
 * Calculate statistics for live venues
 */
async function calculateStats(
  filteredVenues: Venue[],
  country?: string
): Promise<LiveVenuesStats> {
  // Get freshness stats from the venues collection
  const freshnessStats = await venues.getFreshnessStats();

  // Count by status from filtered list
  const byStatus = {
    active: filteredVenues.filter(v => v.status === 'active').length,
    stale: filteredVenues.filter(v => v.status === 'stale').length,
    archived: filteredVenues.filter(v => v.status === 'archived').length,
  };

  // Count by country
  const byCountry: Record<string, number> = {};
  for (const venue of filteredVenues) {
    byCountry[venue.address.country] = (byCountry[venue.address.country] || 0) + 1;
  }

  // Count by type
  const byType: Record<string, number> = {};
  for (const venue of filteredVenues) {
    byType[venue.type] = (byType[venue.type] || 0) + 1;
  }

  return {
    active: byStatus.active,
    stale: byStatus.stale,
    archived: byStatus.archived,
    total: filteredVenues.length,
    byCountry,
    byType,
    avgDaysSinceVerification: freshnessStats.avgDaysSinceVerification,
  };
}
