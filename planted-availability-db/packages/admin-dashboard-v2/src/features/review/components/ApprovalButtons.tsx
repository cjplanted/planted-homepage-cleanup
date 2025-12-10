/**
 * ApprovalButtons Component
 *
 * Three main action buttons: Approve All, Partial Approve, and Reject.
 * Includes loading states and triggers dialogs for feedback/rejection.
 */

import { Check, AlertTriangle, X } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { cn } from '@/lib/utils';

interface ApprovalButtonsProps {
  onApprove: () => void;
  onPartialApprove: () => void;
  onReject: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * ApprovalButtons Component
 */
export function ApprovalButtons({
  onApprove,
  onPartialApprove,
  onReject,
  isLoading = false,
  disabled = false,
  className,
}: ApprovalButtonsProps) {
  return (
    <div className={cn('flex gap-3', className)}>
      {/* Approve All */}
      <Button
        onClick={onApprove}
        disabled={disabled || isLoading}
        className="flex-1 bg-green-600 hover:bg-green-700 text-white"
        size="lg"
      >
        <Check className="h-5 w-5 mr-2" />
        Approve All
      </Button>

      {/* Partial Approve */}
      <Button
        onClick={onPartialApprove}
        disabled={disabled || isLoading}
        variant="outline"
        className="flex-1 border-yellow-500 text-yellow-600 hover:bg-yellow-50"
        size="lg"
      >
        <AlertTriangle className="h-5 w-5 mr-2" />
        Partial Approve
      </Button>

      {/* Reject */}
      <Button
        onClick={onReject}
        disabled={disabled || isLoading}
        variant="destructive"
        className="flex-1"
        size="lg"
      >
        <X className="h-5 w-5 mr-2" />
        Reject
      </Button>
    </div>
  );
}
