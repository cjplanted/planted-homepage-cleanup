/**
 * Admin Approve Venue API
 * POST /admin/review/venues/:id/approve
 *
 * Approves a discovered venue and optionally approves/rejects its dishes
 * - Updates discovered_venue status to 'verified'
 * - Updates discovered_dishes status based on dishApprovals
 * - Records approval in changelog
 * - Triggers confidence recalculation for strategy
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

// Initialize Firestore
initializeFirestore();

// Validation schema for approve request body
const approveBodySchema = z.object({
  dishApprovals: z.array(z.object({
    dishId: z.string(),
    approved: z.boolean(),
  })).optional(),
});

/**
 * Handler for POST /admin/review/venues/:id/approve
 */
export const adminApproveVenueHandler = createAdminHandler(
  async (req, res) => {
    // Extract venue ID from path
    const pathParts = req.path.split('/').filter(Boolean);
    const venueId = pathParts[pathParts.length - 2]; // .../venues/:id/approve

    if (!venueId) {
      res.status(400).json({ error: 'Venue ID required' });
      return;
    }

    // Validate request body
    const validation = approveBodySchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Invalid request body',
        details: validation.error.errors,
      });
      return;
    }

    const { dishApprovals } = validation.data;

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

    // Process dish approvals
    const dishUpdatePromises = [];
    const approvedDishes: string[] = [];
    const rejectedDishes: string[] = [];

    if (dishApprovals && dishApprovals.length > 0) {
      for (const approval of dishApprovals) {
        const dish = dishes.find(d => d.id === approval.dishId);
        if (!dish) {
          console.warn(`Dish ${approval.dishId} not found for venue ${venueId}`);
          continue;
        }

        if (approval.approved) {
          // Approve the dish
          dishUpdatePromises.push(
            discoveredDishes.verifyDish(approval.dishId)
          );
          approvedDishes.push(approval.dishId);
        } else {
          // Reject the dish
          dishUpdatePromises.push(
            discoveredDishes.rejectDish(approval.dishId, 'Rejected during venue approval')
          );
          rejectedDishes.push(approval.dishId);
        }
      }
    } else {
      // If no dish approvals specified, approve all dishes
      for (const dish of dishes) {
        if (dish.status === 'discovered') {
          dishUpdatePromises.push(
            discoveredDishes.verifyDish(dish.id)
          );
          approvedDishes.push(dish.id);
        }
      }
    }

    // Execute all updates
    await Promise.all(dishUpdatePromises);

    // Approve the venue
    const updatedVenue = await discoveredVenues.verifyVenue(venueId);

    // Update strategy success rate
    if (venue.discovered_by_strategy_id) {
      try {
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
        reason: `Admin approved venue with ${approvedDishes.length} dishes approved, ${rejectedDishes.length} dishes rejected`,
      });
    } catch (e) {
      console.warn('Failed to log change:', e);
    }

    res.json({
      success: true,
      message: 'Venue approved successfully',
      venue: {
        id: updatedVenue.id,
        name: updatedVenue.name,
        status: updatedVenue.status,
        verifiedAt: updatedVenue.verified_at,
      },
      dishes: {
        approved: approvedDishes.length,
        rejected: rejectedDishes.length,
        total: dishes.length,
      },
    });
  },
  { allowedMethods: ['POST'] }
);
