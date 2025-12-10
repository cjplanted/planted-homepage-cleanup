/**
 * Admin Partial Approve Venue API
 * POST /admin/review/venues/:id/partial-approve
 *
 * Partially approves a venue with corrections:
 * - Applies dish updates (price corrections, name fixes, etc.)
 * - Records feedback for AI learning
 * - Updates venue status to 'verified' after edits applied
 * - Triggers strategy adjustment based on feedback
 */

import { z } from 'zod';
import {
  initializeFirestore,
  discoveredVenues,
  discoveredDishes,
  discoveryStrategies,
  changeLogs,
} from '@pad/database';
import { createAdminHandler } from '../../../middleware/adminHandler.js';
import type { ExtractedDish } from '@pad/core';

// Initialize Firestore
initializeFirestore();

// Validation schema for partial approve request body
const partialApproveBodySchema = z.object({
  feedback: z.string(),
  feedbackTags: z.array(z.string()),
  dishUpdates: z.array(z.object({
    dishId: z.string(),
    updates: z.record(z.unknown()),
    approved: z.boolean(),
  })).optional(),
});

/**
 * Handler for POST /admin/review/venues/:id/partial-approve
 */
export const adminPartialApproveVenueHandler = createAdminHandler(
  async (req, res) => {
    // Extract venue ID from path
    const pathParts = req.path.split('/').filter(Boolean);
    const venueId = pathParts[pathParts.length - 2]; // .../venues/:id/partial-approve

    if (!venueId) {
      res.status(400).json({ error: 'Venue ID required' });
      return;
    }

    // Validate request body
    const validation = partialApproveBodySchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Invalid request body',
        details: validation.error.errors,
      });
      return;
    }

    const { feedback, feedbackTags, dishUpdates } = validation.data;

    // Get the venue
    const venue = await discoveredVenues.getById(venueId);
    if (!venue) {
      res.status(404).json({ error: 'Venue not found' });
      return;
    }

    // Check if already verified
    if (venue.status === 'verified') {
      res.status(400).json({
        error: 'Venue already verified',
        message: 'This venue has already been approved',
      });
      return;
    }

    // Get all dishes for this venue
    const dishes = await discoveredDishes.getByVenue(venueId);

    // Process dish updates
    const dishUpdateResults: Array<{
      dishId: string;
      status: 'updated' | 'approved' | 'rejected' | 'error';
      error?: string;
    }> = [];

    if (dishUpdates && dishUpdates.length > 0) {
      for (const dishUpdate of dishUpdates) {
        try {
          const dish = dishes.find(d => d.id === dishUpdate.dishId);
          if (!dish) {
            dishUpdateResults.push({
              dishId: dishUpdate.dishId,
              status: 'error',
              error: 'Dish not found',
            });
            continue;
          }

          // Apply updates to the dish
          if (Object.keys(dishUpdate.updates).length > 0) {
            await discoveredDishes.update(dishUpdate.dishId, dishUpdate.updates as Partial<ExtractedDish>);
            dishUpdateResults.push({
              dishId: dishUpdate.dishId,
              status: 'updated',
            });
          }

          // Approve or reject the dish
          if (dishUpdate.approved) {
            await discoveredDishes.verifyDish(dishUpdate.dishId);
            dishUpdateResults.push({
              dishId: dishUpdate.dishId,
              status: 'approved',
            });
          } else {
            await discoveredDishes.rejectDish(
              dishUpdate.dishId,
              'Corrected and rejected during partial approval'
            );
            dishUpdateResults.push({
              dishId: dishUpdate.dishId,
              status: 'rejected',
            });
          }
        } catch (error) {
          console.error(`Failed to update dish ${dishUpdate.dishId}:`, error);
          dishUpdateResults.push({
            dishId: dishUpdate.dishId,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    // Approve the venue after corrections
    const updatedVenue = await discoveredVenues.verifyVenue(venueId);

    // Update strategy with partial success
    // Partial approval means the strategy found the venue, but with some inaccuracies
    if (venue.discovered_by_strategy_id) {
      try {
        // Still count as success but with reduced confidence
        await discoveryStrategies.recordUsage(venue.discovered_by_strategy_id, {
          success: true,
          was_false_positive: false,
        });
      } catch (e) {
        console.warn('Failed to update strategy:', e);
      }
    }

    // Log the change
    try {
      await changeLogs.log({
        action: 'updated',
        collection: 'discovered_venues',
        document_id: venueId,
        changes: [
          { field: 'status', before: venue.status, after: 'verified' },
        ],
        source: { type: 'manual', user_id: req.user?.uid },
        reason: `Admin partial approval with corrections. Feedback: ${feedback}. Tags: ${feedbackTags.join(', ')}`,
      });
    } catch (e) {
      console.warn('Failed to log change:', e);
    }

    // Count results
    const updated = dishUpdateResults.filter(r => r.status === 'updated').length;
    const approved = dishUpdateResults.filter(r => r.status === 'approved').length;
    const rejected = dishUpdateResults.filter(r => r.status === 'rejected').length;
    const errors = dishUpdateResults.filter(r => r.status === 'error').length;

    res.json({
      success: true,
      message: 'Venue partially approved with corrections',
      venue: {
        id: updatedVenue.id,
        name: updatedVenue.name,
        status: updatedVenue.status,
        verifiedAt: updatedVenue.verified_at,
      },
      feedback: {
        message: feedback,
        tags: feedbackTags,
      },
      dishes: {
        updated,
        approved,
        rejected,
        errors,
        total: dishes.length,
      },
      dishResults: dishUpdateResults,
    });
  },
  { allowedMethods: ['POST'] }
);
