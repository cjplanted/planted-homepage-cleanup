import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface SyncStatusResponse {
  lastSync: string | null;
  pendingChanges: {
    toAdd: number;
    toUpdate: number;
    toRemove: number;
  };
  lastSyncStatus?: 'success' | 'partial' | 'failed';
  lastSyncError?: string;
}

async function fetchSyncStatus(): Promise<SyncStatusResponse> {
  // This would be replaced with actual API call
  // For now, return mock data
  const mockData: SyncStatusResponse = {
    lastSync: new Date(Date.now() - 2 * 60 * 60000).toISOString(), // 2 hours ago
    pendingChanges: {
      toAdd: 12,
      toUpdate: 8,
      toRemove: 3,
    },
    lastSyncStatus: 'success',
  };

  return mockData;
}

async function triggerSync(): Promise<{ success: boolean; message: string }> {
  // This would be replaced with actual API call
  // Simulate async sync operation
  await new Promise((resolve) => setTimeout(resolve, 2000));

  return {
    success: true,
    message: 'Website sync completed successfully',
  };
}

export interface UseSyncStatusReturn {
  lastSync: Date | null;
  pendingChanges: {
    toAdd: number;
    toUpdate: number;
    toRemove: number;
  };
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  sync: () => Promise<void>;
  isSyncing: boolean;
  lastSyncStatus?: 'success' | 'partial' | 'failed';
  lastSyncError?: string;
  refetch: () => void;
}

export function useSyncStatus(): UseSyncStatusReturn {
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['sync-status'],
    queryFn: fetchSyncStatus,
    refetchInterval: 60000, // Refetch every minute
    staleTime: 30000, // Consider data stale after 30 seconds
  });

  const syncMutation = useMutation({
    mutationFn: triggerSync,
    onSuccess: () => {
      // Invalidate sync status to refetch
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
      // Also invalidate venues and other data that might have changed
      queryClient.invalidateQueries({ queryKey: ['discovered-venues'] });
      queryClient.invalidateQueries({ queryKey: ['discovered-venues-stats'] });
    },
  });

  const sync = async () => {
    setIsSyncing(true);
    try {
      await syncMutation.mutateAsync();
    } finally {
      setIsSyncing(false);
    }
  };

  return {
    lastSync: data?.lastSync ? new Date(data.lastSync) : null,
    pendingChanges: data?.pendingChanges || {
      toAdd: 0,
      toUpdate: 0,
      toRemove: 0,
    },
    isLoading,
    isError,
    error: error as Error | null,
    sync,
    isSyncing: isSyncing || syncMutation.isPending,
    lastSyncStatus: data?.lastSyncStatus,
    lastSyncError: data?.lastSyncError,
    refetch,
  };
}
