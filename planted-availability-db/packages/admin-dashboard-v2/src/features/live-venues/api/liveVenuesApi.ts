/**
 * Live Venues API Client
 *
 * Typed API functions for the Live Venues Browser feature.
 */

import { apiClient } from '@/lib/api/client';
import { API_ENDPOINTS } from '@/lib/api/endpoints';
import type {
  LiveVenuesResponse,
  LiveVenuesFilters,
  UpdateVenueStatusRequest,
  UpdateVenueStatusResponse,
  VenueDishesResponse,
} from '../types';

/**
 * Build query string from filters
 */
function buildQueryString(filters: LiveVenuesFilters): string {
  const params = new URLSearchParams();

  if (filters.country) params.append('country', filters.country);
  if (filters.status) params.append('status', filters.status);
  if (filters.venueType) params.append('venueType', filters.venueType);
  if (filters.search) params.append('search', filters.search);
  if (filters.page !== undefined) params.append('page', filters.page.toString());
  if (filters.pageSize !== undefined) params.append('pageSize', filters.pageSize.toString());

  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
}

/**
 * Get Live Venues
 */
export async function getLiveVenues(filters: LiveVenuesFilters = {}): Promise<LiveVenuesResponse> {
  const queryString = buildQueryString(filters);
  return apiClient.get<LiveVenuesResponse>(`${API_ENDPOINTS.LIVE_VENUES}${queryString}`);
}

/**
 * Update Venue Status (mark as stale, archive, or reactivate)
 */
export async function updateVenueStatus(
  request: UpdateVenueStatusRequest
): Promise<UpdateVenueStatusResponse> {
  return apiClient.post<UpdateVenueStatusResponse>(API_ENDPOINTS.UPDATE_VENUE_STATUS, request);
}

/**
 * Mark venue as stale
 */
export async function markVenueStale(venueId: string): Promise<UpdateVenueStatusResponse> {
  return updateVenueStatus({ venueId, status: 'stale' });
}

/**
 * Archive a venue
 */
export async function archiveVenue(venueId: string): Promise<UpdateVenueStatusResponse> {
  return updateVenueStatus({ venueId, status: 'archived' });
}

/**
 * Reactivate a venue (mark as active)
 */
export async function reactivateVenue(venueId: string): Promise<UpdateVenueStatusResponse> {
  return updateVenueStatus({ venueId, status: 'active' });
}

/**
 * Get dishes for a venue
 */
export async function getVenueDishes(venueId: string): Promise<VenueDishesResponse> {
  return apiClient.get<VenueDishesResponse>(`${API_ENDPOINTS.VENUE_DISHES}?venueId=${venueId}`);
}
