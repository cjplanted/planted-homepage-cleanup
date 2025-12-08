import { onRequest, HttpsOptions } from 'firebase-functions/v2/https';
import type { Request, Response } from 'express';
import { initializeFirestore, changeLogs, scraperRuns, venues, dishes } from '@pad/database';
import { verifyAuth, requireAdmin, type AuthenticatedRequest } from '../../middleware/auth.js';

// Initialize Firestore
initializeFirestore();

const functionOptions: HttpsOptions = {
  region: 'europe-west6',
  cors: true,
  invoker: 'public', // Allow public access - auth middleware handles authentication
};

/**
 * Helper to wrap admin handlers with authentication
 * Verifies Firebase ID token and checks for admin custom claim
 */
async function withAdminAuth(
  req: Request,
  res: Response,
  handler: (req: AuthenticatedRequest, res: Response) => Promise<void>
): Promise<void> {
  // Create a mock next function for middleware compatibility
  let authPassed = false;
  const mockNext = () => { authPassed = true; };

  // Run auth verification
  await verifyAuth(req as AuthenticatedRequest, res, mockNext);
  if (!authPassed) return; // Response already sent by verifyAuth

  // Check admin claim
  authPassed = false;
  await requireAdmin(req as AuthenticatedRequest, res, mockNext);
  if (!authPassed) return; // Response already sent by requireAdmin

  // Auth passed, run the actual handler
  await handler(req as AuthenticatedRequest, res);
}

/**
 * GET /admin/flagged
 * Get data entries flagged for review (stale, inactive, needs verification)
 * Requires admin authentication
 */
export const adminFlaggedHandler = onRequest(functionOptions, async (req: Request, res: Response) => {
  await withAdminAuth(req, res, async (authReq, authRes) => {
    if (authReq.method !== 'GET') {
      authRes.status(405).json({ error: 'Method not allowed' });
      return;
    }

    try {
      const limit = Math.min(parseInt(authReq.query.limit as string, 10) || 50, 100);
      const daysSinceVerification = parseInt(authReq.query.days as string, 10) || 7;

      // Get stale venues (not verified in X days)
      const staleVenues = await venues.getStaleVenues(daysSinceVerification, limit);

      // Get stale dishes
      const staleDishes = await dishes.getStaleDishes(daysSinceVerification, limit);

      // Get pending venues (need review)
      const pendingVenues = await venues.query({
        status: 'pending',
        limit,
      });

      // Get pending dishes
      const pendingDishes = await dishes.query({
        status: 'pending',
        limit,
      });

      authRes.set('Cache-Control', 'private, max-age=60'); // 1 minute cache

      authRes.status(200).json({
        flagged: {
          stale_venues: staleVenues.map(v => ({
            id: v.id,
            name: v.name,
            last_verified: v.last_verified,
            days_stale: Math.floor((Date.now() - v.last_verified.getTime()) / (1000 * 60 * 60 * 24)),
          })),
          stale_dishes: staleDishes.map(d => ({
            id: d.id,
            name: d.name,
            venue_id: d.venue_id,
            last_verified: d.last_verified,
            days_stale: Math.floor((Date.now() - d.last_verified.getTime()) / (1000 * 60 * 60 * 24)),
          })),
          pending_venues: pendingVenues.map(v => ({
            id: v.id,
            name: v.name,
            created_at: v.created_at,
          })),
          pending_dishes: pendingDishes.map(d => ({
            id: d.id,
            name: d.name,
            venue_id: d.venue_id,
            created_at: d.created_at,
          })),
        },
        summary: {
          stale_venues_count: staleVenues.length,
          stale_dishes_count: staleDishes.length,
          pending_venues_count: pendingVenues.length,
          pending_dishes_count: pendingDishes.length,
          total_flagged: staleVenues.length + staleDishes.length + pendingVenues.length + pendingDishes.length,
        },
        parameters: {
          days_since_verification: daysSinceVerification,
          limit,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Admin flagged API error:', errorMessage);
      authRes.status(500).json({
        error: 'Internal server error',
        message: errorMessage,
      });
    }
  });
});

/**
 * GET /admin/changelog
 * Get recent change logs
 * Requires admin authentication
 */
export const adminChangelogHandler = onRequest(functionOptions, async (req: Request, res: Response) => {
  await withAdminAuth(req, res, async (authReq, authRes) => {
    if (authReq.method !== 'GET') {
      authRes.status(405).json({ error: 'Method not allowed' });
      return;
    }

    try {
      const limit = Math.min(parseInt(authReq.query.limit as string, 10) || 50, 100);
      const collection = authReq.query.collection as string | undefined;
      const documentId = authReq.query.document_id as string | undefined;

      let logs;

      if (documentId) {
        // Get history for specific document
        logs = await changeLogs.query({ documentId, limit });
      } else if (collection) {
        // Get changes for specific collection
        logs = await changeLogs.query({ collection, limit });
      } else {
        // Get recent changes across all collections
        logs = await changeLogs.getRecent(limit);
      }

      authRes.set('Cache-Control', 'private, max-age=30'); // 30 second cache

      authRes.status(200).json({
        logs,
        total: logs.length,
        filters: {
          collection: collection || null,
          document_id: documentId || null,
          limit,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Admin changelog API error:', errorMessage);
      authRes.status(500).json({
        error: 'Internal server error',
        message: errorMessage,
      });
    }
  });
});

/**
 * GET /admin/scraper-status
 * Get status of scraper runs
 * Requires admin authentication
 */
export const adminScraperStatusHandler = onRequest(functionOptions, async (req: Request, res: Response) => {
  await withAdminAuth(req, res, async (authReq, authRes) => {
    if (authReq.method !== 'GET') {
      authRes.status(405).json({ error: 'Method not allowed' });
      return;
    }

    try {
      const limit = Math.min(parseInt(authReq.query.limit as string, 10) || 20, 100);
      const scraperId = authReq.query.scraper_id as string | undefined;
      const status = authReq.query.status as 'running' | 'completed' | 'failed' | undefined;

      let runs;

      if (scraperId) {
        runs = await scraperRuns.query({ scraperId, limit });
      } else if (status) {
        runs = await scraperRuns.query({ status, limit });
      } else {
        runs = await scraperRuns.query({ limit });
      }

      // Get currently running scrapers
      const running = await scraperRuns.query({ status: 'running', limit: 10 });

      // Calculate summary stats
      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentRuns = runs.filter(r => r.started_at >= last24h);
      const successfulRuns = recentRuns.filter(r => r.status === 'completed');
      const failedRuns = recentRuns.filter(r => r.status === 'failed');

      authRes.set('Cache-Control', 'private, max-age=30'); // 30 second cache

      authRes.status(200).json({
        runs,
        currently_running: running,
        summary: {
          total_runs_24h: recentRuns.length,
          successful_24h: successfulRuns.length,
          failed_24h: failedRuns.length,
          success_rate_24h: recentRuns.length > 0
            ? Math.round((successfulRuns.length / recentRuns.length) * 100)
            : null,
        },
        filters: {
          scraper_id: scraperId || null,
          status: status || null,
          limit,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Admin scraper status API error:', errorMessage);
      authRes.status(500).json({
        error: 'Internal server error',
        message: errorMessage,
      });
    }
  });
});
