/**
 * BudgetStatus Component
 *
 * Displays budget usage, cost breakdown, and throttle warnings.
 */

import { DollarSign, TrendingUp, AlertTriangle, Search, Cpu } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/ui/Card';
import { Badge } from '@/shared/ui/Badge';
import { cn } from '@/lib/utils';
import type { BudgetStatus as BudgetStatusType } from '../types';

interface BudgetStatusProps {
  budget: BudgetStatusType;
  className?: string;
}

/**
 * Format cost
 */
function formatCost(cost: number): string {
  return `$${cost.toFixed(2)}`;
}

/**
 * Get usage bar color
 */
function getUsageColor(percentage: number): string {
  if (percentage >= 90) return 'bg-destructive';
  if (percentage >= 80) return 'bg-yellow-500';
  return 'bg-primary';
}

/**
 * Budget Status Component
 */
export function BudgetStatus({ budget, className }: BudgetStatusProps) {
  const dailyPercentage = budget.daily.percentage;
  const monthlyPercentage = budget.monthly.percentage;
  const isThrottled = budget.throttled;
  const showWarning = dailyPercentage >= 80 || monthlyPercentage >= 80;

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Budget Status
          </CardTitle>
          {isThrottled && (
            <Badge variant="warning">Throttled</Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Throttle Warning */}
        {isThrottled && (
          <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-yellow-500">
                API Throttled
              </p>
              <p className="text-xs text-muted-foreground">
                {budget.throttleReason || 'Rate limit reached'}
              </p>
            </div>
          </div>
        )}

        {/* Daily Usage */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold">Daily Usage</span>
            <span className="text-muted-foreground">
              {formatCost(budget.daily.used)} / {formatCost(budget.daily.limit)}
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className={cn(
                'h-full transition-all duration-500',
                getUsageColor(dailyPercentage)
              )}
              style={{ width: `${Math.min(dailyPercentage, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{dailyPercentage.toFixed(1)}% used</span>
            {dailyPercentage >= 80 && (
              <Badge variant="warning" className="text-xs">
                {dailyPercentage >= 90 ? 'Critical' : 'Warning'}
              </Badge>
            )}
          </div>
        </div>

        {/* Monthly Usage */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold">Monthly Usage</span>
            <span className="text-muted-foreground">
              {formatCost(budget.monthly.used)} / {formatCost(budget.monthly.limit)}
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className={cn(
                'h-full transition-all duration-500',
                getUsageColor(monthlyPercentage)
              )}
              style={{ width: `${Math.min(monthlyPercentage, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{monthlyPercentage.toFixed(1)}% used</span>
            {monthlyPercentage >= 80 && (
              <Badge variant="warning" className="text-xs">
                {monthlyPercentage >= 90 ? 'Critical' : 'Warning'}
              </Badge>
            )}
          </div>
        </div>

        {/* Cost Breakdown */}
        <div className="space-y-3 pt-4 border-t">
          <p className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Cost Breakdown
          </p>

          {/* Search Costs */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Search Queries</span>
            </div>
            <div className="pl-5 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Free</span>
                <span className="font-medium">
                  {budget.breakdown.search.free.used} / {budget.breakdown.search.free.limit}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Paid</span>
                <span className="font-medium">
                  {formatCost(budget.breakdown.search.paid.cost)} ({budget.breakdown.search.paid.count} queries)
                </span>
              </div>
            </div>
          </div>

          {/* AI Costs */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">AI Calls</span>
            </div>
            <div className="pl-5 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Total Cost</span>
                <span className="font-medium">
                  {formatCost(budget.breakdown.ai.cost)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">API Calls</span>
                <span className="font-medium">
                  {budget.breakdown.ai.calls.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Total */}
          <div className="pt-3 border-t flex items-center justify-between">
            <span className="font-semibold">Total Today</span>
            <span className="text-lg font-bold">
              {formatCost(budget.daily.used)}
            </span>
          </div>
        </div>

        {/* Warning Message */}
        {showWarning && !isThrottled && (
          <div className="p-3 bg-yellow-500/10 border border-yellow-500 rounded-lg">
            <p className="text-xs text-yellow-600 dark:text-yellow-400">
              Warning: Approaching budget limit. Consider pausing operations.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
