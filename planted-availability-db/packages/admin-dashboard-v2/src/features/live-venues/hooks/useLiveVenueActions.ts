/**
 * useLiveVenueActions Hook
 *
 * React Query mutations for live venue actions (mark stale, archive, reactivate).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  markVenueStale,
  archiveVenue,
  reactivateVenue,
} from '../api/liveVenuesApi';
import { liveVenuesKeys } from './useLiveVenues';
import type { LiveVenuesResponse } from '../types';
import type { VenueStatus } from '@pad/core';

interface MutationCallbacks {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Hook for marking a venue as stale
 */
export function useMarkVenueStale(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markVenueStale,
    onMutate: async (venueId: string) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: liveVenuesKeys.all });

      // Snapshot previous value
      const previousData = queryClient.getQueriesData<LiveVenuesResponse>({
        queryKey: liveVenuesKeys.lists(),
      });

      // Optimistically update
      queryClient.setQueriesData<LiveVenuesResponse>(
        { queryKey: liveVenuesKeys.lists() },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.map((venue) =>
              venue.id === venueId ? { ...venue, status: 'stale' as VenueStatus } : venue
            ),
            stats: {
              ...old.stats,
              active: old.stats.active - 1,
              stale: old.stats.stale + 1,
            },
          };
        }
      );

      return { previousData };
    },
    onError: (error, _venueId, context) => {
      // Rollback on error
      if (context?.previousData) {
        for (const [queryKey, data] of context.previousData) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      callbacks?.onError?.(error as Error);
    },
    onSuccess: () => {
      callbacks?.onSuccess?.();
    },
    onSettled: () => {
      // Refetch after mutation
      queryClient.invalidateQueries({ queryKey: liveVenuesKeys.all });
    },
  });
}

/**
 * Hook for archiving a venue
 */
export function useArchiveVenue(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: archiveVenue,
    onMutate: async (venueId: string) => {
      await queryClient.cancelQueries({ queryKey: liveVenuesKeys.all });

      const previousData = queryClient.getQueriesData<LiveVenuesResponse>({
        queryKey: liveVenuesKeys.lists(),
      });

      // Optimistically update
      queryClient.setQueriesData<LiveVenuesResponse>(
        { queryKey: liveVenuesKeys.lists() },
        (old) => {
          if (!old) return old;
          const venue = old.items.find((v) => v.id === venueId);
          const wasActive = venue?.status === 'active';
          const wasStale = venue?.status === 'stale';

          return {
            ...old,
            items: old.items.map((v) =>
              v.id === venueId ? { ...v, status: 'archived' as VenueStatus } : v
            ),
            stats: {
              ...old.stats,
              active: wasActive ? old.stats.active - 1 : old.stats.active,
              stale: wasStale ? old.stats.stale - 1 : old.stats.stale,
              archived: old.stats.archived + 1,
            },
          };
        }
      );

      return { previousData };
    },
    onError: (error, _venueId, context) => {
      if (context?.previousData) {
        for (const [queryKey, data] of context.previousData) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      callbacks?.onError?.(error as Error);
    },
    onSuccess: () => {
      callbacks?.onSuccess?.();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: liveVenuesKeys.all });
    },
  });
}

/**
 * Hook for reactivating a venue
 */
export function useReactivateVenue(callbacks?: MutationCallbacks) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: reactivateVenue,
    onMutate: async (venueId: string) => {
      await queryClient.cancelQueries({ queryKey: liveVenuesKeys.all });

      const previousData = queryClient.getQueriesData<LiveVenuesResponse>({
        queryKey: liveVenuesKeys.lists(),
      });

      // Optimistically update
      queryClient.setQueriesData<LiveVenuesResponse>(
        { queryKey: liveVenuesKeys.lists() },
        (old) => {
          if (!old) return old;
          const venue = old.items.find((v) => v.id === venueId);
          const wasStale = venue?.status === 'stale';
          const wasArchived = venue?.status === 'archived';

          return {
            ...old,
            items: old.items.map((v) =>
              v.id === venueId
                ? { ...v, status: 'active' as VenueStatus, lastVerified: new Date().toISOString() }
                : v
            ),
            stats: {
              ...old.stats,
              active: old.stats.active + 1,
              stale: wasStale ? old.stats.stale - 1 : old.stats.stale,
              archived: wasArchived ? old.stats.archived - 1 : old.stats.archived,
            },
          };
        }
      );

      return { previousData };
    },
    onError: (error, _venueId, context) => {
      if (context?.previousData) {
        for (const [queryKey, data] of context.previousData) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      callbacks?.onError?.(error as Error);
    },
    onSuccess: () => {
      callbacks?.onSuccess?.();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: liveVenuesKeys.all });
    },
  });
}
