/**
 * Sync API
 *
 * API functions for the Sync to Website feature.
 */

import { get, post } from '@/lib/api/client';
import {
  SyncPreview,
  SyncRequest,
  SyncResult,
  SyncHistoryResponse,
  SyncStats,
} from '../types';

/**
 * Get sync preview (pending changes)
 */
export async function getSyncPreview(): Promise<SyncPreview> {
  return get<SyncPreview>('/admin/sync/preview');
}

/**
 * Execute sync
 */
export async function executeSync(request: SyncRequest): Promise<SyncResult> {
  return post<SyncResult>('/admin/sync/execute', request);
}

/**
 * Get sync history
 */
export async function getSyncHistory(page = 1, pageSize = 20): Promise<SyncHistoryResponse> {
  return get<SyncHistoryResponse>(`/admin/sync/history?page=${page}&pageSize=${pageSize}`);
}

/**
 * Get sync stats
 */
export async function getSyncStats(): Promise<SyncStats> {
  return get<SyncStats>('/admin/sync/stats');
}

/**
 * Cancel ongoing sync
 */
export async function cancelSync(syncId: string): Promise<void> {
  return post(`/admin/sync/${syncId}/cancel`);
}
