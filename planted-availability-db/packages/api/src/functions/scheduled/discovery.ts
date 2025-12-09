/**
 * Smart Discovery Cloud Functions
 *
 * Cloud Function entry points for the AI-powered restaurant discovery system.
 */

import { onSchedule, ScheduledEvent } from 'firebase-functions/v2/scheduler';
import { onRequest, HttpsOptions, onCall, CallableRequest } from 'firebase-functions/v2/https';
import type { Request, Response } from 'express';
import {
  initializeFirestore,
  discoveryRuns,
  discoveryStrategies,
  discoveredVenues,
  searchFeedback,
} from '@pad/database';
import type {
  DiscoveryRunConfig,
  DeliveryPlatform,
  SupportedCountry,
  DiscoveredVenueStatus,
} from '@pad/core';

// Initialize Firestore
initializeFirestore();

const scheduledOptions = {
  region: 'europe-west6',
  timeoutSeconds: 540, // 9 minutes
  memory: '1GiB' as const,
  secrets: ['ANTHROPIC_API_KEY', 'GOOGLE_SEARCH_API_KEY', 'GOOGLE_SEARCH_ENGINE_ID'],
};

const httpsOptions: HttpsOptions = {
  region: 'europe-west6',
  cors: true,
};

/**
 * Daily discovery run - searches for new Planted restaurants
 * Runs at 3 AM CET daily
 */
export const scheduledDiscovery = onSchedule(
  {
    ...scheduledOptions,
    schedule: '0 3 * * *', // 3 AM every day
    timeZone: 'Europe/Zurich',
  },
  async (_event: ScheduledEvent) => {
    console.log('Starting scheduled discovery run...');

    try {
      // Dynamic import to avoid initialization issues
      const { SmartDiscoveryAgent, getSearchProvider } = await import(
        '@pad/scrapers/agents/smart-discovery'
      );

      const searchProvider = getSearchProvider();
      const agent = new SmartDiscoveryAgent(searchProvider, {
        maxQueriesPerRun: 30,
        rateLimitMs: 3000,
        verbose: true,
      });

      // Initialize (seed strategies if needed)
      await agent.initialize();

      // Run discovery across all platforms and countries
      const config: DiscoveryRunConfig = {
        platforms: ['just-eat', 'uber-eats', 'lieferando', 'wolt', 'smood'],
        countries: ['CH', 'DE', 'AT'],
        mode: 'explore',
        max_queries: 30,
      };

      const run = await agent.runDiscovery(config);

      console.log('Scheduled discovery completed:', {
        run_id: run.id,
        status: run.status,
        stats: run.stats,
      });
    } catch (error) {
      console.error('Scheduled discovery failed:', error);
      throw error;
    }
  }
);

/**
 * Weekly learning run - analyzes feedback and improves strategies
 * Runs at 4 AM CET on Sundays
 */
export const weeklyLearning = onSchedule(
  {
    ...scheduledOptions,
    schedule: '0 4 * * 0', // 4 AM on Sundays
    timeZone: 'Europe/Zurich',
  },
  async (_event: ScheduledEvent) => {
    console.log('Starting weekly learning run...');

    try {
      const { SmartDiscoveryAgent, getSearchProvider } = await import(
        '@pad/scrapers/agents/smart-discovery'
      );

      const searchProvider = getSearchProvider();
      const agent = new SmartDiscoveryAgent(searchProvider, { verbose: true });

      const patterns = await agent.learn();

      console.log('Weekly learning completed:', {
        patterns_learned: patterns.length,
        patterns: patterns.map((p) => ({
          type: p.type,
          description: p.description,
          applied: p.applied,
        })),
      });
    } catch (error) {
      console.error('Weekly learning failed:', error);
      throw error;
    }
  }
);

/**
 * Weekly venue verification - re-checks discovered venues
 * Runs at 5 AM CET on Sundays
 */
export const weeklyVerification = onSchedule(
  {
    ...scheduledOptions,
    schedule: '0 5 * * 0', // 5 AM on Sundays
    timeZone: 'Europe/Zurich',
  },
  async (_event: ScheduledEvent) => {
    console.log('Starting weekly venue verification...');

    try {
      const { SmartDiscoveryAgent, getSearchProvider } = await import(
        '@pad/scrapers/agents/smart-discovery'
      );

      // Get venues that need verification (discovered but not verified)
      const pendingVenues = await discoveredVenues.getByStatus('discovered');

      if (pendingVenues.length === 0) {
        console.log('No venues pending verification');
        return;
      }

      const searchProvider = getSearchProvider();
      const agent = new SmartDiscoveryAgent(searchProvider, {
        maxQueriesPerRun: 20,
        verbose: true,
      });

      const config: DiscoveryRunConfig = {
        platforms: ['just-eat', 'uber-eats', 'lieferando', 'wolt', 'smood'],
        countries: ['CH', 'DE', 'AT'],
        mode: 'verify',
        target_venues: pendingVenues.slice(0, 20).map((v) => v.id),
      };

      const run = await agent.runDiscovery(config);

      console.log('Weekly verification completed:', {
        run_id: run.id,
        venues_checked: run.stats.venues_verified + run.stats.venues_rejected,
        venues_verified: run.stats.venues_verified,
        venues_rejected: run.stats.venues_rejected,
      });
    } catch (error) {
      console.error('Weekly verification failed:', error);
      throw error;
    }
  }
);

/**
 * Manual discovery trigger
 * POST /api/admin/discovery/run
 */
export const triggerDiscovery = onRequest(
  { ...httpsOptions, secrets: scheduledOptions.secrets },
  async (req: Request, res: Response) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    // TODO: Add authentication

    try {
      const body = req.body || {};
      const platforms = (body.platforms || ['just-eat', 'uber-eats']) as DeliveryPlatform[];
      const countries = (body.countries || ['CH']) as SupportedCountry[];
      const mode = body.mode || 'explore';
      const maxQueries = body.max_queries || 20;

      const { SmartDiscoveryAgent, getSearchProvider } = await import(
        '@pad/scrapers/agents/smart-discovery'
      );

      const searchProvider = getSearchProvider();
      const agent = new SmartDiscoveryAgent(searchProvider, {
        maxQueriesPerRun: maxQueries,
        rateLimitMs: 2000,
        verbose: true,
      });

      await agent.initialize();

      const config: DiscoveryRunConfig = {
        platforms,
        countries,
        mode,
        max_queries: maxQueries,
      };

      const run = await agent.runDiscovery(config);

      res.status(200).json({
        success: true,
        run_id: run.id,
        status: run.status,
        stats: run.stats,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Manual discovery trigger failed:', errorMessage);
      res.status(500).json({
        error: 'Discovery failed',
        message: errorMessage,
      });
    }
  }
);

/**
 * Get discovery dashboard stats
 * GET /api/admin/discovery/stats
 */
export const discoveryStats = onRequest(httpsOptions, async (req: Request, res: Response) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const [runStats, strategyTiers, venueStats, feedbackStats] = await Promise.all([
      discoveryRuns.getAggregateStats(),
      discoveryStrategies.getStrategyTiers(),
      discoveredVenues.getStats(),
      searchFeedback.getStats(),
    ]);

    res.status(200).json({
      runs: runStats,
      strategies: {
        total:
          strategyTiers.high.length +
          strategyTiers.medium.length +
          strategyTiers.low.length +
          strategyTiers.untested.length,
        by_tier: {
          high: strategyTiers.high.length,
          medium: strategyTiers.medium.length,
          low: strategyTiers.low.length,
          untested: strategyTiers.untested.length,
        },
      },
      venues: venueStats,
      feedback: feedbackStats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Discovery stats failed:', errorMessage);
    res.status(500).json({ error: 'Internal server error', message: errorMessage });
  }
});

/**
 * Get recent discovery runs
 * GET /api/admin/discovery/runs
 */
export const discoveryRunsList = onRequest(httpsOptions, async (req: Request, res: Response) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const runs = await discoveryRuns.getRecentRuns(limit);

    res.status(200).json({
      runs: runs.map((run) => ({
        id: run.id,
        status: run.status,
        config: run.config,
        stats: run.stats,
        created_at: run.created_at,
        started_at: run.started_at,
        completed_at: run.completed_at,
        error_count: run.errors.length,
      })),
      total: runs.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: 'Internal server error', message: errorMessage });
  }
});

/**
 * Get discovered venues pending review
 * GET /api/admin/discovery/venues/pending
 */
export const pendingVenues = onRequest(httpsOptions, async (req: Request, res: Response) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const venues = await discoveredVenues.getPendingReview(limit);

    res.status(200).json({
      venues: venues.map((v) => ({
        id: v.id,
        name: v.name,
        chain_name: v.chain_name,
        is_chain: v.is_chain,
        address: v.address,
        delivery_platforms: v.delivery_platforms,
        planted_products: v.planted_products,
        confidence_score: v.confidence_score,
        confidence_factors: v.confidence_factors,
        discovered_by_query: v.discovered_by_query,
        created_at: v.created_at,
      })),
      total: venues.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: 'Internal server error', message: errorMessage });
  }
});

/**
 * Review a discovered venue (verify or reject)
 * POST /api/admin/discovery/venues/:id/review
 */
export const reviewVenue = onRequest(httpsOptions, async (req: Request, res: Response) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Extract venue ID from path
    const pathParts = req.path.split('/');
    const venueId = pathParts[pathParts.length - 2]; // /venues/:id/review

    if (!venueId) {
      res.status(400).json({ error: 'Venue ID required' });
      return;
    }

    const body = req.body || {};
    const action = body.action as 'verify' | 'reject';
    const reason = body.reason as string;

    if (!action || !['verify', 'reject'].includes(action)) {
      res.status(400).json({ error: 'Action must be "verify" or "reject"' });
      return;
    }

    let venue;
    if (action === 'verify') {
      venue = await discoveredVenues.verifyVenue(venueId);

      // Update strategy feedback
      const feedbacks = await searchFeedback.getForVenue(venueId);
      for (const fb of feedbacks) {
        await searchFeedback.addFeedback(
          fb.id,
          { was_useful: true, venue_was_correct: true },
          'admin'
        );
        // Update strategy success
        await discoveryStrategies.recordUsage(fb.strategy_id, {
          success: true,
          was_false_positive: false,
        });
      }
    } else {
      if (!reason) {
        res.status(400).json({ error: 'Rejection reason required' });
        return;
      }
      venue = await discoveredVenues.rejectVenue(venueId, reason);

      // Update strategy feedback as false positive
      const feedbacks = await searchFeedback.getForVenue(venueId);
      for (const fb of feedbacks) {
        await searchFeedback.addFeedback(
          fb.id,
          { was_useful: false, venue_was_correct: false, notes: reason },
          'admin'
        );
        // Penalize strategy
        await discoveryStrategies.recordUsage(fb.strategy_id, {
          success: false,
          was_false_positive: true,
        });
      }
    }

    res.status(200).json({
      success: true,
      venue: {
        id: venue.id,
        name: venue.name,
        status: venue.status,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Venue review failed:', errorMessage);
    res.status(500).json({ error: 'Internal server error', message: errorMessage });
  }
});

/**
 * Get strategies with performance stats
 * GET /api/admin/discovery/strategies
 */
export const strategiesList = onRequest(httpsOptions, async (req: Request, res: Response) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const platform = req.query.platform as DeliveryPlatform | undefined;
    const country = req.query.country as SupportedCountry | undefined;

    let strategies;
    if (platform && country) {
      strategies = await discoveryStrategies.getActiveStrategies(platform, country);
    } else {
      strategies = await discoveryStrategies.getAll();
    }

    res.status(200).json({
      strategies: strategies.map((s) => ({
        id: s.id,
        platform: s.platform,
        country: s.country,
        query_template: s.query_template,
        success_rate: s.success_rate,
        total_uses: s.total_uses,
        successful_discoveries: s.successful_discoveries,
        false_positives: s.false_positives,
        origin: s.origin,
        tags: s.tags,
        last_used: s.last_used,
        deprecated_at: s.deprecated_at,
      })),
      total: strategies.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: 'Internal server error', message: errorMessage });
  }
});

/**
 * Trigger learning manually
 * POST /api/admin/discovery/learn
 */
export const triggerLearning = onRequest(
  { ...httpsOptions, secrets: scheduledOptions.secrets },
  async (req: Request, res: Response) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    try {
      const { SmartDiscoveryAgent, getSearchProvider } = await import(
        '@pad/scrapers/agents/smart-discovery'
      );

      const searchProvider = getSearchProvider();
      const agent = new SmartDiscoveryAgent(searchProvider, { verbose: true });

      const patterns = await agent.learn();

      res.status(200).json({
        success: true,
        patterns_learned: patterns.length,
        patterns: patterns.map((p) => ({
          type: p.type,
          description: p.description,
          confidence: p.confidence,
          applied: p.applied,
        })),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Manual learning trigger failed:', errorMessage);
      res.status(500).json({ error: 'Learning failed', message: errorMessage });
    }
  }
);
