/**
 * useFilters Hook
 *
 * Hook for managing filter state with URL synchronization.
 */

import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BrowserFilters, StatusFilter, VenueType, DeliveryPlatform } from '../types';

/**
 * useFilters Hook
 *
 * Manages filter state and synchronizes with URL search parameters.
 */
export function useFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Parse filters from URL
  const filters = useMemo<BrowserFilters>(() => {
    return {
      status: (searchParams.get('status') as StatusFilter) || 'all',
      country: searchParams.get('country') || undefined,
      chain: searchParams.get('chain') || undefined,
      venueType: (searchParams.get('venueType') as VenueType) || undefined,
      platform: (searchParams.get('platform') as DeliveryPlatform) || undefined,
      search: searchParams.get('search') || undefined,
      sortBy: (searchParams.get('sortBy') as BrowserFilters['sortBy']) || 'name',
      sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'asc',
    };
  }, [searchParams]);

  // Update a single filter
  const setFilter = useCallback(
    <K extends keyof BrowserFilters>(key: K, value: BrowserFilters[K] | undefined) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);

        if (value === undefined || value === '' || value === 'all') {
          next.delete(key);
        } else {
          next.set(key, String(value));
        }

        return next;
      });
    },
    [setSearchParams]
  );

  // Update multiple filters at once
  const setFilters = useCallback(
    (newFilters: Partial<BrowserFilters>) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);

        Object.entries(newFilters).forEach(([key, value]) => {
          if (value === undefined || value === '' || value === 'all') {
            next.delete(key);
          } else {
            next.set(key, String(value));
          }
        });

        return next;
      });
    },
    [setSearchParams]
  );

  // Reset all filters
  const resetFilters = useCallback(() => {
    setSearchParams(new URLSearchParams());
  }, [setSearchParams]);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return (
      filters.status !== 'all' ||
      !!filters.country ||
      !!filters.chain ||
      !!filters.venueType ||
      !!filters.platform ||
      !!filters.search
    );
  }, [filters]);

  return {
    filters,
    setFilter,
    setFilters,
    resetFilters,
    hasActiveFilters,
  };
}
