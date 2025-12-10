/**
 * useBudget Hook
 *
 * Fetches budget status with auto-refresh.
 */

import { useQuery } from '@tanstack/react-query';
import { getBudgetStatus } from '../api/scraperApi';

/**
 * Hook to fetch budget status with optional auto-refresh
 */
export function useBudget(options?: {
  enabled?: boolean;
  refetchInterval?: number;
}) {
  return useQuery({
    queryKey: ['budget', 'status'],
    queryFn: getBudgetStatus,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: options?.refetchInterval ?? 60 * 1000, // Default 1 minute
    enabled: options?.enabled ?? true,
  });
}
