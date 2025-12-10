/**
 * Admin Feedback Process API
 * POST /admin/feedback/process
 *
 * Processes feedback to update strategy success rates:
 * - Analyzes feedback for discovered venues/dishes
 * - Updates strategy success_rate based on approvals/rejections
 * - If rejection: decrease strategy success_rate
 * - If approval: increase strategy success_rate
 * - Marks feedback as processed
 *
 * Query parameters:
 * - strategyId: Process feedback for specific strategy only
 * - limit: Maximum number of feedback items to process
 * - dryRun: If true, only simulate without making changes
 */

import { z } from 'zod';
import {
  initializeFirestore,
  aiFeedback,
  discoveryStrategies,
  discoveredVenues,
  discoveredDishes,
} from '@pad/database';
import { createAdminHandler } from '../../../middleware/adminHandler.js';

// Initialize Firestore
initializeFirestore();

// Validation schema for process request
const processQuerySchema = z.object({
  strategyId: z.string().optional(),
  limit: z.string().transform(Number).optional().default('100'),
  dryRun: z.enum(['true', 'false']).transform(val => val === 'true').optional().default('false'),
});

/**
 * Handler for POST /admin/feedback/process
 */
export const adminFeedbackProcessHandler = createAdminHandler(
  async (req, res) => {
    // Validate query parameters
    const validation = processQuerySchema.safeParse(req.query);
    if (!validation.success) {
      res.status(400).json({
        error: 'Invalid query parameters',
        details: validation.error.errors,
      });
      return;
    }

    const { strategyId, limit, dryRun } = validation.data;

    // Get all feedback items
    const allFeedback = await aiFeedback.getAll();

    // Filter unprocessed feedback with venue or dish references
    let feedbackToProcess = allFeedback.filter(f =>
      (f.discovered_venue_id || f.discovered_dish_id)
    );

    // If strategyId specified, filter to that strategy
    if (strategyId) {
      // Need to fetch venues/dishes to get their strategy IDs
      const venueIds = feedbackToProcess
        .filter(f => f.discovered_venue_id)
        .map(f => f.discovered_venue_id!);

      const dishIds = feedbackToProcess
        .filter(f => f.discovered_dish_id)
        .map(f => f.discovered_dish_id!);

      const venues = await Promise.all(
        venueIds.map(id => discoveredVenues.getById(id))
      );

      const dishes = await Promise.all(
        dishIds.map(id => discoveredDishes.getById(id))
      );

      const relevantVenueIds = new Set(
        venues
          .filter(v => v && v.discovered_by_strategy_id === strategyId)
          .map(v => v!.id)
      );

      const relevantDishIds = new Set(
        dishes
          .filter(d => d && d.discovered_by_strategy_id === strategyId)
          .map(d => d!.id)
      );

      feedbackToProcess = feedbackToProcess.filter(f =>
        (f.discovered_venue_id && relevantVenueIds.has(f.discovered_venue_id)) ||
        (f.discovered_dish_id && relevantDishIds.has(f.discovered_dish_id))
      );
    }

    // Limit the number of items to process
    feedbackToProcess = feedbackToProcess.slice(0, limit);

    if (feedbackToProcess.length === 0) {
      res.json({
        success: true,
        message: 'No feedback to process',
        processed: 0,
        strategies: [],
      });
      return;
    }

    // Group feedback by strategy
    const feedbackByStrategy = new Map<string, typeof feedbackToProcess>();

    for (const feedback of feedbackToProcess) {
      let strategyIdForFeedback: string | undefined;

      if (feedback.discovered_venue_id) {
        const venue = await discoveredVenues.getById(feedback.discovered_venue_id);
        if (venue) {
          strategyIdForFeedback = venue.discovered_by_strategy_id;
        }
      } else if (feedback.discovered_dish_id) {
        const dish = await discoveredDishes.getById(feedback.discovered_dish_id);
        if (dish) {
          strategyIdForFeedback = dish.discovered_by_strategy_id;
        }
      }

      if (strategyIdForFeedback) {
        if (!feedbackByStrategy.has(strategyIdForFeedback)) {
          feedbackByStrategy.set(strategyIdForFeedback, []);
        }
        feedbackByStrategy.get(strategyIdForFeedback)!.push(feedback);
      }
    }

    // Process each strategy
    const strategyUpdates: Array<{
      strategyId: string;
      oldSuccessRate: number;
      newSuccessRate: number;
      approvals: number;
      rejections: number;
      partials: number;
    }> = [];

    for (const [strategyIdToUpdate, strategyFeedback] of feedbackByStrategy) {
      const strategy = await discoveryStrategies.getById(strategyIdToUpdate);
      if (!strategy) {
        console.warn(`Strategy ${strategyIdToUpdate} not found`);
        continue;
      }

      // Count approvals, rejections, and partials
      const approvals = strategyFeedback.filter(
        f => f.human_feedback === 'correct'
      ).length;

      const rejections = strategyFeedback.filter(
        f => f.human_feedback === 'not_planted' || f.human_feedback === 'wrong_product'
      ).length;

      const partials = strategyFeedback.filter(
        f => f.human_feedback === 'needs_review'
      ).length;

      // Calculate success adjustment
      // Each approval adds to success rate, each rejection reduces it
      // Partials have a smaller positive impact
      const totalFeedback = approvals + rejections + partials;
      if (totalFeedback === 0) continue;

      const successWeight = approvals + (partials * 0.5);
      const failureWeight = rejections;
      const feedbackSuccessRate = (successWeight / (successWeight + failureWeight)) * 100;

      // Blend with existing success rate (weighted average)
      // Give more weight to existing rate if there's more historical data
      const historicalWeight = Math.min(strategy.total_uses / 10, 0.8);
      const feedbackWeight = 1 - historicalWeight;

      const newSuccessRate = Math.round(
        (strategy.success_rate * historicalWeight) + (feedbackSuccessRate * feedbackWeight)
      );

      strategyUpdates.push({
        strategyId: strategyIdToUpdate,
        oldSuccessRate: strategy.success_rate,
        newSuccessRate,
        approvals,
        rejections,
        partials,
      });

      // Update strategy if not dry run
      if (!dryRun) {
        await discoveryStrategies.update(strategyIdToUpdate, {
          success_rate: newSuccessRate,
        });
      }
    }

    res.json({
      success: true,
      message: dryRun
        ? `Dry run completed: would update ${strategyUpdates.length} strategies`
        : `Processed ${feedbackToProcess.length} feedback items, updated ${strategyUpdates.length} strategies`,
      dryRun,
      processed: feedbackToProcess.length,
      strategies: strategyUpdates,
    });
  },
  {
    allowedMethods: ['POST'],
    timeoutSeconds: 540, // 9 minutes for processing
  }
);
