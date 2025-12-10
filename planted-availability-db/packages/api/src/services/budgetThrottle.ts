import { budgetTracking } from '@pad/database';

/**
 * Budget limits configuration
 * These can be overridden via environment variables
 */
export const BUDGET_CONFIG = {
  // Daily budget limit in USD
  dailyBudget: parseFloat(process.env.DAILY_BUDGET_LIMIT || '50'),

  // Monthly budget limit in USD
  monthlyBudget: parseFloat(process.env.MONTHLY_BUDGET_LIMIT || '1000'),

  // Throttle threshold as percentage of daily budget (default: 80%)
  throttleThreshold: parseFloat(process.env.BUDGET_THROTTLE_THRESHOLD || '0.8'),

  // Cost estimates for API calls (in USD)
  costs: {
    searchQueryFree: 0, // Free tier
    searchQueryPaid: 0.005, // $5 per 1000 queries
    aiCallGemini: 0.0001, // Approximate cost per call
    aiCallClaude: 0.0003, // Approximate cost per call
  },
};

export interface ThrottleCheckResult {
  throttle: boolean;
  reason?: string;
  currentCost: number;
  dailyLimit: number;
  monthlyLimit: number;
  percentageUsed: number;
  remainingBudget: number;
}

/**
 * Check if we should throttle based on current budget usage
 */
export async function shouldThrottle(): Promise<ThrottleCheckResult> {
  const today = await budgetTracking.getTodayBudget();

  const dailyLimit = BUDGET_CONFIG.dailyBudget;
  const throttleAt = dailyLimit * BUDGET_CONFIG.throttleThreshold;
  const currentCost = today.costs.total;
  const percentageUsed = (currentCost / dailyLimit) * 100;
  const remainingBudget = dailyLimit - currentCost;

  // Check if we've exceeded the throttle threshold
  if (currentCost >= throttleAt) {
    const reason = `Daily budget at ${percentageUsed.toFixed(1)}% (${currentCost.toFixed(2)}/${dailyLimit} USD). Throttle threshold: ${(BUDGET_CONFIG.throttleThreshold * 100).toFixed(0)}%`;

    // Log throttle event
    await budgetTracking.addThrottleEvent(reason);

    return {
      throttle: true,
      reason,
      currentCost,
      dailyLimit,
      monthlyLimit: BUDGET_CONFIG.monthlyBudget,
      percentageUsed,
      remainingBudget,
    };
  }

  // Check monthly budget
  const now = new Date();
  const monthlyTotals = await budgetTracking.getMonthlyTotals(
    now.getFullYear(),
    now.getMonth() + 1
  );

  if (monthlyTotals.costs.total >= BUDGET_CONFIG.monthlyBudget) {
    const reason = `Monthly budget exceeded: ${monthlyTotals.costs.total.toFixed(2)}/${BUDGET_CONFIG.monthlyBudget} USD`;

    await budgetTracking.addThrottleEvent(reason);

    return {
      throttle: true,
      reason,
      currentCost,
      dailyLimit,
      monthlyLimit: BUDGET_CONFIG.monthlyBudget,
      percentageUsed,
      remainingBudget,
    };
  }

  return {
    throttle: false,
    currentCost,
    dailyLimit,
    monthlyLimit: BUDGET_CONFIG.monthlyBudget,
    percentageUsed,
    remainingBudget,
  };
}

/**
 * Estimate cost for a scraper run
 */
export function estimateScraperCost(
  estimatedSearchQueries: number,
  estimatedAICalls: number,
  useFreeTier: boolean = true
): number {
  const searchCost = useFreeTier
    ? 0
    : estimatedSearchQueries * BUDGET_CONFIG.costs.searchQueryPaid;

  // Assume 50/50 split between Gemini and Claude for estimation
  const aiCost = (estimatedAICalls / 2) * BUDGET_CONFIG.costs.aiCallGemini +
                 (estimatedAICalls / 2) * BUDGET_CONFIG.costs.aiCallClaude;

  return searchCost + aiCost;
}

/**
 * Check if a scraper run would exceed budget
 */
export async function canAffordScraperRun(
  estimatedSearchQueries: number,
  estimatedAICalls: number,
  useFreeTier: boolean = true
): Promise<{
  canAfford: boolean;
  estimatedCost: number;
  reason?: string;
}> {
  const estimatedCost = estimateScraperCost(
    estimatedSearchQueries,
    estimatedAICalls,
    useFreeTier
  );

  const throttleCheck = await shouldThrottle();

  if (throttleCheck.throttle) {
    return {
      canAfford: false,
      estimatedCost,
      reason: throttleCheck.reason,
    };
  }

  // Check if estimated cost would exceed remaining budget
  if (estimatedCost > throttleCheck.remainingBudget) {
    return {
      canAfford: false,
      estimatedCost,
      reason: `Estimated cost ($${estimatedCost.toFixed(2)}) exceeds remaining daily budget ($${throttleCheck.remainingBudget.toFixed(2)})`,
    };
  }

  return {
    canAfford: true,
    estimatedCost,
  };
}

/**
 * Record actual costs from a scraper run
 */
export async function recordScraperCosts(
  searchQueriesFree: number,
  searchQueriesPaid: number,
  aiCallsGemini: number,
  aiCallsClaude: number
): Promise<void> {
  // Update counters
  if (searchQueriesFree > 0) {
    await budgetTracking.incrementSearchQueries('free', searchQueriesFree);
  }
  if (searchQueriesPaid > 0) {
    await budgetTracking.incrementSearchQueries('paid', searchQueriesPaid);
  }
  if (aiCallsGemini > 0) {
    await budgetTracking.incrementAICalls('gemini', aiCallsGemini);
  }
  if (aiCallsClaude > 0) {
    await budgetTracking.incrementAICalls('claude', aiCallsClaude);
  }

  // Calculate and update costs
  const searchCost = searchQueriesPaid * BUDGET_CONFIG.costs.searchQueryPaid;
  const aiCost = (aiCallsGemini * BUDGET_CONFIG.costs.aiCallGemini) +
                 (aiCallsClaude * BUDGET_CONFIG.costs.aiCallClaude);

  if (searchCost > 0 || aiCost > 0) {
    await budgetTracking.updateCosts(searchCost, aiCost);
  }
}
