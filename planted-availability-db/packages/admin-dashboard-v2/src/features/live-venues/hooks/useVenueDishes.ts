/**
 * useVenueDishes Hook
 *
 * React Query hook for fetching dishes for a specific venue.
 */

import { useQuery } from '@tanstack/react-query';
import { getVenueDishes } from '../api/liveVenuesApi';

/**
 * Query key factory for venue dishes
 */
export const venueDishesKeys = {
  all: ['venueDishes'] as const,
  detail: (venueId: string) => [...venueDishesKeys.all, venueId] as const,
};

/**
 * Hook for fetching dishes for a specific venue
 */
export function useVenueDishes(venueId: string | undefined) {
  return useQuery({
    queryKey: venueDishesKeys.detail(venueId ?? ''),
    queryFn: () => getVenueDishes(venueId!),
    enabled: !!venueId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
