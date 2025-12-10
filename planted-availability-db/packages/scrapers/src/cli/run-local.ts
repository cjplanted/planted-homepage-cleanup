#!/usr/bin/env tsx
/**
 * Unified Local Scraper Runner
 *
 * Single entry point for all scraping operations, controlled via config file.
 *
 * Usage:
 *   pnpm run local              # Run with scraper-config.json
 *   pnpm run local --config custom.json
 *   pnpm run local --discovery  # Run only discovery
 *   pnpm run local --extraction # Run only extraction
 *   pnpm run local --dry-run    # Override to dry run
 *
 * Config file location: planted-availability-db/scraper-config.json
 */

// Load environment variables
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../../../..'); // planted-availability-db/

// Load .env files
dotenv.config({ path: path.resolve(rootDir, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Fix relative GOOGLE_APPLICATION_CREDENTIALS path
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!path.isAbsolute(credPath)) {
    const resolvedPath = path.resolve(rootDir, credPath);
    if (fs.existsSync(resolvedPath)) {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = resolvedPath;
    }
  }
}

// Import agents
import { SmartDiscoveryAgent } from '../agents/smart-discovery/SmartDiscoveryAgent.js';
import { SmartDishFinderAgent } from '../agents/smart-dish-finder/index.js';
import {
  GoogleSearchProvider,
  SerpAPIProvider,
  MockSearchProvider,
} from '../agents/smart-discovery/WebSearchProvider.js';
import type { DeliveryPlatform, SupportedCountry, DishExtractionMode, DishExtractionRunConfig } from '@pad/core';

// ============================================================================
// CONFIG TYPES
// ============================================================================

interface DiscoveryConfig {
  enabled: boolean;
  mode: 'explore' | 'enumerate' | 'verify';
  platforms: DeliveryPlatform[];
  countries: SupportedCountry[];
  chains: string[];
  maxQueries: number;
  searchProvider: 'google' | 'serpapi' | 'mock';
  dryRun: boolean;
}

interface ExtractionConfig {
  enabled: boolean;
  mode: DishExtractionMode;
  target: 'all' | 'chain' | 'venues';
  chainId: string | null;
  venueIds: string[];
  countries: SupportedCountry[];
  platforms: DeliveryPlatform[];
  maxVenues: number;
  dryRun: boolean;
  learn: boolean;
}

interface ReviewConfig {
  enabled: boolean;
  type: 'venues' | 'dishes';
  limit: number;
}

interface SyncConfig {
  enabled: boolean;
  preview: boolean;
  execute: boolean;
}

interface ScraperConfig {
  description?: string;
  discovery: DiscoveryConfig;
  extraction: ExtractionConfig;
  review: ReviewConfig;
  sync: SyncConfig;
}

// ============================================================================
// CLI PARSING
// ============================================================================

interface CLIOverrides {
  configPath: string;
  discoveryOnly: boolean;
  extractionOnly: boolean;
  reviewOnly: boolean;
  syncOnly: boolean;
  dryRun: boolean | null;
  verbose: boolean;
  help: boolean;
}

function parseArgs(): CLIOverrides {
  const args = process.argv.slice(2);
  const overrides: CLIOverrides = {
    configPath: path.resolve(rootDir, 'scraper-config.json'),
    discoveryOnly: false,
    extractionOnly: false,
    reviewOnly: false,
    syncOnly: false,
    dryRun: null,
    verbose: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--config':
      case '-c':
        if (nextArg) {
          overrides.configPath = path.isAbsolute(nextArg)
            ? nextArg
            : path.resolve(process.cwd(), nextArg);
          i++;
        }
        break;
      case '--discovery':
        overrides.discoveryOnly = true;
        break;
      case '--extraction':
        overrides.extractionOnly = true;
        break;
      case '--review':
        overrides.reviewOnly = true;
        break;
      case '--sync':
        overrides.syncOnly = true;
        break;
      case '--dry-run':
      case '-d':
        overrides.dryRun = true;
        break;
      case '--wet-run':
        overrides.dryRun = false;
        break;
      case '--verbose':
      case '-v':
        overrides.verbose = true;
        break;
      case '--help':
      case '-h':
        overrides.help = true;
        break;
    }
  }

  return overrides;
}

function printHelp(): void {
  console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║                    PLANTED LOCAL SCRAPER RUNNER                            ║
╚════════════════════════════════════════════════════════════════════════════╝

USAGE:
  pnpm run local [options]

OPTIONS:
  --config, -c <path>    Path to config file (default: scraper-config.json)
  --discovery            Run only discovery (ignores config enabled flags)
  --extraction           Run only extraction (ignores config enabled flags)
  --review               Run only review
  --sync                 Run only sync
  --dry-run, -d          Override: don't save to database
  --wet-run              Override: save to database (even if config says dry-run)
  --verbose, -v          Verbose output
  --help, -h             Show this help

CONFIG FILE (scraper-config.json):
  {
    "discovery": {
      "enabled": true/false,      // Whether to run discovery
      "mode": "explore",          // explore | enumerate | verify
      "platforms": ["uber-eats"], // Platforms to search
      "countries": ["CH", "DE"],  // Countries to search
      "chains": [],               // Chain names for enumerate mode
      "maxQueries": 20,           // Max Google queries
      "dryRun": false             // Don't save results
    },
    "extraction": {
      "enabled": true/false,      // Whether to run extraction
      "mode": "enrich",           // enrich | refresh | verify
      "target": "all",            // all | chain | venues
      "chainId": null,            // Chain ID for target=chain
      "venueIds": [],             // Venue IDs for target=venues
      "maxVenues": 50,            // Max venues to process
      "dryRun": false             // Don't save results
    }
  }

EXAMPLES:
  pnpm run local                    # Run all enabled tasks from config
  pnpm run local --extraction       # Run only extraction
  pnpm run local --dry-run          # Test run, no database writes
  pnpm run local -c my-config.json  # Use custom config file
`);
}

// ============================================================================
// LOAD CONFIG
// ============================================================================

function loadConfig(configPath: string): ScraperConfig {
  if (!fs.existsSync(configPath)) {
    console.error(`\n❌ Config file not found: ${configPath}`);
    console.error(`\nCreate a config file or use --help for options.\n`);
    process.exit(1);
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(content) as ScraperConfig;
  } catch (error) {
    console.error(`\n❌ Failed to parse config file: ${configPath}`);
    console.error(error);
    process.exit(1);
  }
}

// ============================================================================
// RUNNERS
// ============================================================================

async function runDiscovery(config: DiscoveryConfig, verbose: boolean): Promise<void> {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    RUNNING DISCOVERY                          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  console.log(`Mode:      ${config.mode}`);
  console.log(`Platforms: ${config.platforms.join(', ')}`);
  console.log(`Countries: ${config.countries.join(', ')}`);
  if (config.chains.length > 0) {
    console.log(`Chains:    ${config.chains.join(', ')}`);
  }
  console.log(`Max Queries: ${config.maxQueries}`);
  console.log(`Dry Run:   ${config.dryRun}`);
  console.log('');

  // Create search provider
  let searchProvider;
  switch (config.searchProvider) {
    case 'serpapi':
      searchProvider = new SerpAPIProvider();
      break;
    case 'mock':
      searchProvider = new MockSearchProvider();
      break;
    default:
      searchProvider = new GoogleSearchProvider();
  }

  // Create and run agent
  const agent = new SmartDiscoveryAgent({
    searchProvider,
    aiProvider: 'gemini',
    maxQueriesPerRun: config.maxQueries,
    dryRun: config.dryRun,
    verbose,
  });

  const result = await agent.run({
    mode: config.mode,
    countries: config.countries,
    platforms: config.platforms,
    chains: config.mode === 'enumerate' ? config.chains : undefined,
  });

  console.log('\n📊 Discovery Results:');
  console.log(`   Venues Found:    ${result.stats.venuesFound}`);
  console.log(`   Venues Saved:    ${result.stats.venuesSaved}`);
  console.log(`   Queries Used:    ${result.stats.queriesUsed}`);
  console.log(`   AI Calls:        ${result.stats.aiCallsMade}`);
  console.log(`   Errors:          ${result.stats.errors}`);
}

async function runExtraction(config: ExtractionConfig, verbose: boolean): Promise<void> {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    RUNNING EXTRACTION                         ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  console.log(`Mode:       ${config.mode}`);
  console.log(`Target:     ${config.target}`);
  if (config.chainId) {
    console.log(`Chain ID:   ${config.chainId}`);
  }
  if (config.venueIds.length > 0) {
    console.log(`Venue IDs:  ${config.venueIds.join(', ')}`);
  }
  console.log(`Max Venues: ${config.maxVenues}`);
  console.log(`Dry Run:    ${config.dryRun}`);
  console.log('');

  // Create and run agent
  const agent = new SmartDishFinderAgent({
    dryRun: config.dryRun,
    verbose,
    maxVenuesPerRun: config.maxVenues,
  });

  // Build run config matching DishExtractionRunConfig interface
  const runConfig: DishExtractionRunConfig = {
    mode: config.mode,
    max_venues: config.maxVenues,
  };

  if (config.target === 'venues' && config.venueIds.length > 0) {
    runConfig.target_venues = config.venueIds;
  } else if (config.target === 'chain' && config.chainId) {
    runConfig.target_chains = [config.chainId];
  }

  if (config.countries.length > 0) {
    runConfig.countries = config.countries;
  }
  if (config.platforms.length > 0) {
    runConfig.platforms = config.platforms;
  }

  try {
    await agent.initialize();
    const result = await agent.runExtraction(runConfig);

    console.log('\n📊 Extraction Results:');
    console.log(`   Venues Processed: ${result.stats.venues_processed}`);
    console.log(`   Venues Successful: ${result.stats.venues_successful}`);
    console.log(`   Venues Failed:    ${result.stats.venues_failed}`);
    console.log(`   Dishes Extracted: ${result.stats.dishes_extracted}`);
    console.log(`   Dishes Updated:   ${result.stats.dishes_updated}`);
    console.log(`   Errors:           ${result.stats.errors}`);
  } finally {
    await agent.cleanup();
  }

  if (config.learn && !config.dryRun) {
    console.log('\n📚 Running learning process...');
    // Learning would be implemented here
  }
}

async function runReview(config: ReviewConfig, verbose: boolean): Promise<void> {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    RUNNING REVIEW                             ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  console.log(`Type:  ${config.type}`);
  console.log(`Limit: ${config.limit}`);
  console.log('\nReview is interactive - use the review-venues or review-dishes CLI instead:');
  console.log('  pnpm run review       # Review venues');
  console.log('  pnpm run review-dishes # Review dishes');
}

async function runSync(config: SyncConfig, verbose: boolean): Promise<void> {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    RUNNING SYNC                               ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  console.log(`Preview: ${config.preview}`);
  console.log(`Execute: ${config.execute}`);
  console.log('\nSync to website - use the admin dashboard for sync operations.');
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  const overrides = parseArgs();

  if (overrides.help) {
    printHelp();
    process.exit(0);
  }

  console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║                    🌱 PLANTED LOCAL SCRAPER RUNNER                         ║
╚════════════════════════════════════════════════════════════════════════════╝
`);

  // Load config
  console.log(`📁 Loading config from: ${overrides.configPath}`);
  const config = loadConfig(overrides.configPath);

  if (config.description) {
    console.log(`📝 ${config.description}`);
  }

  // Apply dry-run override
  if (overrides.dryRun !== null) {
    config.discovery.dryRun = overrides.dryRun;
    config.extraction.dryRun = overrides.dryRun;
    console.log(`\n⚠️  Dry run override: ${overrides.dryRun ? 'ENABLED' : 'DISABLED'}`);
  }

  // Determine what to run
  const anySpecificTask = overrides.discoveryOnly || overrides.extractionOnly ||
                          overrides.reviewOnly || overrides.syncOnly;

  const shouldRunDiscovery = anySpecificTask ? overrides.discoveryOnly : config.discovery.enabled;
  const shouldRunExtraction = anySpecificTask ? overrides.extractionOnly : config.extraction.enabled;
  const shouldRunReview = anySpecificTask ? overrides.reviewOnly : config.review.enabled;
  const shouldRunSync = anySpecificTask ? overrides.syncOnly : config.sync.enabled;

  // Show what will run
  console.log('\n📋 Tasks to run:');
  console.log(`   Discovery:   ${shouldRunDiscovery ? '✅' : '⏭️  (skipped)'}`);
  console.log(`   Extraction:  ${shouldRunExtraction ? '✅' : '⏭️  (skipped)'}`);
  console.log(`   Review:      ${shouldRunReview ? '✅' : '⏭️  (skipped)'}`);
  console.log(`   Sync:        ${shouldRunSync ? '✅' : '⏭️  (skipped)'}`);

  // Run tasks
  try {
    if (shouldRunDiscovery) {
      await runDiscovery(config.discovery, overrides.verbose);
    }

    if (shouldRunExtraction) {
      await runExtraction(config.extraction, overrides.verbose);
    }

    if (shouldRunReview) {
      await runReview(config.review, overrides.verbose);
    }

    if (shouldRunSync) {
      await runSync(config.sync, overrides.verbose);
    }

    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║                    ✅ ALL TASKS COMPLETE                      ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

  } catch (error) {
    console.error('\n❌ Error during execution:', error);
    process.exit(1);
  }
}

main();
