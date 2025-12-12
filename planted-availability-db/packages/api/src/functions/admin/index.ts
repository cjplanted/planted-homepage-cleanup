export {
  adminVenuesHandler,
  adminDishesHandler,
  adminPromotionsHandler,
  adminChainsHandler,
  adminAssignChainHandler,
  adminAutoAssignChainsHandler,
} from './crud.js';

export {
  adminFlaggedHandler,
  adminChangelogHandler,
  adminScraperStatusHandler,
} from './status.js';

export { adminPartnersHandler, adminBatchesHandler } from './partners.js';

export { adminDiscoveredVenuesHandler } from './discovery-review.js';

export { adminFeedbackHandler } from './feedback.js';

export { adminMetricsHandler } from './metrics.js';

export {
  adminPlatformHealthHandler,
  adminCircuitBreakersHandler,
} from './platformHealth.js';

export { adminScrapersHandler } from './scrapers.js';

export { adminSyncHandler } from './sync.js';

// Sync APIs (new modular structure)
export {
  adminSyncPreviewHandler,
  adminSyncExecuteHandler,
  adminSyncHistoryHandler,
} from './sync/index.js';

// Analytics APIs
export {
  adminAnalyticsKpisHandler,
  adminAnalyticsCostsHandler,
  adminAnalyticsRejectionsHandler,
  adminStrategyStatsHandler,
} from './analytics/index.js';

export {
  adminReviewQueueHandler,
  adminApproveVenueHandler,
  adminPartialApproveVenueHandler,
  adminRejectVenueHandler,
  adminBulkApproveHandler,
  adminBulkRejectHandler,
  adminFlagVenueHandler,
  adminClearVenueFlagHandler,
  adminFlaggedVenuesHandler,
  adminUpdateVenueCountryHandler,
  adminUpdateVenueAddressHandler,
  adminUpdateDishStatusHandler,
} from './review/index.js';

export {
  adminFeedbackSubmitHandler,
  adminFeedbackProcessHandler,
} from './feedback/index.js';

// New scraper control endpoints
export {
  adminStartDiscoveryHandler,
  adminStartExtractionHandler,
  adminScraperStreamHandler,
  adminCancelScraperHandler,
  adminAvailableScrapersHandler,
} from './scrapers/index.js';

// Budget monitoring endpoints
export { adminBudgetStatusHandler } from './budget/index.js';

// Health check (no auth required - for testing/monitoring)
export { adminHealthCheckHandler } from './healthCheck.js';

// Live venues browser endpoints
export {
  adminLiveVenuesHandler,
  adminUpdateVenueStatusHandler,
  adminVenueDishesHandler,
  adminFindDuplicateVenuesHandler,
  adminDeleteDuplicateVenuesHandler,
} from './live-venues/index.js';
