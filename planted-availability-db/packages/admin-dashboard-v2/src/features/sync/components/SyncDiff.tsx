/**
 * SyncDiff Component
 *
 * Displays detailed diff view for a single sync item.
 */

import { X } from 'lucide-react';
import { Dialog } from '@/shared/ui/Dialog';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { cn } from '@/lib/utils';
import {
  SyncItem,
  FieldDiff,
  CHANGE_TYPE_LABELS,
  CHANGE_TYPE_EMOJIS,
  CHANGE_TYPE_COLORS,
} from '../types';

interface SyncDiffProps {
  item: SyncItem | null;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Format value for display
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '—';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

/**
 * SyncDiff Component
 */
export function SyncDiff({ item, isOpen, onClose }: SyncDiffProps) {
  if (!item) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <div className="p-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-6">
          <div>
            <h2 className="text-xl font-bold mb-2">{item.venueName}</h2>
            <div className="flex items-center gap-2">
              <Badge variant={CHANGE_TYPE_COLORS[item.changeType] as any}>
                {CHANGE_TYPE_EMOJIS[item.changeType]} {CHANGE_TYPE_LABELS[item.changeType]}
              </Badge>
              {item.dishName && (
                <Badge variant="outline">Dish: {item.dishName}</Badge>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Diff Content */}
        <div className="space-y-4">
          {/* Addition - Show new data */}
          {item.changeType === 'addition' && (
            <div className="rounded-md border border-border p-4 bg-green-50 dark:bg-green-950/10">
              <h3 className="font-semibold text-sm mb-3 text-green-700 dark:text-green-400">
                New Item
              </h3>
              <pre className="text-xs overflow-auto p-3 bg-background rounded border border-border">
                {JSON.stringify(item.data, null, 2)}
              </pre>
            </div>
          )}

          {/* Update - Show field changes */}
          {item.changeType === 'update' && item.diff && (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Changed Fields</h3>
              {item.diff.map((fieldDiff, index) => (
                <FieldDiffView key={index} diff={fieldDiff} />
              ))}

              {/* Dish diffs if present */}
              {item.dishDiffs && item.dishDiffs.length > 0 && (
                <div className="mt-6">
                  <h3 className="font-semibold text-sm mb-3">Dish Changes</h3>
                  {item.dishDiffs.map((dishDiff, index) => (
                    <div
                      key={index}
                      className="mb-4 p-3 rounded-md border border-border bg-muted/20"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium text-sm">{dishDiff.name}</span>
                        <Badge
                          variant={CHANGE_TYPE_COLORS[dishDiff.changeType] as any}
                          className="text-xs"
                        >
                          {CHANGE_TYPE_EMOJIS[dishDiff.changeType]}
                        </Badge>
                      </div>
                      {dishDiff.fields && dishDiff.fields.length > 0 && (
                        <div className="space-y-2 mt-2">
                          {dishDiff.fields.map((field, i) => (
                            <FieldDiffView key={i} diff={field} compact />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Removal - Show item being removed */}
          {item.changeType === 'removal' && (
            <div className="rounded-md border border-border p-4 bg-red-50 dark:bg-red-950/10">
              <h3 className="font-semibold text-sm mb-3 text-red-700 dark:text-red-400">
                Item to be Removed
              </h3>
              <pre className="text-xs overflow-auto p-3 bg-background rounded border border-border">
                {JSON.stringify(item.data, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-border">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/**
 * FieldDiffView Component
 */
function FieldDiffView({ diff, compact = false }: { diff: FieldDiff; compact?: boolean }) {
  return (
    <div className={cn('rounded-md border border-border', compact ? 'p-2' : 'p-3')}>
      <div className="font-medium text-xs text-muted-foreground mb-2">
        {diff.field}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Old Value</div>
          <div
            className={cn(
              'text-sm p-2 rounded bg-red-50 dark:bg-red-950/10 border border-red-200 dark:border-red-900',
              compact && 'text-xs p-1'
            )}
          >
            <code>{formatValue(diff.oldValue)}</code>
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">New Value</div>
          <div
            className={cn(
              'text-sm p-2 rounded bg-green-50 dark:bg-green-950/10 border border-green-200 dark:border-green-900',
              compact && 'text-xs p-1'
            )}
          >
            <code>{formatValue(diff.newValue)}</code>
          </div>
        </div>
      </div>
    </div>
  );
}
