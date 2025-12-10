/**
 * Admin Bulk Operations API
 * POST /admin/review/bulk/approve
 * POST /admin/review/bulk/reject
 *
 * Bulk approve/reject multiple venues at once
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

// Validation schemas
const bulkApproveBodySchema = z.object({
  venueIds: z.array(z.string()).min(1, 'At least one venue ID is required'),
});

const bulkRejectBodySchema = z.object({
  venueIds: z.array(z.string()).min(1, 'At least one venue ID is required'),
  reason: z.string().min(1, 'Rejection reason is required'),
});

/**
 * Handler for POST /admin/review/bulk/approve
 * Approves multiple venues at once
 */
export const adminBulkApproveHandler = createAdminHandler(
  async (req, res) => {
    // Validate request body
    const validation = bulkApproveBodySchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Invalid request body',
        details: validation.error.errors,
      });
      return;
    }

    const { venueIds } = validation.data;

    if (venueIds.length > 100) {
      res.status(400).json({
        error: 'Too many venues',
        message: 'Maximum 100 venues per bulk operation',
      });
      return;
    }

    const results: Array<{
      venueId: string;
      status: 'success' | 'error' | 'already_verified' | 'not_found';
      error?: string;
      venueName?: string;
    }> = [];

    // Process each venue
    for (const venueId of venueIds) {
      try {
        const venue = await discoveredVenues.getById(venueId);

        if (!venue) {
          results.push({
            venueId,
            status: 'not_found',
            error: 'Venue not found',
          });
          continue;
        }

        if (venue.status === 'verified') {
          results.push({
            venueId,
            status: 'already_verified',
            venueName: venue.name,
          });
          continue;
        }

        // Approve the venue
        await discoveredVenues.verifyVenue(venueId);

        // Update strategy
        if (venue.discovered_by_strategy_id) {
          try {
            await discoveryStrategies.recordUsage(venue.discovered_by_strategy_id, {
              success: true,
              was_false_positive: false,
            });
          } catch (e) {
            console.warn(`Failed to update strategy for venue ${venueId}:`, e);
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
            reason: 'Bulk approval',
          });
        } catch (e) {
          console.warn(`Failed to log change for venue ${venueId}:`, e);
        }

        results.push({
          venueId,
          status: 'success',
          venueName: venue.name,
        });
      } catch (error) {
        console.error(`Failed to approve venue ${venueId}:`, error);
        results.push({
          venueId,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successful = results.filter(r => r.status === 'success').length;
    const alreadyVerified = results.filter(r => r.status === 'already_verified').length;
    const errors = results.filter(r => r.status === 'error').length;
    const notFound = results.filter(r => r.status === 'not_found').length;

    res.json({
      success: true,
      message: `Bulk approval completed: ${successful} approved, ${alreadyVerified} already verified, ${errors} errors, ${notFound} not found`,
      summary: {
        total: venueIds.length,
        successful,
        alreadyVerified,
        errors,
        notFound,
      },
      results,
    });
  },
  {
    allowedMethods: ['POST'],
    timeoutSeconds: 540, // 9 minutes for bulk operations
  }
);

/**
 * Handler for POST /admin/review/bulk/reject
 * Rejects multiple venues at once
 */
export const adminBulkRejectHandler = createAdminHandler(
  async (req, res) => {
    // Validate request body
    const validation = bulkRejectBodySchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Invalid request body',
        details: validation.error.errors,
      });
      return;
    }

    const { venueIds, reason } = validation.data;

    if (venueIds.length > 100) {
      res.status(400).json({
        error: 'Too many venues',
        message: 'Maximum 100 venues per bulk operation',
      });
      return;
    }

    const results: Array<{
      venueId: string;
      status: 'success' | 'error' | 'already_rejected' | 'not_found';
      error?: string;
      venueName?: string;
    }> = [];

    // Process each venue
    for (const venueId of venueIds) {
      try {
        const venue = await discoveredVenues.getById(venueId);

        if (!venue) {
          results.push({
            venueId,
            status: 'not_found',
            error: 'Venue not found',
          });
          continue;
        }

        if (venue.status === 'rejected') {
          results.push({
            venueId,
            status: 'already_rejected',
            venueName: venue.name,
          });
          continue;
        }

        // Reject the venue
        await discoveredVenues.rejectVenue(venueId, reason);

        // Update strategy - mark as false positive
        if (venue.discovered_by_strategy_id) {
          try {
            await discoveryStrategies.recordUsage(venue.discovered_by_strategy_id, {
              success: false,
              was_false_positive: true,
            });
          } catch (e) {
            console.warn(`Failed to update strategy for venue ${venueId}:`, e);
          }
        }

        // Log the change
        try {
          await changeLogs.log({
            action: 'updated',
            collection: 'discovered_venues',
            document_id: venueId,
            changes: [
              { field: 'status', before: venue.status, after: 'rejected' },
              { field: 'rejection_reason', before: null, after: reason },
            ],
            source: { type: 'manual', user_id: req.user?.uid },
            reason: `Bulk rejection: ${reason}`,
          });
        } catch (e) {
          console.warn(`Failed to log change for venue ${venueId}:`, e);
        }

        results.push({
          venueId,
          status: 'success',
          venueName: venue.name,
        });
      } catch (error) {
        console.error(`Failed to reject venue ${venueId}:`, error);
        results.push({
          venueId,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successful = results.filter(r => r.status === 'success').length;
    const alreadyRejected = results.filter(r => r.status === 'already_rejected').length;
    const errors = results.filter(r => r.status === 'error').length;
    const notFound = results.filter(r => r.status === 'not_found').length;

    res.json({
      success: true,
      message: `Bulk rejection completed: ${successful} rejected, ${alreadyRejected} already rejected, ${errors} errors, ${notFound} not found`,
      summary: {
        total: venueIds.length,
        successful,
        alreadyRejected,
        errors,
        notFound,
      },
      results,
    });
  },
  {
    allowedMethods: ['POST'],
    timeoutSeconds: 540, // 9 minutes for bulk operations
  }
);
