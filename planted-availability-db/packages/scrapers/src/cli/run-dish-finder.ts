#!/usr/bin/env node
/**
 * Smart Dish Finder CLI
 *
 * Extract dish information from delivery platform pages.
 *
 * Usage:
 *   pnpm run dish-finder [options]
 *
 * Options:
 *   --mode, -m <mode>        enrich | refresh | verify (default: enrich)
 *   --venues <list>          Comma-separated venue IDs to process
 *   --chains <list>          Comma-separated chain IDs to process
 *   --countries, -c <list>   Comma-separated country codes (CH,DE,AT)
 *   --platforms, -p <list>   Comma-separated platforms
 *   --max-venues <n>         Maximum venues to process (default: 50)
 *   --dry-run                Don't save to database
 *   --verbose, -v            Verbose output
 *   --learn                  Run learning process after extraction
 *   --stats                  Show statistics and exit
 *   --help, -h               Show help
 *
 * Examples:
 *   pnpm run dish-finder --mode enrich --chains dean-david
 *   pnpm run dish-finder --mode refresh --countries CH --max-venues 20
 *   pnpm run dish-finder --mode verify --platforms uber-eats
 *   pnpm run dish-finder --stats
 */

import { SmartDishFinderAgent } from '../agents/smart-dish-finder/index.js';
import type {
  DishExtractionMode,
  DeliveryPlatform,
  SupportedCountry,
} from '@pad/core';

interface CLIOptions {
  mode: DishExtractionMode;
  venues?: string[];
  chains?: string[];
  countries?: SupportedCountry[];
  platforms?: DeliveryPlatform[];
  maxVenues: number;
  dryRun: boolean;
  verbose: boolean;
  learn: boolean;
  stats: boolean;
  help: boolean;
}

function parseArgs(args: string[]): CLIOptions {
  const options: CLIOptions = {
    mode: 'enrich',
    maxVenues: 50,
    dryRun: false,
    verbose: false,
    learn: false,
    stats: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--mode':
      case '-m':
        if (nextArg && ['enrich', 'refresh', 'verify'].includes(nextArg)) {
          options.mode = nextArg as DishExtractionMode;
          i++;
        }
        break;

      case '--venues':
        if (nextArg) {
          options.venues = nextArg.split(',').map((v) => v.trim());
          i++;
        }
        break;

      case '--chains':
        if (nextArg) {
          options.chains = nextArg.split(',').map((c) => c.trim());
          i++;
        }
        break;

      case '--countries':
      case '-c':
        if (nextArg) {
          options.countries = nextArg
            .split(',')
            .map((c) => c.trim().toUpperCase())
            .filter((c) => ['CH', 'DE', 'AT'].includes(c)) as SupportedCountry[];
          i++;
        }
        break;

      case '--platforms':
      case '-p':
        if (nextArg) {
          options.platforms = nextArg
            .split(',')
            .map((p) => p.trim().toLowerCase())
            .filter((p) =>
              ['uber-eats', 'lieferando', 'wolt', 'just-eat', 'smood'].includes(p)
            ) as DeliveryPlatform[];
          i++;
        }
        break;

      case '--max-venues':
        if (nextArg) {
          options.maxVenues = parseInt(nextArg, 10) || 50;
          i++;
        }
        break;

      case '--dry-run':
        options.dryRun = true;
        break;

      case '--verbose':
      case '-v':
        options.verbose = true;
        break;

      case '--learn':
        options.learn = true;
        break;

      case '--stats':
        options.stats = true;
        break;

      case '--help':
      case '-h':
        options.help = true;
        break;
    }
  }

  return options;
}

function showHelp(): void {
  console.log(`
Smart Dish Finder CLI

Extract dish information (names, descriptions, prices) from delivery platforms.

Usage:
  pnpm run dish-finder [options]

Modes:
  enrich   Add dishes to venues without dish data (default)
  refresh  Update prices for existing dishes
  verify   Check if dishes still exist on platforms

Options:
  --mode, -m <mode>        enrich | refresh | verify
  --venues <list>          Comma-separated venue IDs
  --chains <list>          Comma-separated chain IDs (e.g., dean-david,kaimug)
  --countries, -c <list>   Country codes: CH,DE,AT
  --platforms, -p <list>   Platforms: uber-eats,lieferando,wolt,just-eat,smood
  --max-venues <n>         Maximum venues to process (default: 50)
  --dry-run                Don't save to database
  --verbose, -v            Verbose output
  --learn                  Run learning process after extraction
  --stats                  Show statistics and exit
  --help, -h               Show this help

Examples:
  # Enrich dishes for dean&david chain
  pnpm run dish-finder --mode enrich --chains dean-david -v

  # Refresh prices for Swiss venues
  pnpm run dish-finder --mode refresh --countries CH --max-venues 20

  # Verify dishes on Uber Eats
  pnpm run dish-finder --mode verify --platforms uber-eats

  # Show current statistics
  pnpm run dish-finder --stats

  # Dry run with verbose output
  pnpm run dish-finder --chains kaimug --dry-run -v
`);
}

async function showStats(agent: SmartDishFinderAgent): Promise<void> {
  console.log('\n📊 Smart Dish Finder Statistics\n');

  const stats = await agent.getStats();

  console.log('Strategies:');
  console.log(`  Total: ${stats.total_strategies}`);

  console.log('\nDishes:');
  console.log(`  Total: ${stats.total_dishes}`);
  console.log(`  Average confidence: ${stats.average_confidence}%`);

  console.log('\nBy Status:');
  for (const [status, count] of Object.entries(stats.dishes_by_status)) {
    console.log(`  ${status}: ${count}`);
  }

  console.log('\nBy Product:');
  for (const [product, count] of Object.entries(stats.dishes_by_product)) {
    console.log(`  ${product}: ${count}`);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  console.log('🍽️  Smart Dish Finder\n');

  const agent = new SmartDishFinderAgent({
    maxVenuesPerRun: options.maxVenues,
    dryRun: options.dryRun,
    verbose: options.verbose,
  });

  try {
    // Initialize agent
    await agent.initialize();

    // Show stats and exit if requested
    if (options.stats) {
      await showStats(agent);
      await agent.cleanup();
      process.exit(0);
    }

    // Log configuration
    console.log('Configuration:');
    console.log(`  Mode: ${options.mode}`);
    if (options.venues) console.log(`  Venues: ${options.venues.join(', ')}`);
    if (options.chains) console.log(`  Chains: ${options.chains.join(', ')}`);
    if (options.countries) console.log(`  Countries: ${options.countries.join(', ')}`);
    if (options.platforms) console.log(`  Platforms: ${options.platforms.join(', ')}`);
    console.log(`  Max venues: ${options.maxVenues}`);
    console.log(`  Dry run: ${options.dryRun}`);
    console.log('');

    // Run extraction
    console.log('Starting extraction...\n');

    const run = await agent.runExtraction({
      mode: options.mode,
      target_venues: options.venues,
      target_chains: options.chains,
      countries: options.countries,
      platforms: options.platforms,
      max_venues: options.maxVenues,
    });

    // Show results
    console.log('\n✅ Extraction Complete\n');
    console.log('Results:');
    console.log(`  Venues processed: ${run.stats.venues_processed}`);
    console.log(`  Venues successful: ${run.stats.venues_successful}`);
    console.log(`  Venues failed: ${run.stats.venues_failed}`);
    console.log(`  Dishes extracted: ${run.stats.dishes_extracted}`);
    console.log(`  Dishes updated: ${run.stats.dishes_updated}`);
    console.log(`  Prices found: ${run.stats.prices_found}`);
    console.log(`  Images found: ${run.stats.images_found}`);
    console.log(`  Errors: ${run.stats.errors}`);

    // Run learning if requested
    if (options.learn) {
      console.log('\n📚 Running learning process...\n');

      const learningResult = await agent.learn();

      console.log('Learning Results:');
      console.log(`  Strategy updates: ${learningResult.strategy_updates.length}`);
      console.log(`  New strategies: ${learningResult.new_strategies.length}`);
      console.log(`  Insights: ${learningResult.insights.length}`);

      if (learningResult.insights.length > 0) {
        console.log('\nInsights:');
        for (const insight of learningResult.insights) {
          console.log(`  - [${insight.type}] ${insight.description}`);
        }
      }
    }

    // Cleanup
    await agent.cleanup();

    console.log('\nDone! 🎉');
  } catch (error) {
    console.error('\n❌ Error:', error);
    await agent.cleanup();
    process.exit(1);
  }
}

main().catch(console.error);
