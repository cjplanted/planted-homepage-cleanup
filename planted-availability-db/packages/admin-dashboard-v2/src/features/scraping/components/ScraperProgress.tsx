/**
 * ScraperProgress Component
 *
 * Real-time progress display with stats, logs, and cancel button.
 */

import { XCircle, DollarSign, Clock, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { cn } from '@/lib/utils';
import type { ScraperProgress as ScraperProgressType } from '../types';

interface ScraperProgressProps {
  progress: ScraperProgressType;
  onCancel?: (runId: string) => void;
  isCancelling?: boolean;
  className?: string;
}

/**
 * Format seconds to readable time
 */
function formatETA(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds > 0
    ? `${minutes}m ${remainingSeconds}s`
    : `${minutes}m`;
}

/**
 * Format cost
 */
function formatCost(cost: number): string {
  return `$${cost.toFixed(2)}`;
}

/**
 * Get status badge variant
 */
function getStatusBadgeVariant(status: ScraperProgressType['status']) {
  switch (status) {
    case 'running':
      return 'default';
    case 'completed':
      return 'success';
    case 'failed':
      return 'destructive';
    case 'cancelled':
      return 'secondary';
    default:
      return 'outline';
  }
}

/**
 * Get log level badge variant
 */
function getLogLevelVariant(level: 'info' | 'warn' | 'error') {
  switch (level) {
    case 'error':
      return 'destructive';
    case 'warn':
      return 'warning';
    default:
      return 'secondary';
  }
}

/**
 * Format timestamp to time
 */
function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Scraper Progress Component
 */
export function ScraperProgress({
  progress,
  onCancel,
  isCancelling = false,
  className,
}: ScraperProgressProps) {
  const { percentage } = progress.progress;
  const canCancel = progress.status === 'running' && onCancel;
  const recentLogs = progress.logs.slice(-5).reverse();

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg">{progress.runId}</CardTitle>
            <Badge variant={getStatusBadgeVariant(progress.status)}>
              {progress.status}
            </Badge>
          </div>
          {canCancel && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onCancel(progress.runId)}
              disabled={isCancelling}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-semibold">{percentage}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className={cn(
                'h-full transition-all duration-500 rounded-full',
                progress.status === 'running' && 'bg-primary',
                progress.status === 'completed' && 'bg-green-500',
                progress.status === 'failed' && 'bg-destructive',
                progress.status === 'cancelled' && 'bg-muted-foreground'
              )}
              style={{ width: `${percentage}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {progress.progress.current} / {progress.progress.total}
            </span>
            {progress.eta && progress.status === 'running' && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                ETA: {formatETA(progress.eta)}
              </span>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Found</p>
            <p className="text-2xl font-bold">{progress.stats.found}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Processed</p>
            <p className="text-2xl font-bold">{progress.stats.processed}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Errors</p>
            <p className="text-2xl font-bold text-destructive">
              {progress.stats.errors}
            </p>
          </div>
        </div>

        {/* Cost Estimate */}
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Cost Estimate</span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted-foreground">
              Search: {formatCost(progress.cost.search)}
            </span>
            <span className="text-muted-foreground">
              AI: {formatCost(progress.cost.ai)}
            </span>
            <span className="font-bold">
              Total: {formatCost(progress.cost.total)}
            </span>
          </div>
        </div>

        {/* Error Message */}
        {progress.error && (
          <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive rounded-lg">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-destructive">Error</p>
              <p className="text-sm text-muted-foreground">{progress.error}</p>
            </div>
          </div>
        )}

        {/* Recent Logs */}
        {recentLogs.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold">Recent Logs</p>
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {recentLogs.map((log, index) => (
                <div
                  key={`${log.timestamp}-${index}`}
                  className="flex items-start gap-2 text-xs p-2 bg-muted/50 rounded"
                >
                  <Badge
                    variant={getLogLevelVariant(log.level)}
                    className="text-xs shrink-0"
                  >
                    {log.level}
                  </Badge>
                  <span className="text-muted-foreground shrink-0">
                    {formatTime(log.timestamp)}
                  </span>
                  <span className="text-foreground break-all">
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
