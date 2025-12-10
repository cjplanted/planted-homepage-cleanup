/**
 * useVenueBrowser Hook
 *
 * React Query hook for fetching venues with filters.
 */

import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { getVenues, getVenue } from '../api/browserApi';
import { BrowserResponse, BrowserFilters, BrowserVenue } from '../types';

/**
 * Query Key Factory
 */
export const venueBrowserKeys = {
  all: ['venueBrowser'] as const,
  lists: () => [...venueBrowserKeys.all, 'list'] as const,
  list: (filters: BrowserFilters) => [...venueBrowserKeys.lists(), filters] as const,
  details: () => [...venueBrowserKeys.all, 'detail'] as const,
  detail: (id: string) => [...venueBrowserKeys.details(), id] as const,
};

/**
 * useVenueBrowser Hook
 *
 * Fetches venues with optional filters and returns the browser response.
 */
export function useVenueBrowser(
  filters: BrowserFilters = {},
  options?: {
    enabled?: boolean;
    refetchInterval?: number;
  }
): UseQueryResult<BrowserResponse, Error> {
  return useQuery({
    queryKey: venueBrowserKeys.list(filters),
    queryFn: () => getVenues(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes - production data changes less frequently
    refetchInterval: options?.refetchInterval,
    enabled: options?.enabled,
  });
}

/**
 * useVenue Hook
 *
 * Fetches a single venue by ID.
 */
export function useVenue(
  venueId: string,
  options?: {
    enabled?: boolean;
  }
): UseQueryResult<BrowserVenue, Error> {
  return useQuery({
    queryKey: venueBrowserKeys.detail(venueId),
    queryFn: () => getVenue(venueId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: options?.enabled !== false && !!venueId,
  });
}
