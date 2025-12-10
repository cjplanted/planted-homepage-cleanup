/**
 * useSyncHistory Hook
 *
 * React Query hook for fetching sync history.
 */

import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { getSyncHistory } from '../api/syncApi';
import { SyncHistoryResponse } from '../types';

/**
 * Query Key Factory
 */
export const syncHistoryKeys = {
  all: ['syncHistory'] as const,
  lists: () => [...syncHistoryKeys.all, 'list'] as const,
  list: (page: number, pageSize: number) => [...syncHistoryKeys.lists(), page, pageSize] as const,
};

/**
 * useSyncHistory Hook
 *
 * Fetches sync history with pagination.
 */
export function useSyncHistory(
  page = 1,
  pageSize = 20,
  options?: {
    enabled?: boolean;
    refetchInterval?: number;
  }
): UseQueryResult<SyncHistoryResponse, Error> {
  return useQuery({
    queryKey: syncHistoryKeys.list(page, pageSize),
    queryFn: () => getSyncHistory(page, pageSize),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: options?.refetchInterval,
    enabled: options?.enabled,
  });
}
