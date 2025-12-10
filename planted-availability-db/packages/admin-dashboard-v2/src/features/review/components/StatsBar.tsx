/**
 * StatsBar Component
 *
 * Displays statistics about the review queue including counts by status.
 */

import { CheckCircle, Clock, XCircle, TrendingUp } from 'lucide-react';
import { Badge } from '@/shared/ui/Badge';
import { cn } from '@/lib/utils';
import { ReviewStats } from '../types';

interface StatsBarProps {
  stats: ReviewStats;
  className?: string;
}

/**
 * StatItem Component
 */
function StatItem({
  icon: Icon,
  label,
  value,
  variant,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  variant: 'default' | 'success' | 'warning' | 'destructive';
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-accent/50">
      <div className={cn('p-2 rounded-full', {
        'bg-yellow-500/10 text-yellow-600': variant === 'warning',
        'bg-green-500/10 text-green-600': variant === 'success',
        'bg-red-500/10 text-red-600': variant === 'destructive',
        'bg-blue-500/10 text-blue-600': variant === 'default',
      })}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground uppercase">{label}</div>
      </div>
    </div>
  );
}

/**
 * StatsBar Component
 */
export function StatsBar({ stats, className }: StatsBarProps) {
  const averageConfidencePercentage = Math.round(stats.averageConfidence * 100);

  return (
    <div className={cn('space-y-3', className)}>
      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <StatItem
          icon={Clock}
          label="Pending"
          value={stats.pending}
          variant="warning"
        />
        <StatItem
          icon={CheckCircle}
          label="Verified"
          value={stats.verified}
          variant="success"
        />
        <StatItem
          icon={XCircle}
          label="Rejected"
          value={stats.rejected}
          variant="destructive"
        />
        <StatItem
          icon={TrendingUp}
          label="Total"
          value={stats.total}
          variant="default"
        />
      </div>

      {/* Average Confidence */}
      {stats.averageConfidence > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent/50">
          <span className="text-sm text-muted-foreground">Average Confidence:</span>
          <Badge
            variant={
              averageConfidencePercentage >= 80
                ? 'success'
                : averageConfidencePercentage >= 60
                ? 'warning'
                : 'destructive'
            }
          >
            {averageConfidencePercentage}%
          </Badge>
        </div>
      )}
    </div>
  );
}
