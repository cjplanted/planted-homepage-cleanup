/**
 * GET /admin/scrapers/available
 * Get available scrapers and recent runs
 * Requires admin authentication
 */

import { initializeFirestore, scraperRuns } from '@pad/database';
import { createAdminHandler } from '../../../middleware/adminHandler.js';

// Initialize Firestore
initializeFirestore();

/**
 * Available platforms for discovery
 */
const AVAILABLE_PLATFORMS = [
  'uber-eats',
  'wolt',
  'lieferando',
  'deliveroo',
  'glovo',
  'just-eat',
  'thuisbezorgd',
];

/**
 * Available countries
 */
const AVAILABLE_COUNTRIES = ['CH', 'DE', 'AT', 'UK', 'FR', 'IT', 'ES', 'NL'];

/**
 * Discovery modes
 */
const DISCOVERY_MODES = [
  {
    id: 'explore',
    name: 'Explore',
    description: 'Discover new restaurants serving Planted products',
    estimatedQueries: 20,
    estimatedDuration: '5-10 minutes',
  },
  {
    id: 'enumerate',
    name: 'Enumerate Chain',
    description: 'Find all locations of a known restaurant chain',
    estimatedQueries: 50,
    estimatedDuration: '10-20 minutes',
    requiresChainId: true,
  },
  {
    id: 'verify',
    name: 'Verify Locations',
    description: 'Verify existing venue data is still accurate',
    estimatedQueries: 10,
    estimatedDuration: '3-5 minutes',
  },
];

/**
 * Extraction modes
 */
const EXTRACTION_MODES = [
  {
    id: 'enrich',
    name: 'Enrich',
    description: 'Add detailed menu information to venues',
    estimatedAICalls: 5,
    estimatedDuration: '2-5 minutes per venue',
  },
  {
    id: 'refresh',
    name: 'Refresh',
    description: 'Update existing menu data with latest information',
    estimatedAICalls: 3,
    estimatedDuration: '1-3 minutes per venue',
  },
  {
    id: 'verify',
    name: 'Verify',
    description: 'Verify menu items still exist and prices are current',
    estimatedAICalls: 2,
    estimatedDuration: '1-2 minutes per venue',
  },
];

/**
 * Handler for GET /admin/scrapers/available
 */
export const adminAvailableScrapersHandler = createAdminHandler(
  async (req, res) => {
    // Get recent runs (last 10)
    const recentRuns = await scraperRuns.getRecent(10);

    // Get currently running scrapers
    const runningScrapers = await scraperRuns.getRunning();

    // Format recent runs for response
    const formattedRecentRuns = recentRuns.map(run => ({
      id: run.id,
      scraperId: run.scraper_id,
      status: run.status,
      startedAt: run.started_at,
      completedAt: run.completed_at,
      progress: run.progress,
      stats: run.stats,
      costs: run.costs,
      config: run.config,
    }));

    res.set('Cache-Control', 'private, max-age=60'); // 1 minute cache

    res.status(200).json({
      discovery: {
        countries: AVAILABLE_COUNTRIES,
        platforms: AVAILABLE_PLATFORMS,
        modes: DISCOVERY_MODES,
        defaultMaxQueries: 50,
      },
      extraction: {
        modes: EXTRACTION_MODES,
        targets: [
          {
            id: 'all',
            name: 'All Venues',
            description: 'Process all venues in the database',
          },
          {
            id: 'chain',
            name: 'Specific Chain',
            description: 'Process all venues belonging to a restaurant chain',
            requiresChainId: true,
          },
          {
            id: 'venue',
            name: 'Single Venue',
            description: 'Process a single specific venue',
            requiresVenueId: true,
          },
        ],
        defaultMaxVenues: 50,
      },
      recentRuns: formattedRecentRuns,
      runningScrapers: runningScrapers.map(run => ({
        id: run.id,
        scraperId: run.scraper_id,
        status: run.status,
        startedAt: run.started_at,
        progress: run.progress,
        config: run.config,
      })),
      statistics: {
        totalRecentRuns: recentRuns.length,
        currentlyRunning: runningScrapers.length,
        recentSuccessRate: recentRuns.length > 0
          ? Math.round(
              (recentRuns.filter(r => r.status === 'completed').length / recentRuns.length) * 100
            )
          : null,
      },
    });
  },
  { allowedMethods: ['GET'] }
);
