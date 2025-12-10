/**
 * POST /admin/scrapers/runs/:runId/cancel
 * Cancel a running scraper
 * Requires admin authentication
 */

import { initializeFirestore, scraperRuns } from '@pad/database';
import { createAdminHandler } from '../../../middleware/adminHandler.js';

// Initialize Firestore
initializeFirestore();

/**
 * Handler for POST /admin/scrapers/runs/:runId/cancel
 */
export const adminCancelScraperHandler = createAdminHandler(
  async (req, res) => {
    const runId = req.params.runId || (req.path.split('/').slice(-2)[0] as string);

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

    // Check if already in terminal state
    if (['completed', 'failed', 'cancelled'].includes(run.status)) {
      res.status(400).json({
        error: 'Invalid state',
        message: `Cannot cancel scraper run with status: ${run.status}`,
        currentStatus: run.status,
      });
      return;
    }

    // Get user ID from auth token
    const userId = req.user?.uid || 'unknown';
    const userEmail = req.user?.email || 'unknown';

    // Cancel the run
    await scraperRuns.cancel(runId, userEmail);

    // Add log entry
    await scraperRuns.addLog(
      runId,
      'warn',
      `Scraper run cancelled by ${userEmail} (${userId})`
    );

    res.status(200).json({
      success: true,
      message: 'Scraper run cancelled successfully',
      runId,
      cancelledBy: userEmail,
      cancelledAt: new Date(),
    });
  },
  { allowedMethods: ['POST'] }
);
