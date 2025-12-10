/**
 * useFeedback Hook
 *
 * React Query mutation for submitting AI feedback.
 */

import { useMutation, UseMutationResult } from '@tanstack/react-query';
import { submitFeedback } from '../api/reviewApi';
import { FeedbackRequest } from '../types';

/**
 * Options for feedback mutation
 */
interface FeedbackMutationOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

/**
 * useFeedback Hook
 */
export function useFeedback(options?: FeedbackMutationOptions): UseMutationResult<
  void,
  Error,
  FeedbackRequest
> {
  return useMutation({
    mutationFn: (request: FeedbackRequest) => submitFeedback(request),
    onSuccess: () => {
      options?.onSuccess?.();
    },
    onError: (error) => {
      options?.onError?.(error);
    },
  });
}
