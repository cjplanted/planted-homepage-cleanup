/**
 * Browser API
 *
 * API functions for the Venue Browser feature.
 */

import { get } from '@/lib/api/client';
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
 */
export async function getVenues(filters: BrowserFilters = {}): Promise<BrowserResponse> {
  const queryString = buildQueryString(filters);
  return get<BrowserResponse>(`/admin/venues${queryString}`);
}

/**
 * Get a single venue by ID
 */
export async function getVenue(venueId: string): Promise<BrowserVenue> {
  return get<BrowserVenue>(`/admin/venues/${venueId}`);
}

/**
 * Get dishes for a specific venue
 */
export async function getVenueDishes(venueId: string) {
  return get(`/admin/venues/${venueId}/dishes`);
}

/**
 * Export venues to CSV
 */
export async function exportVenuesToCSV(filters: BrowserFilters = {}): Promise<Blob> {
  const queryString = buildQueryString(filters);
  const response = await fetch(`/admin/venues/export${queryString}`, {
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
