/**
 * useUpdateCountry Hook
 *
 * React Query mutation for updating venue country with optimistic updates.
 */

import { useMutation, useQueryClient, UseMutationResult } from '@tanstack/react-query';
import { updateVenueCountry } from '../api/reviewApi';
import { ReviewQueueResponse } from '../types';
import { reviewQueueKeys } from './useReviewQueue';

interface UpdateCountryOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

interface UpdateCountryParams {
  venueId: string;
  country: string;
}

interface UpdateCountryResult {
  success: boolean;
  venue: {
    id: string;
    name: string;
    previousCountry: string;
    country: string;
  };
}

/**
 * useUpdateCountry Hook
 */
export function useUpdateCountry(options?: UpdateCountryOptions): UseMutationResult<
  UpdateCountryResult,
  Error,
  UpdateCountryParams
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ venueId, country }: UpdateCountryParams) => updateVenueCountry(venueId, country),
    onMutate: async ({ venueId, country }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: reviewQueueKeys.lists() });

      // Snapshot previous value
      const previousData = queryClient.getQueriesData({ queryKey: reviewQueueKeys.lists() });

      // Optimistically update the venue's country
      queryClient.setQueriesData<ReviewQueueResponse>(
        { queryKey: reviewQueueKeys.lists() },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.map((venue) =>
              venue.id === venueId
                ? { ...venue, country, countryCode: country }
                : venue
            ),
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
      // Refetch to sync with server (hierarchy may have changed)
      queryClient.invalidateQueries({ queryKey: reviewQueueKeys.lists() });
    },
  });
}
