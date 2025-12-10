/**
 * Browser API
 *
 * API functions for the Venue Browser feature.
 */

import { get } from '@/lib/api/client';
import { API_ENDPOINTS } from '@/lib/api/endpoints';
import { BrowserResponse, BrowserFilters, BrowserVenue } from '../types';

/**
 * Build query string from filters
 */
function buildQueryString(filters: BrowserFilters): string {
  const params = new URLSearchParams();

  if (filters.status && filters.status !== 'all') {
    params.append('status', filters.status);
  }
  if (filters.country) {
    params.append('country', filters.country);
  }
  if (filters.chain) {
    params.append('chain', filters.chain);
  }
  if (filters.venueType) {
    params.append('venueType', filters.venueType);
  }
  if (filters.platform) {
    params.append('platform', filters.platform);
  }
  if (filters.search) {
    params.append('search', filters.search);
  }
  if (filters.sortBy) {
    params.append('sortBy', filters.sortBy);
  }
  if (filters.sortOrder) {
    params.append('sortOrder', filters.sortOrder);
  }

  const query = params.toString();
  return query ? `?${query}` : '';
}

/**
 * Get all venues for browsing
 * Uses adminDiscoveredVenues endpoint for discovered venues
 */
export async function getVenues(filters: BrowserFilters = {}): Promise<BrowserResponse> {
  const queryString = buildQueryString(filters);
  return get<BrowserResponse>(`${API_ENDPOINTS.DISCOVERED_VENUES}${queryString}`);
}

/**
 * Get a single venue by ID
 */
export async function getVenue(venueId: string): Promise<BrowserVenue> {
  return get<BrowserVenue>(`${API_ENDPOINTS.DISCOVERED_VENUES}?venueId=${encodeURIComponent(venueId)}`);
}

/**
 * Get dishes for a specific venue
 * Note: Dishes are embedded in discovered_venues.dishes[], use venue query
 */
export async function getVenueDishes(venueId: string) {
  // Dishes are embedded in the venue document
  const venue = await getVenue(venueId);
  return venue.dishes || [];
}

/**
 * Export venues to CSV
 */
export async function exportVenuesToCSV(filters: BrowserFilters = {}): Promise<Blob> {
  const queryString = buildQueryString(filters);
  const response = await fetch(`${API_ENDPOINTS.DISCOVERED_VENUES}${queryString}&format=csv`, {
    method: 'GET',
    headers: {
      'Accept': 'text/csv',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to export venues');
  }

  return response.blob();
}
