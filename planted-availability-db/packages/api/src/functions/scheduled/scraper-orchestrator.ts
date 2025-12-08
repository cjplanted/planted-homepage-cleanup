import { onSchedule, ScheduledEvent } from 'firebase-functions/v2/scheduler';
import { onRequest, HttpsOptions } from 'firebase-functions/v2/https';
import type { Request, Response } from 'express';
import { initializeFirestore, scraperRuns, venues, dishes } from '@pad/database';

// Initialize Firestore
initializeFirestore();

const scheduledOptions = {
  region: 'europe-west6',
  timeoutSeconds: 540, // 9 minutes
  memory: '512MiB' as const,
};

const httpsOptions: HttpsOptions = {
  region: 'europe-west6',
  cors: true,
};

/**
 * Daily scraper orchestration - runs at 4 AM CET
 *
 * This function coordinates the daily scraping jobs:
 * 1. Identifies stale data that needs re-verification
 * 2. Queues scraper jobs for each source
 * 3. Monitors completion and logs results
 *
 * Note: For production use with actual scrapers (Wolt, Uber Eats, etc.),
 * you'll need to configure a proxy service (e.g., ScraperAPI) and
 * potentially run scrapers as separate Cloud Functions or Cloud Run jobs.
 */
export const dailyScraperOrchestrator = onSchedule(
  {
    ...scheduledOptions,
    schedule: '0 4 * * *', // 4 AM every day (CET)
    timeZone: 'Europe/Zurich',
  },
  async (_event: ScheduledEvent) => {
    console.log('Starting daily scraper orchestration...');

    try {
      // For now, we just log that the scheduled job ran
      // In production, this would:
      // 1. Query for stale venues/dishes (last_verified > 7 days ago)
      // 2. Create scraper jobs for each source
      // 3. Push jobs to Cloud Tasks queue
      // 4. Monitor and log results

      const summary = {
        timestamp: new Date().toISOString(),
        scrapers_triggered: 0,
        message: 'Orchestrator running - scrapers need proxy configuration for production use',
      };

      console.log('Daily scraper orchestration completed:', summary);
    } catch (error) {
      console.error('Daily scraper orchestration failed:', error);
      throw error;
    }
  }
);

/**
 * Manual trigger for scraper orchestration (for testing)
 * POST /api/admin/trigger-scrapers
 */
export const triggerScrapersManually = onRequest(httpsOptions, async (req: Request, res: Response) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // In production, add authentication check here
  // const authHeader = req.headers.authorization;
  // if (!isValidAuth(authHeader)) { res.status(401)... }

  try {
    console.log('Manual scraper trigger initiated');

    // Get scraper status
    const recentRuns = await scraperRuns.getRecent(10);

    const response = {
      success: true,
      message: 'Scraper orchestration triggered',
      timestamp: new Date().toISOString(),
      recent_runs: recentRuns.map(run => ({
        id: run.id,
        scraper_id: run.scraper_id,
        status: run.status,
        started_at: run.started_at,
        stats: run.stats,
      })),
      note: 'Production scrapers require proxy configuration (ScraperAPI or similar)',
    };

    res.status(200).json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Manual scraper trigger failed:', errorMessage);
    res.status(500).json({
      error: 'Internal server error',
      message: errorMessage,
    });
  }
});

// Freshness thresholds (in days) - per project scope
const STALE_THRESHOLD_DAYS = 7;     // Mark as stale after 7 days without verification
const ARCHIVE_THRESHOLD_DAYS = 14;  // Archive after 14 days without verification (scope: >14 days archived)
const BATCH_SIZE = 100;             // Process in batches to avoid timeout

/**
 * Hourly freshness check - marks stale data
 * Runs every hour to update data freshness status
 *
 * Rules (per project scope):
 * - Venues/dishes not verified in 7 days: mark as 'stale'
 * - Venues/dishes not verified in 14 days: mark as 'archived'
 */
export const hourlyFreshnessCheck = onSchedule(
  {
    ...scheduledOptions,
    schedule: '0 * * * *', // Every hour
    timeZone: 'Europe/Zurich',
  },
  async (_event: ScheduledEvent) => {
    console.log('Starting hourly freshness check...');

    const summary = {
      timestamp: new Date().toISOString(),
      venues_marked_stale: 0,
      venues_archived: 0,
      dishes_marked_stale: 0,
      dishes_archived: 0,
    };

    try {
      // 1. Get venues that should be marked as stale (active + not verified in 7 days)
      const staleVenues = await venues.getStaleVenues(STALE_THRESHOLD_DAYS, BATCH_SIZE);
      if (staleVenues.length > 0) {
        const staleVenueIds = staleVenues.map(v => v.id);
        summary.venues_marked_stale = await venues.markManyStale(staleVenueIds);
        console.log(`Marked ${summary.venues_marked_stale} venues as stale`);
      }

      // 2. Get venues that should be archived (stale/active + not verified in 30 days)
      const archiveVenues = await venues.getVenuesForArchival(ARCHIVE_THRESHOLD_DAYS, BATCH_SIZE);
      if (archiveVenues.length > 0) {
        const archiveVenueIds = archiveVenues.map(v => v.id);
        summary.venues_archived = await venues.archiveMany(archiveVenueIds);
        console.log(`Archived ${summary.venues_archived} venues`);
      }

      // 3. Get dishes that should be marked as stale
      const staleDishes = await dishes.getStaleDishes(STALE_THRESHOLD_DAYS, BATCH_SIZE);
      if (staleDishes.length > 0) {
        const staleDishIds = staleDishes.map(d => d.id);
        summary.dishes_marked_stale = await dishes.markManyStale(staleDishIds);
        console.log(`Marked ${summary.dishes_marked_stale} dishes as stale`);
      }

      // 4. Get dishes that should be archived
      const archiveDishes = await dishes.getDishesForArchival(ARCHIVE_THRESHOLD_DAYS, BATCH_SIZE);
      if (archiveDishes.length > 0) {
        const archiveDishIds = archiveDishes.map(d => d.id);
        summary.dishes_archived = await dishes.archiveMany(archiveDishIds);
        console.log(`Archived ${summary.dishes_archived} dishes`);
      }

      console.log('Hourly freshness check completed:', summary);
    } catch (error) {
      console.error('Hourly freshness check failed:', error);
      throw error;
    }
  }
);

/**
 * Get freshness dashboard stats
 * GET /api/admin/freshness-stats
 */
export const freshnessStatsHandler = onRequest(httpsOptions, async (req: Request, res: Response) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const [venueStats, dishStats, recentRuns] = await Promise.all([
      venues.getFreshnessStats(),
      dishes.getFreshnessStats(),
      scraperRuns.getRecent(20),
    ]);

    // Calculate scraper health
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentScraperRuns = recentRuns.filter(r => r.started_at >= last24h);
    const successfulRuns = recentScraperRuns.filter(r => r.status === 'completed');
    const failedRuns = recentScraperRuns.filter(r => r.status === 'failed');

    res.status(200).json({
      freshness: {
        venues: venueStats,
        dishes: dishStats,
      },
      scrapers: {
        runs_24h: recentScraperRuns.length,
        successful_24h: successfulRuns.length,
        failed_24h: failedRuns.length,
        success_rate_24h: recentScraperRuns.length > 0
          ? Math.round((successfulRuns.length / recentScraperRuns.length) * 100)
          : null,
        recent_runs: recentRuns.slice(0, 10).map(r => ({
          id: r.id,
          scraper_id: r.scraper_id,
          status: r.status,
          started_at: r.started_at,
          completed_at: r.completed_at,
          stats: r.stats,
        })),
      },
      thresholds: {
        stale_after_days: STALE_THRESHOLD_DAYS,
        archive_after_days: ARCHIVE_THRESHOLD_DAYS,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Freshness stats API error:', errorMessage);
    res.status(500).json({
      error: 'Internal server error',
      message: errorMessage,
    });
  }
});

/**
 * Get comprehensive scraper health dashboard
 * GET /api/admin/scraper-health
 *
 * Query params:
 * - days: number of days to look back (default: 7)
 */
export const scraperHealthHandler = onRequest(httpsOptions, async (req: Request, res: Response) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const daysBack = parseInt(req.query.days as string) || 7;

    const [allHealth, recentErrors, trends] = await Promise.all([
      scraperRuns.getAllScrapersHealth(daysBack),
      scraperRuns.getRecentErrors(20),
      scraperRuns.getRunTrends(14),
    ]);

    // Format the response
    const response = {
      summary: {
        status: allHealth.overall.critical > 0 ? 'critical' :
                allHealth.overall.warning > 0 ? 'warning' : 'healthy',
        ...allHealth.overall,
        period_days: daysBack,
      },
      scrapers: allHealth.scrapers.map(s => ({
        id: s.id,
        status: s.status,
        success_rate: Math.round(s.health.successRate * 100),
        total_runs: s.health.totalRuns,
        successful_runs: s.health.successfulRuns,
        failed_runs: s.health.failedRuns,
        partial_runs: s.health.partialRuns,
        avg_venues_checked: Math.round(s.health.avgVenuesChecked),
        avg_dishes_found: Math.round(s.health.avgDishesFound),
        last_run: s.health.lastRun ? {
          id: s.health.lastRun.id,
          status: s.health.lastRun.status,
          started_at: s.health.lastRun.started_at,
          stats: s.health.lastRun.stats,
        } : null,
        alerts: s.alerts,
      })),
      recent_errors: recentErrors.map(e => ({
        scraper_id: e.scraper_id,
        run_id: e.run_id,
        started_at: e.started_at,
        error_count: e.errors.length,
        errors: e.errors.slice(0, 5).map(err => ({
          code: err.code,
          message: err.message,
          venue_id: err.venue_id,
        })),
      })),
      trends: trends,
      alerts: allHealth.scrapers
        .filter(s => s.alerts.length > 0)
        .flatMap(s => s.alerts.map(alert => ({
          scraper_id: s.id,
          severity: s.status,
          message: alert,
        }))),
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Scraper health API error:', errorMessage);
    res.status(500).json({
      error: 'Internal server error',
      message: errorMessage,
    });
  }
});

/**
 * Get health status for a specific scraper
 * GET /api/admin/scraper-health/:scraperId
 */
export const scraperHealthByIdHandler = onRequest(httpsOptions, async (req: Request, res: Response) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Extract scraper ID from path
    const pathParts = req.path.split('/');
    const scraperId = pathParts[pathParts.length - 1];

    if (!scraperId || scraperId === 'scraper-health') {
      res.status(400).json({ error: 'Scraper ID is required' });
      return;
    }

    const daysBack = parseInt(req.query.days as string) || 7;

    const [health, recentRuns] = await Promise.all([
      scraperRuns.getScraperHealth(scraperId, daysBack),
      scraperRuns.query({ scraperId, limit: 50 }),
    ]);

    // Calculate status
    let status: 'healthy' | 'warning' | 'critical' | 'inactive' = 'healthy';
    const alerts: string[] = [];

    if (health.totalRuns === 0) {
      status = 'inactive';
      alerts.push(`No runs in the last ${daysBack} days`);
    } else if (health.successRate < 0.5) {
      status = 'critical';
      alerts.push('Success rate below 50%');
    } else if (health.successRate < 0.8) {
      status = 'warning';
      alerts.push('Success rate below 80%');
    }

    if (health.lastRun) {
      const daysSinceLastRun = (Date.now() - health.lastRun.started_at.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceLastRun > 2 && status !== 'inactive') {
        if (status === 'healthy') status = 'warning';
        alerts.push(`Last run was ${Math.round(daysSinceLastRun)} days ago`);
      }
    }

    res.status(200).json({
      scraper_id: scraperId,
      status,
      period_days: daysBack,
      success_rate: Math.round(health.successRate * 100),
      total_runs: health.totalRuns,
      successful_runs: health.successfulRuns,
      failed_runs: health.failedRuns,
      partial_runs: health.partialRuns,
      avg_venues_checked: Math.round(health.avgVenuesChecked),
      avg_dishes_found: Math.round(health.avgDishesFound),
      last_run: health.lastRun ? {
        id: health.lastRun.id,
        status: health.lastRun.status,
        started_at: health.lastRun.started_at,
        completed_at: health.lastRun.completed_at,
        stats: health.lastRun.stats,
        errors: health.lastRun.errors,
      } : null,
      alerts,
      recent_runs: recentRuns.slice(0, 20).map(r => ({
        id: r.id,
        status: r.status,
        started_at: r.started_at,
        completed_at: r.completed_at,
        stats: r.stats,
        error_count: r.errors?.length || 0,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Scraper health by ID API error:', errorMessage);
    res.status(500).json({
      error: 'Internal server error',
      message: errorMessage,
    });
  }
});
