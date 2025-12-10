/**
 * useSyncPreview Hook
 *
 * React Query hook for fetching sync preview data.
 */

import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { getSyncPreview, getSyncStats } from '../api/syncApi';
import { SyncPreview, SyncStats } from '../types';

/**
 * Query Key Factory
 */
export const syncPreviewKeys = {
  all: ['syncPreview'] as const,
  preview: () => [...syncPreviewKeys.all, 'preview'] as const,
  stats: () => [...syncPreviewKeys.all, 'stats'] as const,
};

/**
 * useSyncPreview Hook
 *
 * Fetches pending sync changes.
 */
export function useSyncPreview(
  options?: {
    enabled?: boolean;
    refetchInterval?: number;
  }
): UseQueryResult<SyncPreview, Error> {
  return useQuery({
    queryKey: syncPreviewKeys.preview(),
    queryFn: getSyncPreview,
    staleTime: 60000, // 1 minute
    refetchInterval: options?.refetchInterval,
    enabled: options?.enabled,
  });
}

/**
 * useSyncStats Hook
 *
 * Fetches sync statistics.
 */
export function useSyncStats(
  options?: {
    enabled?: boolean;
    refetchInterval?: number;
  }
): UseQueryResult<SyncStats, Error> {
  return useQuery({
    queryKey: syncPreviewKeys.stats(),
    queryFn: getSyncStats,
    staleTime: 60000, // 1 minute
    refetchInterval: options?.refetchInterval,
    enabled: options?.enabled,
  });
}
