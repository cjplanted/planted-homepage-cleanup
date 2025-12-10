/**
 * POST /admin/scrapers/discovery/start
 * Start a discovery scraper run
 * Requires admin authentication
 */

import { initializeFirestore, scraperRuns } from '@pad/database';
import { createAdminHandler } from '../../../middleware/adminHandler.js';
import { shouldThrottle, estimateScraperCost } from '../../../services/budgetThrottle.js';
import { z } from 'zod';
import { spawn } from 'child_process';
import * as path from 'path';

// Initialize Firestore
initializeFirestore();

// Validation schema
const startDiscoverySchema = z.object({
  countries: z.array(z.string()).min(1, 'At least one country required'),
  platforms: z.array(z.string()).optional(),
  mode: z.enum(['explore', 'enumerate', 'verify']),
  chainId: z.string().optional(),
  maxQueries: z.number().int().positive().optional().default(50),
  dryRun: z.boolean().optional().default(false),
});

type StartDiscoveryRequest = z.infer<typeof startDiscoverySchema>;

/**
 * Handler for POST /admin/scrapers/discovery/start
 */
export const adminStartDiscoveryHandler = createAdminHandler(
  async (req, res) => {
    // Validate request body
    const validation = startDiscoverySchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Invalid request',
        details: validation.error.issues,
      });
      return;
    }

    const body: StartDiscoveryRequest = validation.data;

    // Validate mode-specific requirements
    if (body.mode === 'enumerate' && !body.chainId) {
      res.status(400).json({
        error: 'Invalid request',
        message: 'chainId is required for enumerate mode',
      });
      return;
    }

    // Estimate costs
    const estimatedSearchQueries = body.maxQueries;
    const estimatedAICalls = body.maxQueries * 2; // Rough estimate: 2 AI calls per search query
    const estimatedCost = estimateScraperCost(estimatedSearchQueries, estimatedAICalls, true);

    // Check budget throttle
    const throttleCheck = await shouldThrottle();
    if (throttleCheck.throttle) {
      res.status(429).json({
        error: 'Budget throttled',
        message: throttleCheck.reason,
        budgetStatus: {
          currentCost: throttleCheck.currentCost,
          dailyLimit: throttleCheck.dailyLimit,
          percentageUsed: throttleCheck.percentageUsed,
          remainingBudget: throttleCheck.remainingBudget,
        },
      });
      return;
    }

    // Check if we can afford this run
    if (estimatedCost > throttleCheck.remainingBudget && !body.dryRun) {
      res.status(429).json({
        error: 'Insufficient budget',
        message: `Estimated cost ($${estimatedCost.toFixed(2)}) exceeds remaining daily budget ($${throttleCheck.remainingBudget.toFixed(2)})`,
        estimatedCost,
        remainingBudget: throttleCheck.remainingBudget,
      });
      return;
    }

    // Create scraper run record
    const scraperId = body.mode === 'enumerate'
      ? `discovery-enumerate-${body.chainId}`
      : `discovery-${body.mode}`;

    const config = {
      type: 'discovery',
      mode: body.mode,
      countries: body.countries,
      platforms: body.platforms || [],
      chainId: body.chainId,
      maxQueries: body.maxQueries,
      dryRun: body.dryRun,
      estimatedCost,
    };

    const run = await scraperRuns.startWithConfig(scraperId, config);

    // Spawn background process to run the discovery
    // In production, this would be a Cloud Run job or similar
    const scraperPath = path.join(process.cwd(), 'packages', 'scrapers', 'dist', 'cli.js');

    const args = [
      'google-search',
      '--mode', body.mode,
      '--countries', body.countries.join(','),
    ];

    if (body.platforms && body.platforms.length > 0) {
      args.push('--platforms', body.platforms.join(','));
    }

    if (body.chainId) {
      args.push('--chain-id', body.chainId);
    }

    if (body.maxQueries) {
      args.push('--max-queries', body.maxQueries.toString());
    }

    if (body.dryRun) {
      args.push('--dry-run');
    }

    args.push('--run-id', run.id);

    // Spawn the process in detached mode
    const child = spawn('node', [scraperPath, ...args], {
      detached: true,
      stdio: 'ignore',
    });

    child.unref(); // Allow parent to exit independently

    // Log the start
    await scraperRuns.addLog(run.id, 'info', `Discovery ${body.mode} started for countries: ${body.countries.join(', ')}`);

    // Return response immediately
    const statusUrl = `/admin/scrapers/runs/${run.id}/stream`;

    res.status(202).json({
      runId: run.id,
      statusUrl,
      status: 'pending',
      message: 'Discovery scraper started successfully',
      config,
      estimatedCost,
    });
  },
  {
    allowedMethods: ['POST'],
    timeoutSeconds: 540, // 9 minutes (max for HTTP functions)
    memory: '512MiB',
  }
);
