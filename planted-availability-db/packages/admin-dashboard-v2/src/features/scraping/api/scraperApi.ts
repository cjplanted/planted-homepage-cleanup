/**
 * Scraper API Client
 *
 * Typed functions for all scraper endpoints with SSE support.
 */

import { apiClient } from '@/lib/api/client';
import { API_BASE_URL } from '@/lib/api/endpoints';
import { auth } from '@/lib/firebase';
import type {
  DiscoveryConfig,
  ExtractionConfig,
  StartScraperResponse,
  CancelScraperResponse,
  AvailableScrapersResponse,
  BudgetStatus,
  ScraperProgress,
  RecentRunsResponse,
  ScraperType,
  ScraperStatus,
} from '../types';

/**
 * Start Discovery Scraper
 */
export async function startDiscovery(
  config: DiscoveryConfig
): Promise<StartScraperResponse> {
  return apiClient.post('/admin/scrapers/discovery/start', config);
}

/**
 * Start Extraction Scraper
 */
export async function startExtraction(
  config: ExtractionConfig
): Promise<StartScraperResponse> {
  return apiClient.post('/admin/scrapers/extraction/start', config);
}

/**
 * Cancel Scraper Run
 */
export async function cancelScraperRun(
  runId: string
): Promise<CancelScraperResponse> {
  return apiClient.post(`/admin/scrapers/runs/${runId}/cancel`);
}

/**
 * Get Available Scrapers
 */
export async function getAvailableScrapers(): Promise<AvailableScrapersResponse> {
  return apiClient.get('/admin/scrapers/available');
}

/**
 * Get Recent Scraper Runs
 * Uses /admin/scrapers/available endpoint which includes recentRuns
 */
export async function getRecentRuns(limit = 10): Promise<RecentRunsResponse> {
  // Use /admin/scrapers/available which already includes recentRuns
  const response = await apiClient.get<{
    recentRuns?: Array<{
      id: string;
      scraperId: string;
      status: string;
      startedAt: string;
      completedAt?: string;
      progress?: { current: number; total: number; percentage: number };
      stats?: { venues_checked: number; venues_updated: number; dishes_found: number; dishes_updated: number; errors: number };
      costs?: { searchQueries: number; aiCalls: number; estimated: number };
      config?: Record<string, unknown>;
    }>;
  }>('/admin/scrapers/available');

  // Transform to expected format
  const runs: ScraperProgress[] = (response.recentRuns || []).slice(0, limit).map(run => ({
    runId: run.id,
    type: (run.scraperId?.includes('discovery') ? 'discovery' : 'extraction') as ScraperType,
    status: run.status as ScraperStatus,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    progress: run.progress || { current: 0, total: 0, percentage: 0 },
    stats: {
      found: run.stats?.venues_checked || 0,
      processed: run.stats?.venues_updated || 0,
      errors: run.stats?.errors || 0,
    },
    cost: {
      search: run.costs?.searchQueries || 0,
      ai: run.costs?.aiCalls || 0,
      total: run.costs?.estimated || 0,
    },
    logs: [],
  }));

  return { runs, total: runs.length };
}

/**
 * Get Budget Status
 */
export async function getBudgetStatus(): Promise<BudgetStatus> {
  return apiClient.get('/admin/budget/status');
}

/**
 * Create SSE Event Source for Scraper Progress
 *
 * Returns an EventSource that streams progress updates for a running scraper.
 * The caller is responsible for closing the EventSource when done.
 */
export async function createScraperProgressStream(
  runId: string
): Promise<EventSource> {
  // Get auth token
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Not authenticated');
  }
  const token = await user.getIdToken();

  // Create EventSource with auth token
  // Note: EventSource doesn't support custom headers directly, so we pass token as query param
  const url = `${API_BASE_URL}/admin/scrapers/runs/${runId}/stream?token=${encodeURIComponent(token)}`;

  const eventSource = new EventSource(url, {
    withCredentials: true,
  });

  return eventSource;
}

/**
 * Helper to parse SSE message data
 */
export function parseProgressEvent(data: string): ScraperProgress {
  return JSON.parse(data);
}

/**
 * Setup SSE Event Handlers
 */
export interface SSEHandlers {
  onProgress?: (progress: ScraperProgress) => void;
  onComplete?: (progress: ScraperProgress) => void;
  onError?: (error: Error) => void;
  onClose?: () => void;
}

export function setupProgressEventHandlers(
  eventSource: EventSource,
  handlers: SSEHandlers
): void {
  // Handle progress messages
  eventSource.onmessage = (event) => {
    try {
      const progress = parseProgressEvent(event.data);

      if (handlers.onProgress) {
        handlers.onProgress(progress);
      }

      // Auto-detect completion
      if (
        progress.status === 'completed' ||
        progress.status === 'failed' ||
        progress.status === 'cancelled'
      ) {
        if (handlers.onComplete) {
          handlers.onComplete(progress);
        }
        eventSource.close();
      }
    } catch (error) {
      if (handlers.onError) {
        handlers.onError(
          error instanceof Error ? error : new Error('Failed to parse progress event')
        );
      }
    }
  };

  // Handle errors
  eventSource.onerror = () => {
    const error = new Error('SSE connection error');
    if (handlers.onError) {
      handlers.onError(error);
    }
    eventSource.close();
    if (handlers.onClose) {
      handlers.onClose();
    }
  };
}
