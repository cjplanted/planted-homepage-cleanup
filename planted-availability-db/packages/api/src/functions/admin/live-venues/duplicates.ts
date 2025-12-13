/**
 * Duplicate Venues Detection API
 *
 * GET /adminFindDuplicateVenues - Find venues with identical or similar addresses
 * POST /adminDeleteDuplicateVenues - Delete specified duplicate venues
 * POST /adminMergeVenues - Merge two venues into one
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
 * Multi-factor duplicate detection scoring
 */
interface DuplicateScore {
  addressMatch: boolean;        // Normalized address comparison
  coordinateProximity: number;  // Distance in meters (-1 if unknown)
  platformUrlMatch: boolean;    // Same delivery URL on any platform
  nameSimilarity: number;       // Levenshtein distance ratio (0-1)
  totalScore: number;           // Weighted combination
}

// Scoring weights for duplicate detection
const DUPLICATE_SCORE_WEIGHTS = {
  ADDRESS_MATCH: 40,
  COORDINATE_PROXIMITY: 30,      // Full points if < 100m
  PLATFORM_URL_MATCH: 25,
  NAME_SIMILARITY: 5,            // Full points if > 0.8 similarity
};

const DUPLICATE_THRESHOLD = 50;  // Score >= 50 = potential duplicate

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate name similarity as ratio (0-1)
 */
function calculateNameSimilarity(name1: string, name2: string): number {
  const s1 = name1.toLowerCase().trim();
  const s2 = name2.toLowerCase().trim();

  if (s1 === s2) return 1;

  const distance = levenshteinDistance(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);

  return 1 - (distance / maxLength);
}

/**
 * Calculate distance between two coordinates in meters using Haversine formula
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate multi-factor duplicate score between two venues
 */
function calculateDuplicateScore(venue1: Venue, venue2: Venue): DuplicateScore {
  let totalScore = 0;

  // 1. Address match (40 points)
  const addr1 = normalizeAddress(venue1);
  const addr2 = normalizeAddress(venue2);
  const addressMatch = addr1 === addr2;
  if (addressMatch) {
    totalScore += DUPLICATE_SCORE_WEIGHTS.ADDRESS_MATCH;
  }

  // 2. Coordinate proximity (30 points if < 100m)
  let coordinateProximity = -1;
  if (venue1.coordinates && venue2.coordinates) {
    coordinateProximity = calculateDistance(
      venue1.coordinates.lat,
      venue1.coordinates.lng,
      venue2.coordinates.lat,
      venue2.coordinates.lng
    );
    if (coordinateProximity < 100) {
      totalScore += DUPLICATE_SCORE_WEIGHTS.COORDINATE_PROXIMITY;
    } else if (coordinateProximity < 500) {
      // Partial points for being within 500m
      totalScore += DUPLICATE_SCORE_WEIGHTS.COORDINATE_PROXIMITY * 0.5;
    }
  }

  // 3. Platform URL match (25 points if any URL matches)
  let platformUrlMatch = false;
  const urls1 = new Set(venue1.delivery_platforms?.map(p => p.url.toLowerCase()) || []);
  for (const platform of venue2.delivery_platforms || []) {
    if (urls1.has(platform.url.toLowerCase())) {
      platformUrlMatch = true;
      totalScore += DUPLICATE_SCORE_WEIGHTS.PLATFORM_URL_MATCH;
      break;
    }
  }

  // 4. Name similarity (5 points if > 0.8)
  const nameSimilarity = calculateNameSimilarity(venue1.name, venue2.name);
  if (nameSimilarity > 0.8) {
    totalScore += DUPLICATE_SCORE_WEIGHTS.NAME_SIMILARITY;
  } else if (nameSimilarity > 0.6) {
    totalScore += DUPLICATE_SCORE_WEIGHTS.NAME_SIMILARITY * 0.5;
  }

  return {
    addressMatch,
    coordinateProximity,
    platformUrlMatch,
    nameSimilarity,
    totalScore,
  };
}

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
  coordinates?: { lat: number; lng: number };
  platformUrls: string[];
  status: VenueStatus;
  lastVerified: string;
  createdAt: string;
  dishCount: number;
}

interface DuplicateGroup {
  addressKey: string;
  formattedAddress: string;
  venues: DuplicateVenue[];
  score: DuplicateScore;        // Multi-factor score details
  recommendation: 'merge' | 'review' | 'keep_both';
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
 * Find all venues that share the same address or have high duplicate scores
 * Uses multi-factor detection: address, coordinates, platform URLs, name similarity
 */
export const adminFindDuplicateVenuesHandler = createAdminHandler(
  async (req, res) => {
    // Fetch all venues
    const allVenues = await venues.query({});

    // Get dish counts for all venues
    const allDishes = await dishes.query({ status: 'active' });
    const dishCountMap = new Map<string, number>();
    for (const dish of allDishes) {
      const count = dishCountMap.get(dish.venue_id) || 0;
      dishCountMap.set(dish.venue_id, count + 1);
    }

    // Find duplicate pairs using multi-factor scoring
    const duplicatePairs: Array<{ venue1: Venue; venue2: Venue; score: DuplicateScore }> = [];
    const processedPairs = new Set<string>();

    for (let i = 0; i < allVenues.length; i++) {
      for (let j = i + 1; j < allVenues.length; j++) {
        const venue1 = allVenues[i];
        const venue2 = allVenues[j];

        // Skip if already processed
        const pairKey = [venue1.id, venue2.id].sort().join('|');
        if (processedPairs.has(pairKey)) continue;
        processedPairs.add(pairKey);

        // Calculate duplicate score
        const score = calculateDuplicateScore(venue1, venue2);

        // Only include if score meets threshold
        if (score.totalScore >= DUPLICATE_THRESHOLD) {
          duplicatePairs.push({ venue1, venue2, score });
        }
      }
    }

    // Group overlapping pairs into clusters
    const venueToGroup = new Map<string, number>();
    const groups: Venue[][] = [];

    for (const { venue1, venue2 } of duplicatePairs) {
      const group1 = venueToGroup.get(venue1.id);
      const group2 = venueToGroup.get(venue2.id);

      if (group1 === undefined && group2 === undefined) {
        // Create new group
        const newGroupIndex = groups.length;
        groups.push([venue1, venue2]);
        venueToGroup.set(venue1.id, newGroupIndex);
        venueToGroup.set(venue2.id, newGroupIndex);
      } else if (group1 !== undefined && group2 === undefined) {
        // Add venue2 to group1
        groups[group1].push(venue2);
        venueToGroup.set(venue2.id, group1);
      } else if (group1 === undefined && group2 !== undefined) {
        // Add venue1 to group2
        groups[group2].push(venue1);
        venueToGroup.set(venue1.id, group2);
      } else if (group1 !== undefined && group2 !== undefined && group1 !== group2) {
        // Merge groups
        const mergedGroup = [...groups[group1], ...groups[group2]];
        groups[group1] = mergedGroup;
        groups[group2] = [];
        for (const v of mergedGroup) {
          venueToGroup.set(v.id, group1);
        }
      }
    }

    // Convert groups to DuplicateGroup format
    const duplicateGroups: DuplicateGroup[] = [];
    const countByCountry: Record<string, number> = {};

    for (const venueGroup of groups) {
      if (venueGroup.length < 2) continue;

      // Sort by creation date (oldest first)
      venueGroup.sort((a, b) => a.created_at.getTime() - b.created_at.getTime());

      const formattedAddress = formatAddress(venueGroup[0]);
      const addressKey = normalizeAddress(venueGroup[0]);

      // Calculate the best score in this group
      let bestScore: DuplicateScore = {
        addressMatch: false,
        coordinateProximity: -1,
        platformUrlMatch: false,
        nameSimilarity: 0,
        totalScore: 0,
      };

      for (let i = 0; i < venueGroup.length; i++) {
        for (let j = i + 1; j < venueGroup.length; j++) {
          const score = calculateDuplicateScore(venueGroup[i], venueGroup[j]);
          if (score.totalScore > bestScore.totalScore) {
            bestScore = score;
          }
        }
      }

      // Determine recommendation based on score
      let recommendation: 'merge' | 'review' | 'keep_both';
      if (bestScore.totalScore >= 70) {
        recommendation = 'merge';
      } else if (bestScore.totalScore >= 50) {
        recommendation = 'review';
      } else {
        recommendation = 'keep_both';
      }

      duplicateGroups.push({
        addressKey,
        formattedAddress,
        venues: venueGroup.map(v => ({
          id: v.id,
          name: v.name,
          type: v.type,
          chainId: v.chain_id,
          chainName: undefined,
          address: {
            street: v.address.street,
            city: v.address.city,
            postalCode: v.address.postal_code,
            country: v.address.country,
          },
          coordinates: v.coordinates,
          platformUrls: v.delivery_platforms?.map(p => p.url) || [],
          status: v.status,
          lastVerified: v.last_verified.toISOString(),
          createdAt: v.created_at.toISOString(),
          dishCount: dishCountMap.get(v.id) || 0,
        })),
        score: bestScore,
        recommendation,
      });

      // Track by country
      const country = venueGroup[0].address.country;
      countByCountry[country] = (countByCountry[country] || 0) + venueGroup.length;
    }

    // Sort by score (highest first)
    duplicateGroups.sort((a, b) => b.score.totalScore - a.score.totalScore);

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

// Validation schema for merge request
const mergeSchema = z.object({
  primaryVenueId: z.string().min(1),
  secondaryVenueId: z.string().min(1),
});

interface MergeVenuesResponse {
  success: boolean;
  message: string;
  mergedVenue: {
    id: string;
    name: string;
    totalDishes: number;
    totalPlatforms: number;
  };
  deletedSecondary: {
    venueId: string;
    venueName: string;
    dishesTransferred: number;
    platformsTransferred: number;
  };
}

/**
 * POST /adminMergeVenues
 * Merge two venues: transfer dishes and platforms from secondary to primary, then delete secondary
 */
export const adminMergeVenuesHandler = createAdminHandler(
  async (req, res) => {
    // Validate request body
    const validation = mergeSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Invalid request body',
        details: validation.error.errors,
      });
      return;
    }

    const { primaryVenueId, secondaryVenueId } = validation.data;

    // Prevent merging venue with itself
    if (primaryVenueId === secondaryVenueId) {
      res.status(400).json({ error: 'Cannot merge a venue with itself' });
      return;
    }

    // Get both venues
    const [primaryVenue, secondaryVenue] = await Promise.all([
      venues.get(primaryVenueId),
      venues.get(secondaryVenueId),
    ]);

    if (!primaryVenue) {
      res.status(404).json({ error: `Primary venue ${primaryVenueId} not found` });
      return;
    }

    if (!secondaryVenue) {
      res.status(404).json({ error: `Secondary venue ${secondaryVenueId} not found` });
      return;
    }

    // Get dishes from secondary venue
    const secondaryDishes = await dishes.getByVenue(secondaryVenueId, false);
    const primaryDishes = await dishes.getByVenue(primaryVenueId, false);

    // Get existing dish names in primary (for deduplication)
    const existingDishNames = new Set(primaryDishes.map(d => d.name.toLowerCase().trim()));

    // Transfer unique dishes from secondary to primary
    let dishesTransferred = 0;
    for (const dish of secondaryDishes) {
      const normalizedName = dish.name.toLowerCase().trim();
      if (!existingDishNames.has(normalizedName)) {
        // Update dish to belong to primary venue
        await dishes.update(dish.id, { venue_id: primaryVenueId });
        existingDishNames.add(normalizedName);
        dishesTransferred++;
      } else {
        // Delete duplicate dish
        await dishes.delete(dish.id);
      }
    }

    // Merge delivery platforms (keep unique ones)
    const existingPlatformUrls = new Set(
      primaryVenue.delivery_platforms?.map(p => p.url.toLowerCase()) || []
    );
    const newPlatforms: typeof primaryVenue.delivery_platforms = [
      ...(primaryVenue.delivery_platforms || [])
    ];
    let platformsTransferred = 0;

    for (const platform of secondaryVenue.delivery_platforms || []) {
      if (!existingPlatformUrls.has(platform.url.toLowerCase())) {
        newPlatforms.push(platform);
        existingPlatformUrls.add(platform.url.toLowerCase());
        platformsTransferred++;
      }
    }

    // Update primary venue with merged platforms
    if (platformsTransferred > 0) {
      await venues.update(primaryVenueId, { delivery_platforms: newPlatforms });
    }

    // Delete secondary venue
    await venues.delete(secondaryVenueId);

    // Get final dish count
    const finalDishes = await dishes.getByVenue(primaryVenueId, false);

    const response: MergeVenuesResponse = {
      success: true,
      message: `Successfully merged "${secondaryVenue.name}" into "${primaryVenue.name}"`,
      mergedVenue: {
        id: primaryVenueId,
        name: primaryVenue.name,
        totalDishes: finalDishes.length,
        totalPlatforms: newPlatforms.length,
      },
      deletedSecondary: {
        venueId: secondaryVenueId,
        venueName: secondaryVenue.name,
        dishesTransferred,
        platformsTransferred,
      },
    };

    res.json(response);
  },
  { allowedMethods: ['POST'] }
);
