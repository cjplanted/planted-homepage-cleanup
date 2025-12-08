import { onRequest, HttpsOptions } from 'firebase-functions/v2/https';
import type { Request, Response } from 'express';
import { initializeFirestore, venues, dishes, promotions } from '@pad/database';
import {
  isVenueOpen,
  getNextOpeningTime,
  getTodayHoursString,
  type VenueType,
  type VenueStatus,
} from '@pad/core';

// Type guards for venue query params
const VENUE_TYPES: VenueType[] = ['retail', 'restaurant', 'delivery_kitchen'];
const VENUE_STATUSES: VenueStatus[] = ['active', 'stale', 'archived'];

function isValidVenueType(value: string | undefined): value is VenueType {
  return value !== undefined && VENUE_TYPES.includes(value as VenueType);
}

function isValidVenueStatus(value: string | undefined): value is VenueStatus {
  return value !== undefined && VENUE_STATUSES.includes(value as VenueStatus);
}

// Initialize Firestore
initializeFirestore();

const functionOptions: HttpsOptions = {
  region: 'europe-west6',
  cors: true,
  invoker: 'public', // Allow unauthenticated access
};

/**
 * GET /api/v1/venues/:id
 * Get full venue details including dishes and promotions
 */
export const venueDetailHandler = onRequest(functionOptions, async (req: Request, res: Response) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Extract venue ID from path
    // Expected path: /venues/{id}
    const pathParts = req.path.split('/').filter(Boolean);
    const venueId = pathParts[pathParts.length - 1];

    if (!venueId) {
      res.status(400).json({
        error: 'Bad request',
        message: 'Venue ID is required',
      });
      return;
    }

    // Get venue
    const venue = await venues.getById(venueId);

    if (!venue) {
      res.status(404).json({
        error: 'Not found',
        message: `Venue ${venueId} not found`,
      });
      return;
    }

    // Get venue's dishes
    const venueDishes = await dishes.getByVenue(venueId);

    // Get active promotions for this venue
    const venuePromotions = await promotions.getActiveForVenue(venueId);

    // If venue belongs to a chain, also get chain-wide promotions
    let chainPromotions: typeof venuePromotions = [];
    if (venue.chain_id) {
      chainPromotions = await promotions.getActiveForChain(venue.chain_id);
    }

    // Calculate opening status
    const is_open = isVenueOpen(venue.opening_hours);
    const next_open = is_open ? null : getNextOpeningTime(venue.opening_hours);
    const today_hours = getTodayHoursString(venue.opening_hours);

    // Get unique delivery partners from dishes
    const deliveryPartners = new Map<string, { partner: string; url: string }>();
    venueDishes.forEach((dish) => {
      dish.delivery_partners?.forEach((dp) => {
        if (!deliveryPartners.has(dp.partner)) {
          deliveryPartners.set(dp.partner, {
            partner: dp.partner,
            url: dp.url,
          });
        }
      });
    });

    // Set cache headers
    res.set('Cache-Control', 'public, max-age=300'); // 5 minute cache

    res.status(200).json({
      venue,
      dishes: venueDishes,
      promotions: [...venuePromotions, ...chainPromotions],
      is_open,
      next_open: next_open ? next_open.toISOString() : null,
      today_hours,
      delivery_partners: Array.from(deliveryPartners.values()),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Venue detail API error:', errorMessage);
    res.status(500).json({
      error: 'Internal server error',
      message: errorMessage,
    });
  }
});

/**
 * GET /api/v1/venues
 * List venues with optional filters
 */
export const venuesListHandler = onRequest(functionOptions, async (req: Request, res: Response) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const type = req.query.type as string | undefined;
    const country = req.query.country as string | undefined;
    const chainId = req.query.chain_id as string | undefined;
    const status = req.query.status as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 100);
    const offset = parseInt(req.query.offset as string, 10) || 0;

    const venuesList = await venues.query({
      type: isValidVenueType(type) ? type : undefined,
      country,
      chainId,
      status: isValidVenueStatus(status) ? status : undefined,
      limit,
      offset,
    });

    // Set cache headers
    res.set('Cache-Control', 'public, max-age=120'); // 2 minute cache

    res.status(200).json({
      venues: venuesList,
      total: venuesList.length,
      limit,
      offset,
      has_more: venuesList.length === limit,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Venues list API error:', errorMessage);
    res.status(500).json({
      error: 'Internal server error',
      message: errorMessage,
    });
  }
});
