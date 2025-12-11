// Main entry point for Cloud Functions

// Public API endpoints
export {
  nearbyHandler as nearby,
  venueDetailHandler as venueDetail,
  venuesListHandler as venues,
  dishesHandler as dishes,
  dishDetailHandler as dishDetail,
  deliveryCheckHandler as deliveryCheck,
  geolocateHandler as geolocate,
} from './functions/public/index.js';

// Admin API endpoints
export {
  adminVenuesHandler as adminVenues,
  adminDishesHandler as adminDishes,
  adminPromotionsHandler as adminPromotions,
  adminChainsHandler as adminChains,
  adminAssignChainHandler as adminAssignChain,
  adminAutoAssignChainsHandler as adminAutoAssignChains,
  adminFlaggedHandler as adminFlagged,
  adminChangelogHandler as adminChangelog,
  adminScraperStatusHandler as adminScraperStatus,
  adminPartnersHandler as adminPartners,
  adminBatchesHandler as adminBatches,
  adminDiscoveredVenuesHandler as adminDiscoveredVenues,
  adminFeedbackHandler as adminFeedback,
  adminMetricsHandler as adminMetrics,
  adminPlatformHealthHandler as adminPlatformHealth,
  adminCircuitBreakersHandler as adminCircuitBreakers,
  adminScrapersHandler as adminScrapers,
  adminSyncHandler as adminSync,
  // Health check (no auth - for testing)
  adminHealthCheckHandler as adminHealthCheck,
  // Review workflow endpoints
  adminReviewQueueHandler as adminReviewQueue,
  adminApproveVenueHandler as adminApproveVenue,
  adminPartialApproveVenueHandler as adminPartialApproveVenue,
  adminRejectVenueHandler as adminRejectVenue,
  adminBulkApproveHandler as adminBulkApprove,
  adminBulkRejectHandler as adminBulkReject,
  // Flag endpoints
  adminFlagVenueHandler as adminFlagVenue,
  adminClearVenueFlagHandler as adminClearVenueFlag,
  adminFlaggedVenuesHandler as adminFlaggedVenues,
  // Venue edit endpoints
  adminUpdateVenueCountryHandler as adminUpdateVenueCountry,
  adminUpdateVenueAddressHandler as adminUpdateVenueAddress,
  // Dish status endpoint
  adminUpdateDishStatusHandler as adminUpdateDishStatus,
  // Feedback endpoints
  adminFeedbackSubmitHandler as adminFeedbackSubmit,
  adminFeedbackProcessHandler as adminFeedbackProcess,
  // Scraper control endpoints
  adminStartDiscoveryHandler as adminStartDiscovery,
  adminStartExtractionHandler as adminStartExtraction,
  adminScraperStreamHandler as adminScraperStream,
  adminCancelScraperHandler as adminCancelScraper,
  adminAvailableScrapersHandler as adminAvailableScrapers,
  // Sync endpoints
  adminSyncPreviewHandler as adminSyncPreview,
  adminSyncExecuteHandler as adminSyncExecute,
  adminSyncHistoryHandler as adminSyncHistory,
  // Analytics endpoints
  adminAnalyticsKpisHandler as adminAnalyticsKpis,
  adminAnalyticsCostsHandler as adminAnalyticsCosts,
  adminAnalyticsRejectionsHandler as adminAnalyticsRejections,
  adminStrategyStatsHandler as adminStrategyStats,
  // Budget endpoints
  adminBudgetStatusHandler as adminBudgetStatus,
  // Live venues browser endpoints
  adminLiveVenuesHandler as adminLiveVenues,
  adminUpdateVenueStatusHandler as adminUpdateVenueStatus,
  adminVenueDishesHandler as adminVenueDishes,
} from './functions/admin/index.js';

// Partner API endpoints
export {
  partnerWebhookHandler as partnerWebhook,
  partnerStatusHandler as partnerStatus,
  partnerBatchStatusHandler as partnerBatchStatus,
} from './functions/partner/index.js';

// Webhook endpoints (legacy - kept for backwards compatibility)
export {
  partnerWebhookHandler as webhookPartner,
  emailWebhookHandler as webhookEmail,
  webhookStagingHandler as webhookStaging,
  approveWebhookItemHandler as webhookApprove,
  rejectWebhookItemHandler as webhookReject,
} from './functions/webhooks/index.js';

// Scheduled functions
export {
  dailyScraperOrchestrator,
  triggerScrapersManually,
  hourlyFreshnessCheck,
  freshnessStatsHandler as freshnessStats,
  scraperHealthHandler as scraperHealth,
  scraperHealthByIdHandler as scraperHealthById,
} from './functions/scheduled/scraper-orchestrator.js';
