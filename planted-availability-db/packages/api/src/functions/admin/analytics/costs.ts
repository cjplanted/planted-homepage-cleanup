/**
 * Admin Analytics Costs API
 * GET /admin/analytics/costs
 *
 * Returns cost analysis and budget tracking:
 * - Total costs breakdown by category
 * - Daily cost trends
 * - Budget utilization
 * - Projected monthly costs
 */

import { z } from 'zod';
import {
  initializeFirestore,
  budgetTracking,
} from '@pad/database';
import { createAdminHandler } from '../../../middleware/adminHandler.js';

// Initialize Firestore
initializeFirestore();

// Validation schema for query parameters
const costsQuerySchema = z.object({
  period: z.enum(['7d', '30d', '90d']).optional().default('30d'),
});

// Monthly budget limit (in USD)
const MONTHLY_BUDGET = 500;

/**
 * Handler for GET /admin/analytics/costs
 */
export const adminAnalyticsCostsHandler = createAdminHandler(
  async (req, res) => {
    // Validate query parameters
    const validation = costsQuerySchema.safeParse(req.query);
    if (!validation.success) {
      res.status(400).json({
        error: 'Invalid query parameters',
        details: validation.error.errors,
      });
      return;
    }

    const { period } = validation.data;

    // Calculate days back
    const daysBack = period === '7d' ? 7 : period === '30d' ? 30 : 90;

    // Get budget history
    const history = await budgetTracking.getBudgetHistory(daysBack);

    // Calculate totals and breakdown
    let totalSearchCost = 0;
    let totalAiCost = 0;
    let totalScrapingCost = 0;
    let totalSearchQueries = 0;
    let totalAiCalls = 0;

    const byDay: { date: string; search: number; ai: number; scraping: number; total: number }[] = [];

    for (const record of history) {
      // Calculate costs from actual data
      const searchCost = record.costs.search || 0;
      const aiCost = record.costs.ai || 0;
      const scrapingCost = 0; // Would need to track this separately

      totalSearchCost += searchCost;
      totalAiCost += aiCost;
      totalScrapingCost += scrapingCost;

      totalSearchQueries += record.searchQueries.free + record.searchQueries.paid;
      totalAiCalls += record.aiCalls.gemini + record.aiCalls.claude;

      byDay.push({
        date: record.date,
        search: searchCost,
        ai: aiCost,
        scraping: scrapingCost,
        total: searchCost + aiCost + scrapingCost,
      });
    }

    // Sort by date ascending
    byDay.sort((a, b) => a.date.localeCompare(b.date));

    const totalCost = totalSearchCost + totalAiCost + totalScrapingCost;

    // Calculate current month's costs
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const monthlyTotals = await budgetTracking.getMonthlyTotals(currentYear, currentMonth);

    const monthlyCost = monthlyTotals.costs.total;
    const budgetUsedPercentage = Math.round((monthlyCost / MONTHLY_BUDGET) * 100);

    // Project monthly cost based on current rate
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const currentDay = now.getDate();
    const dailyAverage = currentDay > 0 ? monthlyCost / currentDay : 0;
    const projectedMonthlyCost = Math.round(dailyAverage * daysInMonth * 100) / 100;

    // Calculate costs per operation
    const costPerSearch = totalSearchQueries > 0 ? totalSearchCost / totalSearchQueries : 0;
    const costPerAiCall = totalAiCalls > 0 ? totalAiCost / totalAiCalls : 0;

    res.json({
      period,
      total: Math.round(totalCost * 100) / 100,
      breakdown: {
        search: {
          cost: Math.round(totalSearchCost * 100) / 100,
          percentage: totalCost > 0 ? Math.round((totalSearchCost / totalCost) * 100) : 0,
          queries: totalSearchQueries,
          costPerQuery: Math.round(costPerSearch * 10000) / 10000,
        },
        ai: {
          cost: Math.round(totalAiCost * 100) / 100,
          percentage: totalCost > 0 ? Math.round((totalAiCost / totalCost) * 100) : 0,
          calls: totalAiCalls,
          costPerCall: Math.round(costPerAiCall * 10000) / 10000,
          byProvider: {
            gemini: monthlyTotals.aiCalls.gemini,
            claude: monthlyTotals.aiCalls.claude,
          },
        },
        scraping: {
          cost: Math.round(totalScrapingCost * 100) / 100,
          percentage: totalCost > 0 ? Math.round((totalScrapingCost / totalCost) * 100) : 0,
        },
      },
      byDay,
      budget: {
        limit: MONTHLY_BUDGET,
        used: Math.round(monthlyCost * 100) / 100,
        remaining: Math.round((MONTHLY_BUDGET - monthlyCost) * 100) / 100,
        percentage: budgetUsedPercentage,
        isOverBudget: monthlyCost > MONTHLY_BUDGET,
      },
      projected: {
        monthlyCost: projectedMonthlyCost,
        willExceedBudget: projectedMonthlyCost > MONTHLY_BUDGET,
        dailyAverage: Math.round(dailyAverage * 100) / 100,
        daysRemaining: daysInMonth - currentDay,
      },
      currentMonth: {
        month: currentMonth,
        year: currentYear,
        daysElapsed: currentDay,
        daysTotal: daysInMonth,
        searchQueries: monthlyTotals.searchQueries,
        aiCalls: monthlyTotals.aiCalls,
        throttleEvents: monthlyTotals.throttleEventsCount,
      },
    });
  },
  { allowedMethods: ['GET'] }
);
