/**
 * Admin Update Venue Status API
 * POST /adminUpdateVenueStatus
 *
 * Updates the status of a production venue (mark as stale, archive, reactivate).
 */

import { z } from 'zod';
import {
  initializeFirestore,
  venues,
} from '@pad/database';
import { createAdminHandler } from '../../../middleware/adminHandler.js';

// Initialize Firestore
initializeFirestore();

// Validation schema for request body
const updateStatusSchema = z.object({
  venueId: z.string().min(1),
  status: z.enum(['active', 'stale', 'archived']),
});

/**
 * Handler for POST /adminUpdateVenueStatus
 */
export const adminUpdateVenueStatusHandler = createAdminHandler(
  async (req, res) => {
    // Validate request body
    const validation = updateStatusSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Invalid request body',
        details: validation.error.errors,
      });
      return;
    }

    const { venueId, status } = validation.data;

    // Get the venue first to check it exists
    const venue = await venues.getById(venueId);
    if (!venue) {
      res.status(404).json({
        error: 'Venue not found',
        venueId,
      });
      return;
    }

    const previousStatus = venue.status;

    // Update the status using the appropriate method
    let updatedVenue;
    switch (status) {
      case 'active':
        // Reactivate - also updates last_verified
        updatedVenue = await venues.markVerified(venueId);
        break;
      case 'stale':
        updatedVenue = await venues.markStale(venueId);
        break;
      case 'archived':
        updatedVenue = await venues.archive(venueId);
        break;
    }

    res.json({
      success: true,
      message: `Venue status updated from ${previousStatus} to ${status}`,
      venue: {
        id: updatedVenue.id,
        name: updatedVenue.name,
        previousStatus,
        status: updatedVenue.status,
        lastVerified: updatedVenue.last_verified,
      },
    });
  },
  { allowedMethods: ['POST'] }
);
