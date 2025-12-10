/**
 * Review Queue Page
 *
 * Main page for reviewing scraped venues before publishing.
 * Features:
 * - Split layout with hierarchical tree and detail view
 * - Filtering and search
 * - Keyboard shortcuts (j/k navigate, a approve, r reject, e edit)
 * - Auto-refresh every 5 minutes
 * - Bulk actions
 * - Loading, error, and empty states
 */

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/shared/ui/Card';
import { LoadingState } from '@/shared/components/LoadingState';
import { ErrorState } from '@/shared/components/ErrorState';
import { EmptyState } from '@/shared/components/EmptyState';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/ui/Dialog';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { HelpCircle, RefreshCw } from 'lucide-react';
import { useReviewQueue } from '@/features/review/hooks/useReviewQueue';
import {
  useApproveVenue,
  usePartialApproveVenue,
  useRejectVenue,
  useBulkApprove,
  useBulkReject,
} from '@/features/review/hooks/useApproval';
import { HierarchyTree } from '@/features/review/components/HierarchyTree';
import { VenueDetailPanel } from '@/features/review/components/VenueDetailPanel';
import { DishGrid } from '@/features/review/components/DishGrid';
import { ApprovalButtons } from '@/features/review/components/ApprovalButtons';
import { FeedbackForm } from '@/features/review/components/FeedbackForm';
import { BulkActionsBar } from '@/features/review/components/BulkActionsBar';
import { FilterBar } from '@/features/review/components/FilterBar';
import { StatsBar } from '@/features/review/components/StatsBar';
import { ChainAssignmentDialog } from '@/features/review/components/ChainAssignmentDialog';
import { ReviewQueueFilters } from '@/features/review/types';

const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

/**
 * ReviewQueuePage Component
 */
export function ReviewQueuePage() {
  const [filters, setFilters] = useState<ReviewQueueFilters>({
    status: 'pending',
    page: 1,
    pageSize: 50,
  });
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [selectedVenueIds, setSelectedVenueIds] = useState<Set<string>>(new Set());
  const [showPartialDialog, setShowPartialDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showHelpDialog, setShowHelpDialog] = useState(false);
  const [showBulkRejectDialog, setShowBulkRejectDialog] = useState(false);
  const [showChainDialog, setShowChainDialog] = useState(false);

  // Fetch review queue
  const { data, isLoading, error, refetch } = useReviewQueue(filters, {
    refetchInterval: AUTO_REFRESH_INTERVAL,
  });

  // Mutations
  const approveMutation = useApproveVenue({
    onSuccess: () => {
      setSelectedVenueId(null);
    },
  });

  const partialApproveMutation = usePartialApproveVenue({
    onSuccess: () => {
      setShowPartialDialog(false);
      setSelectedVenueId(null);
    },
  });

  const rejectMutation = useRejectVenue({
    onSuccess: () => {
      setShowRejectDialog(false);
      setSelectedVenueId(null);
    },
  });

  const bulkApproveMutation = useBulkApprove({
    onSuccess: () => {
      setSelectedVenueIds(new Set());
    },
  });

  const bulkRejectMutation = useBulkReject({
    onSuccess: () => {
      setShowBulkRejectDialog(false);
      setSelectedVenueIds(new Set());
    },
  });

  // Get selected venue
  const selectedVenue = data?.items.find((v) => v.id === selectedVenueId);

  // Auto-select first venue if none selected
  useEffect(() => {
    if (data?.items.length && !selectedVenueId) {
      setSelectedVenueId(data.items[0].id);
    }
  }, [data?.items, selectedVenueId]);

  // Handle approval actions
  const handleApprove = useCallback(() => {
    if (!selectedVenueId) return;
    approveMutation.mutate(selectedVenueId);
  }, [selectedVenueId, approveMutation]);

  const handlePartialApprove = useCallback(() => {
    setShowPartialDialog(true);
  }, []);

  const handleReject = useCallback(() => {
    setShowRejectDialog(true);
  }, []);

  const handlePartialSubmit = useCallback(
    (feedback: string, tags: string[]) => {
      if (!selectedVenueId) return;
      partialApproveMutation.mutate({
        venueId: selectedVenueId,
        feedback: `${tags.join(', ')}\n\n${feedback}`,
      });
    },
    [selectedVenueId, partialApproveMutation]
  );

  const handleRejectSubmit = useCallback(
    (reason: string, tags: string[]) => {
      if (!selectedVenueId) return;
      rejectMutation.mutate({
        venueId: selectedVenueId,
        reason: `${tags.join(', ')}\n\n${reason}`,
      });
    },
    [selectedVenueId, rejectMutation]
  );

  // Handle bulk actions
  const handleBulkApprove = useCallback(() => {
    bulkApproveMutation.mutate(Array.from(selectedVenueIds));
  }, [selectedVenueIds, bulkApproveMutation]);

  const handleBulkReject = useCallback(() => {
    setShowBulkRejectDialog(true);
  }, []);

  const handleBulkRejectSubmit = useCallback(
    (reason: string, tags: string[]) => {
      bulkRejectMutation.mutate({
        venueIds: Array.from(selectedVenueIds),
        reason: `${tags.join(', ')}\n\n${reason}`,
      });
    },
    [selectedVenueIds, bulkRejectMutation]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      // Ignore if dialog is open
      if (showPartialDialog || showRejectDialog || showHelpDialog || showBulkRejectDialog) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'a':
          e.preventDefault();
          handleApprove();
          break;
        case 'r':
          e.preventDefault();
          handleReject();
          break;
        case 'e':
          e.preventDefault();
          handlePartialApprove();
          break;
        case '?':
          e.preventDefault();
          setShowHelpDialog(true);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [
    handleApprove,
    handleReject,
    handlePartialApprove,
    showPartialDialog,
    showRejectDialog,
    showHelpDialog,
    showBulkRejectDialog,
  ]);

  // Reset filters
  const handleResetFilters = useCallback(() => {
    setFilters({
      status: 'pending',
      page: 1,
      pageSize: 50,
    });
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Review Queue</h1>
          <p className="text-muted-foreground mt-1">
            Review and approve scraped venues
          </p>
        </div>
        <LoadingState message="Loading review queue..." />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Review Queue</h1>
          <p className="text-muted-foreground mt-1">
            Review and approve scraped venues
          </p>
        </div>
        <ErrorState
          title="Failed to load review queue"
          message={error.message}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  // Empty state
  if (!data || data.items.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Review Queue</h1>
          <p className="text-muted-foreground mt-1">
            Review and approve scraped venues
          </p>
        </div>
        <EmptyState
          title="No venues to review"
          description="The review queue is empty. Check back later or adjust your filters."
          action={{
            label: 'Reset Filters',
            onClick: handleResetFilters,
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Review Queue</h1>
          <p className="text-muted-foreground mt-1">
            Review and approve scraped venues
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowHelpDialog(true)}
          >
            <HelpCircle className="h-4 w-4 mr-2" />
            Shortcuts
          </Button>
        </div>
      </div>

      {/* Stats Bar */}
      <StatsBar stats={data.stats} />

      {/* Filter Bar */}
      <FilterBar
        filters={filters}
        onChange={setFilters}
        onReset={handleResetFilters}
      />

      {/* Main Content - Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Panel - Hierarchy Tree */}
        <Card className="lg:col-span-4 p-4 max-h-[calc(100vh-24rem)] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg">Queue</h2>
            <Badge variant="secondary">{data.items.length}</Badge>
          </div>
          <HierarchyTree
            hierarchy={data.hierarchy}
            selectedVenueId={selectedVenueId || undefined}
            onSelectVenue={setSelectedVenueId}
            className="flex-1 overflow-y-auto"
          />
        </Card>

        {/* Right Panel - Details */}
        <div className="lg:col-span-8 space-y-6">
          {selectedVenue ? (
            <>
              {/* Venue Details */}
              <VenueDetailPanel
                venue={selectedVenue}
                onAssignChain={() => setShowChainDialog(true)}
              />

              {/* Dishes */}
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold">Dishes</h3>
                  <Badge variant="secondary">{selectedVenue.dishes.length}</Badge>
                </div>
                <DishGrid dishes={selectedVenue.dishes} />
              </Card>

              {/* Approval Actions */}
              {selectedVenue.status === 'pending' && (
                <ApprovalButtons
                  onApprove={handleApprove}
                  onPartialApprove={handlePartialApprove}
                  onReject={handleReject}
                  isLoading={
                    approveMutation.isPending ||
                    partialApproveMutation.isPending ||
                    rejectMutation.isPending
                  }
                />
              )}
            </>
          ) : (
            <EmptyState
              title="No venue selected"
              description="Select a venue from the tree to view details"
            />
          )}
        </div>
      </div>

      {/* Bulk Actions Bar */}
      <BulkActionsBar
        selectedCount={selectedVenueIds.size}
        onBulkApprove={handleBulkApprove}
        onBulkReject={handleBulkReject}
        onClearSelection={() => setSelectedVenueIds(new Set())}
        isLoading={bulkApproveMutation.isPending || bulkRejectMutation.isPending}
      />

      {/* Partial Approve Dialog */}
      <Dialog open={showPartialDialog} onOpenChange={setShowPartialDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Partial Approval</DialogTitle>
            <DialogDescription>
              Approve with feedback for AI training and improvement.
            </DialogDescription>
          </DialogHeader>
          <FeedbackForm
            type="partial"
            onSubmit={handlePartialSubmit}
            onCancel={() => setShowPartialDialog(false)}
            isLoading={partialApproveMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Reject Venue</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this venue.
            </DialogDescription>
          </DialogHeader>
          <FeedbackForm
            type="reject"
            onSubmit={handleRejectSubmit}
            onCancel={() => setShowRejectDialog(false)}
            isLoading={rejectMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Bulk Reject Dialog */}
      <Dialog open={showBulkRejectDialog} onOpenChange={setShowBulkRejectDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bulk Reject Venues</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting {selectedVenueIds.size} venues.
            </DialogDescription>
          </DialogHeader>
          <FeedbackForm
            type="reject"
            onSubmit={handleBulkRejectSubmit}
            onCancel={() => setShowBulkRejectDialog(false)}
            isLoading={bulkRejectMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Help Dialog */}
      <Dialog open={showHelpDialog} onOpenChange={setShowHelpDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Keyboard Shortcuts</DialogTitle>
            <DialogDescription>
              Use these shortcuts to navigate and review venues quickly.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Navigate down</span>
              <Badge variant="outline">j / ↓</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Navigate up</span>
              <Badge variant="outline">k / ↑</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Expand node</span>
              <Badge variant="outline">l / →</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Collapse node</span>
              <Badge variant="outline">h / ←</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Approve venue</span>
              <Badge variant="outline">a</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Reject venue</span>
              <Badge variant="outline">r</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Partial approve (edit)</span>
              <Badge variant="outline">e</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Show this help</span>
              <Badge variant="outline">?</Badge>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Chain Assignment Dialog */}
      {selectedVenueId && (
        <ChainAssignmentDialog
          open={showChainDialog}
          onOpenChange={setShowChainDialog}
          venueIds={[selectedVenueId]}
          onSuccess={() => refetch()}
        />
      )}
    </div>
  );
}
