/**
 * Admin Reject Venue API
 * POST /admin/review/venues/:id/reject
 *
 * Rejects a discovered venue as a false positive:
 * - Updates venue status to 'rejected'
 * - Stores rejection reason
 * - Records feedback for strategy learning
 * - Updates strategy to reflect false positive
 */

import { z } from 'zod';
import {
  initializeFirestore,
  discoveredVenues,
  discoveryStrategies,
  changeLogs,
} from '@pad/database';
import { createAdminHandler } from '../../../middleware/adminHandler.js';

// Initialize Firestore
initializeFirestore();

// Validation schema for reject request body
const rejectBodySchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required'),
  feedbackTags: z.array(z.string()).optional(),
});

/**
 * Handler for POST /admin/review/venues/:id/reject
 */
export const adminRejectVenueHandler = createAdminHandler(
  async (req, res) => {
    // Extract venue ID from path
    const pathParts = req.path.split('/').filter(Boolean);
    const venueId = pathParts[pathParts.length - 2]; // .../venues/:id/reject

    if (!venueId) {
      res.status(400).json({ error: 'Venue ID required' });
      return;
    }

    // Validate request body
    const validation = rejectBodySchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Invalid request body',
        details: validation.error.errors,
      });
      return;
    }

    const { reason, feedbackTags } = validation.data;

    // Get the venue
    const venue = await discoveredVenues.getById(venueId);
    if (!venue) {
      res.status(404).json({ error: 'Venue not found' });
      return;
    }

    // Check if already rejected
    if (venue.status === 'rejected') {
      res.status(400).json({
        error: 'Venue already rejected',
        message: 'This venue has already been rejected',
      });
      return;
    }

    // Reject the venue
    const updatedVenue = await discoveredVenues.rejectVenue(venueId, reason);

    // Update strategy - mark as false positive
    if (venue.discovered_by_strategy_id) {
      try {
        await discoveryStrategies.recordUsage(venue.discovered_by_strategy_id, {
          success: false,
          was_false_positive: true,
        });
      } catch (e) {
        console.warn('Failed to update strategy:', e);
      }
    }

    // Log the change
    try {
      const tagsMessage = feedbackTags && feedbackTags.length > 0
        ? `. Feedback tags: ${feedbackTags.join(', ')}`
        : '';

      await changeLogs.log({
        action: 'updated',
        collection: 'discovered_venues',
        document_id: venueId,
        changes: [
          { field: 'status', before: venue.status, after: 'rejected' },
          { field: 'rejection_reason', before: null, after: reason },
        ],
        source: { type: 'manual', user_id: req.user?.uid },
        reason: `Admin rejected venue: ${reason}${tagsMessage}`,
      });
    } catch (e) {
      console.warn('Failed to log change:', e);
    }

    res.json({
      success: true,
      message: 'Venue rejected successfully',
      venue: {
        id: updatedVenue.id,
        name: updatedVenue.name,
        status: updatedVenue.status,
        rejectionReason: updatedVenue.rejection_reason,
      },
      feedback: {
        reason,
        tags: feedbackTags || [],
      },
    });
  },
  { allowedMethods: ['POST'] }
);
