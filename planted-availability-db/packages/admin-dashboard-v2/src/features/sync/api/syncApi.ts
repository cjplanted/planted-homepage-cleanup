/**
 * Sync API
 *
 * API functions for the Sync to Website feature.
 */

import { get, post } from '@/lib/api/client';
import { API_ENDPOINTS } from '@/lib/api/endpoints';
import {
  SyncPreview,
  SyncRequest,
  SyncResult,
  SyncHistoryResponse,
  SyncStats,
  SyncItem,
  SyncChangeType,
} from '../types';

/**
 * Backend Sync Preview Response Structure
 * The backend returns a nested structure that needs to be transformed
 * into the flat SyncPreview structure expected by the frontend.
 */
interface BackendSyncPreview {
  additions: { venues: BackendVenue[]; dishes: BackendDish[] };
  updates: { venues: BackendVenue[]; dishes: BackendDish[] };
  removals: { venues: BackendVenue[]; dishes: BackendDish[] };
  staleVenues?: BackendVenue[];
  stats: {
    total: number;
    additions: number;
    updates: number;
    removals: number;
  };
}

interface BackendVenue {
  id: string;
  name: string;
  dishes?: unknown[];
  diff?: unknown;
  dishDiffs?: unknown[];
  priority?: number;
  createdAt?: string;
}

interface BackendDish {
  id: string;
  name: string;
  venueId?: string;
  venueName?: string;
  diff?: unknown;
  priority?: number;
  createdAt?: string;
}

/**
 * Transform backend venue data to SyncItem
 */
function transformVenue(venue: BackendVenue, changeType: SyncChangeType): SyncItem {
  return {
    id: venue.id,
    type: 'venue' as const,
    changeType,
    venueId: venue.id,
    venueName: venue.name || 'Unknown Venue',
    data: venue,
    diff: venue.diff as SyncItem['diff'],
    dishDiffs: venue.dishDiffs as SyncItem['dishDiffs'],
    dishCount: venue.dishes?.length || 0,
    priority: venue.priority || 0,
    createdAt: venue.createdAt || new Date().toISOString(),
  };
}

/**
 * Transform backend dish data to SyncItem
 */
function transformDish(dish: BackendDish, changeType: SyncChangeType): SyncItem {
  return {
    id: dish.id,
    type: 'dish' as const,
    changeType,
    venueId: dish.venueId || '',
    venueName: dish.venueName || 'Unknown Venue',
    dishId: dish.id,
    dishName: dish.name || 'Unknown Dish',
    data: dish,
    diff: dish.diff as SyncItem['diff'],
    priority: dish.priority || 0,
    createdAt: dish.createdAt || new Date().toISOString(),
  };
}

/**
 * Get sync preview (pending changes)
 */
export async function getSyncPreview(): Promise<SyncPreview> {
  const response = await get<BackendSyncPreview>(API_ENDPOINTS.SYNC_PREVIEW);

  // Transform backend nested structure to frontend flat arrays
  return {
    additions: [
      ...response.additions.venues.map(v => transformVenue(v, 'addition')),
      ...response.additions.dishes.map(d => transformDish(d, 'addition')),
    ],
    updates: [
      ...response.updates.venues.map(v => transformVenue(v, 'update')),
      ...response.updates.dishes.map(d => transformDish(d, 'update')),
    ],
    removals: [
      ...response.removals.venues.map(v => transformVenue(v, 'removal')),
      ...response.removals.dishes.map(d => transformDish(d, 'removal')),
    ],
    totalChanges: response.stats.total,
    estimatedDuration: Math.ceil(response.stats.total / 10), // ~10 items/sec
    lastSync: undefined, // Will come from history endpoint
  };
}

/**
 * Execute sync
 */
export async function executeSync(request: SyncRequest): Promise<SyncResult> {
  return post<SyncResult>(API_ENDPOINTS.SYNC_EXECUTE, request);
}

/**
 * Get sync history
 */
export async function getSyncHistory(page = 1, pageSize = 20): Promise<SyncHistoryResponse> {
  return get<SyncHistoryResponse>(`${API_ENDPOINTS.SYNC_HISTORY}?page=${page}&pageSize=${pageSize}`);
}

/**
 * Get sync stats
 * Note: Stats are derived from the preview response
 */
export async function getSyncStats(): Promise<SyncStats> {
  const response = await get<BackendSyncPreview>(API_ENDPOINTS.SYNC_PREVIEW);
  return {
    lastSync: undefined, // Not available from preview
    pendingChanges: response.stats.total || 0,
    totalSyncs: 0, // Not available from preview
    successRate: 100, // Not available from preview
    averageDuration: Math.ceil(response.stats.total / 10), // ~10 items/sec
  };
}

/**
 * Cancel ongoing sync
 * Note: This may not be available - depends on implementation
 */
export async function cancelSync(syncId: string): Promise<void> {
  // This endpoint may not exist - keeping for interface compatibility
  return post(`${API_ENDPOINTS.SYNC_EXECUTE}`, { action: 'cancel', syncId });
}
