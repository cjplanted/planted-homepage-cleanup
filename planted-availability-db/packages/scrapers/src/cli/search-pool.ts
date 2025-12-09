#!/usr/bin/env tsx
/**
 * CLI to manage the Search Engine Credential Pool
 *
 * Usage:
 *   pnpm run search-pool stats        Show pool statistics
 *   pnpm run search-pool list         List all credentials with usage
 *   pnpm run search-pool reset        Reset all daily counters (for testing)
 */

import { SearchEnginePool } from '../agents/smart-discovery/SearchEnginePool.js';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'stats';

  const pool = new SearchEnginePool();

  try {
    await pool.initialize();

    switch (command) {
      case 'stats': {
        const stats = await pool.getStats();
        console.log('\n📊 Search Engine Pool Statistics');
        console.log('================================');
        console.log(`Total search engines:  ${stats.totalCredentials}`);
        console.log(`Active engines:        ${stats.activeCredentials}`);
        console.log(`Disabled engines:      ${stats.disabledCredentials}`);
        console.log('');

        // Display mode
        const modeIcon = stats.mode === 'free' ? '🆓' : '💳';
        console.log(`Current mode: ${modeIcon} ${stats.mode.toUpperCase()}`);
        console.log('');

        // Free quota
        console.log('FREE QUOTA (100 queries/engine/day)');
        console.log('-----------------------------------');
        console.log(`Used:      ${stats.freeQueriesUsed} / ${stats.freeQueriesTotal}`);
        console.log(`Remaining: ${stats.queriesRemaining}`);

        const usagePercent = stats.freeQueriesTotal > 0
          ? ((stats.freeQueriesUsed / stats.freeQueriesTotal) * 100).toFixed(1)
          : 0;
        console.log(`Usage:     ${usagePercent}%`);

        // Visual progress bar
        const barLength = 40;
        const filledLength = Math.round((stats.freeQueriesUsed / stats.freeQueriesTotal) * barLength) || 0;
        const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
        console.log(`[${bar}]`);

        // Paid usage
        if (stats.paidQueriesUsed > 0) {
          console.log('');
          console.log('PAID USAGE ($5 per 1000 queries)');
          console.log('--------------------------------');
          console.log(`Queries used: ${stats.paidQueriesUsed}`);
          console.log(`Estimated cost: $${stats.estimatedCost.toFixed(2)}`);
        }

        // Total
        console.log('');
        console.log('TOTAL TODAY');
        console.log('-----------');
        console.log(`Total queries: ${stats.totalQueriesUsedToday}`);

        break;
      }

      case 'list': {
        const detailed = await pool.getDetailedUsage();
        console.log('\n📋 Credential Details');
        console.log('=====================');

        for (const { credential, usage } of detailed) {
          const status = usage.isDisabled ? '❌ DISABLED' : '✅ Active';
          const remaining = usage.dailyLimit - usage.queriesUsedToday;

          console.log(`\n${credential.name || credential.id} (${status})`);
          console.log(`  ID: ${credential.id}`);
          console.log(`  API Key: ${credential.apiKey}`);
          console.log(`  Search Engine ID: ${credential.searchEngineId}`);
          console.log(`  Today: ${usage.queriesUsedToday}/${usage.dailyLimit} (${remaining} remaining)`);
          console.log(`  All-time: ${usage.totalQueriesAllTime} queries`);
          console.log(`  Last reset: ${usage.lastResetDate}`);

          if (usage.isDisabled && usage.disabledReason) {
            console.log(`  Disabled reason: ${usage.disabledReason}`);
          }
        }
        break;
      }

      case 'test': {
        console.log('\n🧪 Testing credential rotation...');
        const credential = await pool.getAvailableCredential();

        if (credential) {
          console.log(`✅ Got credential: ${credential.name || credential.id}`);
          console.log(`   API Key: ${credential.apiKey.slice(0, 15)}...`);
          console.log(`   Search Engine: ${credential.searchEngineId}`);
        } else {
          console.log('❌ No credentials available');
        }
        break;
      }

      case 'help':
      default:
        console.log(`
Search Engine Pool Manager

Usage:
  pnpm run search-pool <command>

Commands:
  stats       Show pool statistics (default)
  list        List all search engines with detailed usage
  test        Test getting an available credential
  help        Show this help

Configuration:
  Supports 6 search engines with a single API key:

  GOOGLE_SEARCH_API_KEY=AIza...           (required - shared across all engines)
  GOOGLE_SEARCH_ENGINE_ID_1=abc123...     (optional - defaults to predefined IDs)
  GOOGLE_SEARCH_ENGINE_ID_2=def456...     (optional)
  ... up to GOOGLE_SEARCH_ENGINE_ID_6

Free Quota:
  - Each search engine gets 100 free queries per day
  - Total: 6 engines × 100 = 600 free queries/day
  - Resets daily at midnight UTC

Paid Fallback:
  - After exhausting all free quota, automatically switches to paid mode
  - Paid mode: $5 per 1,000 queries (account-wide)
  - Cost tracking is shown in stats

Setup Guide:
  1. Go to https://console.cloud.google.com
  2. Create a new project (or use existing)
  3. Enable "Custom Search API"
  4. Go to "APIs & Services" > "Credentials"
  5. Create an API key → Set as GOOGLE_SEARCH_API_KEY
  6. Go to https://programmablesearchengine.google.com
  7. Create 6 search engines (search the entire web)
  8. Copy each Search Engine ID → Set as GOOGLE_SEARCH_ENGINE_ID_1 through _6
     (Or use the predefined IDs - they will be loaded automatically)
  9. Enable billing on your Google Cloud project for paid mode support

With this setup: 600 free queries/day, then $5/1000 after that!
`);
    }

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
