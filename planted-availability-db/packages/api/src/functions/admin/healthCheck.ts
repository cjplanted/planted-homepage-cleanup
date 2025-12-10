/**
 * Health Check Endpoint (NO AUTH REQUIRED)
 * GET /admin/health-check
 *
 * This endpoint is intentionally unauthenticated to allow:
 * - Testing API connectivity without login
 * - Monitoring tools to check system status
 * - Debugging deployment issues
 *
 * Returns comprehensive system health information.
 */

import { onRequest, HttpsOptions } from 'firebase-functions/v2/https';
import { initializeFirestore, venues, discoveredVenues } from '@pad/database';

// CORS configuration - allow all origins for health checks
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

const functionOptions: HttpsOptions = {
  region: 'europe-west6',
  maxInstances: 10,
  cors: true,
};

/**
 * Health Check Handler
 */
export const adminHealthCheckHandler = onRequest(
  functionOptions,
  async (req, res) => {
    // Set CORS headers for all responses
    Object.entries(corsHeaders).forEach(([key, value]) => {
      res.set(key, value);
    });

    // Handle OPTIONS preflight
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    // Only allow GET
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const startTime = Date.now();
    const checks: Record<string, { status: 'ok' | 'error'; message: string; latencyMs?: number }> = {};

    // Initialize Firestore
    try {
      initializeFirestore();
      checks.firestore_init = { status: 'ok', message: 'Firestore initialized' };
    } catch (error) {
      checks.firestore_init = { status: 'error', message: (error as Error).message };
    }

    // Test Firestore read (venues collection)
    const venueReadStart = Date.now();
    try {
      const venueCount = await venues.count();
      checks.firestore_read = {
        status: 'ok',
        message: `Read successful: ${venueCount} venues`,
        latencyMs: Date.now() - venueReadStart,
      };
    } catch (error) {
      checks.firestore_read = {
        status: 'error',
        message: (error as Error).message,
        latencyMs: Date.now() - venueReadStart,
      };
    }

    // Test discovered venues collection (for review queue)
    const discoveredReadStart = Date.now();
    try {
      const pendingCount = await discoveredVenues.countByStatus('pending_review');
      checks.discovered_venues = {
        status: 'ok',
        message: `${pendingCount} venues pending review`,
        latencyMs: Date.now() - discoveredReadStart,
      };
    } catch (error) {
      checks.discovered_venues = {
        status: 'error',
        message: (error as Error).message,
        latencyMs: Date.now() - discoveredReadStart,
      };
    }

    // List available endpoints
    const endpoints = [
      { path: '/admin/health-check', auth: false, description: 'Health check (this endpoint)' },
      { path: '/admin/review-queue', auth: true, description: 'Get venues for review' },
      { path: '/admin/approve-venue', auth: true, description: 'Approve a venue' },
      { path: '/admin/reject-venue', auth: true, description: 'Reject a venue' },
      { path: '/admin/partial-approve-venue', auth: true, description: 'Partially approve a venue' },
      { path: '/admin/bulk-approve', auth: true, description: 'Bulk approve venues' },
      { path: '/admin/bulk-reject', auth: true, description: 'Bulk reject venues' },
      { path: '/admin/scrapers/start-discovery', auth: true, description: 'Start discovery scraper' },
      { path: '/admin/scrapers/start-extraction', auth: true, description: 'Start extraction scraper' },
      { path: '/admin/scrapers/stream', auth: true, description: 'Stream scraper output (SSE)' },
      { path: '/admin/scrapers/cancel', auth: true, description: 'Cancel running scraper' },
      { path: '/admin/scrapers/available', auth: true, description: 'List available scrapers' },
      { path: '/admin/sync/preview', auth: true, description: 'Preview sync changes' },
      { path: '/admin/sync/execute', auth: true, description: 'Execute sync' },
      { path: '/admin/sync/history', auth: true, description: 'Get sync history' },
      { path: '/admin/analytics/kpis', auth: true, description: 'Get KPI metrics' },
      { path: '/admin/analytics/costs', auth: true, description: 'Get cost analytics' },
      { path: '/admin/analytics/rejections', auth: true, description: 'Get rejection analytics' },
      { path: '/admin/budget/status', auth: true, description: 'Get budget status' },
      { path: '/admin/feedback/submit', auth: true, description: 'Submit feedback' },
      { path: '/admin/feedback/process', auth: true, description: 'Process feedback batch' },
    ];

    // Calculate overall status
    const allChecks = Object.values(checks);
    const errorCount = allChecks.filter((c) => c.status === 'error').length;
    const overallStatus = errorCount === 0 ? 'healthy' : errorCount === allChecks.length ? 'unhealthy' : 'degraded';

    const totalLatency = Date.now() - startTime;

    res.status(200).json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'production',
      region: 'europe-west6',
      version: '2.0.0',
      latencyMs: totalLatency,
      checks,
      endpoints,
      authInfo: {
        note: 'All endpoints except health-check require Firebase Authentication',
        tokenHeader: 'Authorization: Bearer <firebase-id-token>',
      },
    });
  }
);
