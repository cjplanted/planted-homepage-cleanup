/**
 * SyncHistory Component
 *
 * Shows list of past sync operations.
 */

import { useState } from 'react';
import { ChevronDown, ChevronRight, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { Card } from '@/shared/ui/Card';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { cn } from '@/lib/utils';
import {
  SyncHistoryEntry,
  SYNC_STATUS_LABELS,
  SYNC_STATUS_EMOJIS,
} from '../types';

interface SyncHistoryProps {
  entries: SyncHistoryEntry[];
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoading?: boolean;
  className?: string;
}

/**
 * SyncHistory Component
 */
export function SyncHistory({
  entries,
  onLoadMore,
  hasMore = false,
  isLoading = false,
  className,
}: SyncHistoryProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (entries.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No sync history available
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {entries.map((entry) => {
        const isExpanded = expandedIds.has(entry.id);
        const hasErrors = entry.errors && entry.errors.length > 0;
        const successRate = entry.itemsProcessed > 0
          ? (entry.itemsSucceeded / entry.itemsProcessed) * 100
          : 0;

        return (
          <Card key={entry.id} className="p-4">
            {/* Header */}
            <div
              onClick={() => toggleExpanded(entry.id)}
              className="flex items-start justify-between gap-3 cursor-pointer"
            >
              <div className="flex items-start gap-3 flex-1">
                <button className="mt-1">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge
                      variant={
                        entry.status === 'completed'
                          ? 'success'
                          : entry.status === 'failed'
                          ? 'destructive'
                          : entry.status === 'in_progress'
                          ? 'warning'
                          : 'secondary'
                      }
                    >
                      {SYNC_STATUS_EMOJIS[entry.status]} {SYNC_STATUS_LABELS[entry.status]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(entry.startedAt).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span>{entry.itemsSucceeded} succeeded</span>
                    </div>
                    {entry.itemsFailed > 0 && (
                      <div className="flex items-center gap-1">
                        <XCircle className="h-4 w-4 text-red-500" />
                        <span>{entry.itemsFailed} failed</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>{entry.duration}s</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Success Rate Badge */}
              <Badge variant="outline" className="shrink-0">
                {successRate.toFixed(0)}% success
              </Badge>
            </div>

            {/* Expanded Details */}
            {isExpanded && (
              <div className="mt-4 pt-4 border-t border-border space-y-3">
                {/* Metadata */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Started by: </span>
                    <span>{entry.startedBy}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total items: </span>
                    <span>{entry.itemsProcessed}</span>
                  </div>
                  {entry.completedAt && (
                    <div>
                      <span className="text-muted-foreground">Completed: </span>
                      <span>{new Date(entry.completedAt).toLocaleString()}</span>
                    </div>
                  )}
                </div>

                {/* Errors */}
                {hasErrors && (
                  <div className="mt-3">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="h-4 w-4 text-red-500" />
                      <h4 className="font-semibold text-sm">Errors ({entry.errors!.length})</h4>
                    </div>
                    <div className="space-y-2">
                      {entry.errors!.map((error, index) => (
                        <div
                          key={index}
                          className="p-2 rounded bg-red-50 dark:bg-red-950/10 border border-red-200 dark:border-red-900"
                        >
                          <div className="font-medium text-xs mb-1">{error.itemId}</div>
                          <div className="text-xs text-red-600 dark:text-red-400">
                            {error.error}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        );
      })}

      {/* Load More */}
      {hasMore && (
        <div className="text-center pt-4">
          <Button
            variant="outline"
            onClick={onLoadMore}
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : 'Load More'}
          </Button>
        </div>
      )}
    </div>
  );
}
