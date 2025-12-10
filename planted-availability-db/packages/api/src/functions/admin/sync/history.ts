/**
 * Admin Sync History API
 * GET /admin/sync/history
 *
 * Returns paginated sync history records with details about each sync operation
 */

import { z } from 'zod';
import {
  initializeFirestore,
  syncHistory,
} from '@pad/database';
import { createAdminHandler } from '../../../middleware/adminHandler.js';

// Initialize Firestore
initializeFirestore();

// Validation schema for query parameters
const historyQuerySchema = z.object({
  limit: z.string().transform(Number).optional().default('50'),
  cursor: z.string().optional(),
});

/**
 * Handler for GET /admin/sync/history
 */
export const adminSyncHistoryHandler = createAdminHandler(
  async (req, res) => {
    // Validate query parameters
    const validation = historyQuerySchema.safeParse(req.query);
    if (!validation.success) {
      res.status(400).json({
        error: 'Invalid query parameters',
        details: validation.error.errors,
      });
      return;
    }

    const { limit, cursor } = validation.data;

    // Get sync history with pagination
    const result = await syncHistory.getHistory(limit, cursor);

    // Get aggregate stats for the last 30 days
    const aggregateStats = await syncHistory.getAggregateStats(30);

    // Get last sync info
    const lastSync = await syncHistory.getLastSync();

    res.json({
      history: result.history.map(record => ({
        id: record.id,
        executedAt: record.executedAt.toISOString(),
        executedBy: record.executedBy,
        stats: record.stats,
        itemsSynced: {
          venues: record.itemsSynced.venues.length,
          dishes: record.itemsSynced.dishes.length,
        },
        hasErrors: (record.errors?.length || 0) > 0,
        errorCount: record.errors?.length || 0,
      })),
      pagination: {
        cursor: result.nextCursor,
        hasMore: result.hasMore,
        limit,
      },
      summary: {
        lastSync: lastSync ? {
          executedAt: lastSync.executedAt.toISOString(),
          executedBy: lastSync.executedBy,
          venuesSynced: lastSync.stats.venuesAdded + lastSync.stats.venuesUpdated,
          dishesSynced: lastSync.stats.dishesAdded + lastSync.stats.dishesUpdated,
          errors: lastSync.stats.errors,
        } : null,
        last30Days: aggregateStats,
      },
    });
  },
  { allowedMethods: ['GET'] }
);
