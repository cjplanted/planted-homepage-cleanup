/**
 * useApproval Hook
 *
 * React Query mutations for approval actions with optimistic updates.
 */

import { useMutation, useQueryClient, UseMutationResult } from '@tanstack/react-query';
import {
  approveVenue,
  partialApproveVenue,
  rejectVenue,
  bulkApproveVenues,
  bulkRejectVenues,
} from '../api/reviewApi';
import { ReviewVenue, ReviewQueueResponse } from '../types';
import { reviewQueueKeys } from './useReviewQueue';

/**
 * Options for approval mutations
 */
interface ApprovalMutationOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

/**
 * useApproveVenue Hook
 */
export function useApproveVenue(options?: ApprovalMutationOptions): UseMutationResult<
  ReviewVenue,
  Error,
  string
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (venueId: string) => approveVenue(venueId),
    onMutate: async (venueId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: reviewQueueKeys.lists() });

      // Snapshot previous value
      const previousData = queryClient.getQueriesData({ queryKey: reviewQueueKeys.lists() });

      // Optimistically update to verified
      queryClient.setQueriesData<ReviewQueueResponse>(
        { queryKey: reviewQueueKeys.lists() },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.map((venue) =>
              venue.id === venueId ? { ...venue, status: 'verified' as const } : venue
            ),
            stats: {
              ...old.stats,
              pending: Math.max(0, old.stats.pending - 1),
              verified: old.stats.verified + 1,
            },
          };
        }
      );

      return { previousData };
    },
    onError: (error, _, context) => {
      // Rollback on error
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      options?.onError?.(error);
    },
    onSuccess: () => {
      options?.onSuccess?.();
    },
    onSettled: () => {
      // Refetch to sync with server
      queryClient.invalidateQueries({ queryKey: reviewQueueKeys.lists() });
    },
  });
}

/**
 * usePartialApproveVenue Hook
 */
export function usePartialApproveVenue(options?: ApprovalMutationOptions): UseMutationResult<
  ReviewVenue,
  Error,
  { venueId: string; feedback: string; dishIds?: string[] }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ venueId, feedback, dishIds }) =>
      partialApproveVenue(venueId, feedback, dishIds),
    onMutate: async ({ venueId }) => {
      await queryClient.cancelQueries({ queryKey: reviewQueueKeys.lists() });
      const previousData = queryClient.getQueriesData({ queryKey: reviewQueueKeys.lists() });

      queryClient.setQueriesData<ReviewQueueResponse>(
        { queryKey: reviewQueueKeys.lists() },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.map((venue) =>
              venue.id === venueId ? { ...venue, status: 'verified' as const } : venue
            ),
            stats: {
              ...old.stats,
              pending: Math.max(0, old.stats.pending - 1),
              verified: old.stats.verified + 1,
            },
          };
        }
      );

      return { previousData };
    },
    onError: (error, _, context) => {
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      options?.onError?.(error);
    },
    onSuccess: () => {
      options?.onSuccess?.();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: reviewQueueKeys.lists() });
    },
  });
}

/**
 * useRejectVenue Hook
 */
export function useRejectVenue(options?: ApprovalMutationOptions): UseMutationResult<
  ReviewVenue,
  Error,
  { venueId: string; reason: string }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ venueId, reason }) => rejectVenue(venueId, reason),
    onMutate: async ({ venueId }) => {
      await queryClient.cancelQueries({ queryKey: reviewQueueKeys.lists() });
      const previousData = queryClient.getQueriesData({ queryKey: reviewQueueKeys.lists() });

      queryClient.setQueriesData<ReviewQueueResponse>(
        { queryKey: reviewQueueKeys.lists() },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.map((venue) =>
              venue.id === venueId ? { ...venue, status: 'rejected' as const } : venue
            ),
            stats: {
              ...old.stats,
              pending: Math.max(0, old.stats.pending - 1),
              rejected: old.stats.rejected + 1,
            },
          };
        }
      );

      return { previousData };
    },
    onError: (error, _, context) => {
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      options?.onError?.(error);
    },
    onSuccess: () => {
      options?.onSuccess?.();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: reviewQueueKeys.lists() });
    },
  });
}

/**
 * useBulkApprove Hook
 */
export function useBulkApprove(options?: ApprovalMutationOptions): UseMutationResult<
  { success: number; failed: number },
  Error,
  string[]
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (venueIds: string[]) => bulkApproveVenues(venueIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reviewQueueKeys.lists() });
      options?.onSuccess?.();
    },
    onError: (error) => {
      options?.onError?.(error);
    },
  });
}

/**
 * useBulkReject Hook
 */
export function useBulkReject(options?: ApprovalMutationOptions): UseMutationResult<
  { success: number; failed: number },
  Error,
  { venueIds: string[]; reason: string }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ venueIds, reason }) => bulkRejectVenues(venueIds, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reviewQueueKeys.lists() });
      options?.onSuccess?.();
    },
    onError: (error) => {
      options?.onError?.(error);
    },
  });
}
