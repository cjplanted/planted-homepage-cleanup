/**
 * API Endpoint Configuration
 *
 * Firebase Cloud Functions use flat function names, not REST-style paths.
 * The base URL is the Cloud Functions region URL.
 */

// Get API base URL from environment or use default
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/get-planted-db/europe-west6';

/**
 * API Endpoints
 *
 * These map to the exported function names in packages/api/src/index.ts
 * Firebase Cloud Functions URL format: {BASE_URL}/{functionName}
 */
export const API_ENDPOINTS = {
  // Health & Status (no auth)
  HEALTH_CHECK: '/adminHealthCheck',

  // Dashboard / Stats
  PLATFORM_HEALTH: '/adminPlatformHealth',

  // Scrapers
  SCRAPERS_AVAILABLE: '/adminAvailableScrapers',
  SCRAPERS_START_DISCOVERY: '/adminStartDiscovery',
  SCRAPERS_START_EXTRACTION: '/adminStartExtraction',
  SCRAPERS_STREAM: '/adminScraperStream',
  SCRAPERS_CANCEL: '/adminCancelScraper',

  // Budget
  BUDGET_STATUS: '/adminBudgetStatus',

  // Review Queue
  REVIEW_QUEUE: '/adminReviewQueue',
  APPROVE_VENUE: '/adminApproveVenue',
  PARTIAL_APPROVE_VENUE: '/adminPartialApproveVenue',
  REJECT_VENUE: '/adminRejectVenue',
  BULK_APPROVE: '/adminBulkApprove',
  BULK_REJECT: '/adminBulkReject',

  // Sync
  SYNC_PREVIEW: '/adminSyncPreview',
  SYNC_EXECUTE: '/adminSyncExecute',
  SYNC_HISTORY: '/adminSyncHistory',

  // Analytics
  ANALYTICS_KPIS: '/adminAnalyticsKpis',
  ANALYTICS_COSTS: '/adminAnalyticsCosts',
  ANALYTICS_REJECTIONS: '/adminAnalyticsRejections',

  // Feedback
  FEEDBACK_SUBMIT: '/adminFeedbackSubmit',
  FEEDBACK_PROCESS: '/adminFeedbackProcess',

  // Legacy (from original exports)
  VENUES: '/adminVenues',
  DISHES: '/adminDishes',
  DISCOVERED_VENUES: '/adminDiscoveredVenues',

  // Chain management
  ASSIGN_CHAIN: '/adminAssignChain',
  LIST_CHAINS: '/adminChains',
} as const;

/**
 * Helper function to build full API URL
 */
export function buildApiUrl(endpoint: string): string {
  // If endpoint already starts with /, just append to base URL
  // Otherwise, add a / prefix
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE_URL}${path}`;
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
