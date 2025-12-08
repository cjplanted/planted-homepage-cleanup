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
  adminFlaggedHandler as adminFlagged,
  adminChangelogHandler as adminChangelog,
  adminScraperStatusHandler as adminScraperStatus,
  adminPartnersHandler as adminPartners,
  adminBatchesHandler as adminBatches,
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
