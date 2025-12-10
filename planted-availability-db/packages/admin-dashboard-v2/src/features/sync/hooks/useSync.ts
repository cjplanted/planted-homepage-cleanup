/**
 * useSync Hook
 *
 * React Query mutation hook for executing sync operations.
 */

import { useMutation, useQueryClient, UseMutationResult } from '@tanstack/react-query';
import { executeSync, cancelSync } from '../api/syncApi';
import { SyncRequest, SyncResult } from '../types';
import { syncPreviewKeys } from './useSyncPreview';
import { syncHistoryKeys } from './useSyncHistory';

/**
 * useSync Hook
 *
 * Executes a sync operation and invalidates relevant queries on success.
 */
export function useSync(): UseMutationResult<SyncResult, Error, SyncRequest> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: executeSync,
    onSuccess: () => {
      // Invalidate sync preview and history queries
      queryClient.invalidateQueries({ queryKey: syncPreviewKeys.all });
      queryClient.invalidateQueries({ queryKey: syncHistoryKeys.all });

      // Also invalidate venue browser data as it may have changed
      queryClient.invalidateQueries({ queryKey: ['venueBrowser'] });
    },
  });
}

/**
 * useCancelSync Hook
 *
 * Cancels an ongoing sync operation.
 */
export function useCancelSync(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: cancelSync,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: syncPreviewKeys.all });
      queryClient.invalidateQueries({ queryKey: syncHistoryKeys.all });
    },
  });
}
