/**
 * GET /admin/scrapers/runs/:runId/stream
 * Stream scraper run progress via Server-Sent Events
 * Requires admin authentication
 */

import { initializeFirestore, scraperRuns } from '@pad/database';
import { createAdminSSEHandler } from '../../../middleware/adminHandler.js';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firestore
initializeFirestore();

/**
 * Handler for GET /admin/scrapers/runs/:runId/stream
 */
export const adminScraperStreamHandler = createAdminSSEHandler(
  async (req, res) => {
    const runId = req.params.runId || (req.path.split('/').pop() as string);

    if (!runId) {
      res.status(400).json({
        error: 'Invalid request',
        message: 'runId is required',
      });
      return;
    }

    // Verify run exists
    const run = await scraperRuns.getById(runId);
    if (!run) {
      res.status(404).json({
        error: 'Not found',
        message: `Scraper run ${runId} not found`,
      });
      return;
    }

    // SSE headers are already set by createAdminSSEHandler
    // Add nginx buffering disable
    res.setHeader('X-Accel-Buffering', 'no');

    // Send initial event
    const sendEvent = (eventType: string, data: any) => {
      res.write(`event: ${eventType}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Send initial run data
    sendEvent('init', {
      runId: run.id,
      scraperId: run.scraper_id,
      status: run.status,
      startedAt: run.started_at,
      config: run.config,
    });

    // Set up Firestore listener
    const db = getFirestore();
    const unsubscribe = db
      .collection('scraper_runs')
      .doc(runId)
      .onSnapshot(
        (snapshot) => {
          if (!snapshot.exists) {
            sendEvent('error', { message: 'Run deleted' });
            res.end();
            return;
          }

          const data = snapshot.data()!;
          const status = data.status;

          // Convert Firestore timestamps to dates for serialization
          const eventData: any = {
            status,
            progress: data.progress || { current: 0, total: 0, percentage: 0 },
            results: {
              found: data.stats?.venues_checked || 0,
              processed: data.stats?.venues_updated || 0,
              errors: data.stats?.errors || 0,
            },
            costs: data.costs || { searchQueries: 0, aiCalls: 0, estimated: 0 },
          };

          // Add logs if present (last 10)
          if (data.logs && data.logs.length > 0) {
            eventData.logs = data.logs.slice(-10).map((log: any) => ({
              timestamp: log.timestamp?.toDate?.() || new Date(),
              level: log.level,
              message: log.message,
            }));
          }

          // Calculate ETA if we have progress
          if (data.progress && data.progress.total > 0 && data.progress.current > 0) {
            const startedAt = data.started_at?.toDate?.() || new Date();
            const elapsed = Date.now() - startedAt.getTime();
            const rate = data.progress.current / elapsed;
            const remaining = data.progress.total - data.progress.current;
            const etaMs = remaining / rate;
            eventData.eta = new Date(Date.now() + etaMs);
          }

          sendEvent('update', eventData);

          // Close connection if terminal status
          if (['completed', 'failed', 'cancelled'].includes(status)) {
            sendEvent('done', {
              status,
              completedAt: data.completed_at?.toDate?.() || new Date(),
              stats: data.stats,
              errors: data.errors || [],
            });

            unsubscribe();
            res.end();
          }
        },
        (error) => {
          console.error('Firestore snapshot error:', error);
          sendEvent('error', { message: error.message });
          unsubscribe();
          res.end();
        }
      );

    // Clean up on client disconnect
    req.on('close', () => {
      unsubscribe();
      res.end();
    });

    // Send heartbeat every 15 seconds
    const heartbeatInterval = setInterval(() => {
      sendEvent('heartbeat', { timestamp: new Date() });
    }, 15000);

    // Clean up heartbeat on response end
    res.on('finish', () => {
      clearInterval(heartbeatInterval);
    });
  },
  { allowedMethods: ['GET'] }
);
