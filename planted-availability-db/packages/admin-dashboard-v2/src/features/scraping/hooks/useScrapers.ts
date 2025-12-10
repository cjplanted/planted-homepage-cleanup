/**
 * useScrapers Hook
 *
 * Fetches available scrapers and recent runs.
 */

import { useQuery } from '@tanstack/react-query';
import { getAvailableScrapers, getRecentRuns } from '../api/scraperApi';

/**
 * Hook to fetch available scrapers
 */
export function useScrapers() {
  return useQuery({
    queryKey: ['scrapers', 'available'],
    queryFn: getAvailableScrapers,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to fetch recent scraper runs
 */
export function useRecentRuns(limit = 10, options?: { enabled?: boolean; refetchInterval?: number }) {
  return useQuery({
    queryKey: ['scrapers', 'runs', limit],
    queryFn: () => getRecentRuns(limit),
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: options?.refetchInterval,
    enabled: options?.enabled,
  });
}
