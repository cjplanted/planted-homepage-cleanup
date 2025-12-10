/**
 * BulkActionsBar Component
 *
 * Shows when multiple items are selected with bulk action buttons.
 */

import { Check, X, XCircle } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { cn } from '@/lib/utils';

interface BulkActionsBarProps {
  selectedCount: number;
  onBulkApprove: () => void;
  onBulkReject: () => void;
  onClearSelection: () => void;
  isLoading?: boolean;
  className?: string;
}

/**
 * BulkActionsBar Component
 */
export function BulkActionsBar({
  selectedCount,
  onBulkApprove,
  onBulkReject,
  onClearSelection,
  isLoading = false,
  className,
}: BulkActionsBarProps) {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed bottom-6 left-1/2 -translate-x-1/2 z-50',
        'bg-card border border-border rounded-lg shadow-lg',
        'px-6 py-4 flex items-center gap-4',
        'animate-in slide-in-from-bottom-4 duration-300',
        className
      )}
    >
      {/* Selection Count */}
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-base px-3 py-1">
          {selectedCount}
        </Badge>
        <span className="text-sm font-medium">
          {selectedCount === 1 ? 'item' : 'items'} selected
        </span>
      </div>

      {/* Divider */}
      <div className="h-6 w-px bg-border" />

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          onClick={onBulkApprove}
          disabled={isLoading}
          className="bg-green-600 hover:bg-green-700 text-white"
          size="sm"
        >
          <Check className="h-4 w-4 mr-2" />
          Approve All
        </Button>

        <Button
          onClick={onBulkReject}
          disabled={isLoading}
          variant="destructive"
          size="sm"
        >
          <X className="h-4 w-4 mr-2" />
          Reject All
        </Button>

        <Button
          onClick={onClearSelection}
          disabled={isLoading}
          variant="ghost"
          size="sm"
        >
          <XCircle className="h-4 w-4 mr-2" />
          Clear
        </Button>
      </div>
    </div>
  );
}
