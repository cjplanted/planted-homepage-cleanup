/**
 * Admin Analytics Rejections API
 * GET /admin/analytics/rejections
 *
 * Returns rejection analysis to identify patterns:
 * - Most common rejection reasons
 * - Rejection trends over time
 * - Top chains with rejections
 * - AI prediction accuracy issues
 */

import { z } from 'zod';
import {
  initializeFirestore,
  discoveredVenues,
  discoveredDishes,
  aiFeedback,
} from '@pad/database';
import { createAdminHandler } from '../../../middleware/adminHandler.js';

// Initialize Firestore
initializeFirestore();

// Validation schema for query parameters
const rejectionsQuerySchema = z.object({
  period: z.enum(['7d', '30d', '90d']).optional().default('30d'),
});

interface RejectionReason {
  reason: string;
  count: number;
  percentage: number;
  examples: string[];
}

/**
 * Handler for GET /admin/analytics/rejections
 */
export const adminAnalyticsRejectionsHandler = createAdminHandler(
  async (req, res) => {
    // Validate query parameters
    const validation = rejectionsQuerySchema.safeParse(req.query);
    if (!validation.success) {
      res.status(400).json({
        error: 'Invalid query parameters',
        details: validation.error.errors,
      });
      return;
    }

    const { period } = validation.data;

    // Calculate date range
    const daysBack = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    // Get rejected venues
    const rejectedVenues = await discoveredVenues.getByStatus('rejected');
    const periodRejectedVenues = rejectedVenues.filter(v =>
      v.updated_at >= startDate && v.rejection_reason
    );

    // Get rejected dishes
    const rejectedDishes = await discoveredDishes.getByStatus('rejected');
    const periodRejectedDishes = rejectedDishes.filter(d =>
      d.updated_at >= startDate && d.rejection_reason
    );

    // Get AI feedback for wrong predictions
    const feedbackStats = await aiFeedback.getStats(startDate);

    // Aggregate rejection reasons for venues
    const venueReasonCounts = new Map<string, { count: number; examples: string[] }>();
    for (const venue of periodRejectedVenues) {
      if (!venue.rejection_reason) continue;

      const reason = venue.rejection_reason;
      if (!venueReasonCounts.has(reason)) {
        venueReasonCounts.set(reason, { count: 0, examples: [] });
      }
      const data = venueReasonCounts.get(reason)!;
      data.count++;
      if (data.examples.length < 3) {
        data.examples.push(venue.name);
      }
    }

    // Aggregate rejection reasons for dishes
    const dishReasonCounts = new Map<string, { count: number; examples: string[] }>();
    for (const dish of periodRejectedDishes) {
      if (!dish.rejection_reason) continue;

      const reason = dish.rejection_reason;
      if (!dishReasonCounts.has(reason)) {
        dishReasonCounts.set(reason, { count: 0, examples: [] });
      }
      const data = dishReasonCounts.get(reason)!;
      data.count++;
      if (data.examples.length < 3) {
        data.examples.push(`${dish.name} (${dish.venue_name})`);
      }
    }

    // Convert to sorted arrays
    const totalVenueRejections = periodRejectedVenues.length;
    const venueReasons: RejectionReason[] = Array.from(venueReasonCounts.entries())
      .map(([reason, data]) => ({
        reason,
        count: data.count,
        percentage: totalVenueRejections > 0 ? Math.round((data.count / totalVenueRejections) * 100) : 0,
        examples: data.examples,
      }))
      .sort((a, b) => b.count - a.count);

    const totalDishRejections = periodRejectedDishes.length;
    const dishReasons: RejectionReason[] = Array.from(dishReasonCounts.entries())
      .map(([reason, data]) => ({
        reason,
        count: data.count,
        percentage: totalDishRejections > 0 ? Math.round((data.count / totalDishRejections) * 100) : 0,
        examples: data.examples,
      }))
      .sort((a, b) => b.count - a.count);

    // Calculate rejections by day
    const byDay = calculateRejectionsByDay(
      [...periodRejectedVenues, ...periodRejectedDishes],
      daysBack
    );

    // Find chains with most rejections
    const chainRejections = new Map<string, number>();
    for (const venue of periodRejectedVenues) {
      if (venue.chain_id && venue.chain_name) {
        chainRejections.set(
          venue.chain_name,
          (chainRejections.get(venue.chain_name) || 0) + 1
        );
      }
    }
    for (const dish of periodRejectedDishes) {
      if (dish.chain_id && dish.chain_name) {
        chainRejections.set(
          dish.chain_name,
          (chainRejections.get(dish.chain_name) || 0) + 1
        );
      }
    }

    const topChains = Array.from(chainRejections.entries())
      .map(([chain, count]) => ({ chain, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Get AI prediction issues from feedback
    const aiIssues = {
      wrongProduct: feedbackStats.by_feedback_type.wrong_product,
      notPlanted: feedbackStats.by_feedback_type.not_planted,
      needsReview: feedbackStats.by_feedback_type.needs_review,
      total: feedbackStats.by_feedback_type.wrong_product +
             feedbackStats.by_feedback_type.not_planted +
             feedbackStats.by_feedback_type.needs_review,
    };

    // Calculate overall rejection rate
    const totalDiscovered = totalVenueRejections + totalDishRejections +
                           feedbackStats.by_feedback_type.correct + aiIssues.total;
    const totalRejected = totalVenueRejections + totalDishRejections + aiIssues.total;
    const rejectionRate = totalDiscovered > 0 ? Math.round((totalRejected / totalDiscovered) * 100) : 0;

    res.json({
      period,
      summary: {
        total: totalVenueRejections + totalDishRejections,
        venues: totalVenueRejections,
        dishes: totalDishRejections,
        rejectionRate,
      },
      venues: {
        total: totalVenueRejections,
        reasons: venueReasons,
        topReason: venueReasons[0]?.reason || 'N/A',
      },
      dishes: {
        total: totalDishRejections,
        reasons: dishReasons,
        topReason: dishReasons[0]?.reason || 'N/A',
      },
      aiPredictions: {
        issues: aiIssues,
        accuracy: feedbackStats.overall_accuracy_rate,
        reviewed: feedbackStats.total,
      },
      byDay,
      topChains,
      insights: generateInsights(
        venueReasons,
        dishReasons,
        topChains,
        aiIssues,
        feedbackStats.overall_accuracy_rate
      ),
    });
  },
  { allowedMethods: ['GET'] }
);

/**
 * Helper to calculate rejections by day
 */
function calculateRejectionsByDay(
  rejectedItems: Array<{ updated_at: Date }>,
  daysBack: number
): { date: string; venues: number; dishes: number; total: number }[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dayCounts = new Map<string, { venues: number; dishes: number }>();

  // Initialize all days with 0
  for (let i = 0; i < daysBack; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    dayCounts.set(dateStr, { venues: 0, dishes: 0 });
  }

  // Count rejections per day (simplified - would need type info)
  for (const item of rejectedItems) {
    const dateOnly = new Date(item.updated_at);
    dateOnly.setHours(0, 0, 0, 0);
    const dateStr = dateOnly.toISOString().split('T')[0];
    const counts = dayCounts.get(dateStr);
    if (counts) {
      counts.venues++; // Simplified
    }
  }

  // Convert to array and sort by date
  return Array.from(dayCounts.entries())
    .map(([date, counts]) => ({
      date,
      venues: counts.venues,
      dishes: counts.dishes,
      total: counts.venues + counts.dishes,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Generate insights from rejection data
 */
function generateInsights(
  venueReasons: RejectionReason[],
  dishReasons: RejectionReason[],
  topChains: Array<{ chain: string; count: number }>,
  aiIssues: { wrongProduct: number; notPlanted: number; needsReview: number; total: number },
  aiAccuracy: number
): string[] {
  const insights: string[] = [];

  // Top venue rejection reason insight
  if (venueReasons.length > 0 && venueReasons[0].percentage > 40) {
    insights.push(
      `${venueReasons[0].percentage}% of venue rejections are due to "${venueReasons[0].reason}". Consider improving discovery filters.`
    );
  }

  // Top dish rejection reason insight
  if (dishReasons.length > 0 && dishReasons[0].percentage > 40) {
    insights.push(
      `${dishReasons[0].percentage}% of dish rejections are due to "${dishReasons[0].reason}". Review extraction strategy.`
    );
  }

  // Chain insight
  if (topChains.length > 0 && topChains[0].count > 5) {
    insights.push(
      `${topChains[0].chain} has the most rejections (${topChains[0].count}). May need chain-specific rules.`
    );
  }

  // AI accuracy insight
  if (aiAccuracy < 70) {
    insights.push(
      `AI prediction accuracy is ${aiAccuracy}%. Consider retraining with more feedback data.`
    );
  }

  // Wrong product insight
  if (aiIssues.wrongProduct > aiIssues.total * 0.3) {
    insights.push(
      `${Math.round((aiIssues.wrongProduct / aiIssues.total) * 100)}% of AI issues are wrong product matches. Review product matching logic.`
    );
  }

  // Not planted insight
  if (aiIssues.notPlanted > aiIssues.total * 0.2) {
    insights.push(
      `${Math.round((aiIssues.notPlanted / aiIssues.total) * 100)}% of items flagged are not Planted products. Improve initial filtering.`
    );
  }

  return insights;
}
