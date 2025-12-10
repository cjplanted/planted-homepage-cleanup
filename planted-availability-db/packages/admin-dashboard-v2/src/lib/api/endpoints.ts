/**
 * API Endpoint Configuration
 *
 * Centralized configuration for all API endpoints.
 * Base URL is configured via VITE_API_URL environment variable.
 */

// Get API base URL from environment or use default
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * API Endpoints
 */
export const API_ENDPOINTS = {
  // Health & Status
  HEALTH: '/admin/health',

  // Dashboard
  DASHBOARD_STATS: '/admin/dashboard/stats',

  // Scrape Control (Legacy)
  SCRAPE_STATUS: '/admin/scrape/status',
  SCRAPE_START: '/admin/scrape/start',
  SCRAPE_STOP: '/admin/scrape/stop',
  SCRAPE_LOGS: '/admin/scrape/logs',

  // Scrapers (New)
  SCRAPERS_DISCOVERY_START: '/admin/scrapers/discovery/start',
  SCRAPERS_EXTRACTION_START: '/admin/scrapers/extraction/start',
  SCRAPERS_RUN_STREAM: (runId: string) => `/admin/scrapers/runs/${runId}/stream`,
  SCRAPERS_RUN_CANCEL: (runId: string) => `/admin/scrapers/runs/${runId}/cancel`,
  SCRAPERS_AVAILABLE: '/admin/scrapers/available',
  // Note: Recent runs are included in SCRAPERS_AVAILABLE response
  BUDGET_STATUS: '/admin/budget/status',

  // Review Queue
  REVIEW_QUEUE: '/admin/review/queue',
  REVIEW_APPROVE: '/admin/review/approve',
  REVIEW_REJECT: '/admin/review/reject',
  REVIEW_BULK: '/admin/review/bulk',

  // Sync to Website
  SYNC_STATUS: '/admin/sync/status',
  SYNC_START: '/admin/sync/start',
  SYNC_HISTORY: '/admin/sync/history',

  // Venue Browser
  VENUES: '/admin/venues',
  VENUE_BY_ID: (id: string) => `/admin/venues/${id}`,
  VENUE_UPDATE: (id: string) => `/admin/venues/${id}`,
  VENUE_DELETE: (id: string) => `/admin/venues/${id}`,

  // Live on Website
  LIVE_VENUES: '/admin/live-venues',

  // Cost Monitor
  COST_STATS: '/admin/costs/stats',
  COST_HISTORY: '/admin/costs/history',
  COST_BREAKDOWN: '/admin/costs/breakdown',
} as const;

/**
 * Helper function to build full API URL
 */
export function buildApiUrl(endpoint: string): string {
  return `${API_BASE_URL}${endpoint}`;
}

/**
 * API Response Types
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
