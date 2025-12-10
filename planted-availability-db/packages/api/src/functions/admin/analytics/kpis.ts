/**
 * Admin Analytics KPIs API
 * GET /admin/analytics/kpis
 *
 * Returns key performance indicators for the discovery system:
 * - Discovery rate and trends
 * - Approval/rejection rates
 * - AI accuracy metrics
 * - Venue and dish statistics
 */

import { z } from 'zod';
import {
  initializeFirestore,
  discoveredVenues,
  discoveredDishes,
  aiFeedback,
  venues,
} from '@pad/database';
import { createAdminHandler } from '../../../middleware/adminHandler.js';

// Initialize Firestore
initializeFirestore();

// Validation schema for query parameters
const kpisQuerySchema = z.object({
  period: z.enum(['7d', '30d', '90d']).optional().default('30d'),
});

/**
 * Handler for GET /admin/analytics/kpis
 */
export const adminAnalyticsKpisHandler = createAdminHandler(
  async (req, res) => {
    // Validate query parameters
    const validation = kpisQuerySchema.safeParse(req.query);
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

    // Get all discovered venues and filter by date
    const allVenues = await discoveredVenues.getAll();
    const periodVenues = allVenues.filter(v => v.created_at >= startDate);

    // Get all discovered dishes and filter by date
    const allDishes = await discoveredDishes.getAll();
    const periodDishes = allDishes.filter(d => d.created_at >= startDate);

    // Calculate discovery metrics
    const discoveryTotal = periodVenues.length + periodDishes.length;
    const discoveryByDay = calculateByDay(
      [...periodVenues.map(v => v.created_at), ...periodDishes.map(d => d.created_at)],
      daysBack
    );

    // Calculate discovery rate (items per day)
    const discoveryRate = daysBack > 0 ? Math.round((discoveryTotal / daysBack) * 10) / 10 : 0;

    // Calculate approval metrics
    const approvedVenues = periodVenues.filter(v => v.status === 'verified' || v.status === 'promoted').length;
    const rejectedVenues = periodVenues.filter(v => v.status === 'rejected').length;
    const totalReviewedVenues = approvedVenues + rejectedVenues;

    const approvedDishes = periodDishes.filter(d => d.status === 'verified' || d.status === 'promoted').length;
    const rejectedDishes = periodDishes.filter(d => d.status === 'rejected').length;
    const totalReviewedDishes = approvedDishes + rejectedDishes;

    const totalReviewed = totalReviewedVenues + totalReviewedDishes;
    const totalApproved = approvedVenues + approvedDishes;
    const totalRejected = rejectedVenues + rejectedDishes;

    const approvalRate = totalReviewed > 0 ? Math.round((totalApproved / totalReviewed) * 100) : 0;

    // Get AI feedback stats
    const feedbackStats = await aiFeedback.getStats(startDate);
    const aiAccuracyOverall = feedbackStats.overall_accuracy_rate;

    // Calculate venue and dish accuracy from feedback
    const venueAccuracy = approvalRate; // Simplified - venues approved / total reviewed
    const dishAccuracy = aiAccuracyOverall; // AI feedback accuracy for dishes

    // Get current venue statistics
    const productionVenues = await venues.query({ status: 'active', limit: 10000 });
    const pendingVenues = allVenues.filter(v => v.status === 'discovered').length;
    const verifiedVenues = allVenues.filter(v => v.status === 'verified').length;
    const promotedVenues = allVenues.filter(v => v.status === 'promoted').length;

    // Calculate trend (compare first half vs second half of period)
    const midPoint = new Date(startDate.getTime() + (Date.now() - startDate.getTime()) / 2);
    const firstHalf = periodVenues.filter(v => v.created_at < midPoint).length +
                      periodDishes.filter(d => d.created_at < midPoint).length;
    const secondHalf = periodVenues.filter(v => v.created_at >= midPoint).length +
                       periodDishes.filter(d => d.created_at >= midPoint).length;
    const trendChange = firstHalf > 0 ? Math.round(((secondHalf - firstHalf) / firstHalf) * 100) : 0;

    res.json({
      discovery: {
        total: discoveryTotal,
        venues: periodVenues.length,
        dishes: periodDishes.length,
        byDay: discoveryByDay,
        rate: discoveryRate,
        rateUnit: 'items/day',
      },
      approval: {
        approved: totalApproved,
        rejected: totalRejected,
        pending: discoveryTotal - totalReviewed,
        rate: approvalRate,
        byType: {
          venues: {
            approved: approvedVenues,
            rejected: rejectedVenues,
            rate: totalReviewedVenues > 0 ? Math.round((approvedVenues / totalReviewedVenues) * 100) : 0,
          },
          dishes: {
            approved: approvedDishes,
            rejected: rejectedDishes,
            rate: totalReviewedDishes > 0 ? Math.round((approvedDishes / totalReviewedDishes) * 100) : 0,
          },
        },
      },
      accuracy: {
        overall: Math.round((venueAccuracy + dishAccuracy) / 2),
        venue: venueAccuracy,
        dish: dishAccuracy,
        aiPredictions: {
          total: feedbackStats.total,
          correct: feedbackStats.by_feedback_type.correct,
          rate: aiAccuracyOverall,
        },
      },
      venues: {
        total: allVenues.length,
        live: productionVenues.length,
        pending: pendingVenues,
        verified: verifiedVenues,
        promoted: promotedVenues,
        rejected: allVenues.filter(v => v.status === 'rejected').length,
      },
      dishes: {
        total: allDishes.length,
        verified: allDishes.filter(d => d.status === 'verified').length,
        promoted: allDishes.filter(d => d.status === 'promoted').length,
        rejected: allDishes.filter(d => d.status === 'rejected').length,
      },
      trend: {
        period,
        change: trendChange,
        direction: trendChange > 0 ? 'up' : trendChange < 0 ? 'down' : 'stable',
        firstHalf,
        secondHalf,
      },
    });
  },
  { allowedMethods: ['GET'] }
);

/**
 * Helper to calculate daily counts
 */
function calculateByDay(dates: Date[], daysBack: number): { date: string; count: number }[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dayCounts = new Map<string, number>();

  // Initialize all days with 0
  for (let i = 0; i < daysBack; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    dayCounts.set(dateStr, 0);
  }

  // Count items per day
  for (const date of dates) {
    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);
    const dateStr = dateOnly.toISOString().split('T')[0];
    dayCounts.set(dateStr, (dayCounts.get(dateStr) || 0) + 1);
  }

  // Convert to array and sort by date
  return Array.from(dayCounts.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
