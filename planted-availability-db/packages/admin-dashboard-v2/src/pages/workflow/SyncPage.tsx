/**
 * Sync to Website Page
 *
 * Manages syncing changes from the database to the production website.
 */

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { Card } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { LoadingState } from '@/shared/components/LoadingState';
import { ErrorState } from '@/shared/components/ErrorState';
import { Dialog } from '@/shared/ui/Dialog';
import {
  useSyncPreview,
  useSyncStats,
  useSync,
  useSyncHistory,
  SyncPreviewComponent,
  SyncDiff,
  SyncProgress,
  SyncHistoryComponent,
  SyncItem,
  SyncChangeType,
} from '@/features/sync';

/**
 * SyncPage Component
 */
export function SyncPage() {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [diffItem, setDiffItem] = useState<SyncItem | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Queries
  const { data: previewData, isLoading: isLoadingPreview, error: previewError, refetch: refetchPreview } = useSyncPreview();
  const { data: statsData } = useSyncStats();
  const { data: historyData, refetch: refetchHistory } = useSyncHistory(1, 10);

  // Mutations
  const { mutate: executeSync, isPending: isSyncing, data: syncResult } = useSync();

  // Handle item toggle
  const handleToggleItem = (itemId: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  // Handle toggle all for a change type
  const handleToggleAll = (changeType: SyncChangeType) => {
    if (!previewData) return;

    const items =
      changeType === 'addition'
        ? previewData.additions
        : changeType === 'update'
        ? previewData.updates
        : previewData.removals;

    const allSelected = items.every((item) => selectedItems.has(item.id));

    setSelectedItems((prev) => {
      const next = new Set(prev);
      items.forEach((item) => {
        if (allSelected) {
          next.delete(item.id);
        } else {
          next.add(item.id);
        }
      });
      return next;
    });
  };

  // Handle view diff
  const handleViewDiff = (item: SyncItem) => {
    setDiffItem(item);
    setShowDiff(true);
  };

  // Handle sync execution
  const handleExecuteSync = () => {
    if (selectedItems.size === 0) return;

    executeSync(
      { itemIds: Array.from(selectedItems) },
      {
        onSuccess: () => {
          setSelectedItems(new Set());
          setShowConfirmation(false);
          refetchPreview();
          refetchHistory();
        },
      }
    );
  };

  // Calculate selection stats
  const selectionStats = useMemo(() => {
    if (!previewData) return { additions: 0, updates: 0, removals: 0 };

    return {
      additions: previewData.additions.filter((item) => selectedItems.has(item.id)).length,
      updates: previewData.updates.filter((item) => selectedItems.has(item.id)).length,
      removals: previewData.removals.filter((item) => selectedItems.has(item.id)).length,
    };
  }, [selectedItems, previewData]);

  // Loading state
  if (isLoadingPreview) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingState message="Loading sync preview..." />
      </div>
    );
  }

  // Error state
  if (previewError) {
    return (
      <div className="flex items-center justify-center h-full">
        <ErrorState
          title="Failed to load sync preview"
          message={previewError.message}
          onRetry={refetchPreview}
        />
      </div>
    );
  }

  // No data state
  if (!previewData) {
    return (
      <div className="flex items-center justify-center h-full">
        <ErrorState
          title="No data available"
          message="Unable to load sync preview"
          onRetry={refetchPreview}
        />
      </div>
    );
  }

  const hasChanges = previewData.totalChanges > 0;
  const hasSelection = selectedItems.size > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border bg-background p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Sync to Website</h1>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
          >
            {showHistory ? (
              <>
                <ChevronUp className="h-4 w-4 mr-2" />
                Hide History
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-2" />
                Show History
              </>
            )}
          </Button>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6 text-sm">
          <div>
            <span className="text-muted-foreground">Last sync: </span>
            <span className="font-medium">
              {statsData?.lastSync
                ? new Date(statsData.lastSync).toLocaleString()
                : 'Never'}
            </span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div>
            <span className="text-muted-foreground">Pending: </span>
            <span className="font-semibold">{previewData.totalChanges}</span> changes
          </div>
          {statsData && (
            <>
              <div className="h-4 w-px bg-border" />
              <div>
                <span className="text-muted-foreground">Success rate: </span>
                <span className="font-medium">{statsData.successRate.toFixed(1)}%</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* History Section (Collapsible) */}
      {showHistory && historyData && (
        <div className="border-b border-border bg-muted/20 p-6">
          <h2 className="font-semibold mb-4">Recent Syncs</h2>
          <SyncHistoryComponent entries={historyData.entries} />
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        {!hasChanges ? (
          <Card className="p-12 text-center">
            <div className="max-w-md mx-auto space-y-4">
              <div className="text-4xl">✅</div>
              <h2 className="text-xl font-semibold">All synced up!</h2>
              <p className="text-muted-foreground">
                There are no pending changes to sync to the website.
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Sync Preview */}
            <Card className="p-6">
              <SyncPreviewComponent
                additions={previewData.additions}
                updates={previewData.updates}
                removals={previewData.removals}
                selectedItems={selectedItems}
                onToggleItem={handleToggleItem}
                onToggleAll={handleToggleAll}
                onViewDiff={handleViewDiff}
              />
            </Card>

            {/* Sync Actions */}
            {hasSelection && (
              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold mb-1">
                      Ready to sync {selectedItems.size} item{selectedItems.size > 1 ? 's' : ''}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {selectionStats.additions > 0 && `${selectionStats.additions} additions`}
                      {selectionStats.updates > 0 && `, ${selectionStats.updates} updates`}
                      {selectionStats.removals > 0 && `, ${selectionStats.removals} removals`}
                    </p>
                    {previewData.estimatedDuration && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Estimated duration: ~{Math.ceil(previewData.estimatedDuration / 60)} minutes
                      </p>
                    )}
                  </div>
                  <Button
                    size="lg"
                    onClick={() => setShowConfirmation(true)}
                    disabled={isSyncing}
                  >
                    {isSyncing ? 'Syncing...' : `Sync Selected (${selectedItems.size})`}
                  </Button>
                </div>
              </Card>
            )}

            {/* Sync Progress (shown during sync) */}
            {isSyncing && syncResult && (
              <Card className="p-6">
                <SyncProgress
                  isRunning={isSyncing}
                  progress={75} // This would come from real-time updates
                  itemsProcessed={10}
                  totalItems={selectedItems.size}
                />
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Diff Dialog */}
      <SyncDiff
        item={diffItem}
        isOpen={showDiff}
        onClose={() => setShowDiff(false)}
      />

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <div className="p-6 max-w-md">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="h-6 w-6 text-yellow-500 shrink-0 mt-1" />
            <div>
              <h2 className="text-xl font-bold mb-2">Confirm Sync</h2>
              <p className="text-sm text-muted-foreground">
                You are about to sync {selectedItems.size} item{selectedItems.size > 1 ? 's' : ''} to the production website. This action cannot be undone.
              </p>
            </div>
          </div>

          <div className="space-y-2 mb-6 text-sm">
            {selectionStats.additions > 0 && (
              <div className="flex items-center gap-2">
                <Badge variant="success" className="shrink-0">+</Badge>
                <span>{selectionStats.additions} addition{selectionStats.additions > 1 ? 's' : ''}</span>
              </div>
            )}
            {selectionStats.updates > 0 && (
              <div className="flex items-center gap-2">
                <Badge variant="warning" className="shrink-0">~</Badge>
                <span>{selectionStats.updates} update{selectionStats.updates > 1 ? 's' : ''}</span>
              </div>
            )}
            {selectionStats.removals > 0 && (
              <div className="flex items-center gap-2">
                <Badge variant="destructive" className="shrink-0">-</Badge>
                <span>{selectionStats.removals} removal{selectionStats.removals > 1 ? 's' : ''}</span>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setShowConfirmation(false)}
              disabled={isSyncing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleExecuteSync}
              disabled={isSyncing}
            >
              {isSyncing ? 'Syncing...' : 'Confirm Sync'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
