/**
 * useReviewQueue Hook
 *
 * React Query hook for fetching the review queue with filters.
 */

import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { getReviewQueue } from '../api/reviewApi';
import { ReviewQueueResponse, ReviewQueueFilters } from '../types';

/**
 * Query Key Factory
 */
export const reviewQueueKeys = {
  all: ['reviewQueue'] as const,
  lists: () => [...reviewQueueKeys.all, 'list'] as const,
  list: (filters: ReviewQueueFilters) => [...reviewQueueKeys.lists(), filters] as const,
  details: () => [...reviewQueueKeys.all, 'detail'] as const,
  detail: (id: string) => [...reviewQueueKeys.details(), id] as const,
};

/**
 * useReviewQueue Hook
 */
export function useReviewQueue(
  filters: ReviewQueueFilters = {},
  options?: {
    enabled?: boolean;
    refetchInterval?: number;
  }
): UseQueryResult<ReviewQueueResponse, Error> {
  return useQuery({
    queryKey: reviewQueueKeys.list(filters),
    queryFn: () => getReviewQueue(filters),
    staleTime: 60000, // 1 minute
    refetchInterval: options?.refetchInterval,
    enabled: options?.enabled,
  });
}
