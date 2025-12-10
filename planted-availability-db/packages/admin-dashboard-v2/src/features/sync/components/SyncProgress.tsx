/**
 * SyncProgress Component
 *
 * Shows progress during sync execution.
 */

import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Badge } from '@/shared/ui/Badge';
import { cn } from '@/lib/utils';
import { SyncProgressEvent } from '../types';

interface SyncProgressProps {
  isRunning: boolean;
  progress: number; // 0-100
  currentItem?: string;
  events?: SyncProgressEvent[];
  itemsProcessed?: number;
  totalItems?: number;
  className?: string;
}

/**
 * SyncProgress Component
 */
export function SyncProgress({
  isRunning,
  progress,
  currentItem,
  events = [],
  itemsProcessed = 0,
  totalItems = 0,
  className,
}: SyncProgressProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="font-medium">Syncing...</span>
              </>
            ) : (
              <span className="font-medium">Sync Complete</span>
            )}
          </div>
          <span className="text-muted-foreground">
            {itemsProcessed} / {totalItems} items
          </span>
        </div>

        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full transition-all duration-300',
              isRunning ? 'bg-primary' : 'bg-green-500'
            )}
            style={{ width: `${progress}%` }}
          />
        </div>

        {currentItem && isRunning && (
          <p className="text-xs text-muted-foreground">
            Processing: {currentItem}
          </p>
        )}
      </div>

      {/* Events Log */}
      {events.length > 0 && (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          <h4 className="font-semibold text-sm">Sync Log</h4>
          <div className="space-y-1">
            {events.map((event, index) => (
              <div
                key={index}
                className="flex items-start gap-2 text-xs p-2 rounded bg-muted/50"
              >
                {event.status === 'completed' && (
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                )}
                {event.status === 'failed' && (
                  <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                )}
                {event.status === 'started' && (
                  <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0 mt-0.5" />
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{event.itemId}</span>
                    <Badge
                      variant={
                        event.status === 'completed'
                          ? 'success'
                          : event.status === 'failed'
                          ? 'destructive'
                          : 'secondary'
                      }
                      className="text-xs shrink-0"
                    >
                      {event.status}
                    </Badge>
                  </div>
                  {event.message && (
                    <p className="text-muted-foreground mt-1">{event.message}</p>
                  )}
                  {event.error && (
                    <p className="text-red-500 mt-1">{event.error}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
