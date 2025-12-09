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
        console.log(`Total credentials:     ${stats.totalCredentials}`);
        console.log(`Active credentials:    ${stats.activeCredentials}`);
        console.log(`Disabled credentials:  ${stats.disabledCredentials}`);
        console.log('');
        console.log(`Queries available today: ${stats.totalQueriesAvailableToday}`);
        console.log(`Queries used today:      ${stats.totalQueriesUsedToday}`);
        console.log(`Queries remaining:       ${stats.queriesRemaining}`);
        console.log('');

        const usagePercent = stats.totalQueriesAvailableToday > 0
          ? ((stats.totalQueriesUsedToday / stats.totalQueriesAvailableToday) * 100).toFixed(1)
          : 0;
        console.log(`Usage: ${usagePercent}%`);

        // Visual progress bar
        const barLength = 40;
        const filledLength = Math.round((stats.totalQueriesUsedToday / stats.totalQueriesAvailableToday) * barLength) || 0;
        const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
        console.log(`[${bar}]`);
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
  list        List all credentials with detailed usage
  test        Test getting an available credential
  help        Show this help

Configuration:
  Add credentials using one of these methods:

  1. JSON array (recommended for many credentials):
     GOOGLE_SEARCH_CREDENTIALS='[
       {"apiKey":"AIza...","searchEngineId":"abc123","name":"Project 1"},
       {"apiKey":"AIza...","searchEngineId":"def456","name":"Project 2"}
     ]'

  2. Numbered environment variables:
     GOOGLE_SEARCH_API_KEY_1=AIza...
     GOOGLE_SEARCH_ENGINE_ID_1=abc123
     GOOGLE_SEARCH_API_KEY_2=AIza...
     GOOGLE_SEARCH_ENGINE_ID_2=def456

  3. Single credential (backwards compatible):
     GOOGLE_SEARCH_API_KEY=AIza...
     GOOGLE_SEARCH_ENGINE_ID=abc123

Setup Guide:
  1. Go to https://console.cloud.google.com
  2. Create a new project (or select existing)
  3. Enable "Custom Search API"
  4. Go to "APIs & Services" > "Credentials"
  5. Create an API key
  6. Go to https://programmablesearchengine.google.com
  7. Create a new search engine (search the entire web)
  8. Copy the Search Engine ID
  9. Add both values to your environment

  Repeat for each project to get 100 queries/day each.
  With 20 projects = 2,000 queries/day for free!
`);
    }

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
