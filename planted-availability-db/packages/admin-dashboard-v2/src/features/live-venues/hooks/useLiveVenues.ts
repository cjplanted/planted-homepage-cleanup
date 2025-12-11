/**
 * useLiveVenues Hook
 *
 * React Query hook for fetching live venues data.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getLiveVenues } from '../api/liveVenuesApi';
import type { LiveVenuesFilters } from '../types';

/**
 * Query key factory for live venues
 */
export const liveVenuesKeys = {
  all: ['liveVenues'] as const,
  lists: () => [...liveVenuesKeys.all, 'list'] as const,
  list: (filters: LiveVenuesFilters) => [...liveVenuesKeys.lists(), filters] as const,
};

/**
 * Hook for fetching live venues with filters
 */
export function useLiveVenues(filters: LiveVenuesFilters = {}) {
  return useQuery({
    queryKey: liveVenuesKeys.list(filters),
    queryFn: () => getLiveVenues(filters),
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
}

/**
 * Hook to prefetch live venues
 */
export function usePrefetchLiveVenues() {
  const queryClient = useQueryClient();

  return (filters: LiveVenuesFilters) => {
    queryClient.prefetchQuery({
      queryKey: liveVenuesKeys.list(filters),
      queryFn: () => getLiveVenues(filters),
      staleTime: 60 * 1000,
    });
  };
}

/**
 * Hook to invalidate live venues queries
 */
export function useInvalidateLiveVenues() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: liveVenuesKeys.all });
  };
}
