/**
 * GET /admin/budget/status
 * Get current budget status
 * Requires admin authentication
 */

import { initializeFirestore, budgetTracking } from '@pad/database';
import { createAdminHandler } from '../../../middleware/adminHandler.js';
import { BUDGET_CONFIG } from '../../../services/budgetThrottle.js';

// Initialize Firestore
initializeFirestore();

/**
 * Handler for GET /admin/budget/status
 */
export const adminBudgetStatusHandler = createAdminHandler(
  async (req, res) => {
    // Get today's budget
    const today = await budgetTracking.getTodayBudget();

    // Get monthly totals
    const now = new Date();
    const monthlyTotals = await budgetTracking.getMonthlyTotals(
      now.getFullYear(),
      now.getMonth() + 1
    );

    // Calculate if throttled
    const dailyLimit = BUDGET_CONFIG.dailyBudget;
    const monthlyLimit = BUDGET_CONFIG.monthlyBudget;
    const throttleAt = dailyLimit * BUDGET_CONFIG.throttleThreshold;

    const isThrottled = today.costs.total >= throttleAt || monthlyTotals.costs.total >= monthlyLimit;

    let throttleReason: string | undefined;
    if (today.costs.total >= throttleAt) {
      const percentageUsed = (today.costs.total / dailyLimit) * 100;
      throttleReason = `Daily budget at ${percentageUsed.toFixed(1)}% (${today.costs.total.toFixed(2)}/${dailyLimit} USD)`;
    } else if (monthlyTotals.costs.total >= monthlyLimit) {
      throttleReason = `Monthly budget exceeded: ${monthlyTotals.costs.total.toFixed(2)}/${monthlyLimit} USD`;
    }

    // Calculate percentages
    const dailyPercentage = (today.costs.total / dailyLimit) * 100;
    const monthlyPercentage = (monthlyTotals.costs.total / monthlyLimit) * 100;

    res.set('Cache-Control', 'private, max-age=30'); // 30 second cache

    res.status(200).json({
      today: {
        date: today.date,
        searchQueries: {
          used: today.searchQueries.free + today.searchQueries.paid,
          free: today.searchQueries.free,
          paid: today.searchQueries.paid,
          cost: today.costs.search,
        },
        aiCalls: {
          count: today.aiCalls.gemini + today.aiCalls.claude,
          gemini: today.aiCalls.gemini,
          claude: today.aiCalls.claude,
          cost: today.costs.ai,
        },
        total: today.costs.total,
        percentage: dailyPercentage,
      },
      month: {
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        searchQueries: {
          used: monthlyTotals.searchQueries.free + monthlyTotals.searchQueries.paid,
          free: monthlyTotals.searchQueries.free,
          paid: monthlyTotals.searchQueries.paid,
        },
        aiCalls: {
          count: monthlyTotals.aiCalls.gemini + monthlyTotals.aiCalls.claude,
          gemini: monthlyTotals.aiCalls.gemini,
          claude: monthlyTotals.aiCalls.claude,
        },
        total: monthlyTotals.costs.total,
        percentage: monthlyPercentage,
      },
      limits: {
        dailyBudget: dailyLimit,
        monthlyBudget: monthlyLimit,
        throttleAt,
        throttleThreshold: BUDGET_CONFIG.throttleThreshold,
      },
      isThrottled,
      throttleReason,
      throttleEvents: {
        today: today.throttleEvents.length,
        month: monthlyTotals.throttleEventsCount,
        recent: today.throttleEvents.slice(-5).map(e => ({
          timestamp: e.timestamp,
          reason: e.reason,
        })),
      },
    });
  },
  { allowedMethods: ['GET'] }
);
