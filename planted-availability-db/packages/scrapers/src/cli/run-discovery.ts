#!/usr/bin/env tsx
/**
 * CLI to run the Smart Discovery Agent
 *
 * Usage:
 *   pnpm run discovery --mode explore --platforms uber-eats,just-eat --countries CH
 *   pnpm run discovery --mode enumerate --chains "dean&david,Hiltl"
 *   pnpm run discovery --dry-run
 */

// Load environment variables from .env file (look in parent directories too)
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../../../..'); // planted-availability-db/

// Try loading from multiple locations
dotenv.config({ path: path.resolve(rootDir, '.env') }); // planted-availability-db/.env
dotenv.config({ path: path.resolve(__dirname, '../../../.env') }); // packages/.env
dotenv.config({ path: path.resolve(__dirname, '../../.env') }); // scrapers/.env

// Fix relative GOOGLE_APPLICATION_CREDENTIALS path - resolve relative to the .env location (rootDir)
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!path.isAbsolute(credPath)) {
    const resolvedPath = path.resolve(rootDir, credPath);
    if (existsSync(resolvedPath)) {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = resolvedPath;
    }
  }
}

import { SmartDiscoveryAgent } from '../agents/smart-discovery/SmartDiscoveryAgent.js';
import {
  GoogleSearchProvider,
  SerpAPIProvider,
  MockSearchProvider,
} from '../agents/smart-discovery/WebSearchProvider.js';
import type { AIProvider } from '../agents/smart-discovery/AIClient.js';
import type { DeliveryPlatform, SupportedCountry, DiscoveryRunConfig } from '@pad/core';

// Parse command line arguments
function parseArgs(): {
  mode: 'explore' | 'enumerate' | 'verify';
  platforms: DeliveryPlatform[];
  countries: SupportedCountry[];
  chains?: string[];
  dryRun: boolean;
  verbose: boolean;
  maxQueries: number;
  searchProvider: 'google' | 'serpapi' | 'mock';
  aiProvider?: AIProvider;
} {
  const args = process.argv.slice(2);
  const result = {
    mode: 'explore' as const,
    platforms: ['uber-eats', 'just-eat', 'lieferando', 'wolt', 'smood'] as DeliveryPlatform[],
    countries: ['CH', 'DE', 'AT'] as SupportedCountry[],
    chains: undefined as string[] | undefined,
    dryRun: false,
    verbose: false,
    maxQueries: 20,
    searchProvider: 'google' as 'google' | 'serpapi' | 'mock',
    aiProvider: undefined as AIProvider | undefined,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--mode':
      case '-m':
        if (nextArg && ['explore', 'enumerate', 'verify'].includes(nextArg)) {
          result.mode = nextArg as typeof result.mode;
          i++;
        }
        break;

      case '--platforms':
      case '-p':
        if (nextArg) {
          result.platforms = nextArg.split(',') as DeliveryPlatform[];
          i++;
        }
        break;

      case '--countries':
      case '-c':
        if (nextArg) {
          result.countries = nextArg.split(',') as SupportedCountry[];
          i++;
        }
        break;

      case '--chains':
        if (nextArg) {
          result.chains = nextArg.split(',');
          i++;
        }
        break;

      case '--dry-run':
        result.dryRun = true;
        break;

      case '--verbose':
      case '-v':
        result.verbose = true;
        break;

      case '--max-queries':
        if (nextArg) {
          result.maxQueries = parseInt(nextArg, 10);
          i++;
        }
        break;

      case '--provider':
        if (nextArg && ['google', 'serpapi', 'mock'].includes(nextArg)) {
          result.searchProvider = nextArg as typeof result.searchProvider;
          i++;
        }
        break;

      case '--ai':
        if (nextArg && ['gemini', 'claude'].includes(nextArg)) {
          result.aiProvider = nextArg as AIProvider;
          i++;
        }
        break;

      case '--help':
      case '-h':
        console.log(`
Smart Discovery Agent CLI

Usage:
  pnpm run discovery [options]

Options:
  --mode, -m <mode>       Discovery mode: explore, enumerate, verify (default: explore)
  --platforms, -p <list>  Comma-separated platforms (default: all)
  --countries, -c <list>  Comma-separated countries: CH,DE,AT (default: all)
  --chains <list>         Comma-separated chain names (for enumerate mode)
  --max-queries <n>       Maximum queries to run (default: 20)
  --provider <name>       Search provider: google, serpapi, mock (default: google)
  --ai <provider>         AI provider: gemini, claude (default: auto-detect)
  --dry-run               Don't save results to database
  --verbose, -v           Show detailed logs
  --help, -h              Show this help

Environment Variables:
  GOOGLE_AI_API_KEY       Gemini API key (or GEMINI_API_KEY)
  ANTHROPIC_API_KEY       Claude API key
  GOOGLE_SEARCH_API_KEY   Google Custom Search API key
  GOOGLE_SEARCH_ENGINE_ID Google Custom Search Engine ID

Examples:
  pnpm run discovery --mode explore --countries CH --ai gemini --verbose
  pnpm run discovery --mode enumerate --chains "dean&david,Hiltl"
  pnpm run discovery --provider mock --ai gemini --dry-run
`);
        process.exit(0);
    }
  }

  return result;
}

async function main() {
  const args = parseArgs();

  console.log('🔍 Smart Discovery Agent');
  console.log('========================');
  console.log(`Mode: ${args.mode}`);
  console.log(`Platforms: ${args.platforms.join(', ')}`);
  console.log(`Countries: ${args.countries.join(', ')}`);
  console.log(`Max queries: ${args.maxQueries}`);
  console.log(`Search provider: ${args.searchProvider}`);
  console.log(`AI provider: ${args.aiProvider || 'auto-detect'}`);
  console.log(`Dry run: ${args.dryRun}`);
  console.log('');

  // Create search provider
  let searchProvider;
  switch (args.searchProvider) {
    case 'serpapi':
      searchProvider = new SerpAPIProvider();
      break;
    case 'mock':
      const mock = new MockSearchProvider();
      // Add mock results matching the actual query templates
      // Template: site:just-eat.ch "planted.chicken" {city}
      mock.addMockResults('site:just-eat.ch "planted.chicken" Zürich', [
        {
          title: 'Hiltl - Vegetarian Restaurant | just-eat.ch',
          url: 'https://www.just-eat.ch/en/menu/hiltl-zurich',
          snippet: 'Try our planted.chicken dishes - vegan and delicious bowls',
          position: 1,
        },
        {
          title: 'Tibits Zürich | just-eat.ch',
          url: 'https://www.just-eat.ch/en/menu/tibits-zurich',
          snippet: 'Fresh vegetarian food with planted.chicken options',
          position: 2,
        },
      ]);
      mock.addMockResults('site:just-eat.ch "planted.chicken" Basel', [
        {
          title: 'Klara Basel | just-eat.ch',
          url: 'https://www.just-eat.ch/en/menu/klara-basel',
          snippet: 'Vegan bowls with planted.chicken and fresh vegetables',
          position: 1,
        },
      ]);
      mock.addMockResults('site:just-eat.ch "planted.chicken" Bern', [
        {
          title: 'Chickeria Bern | just-eat.ch',
          url: 'https://www.just-eat.ch/en/menu/chickeria-bern',
          snippet: 'Delicious planted.chicken wraps and salads',
          position: 1,
        },
      ]);
      // Template: site:just-eat.ch planted chicken {city}
      mock.addMockResults('site:just-eat.ch planted chicken Zürich', [
        {
          title: 'Hiltl Zürich | just-eat.ch',
          url: 'https://www.just-eat.ch/en/menu/hiltl-zurich',
          snippet: 'Planted chicken bowls and more',
          position: 1,
        },
      ]);
      // Uber Eats
      mock.addMockResults('site:ubereats.com/ch planted chicken Zürich', [
        {
          title: 'dean&david Zürich | Uber Eats',
          url: 'https://www.ubereats.com/ch/store/dean-david-zurich/abc123',
          snippet: 'Healthy salads and bowls with planted.chicken',
          position: 1,
        },
      ]);
      searchProvider = mock;
      console.log('⚠️  Using mock search provider with test data');
      break;
    default:
      searchProvider = new GoogleSearchProvider();
  }

  // Create agent
  const agent = new SmartDiscoveryAgent(searchProvider, {
    maxQueriesPerRun: args.maxQueries,
    dryRun: args.dryRun,
    verbose: args.verbose,
    aiProvider: args.aiProvider,
  });

  try {
    // Initialize (seeds strategies if needed)
    console.log('Initializing agent...');
    await agent.initialize();

    // Build config
    const config: DiscoveryRunConfig = {
      mode: args.mode,
      platforms: args.platforms,
      countries: args.countries,
      max_queries: args.maxQueries,
    };

    if (args.mode === 'enumerate' && args.chains) {
      config.target_chains = args.chains;
    }

    // Run discovery
    console.log('\nStarting discovery run...\n');
    const run = await agent.runDiscovery(config);

    // Print results
    console.log('\n📊 Discovery Run Complete');
    console.log('=========================');
    console.log(`Run ID: ${run.id}`);
    console.log(`Status: ${run.status}`);
    console.log(`Queries executed: ${run.stats.queries_executed}`);
    console.log(`Queries successful: ${run.stats.queries_successful}`);
    console.log(`Venues discovered: ${run.stats.venues_discovered}`);
    console.log(`Chains detected: ${run.stats.chains_detected}`);

    if (run.errors.length > 0) {
      console.log(`\n⚠️  Errors: ${run.errors.length}`);
      for (const error of run.errors) {
        console.log(`  - ${error.phase}: ${error.message}`);
      }
    }

    // Show overall stats
    console.log('\n📈 Agent Statistics');
    console.log('===================');
    const stats = await agent.getStats();
    console.log(`Total strategies: ${stats.total_strategies}`);
    console.log(`  High performers: ${stats.strategies_by_tier.high}`);
    console.log(`  Medium performers: ${stats.strategies_by_tier.medium}`);
    console.log(`  Low performers: ${stats.strategies_by_tier.low}`);
    console.log(`  Untested: ${stats.strategies_by_tier.untested}`);
    console.log(`Total venues discovered: ${stats.total_venues_discovered}`);
    console.log(`Search success rate: ${(stats.search_success_rate * 100).toFixed(1)}%`);

  } catch (error) {
    console.error('\n❌ Discovery failed:', error);
    process.exit(1);
  }
}

main();
