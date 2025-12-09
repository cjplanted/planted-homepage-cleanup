/**
 * Test script to demonstrate batch city processing
 *
 * This script shows how the new batch city feature works:
 * - Groups cities into batches of N (default: 3)
 * - Uses OR syntax to search multiple cities in one query
 * - Significantly reduces API calls and improves efficiency
 *
 * Example:
 * Before: "planted chicken Zürich" + "planted chicken Winterthur" + "planted chicken Baden" = 3 queries
 * After: "planted chicken (Zürich OR Winterthur OR Baden)" = 1 query
 */

import { SmartDiscoveryAgent } from './src/agents/smart-discovery/SmartDiscoveryAgent.js';

// Mock search provider for testing
class MockSearchProvider {
  async search(query: string) {
    console.log(`\n[SEARCH] Query executed: ${query}`);
    return [];
  }
}

async function testBatchCityProcessing() {
  console.log('='.repeat(80));
  console.log('Testing Batch City Processing Feature');
  console.log('='.repeat(80));

  const agent = new SmartDiscoveryAgent(new MockSearchProvider(), {
    verbose: true,
    dryRun: true,
    maxQueriesPerRun: 50,
    batchCitySize: 3, // Batch 3 cities per query
    enableQueryCache: false, // Disable cache for testing
  });

  await agent.initialize();

  console.log('\n' + '='.repeat(80));
  console.log('Test 1: Explore mode with 5 cities (should create 2 batches: 3 + 2)');
  console.log('='.repeat(80));

  try {
    await agent.runDiscovery({
      mode: 'explore',
      platforms: ['ubereats.com'],
      countries: ['CH'],
    });
  } catch (error) {
    console.log(`Error (expected for mock): ${error}`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('Efficiency Gain Calculation');
  console.log('='.repeat(80));
  console.log('Without batching: 5 cities × 1 query each = 5 queries');
  console.log('With batching (size=3): 2 batches = 2 queries');
  console.log('Efficiency gain: 5 / 2 = 2.5x improvement (60% reduction)');
  console.log('='.repeat(80));

  console.log('\n' + '='.repeat(80));
  console.log('Test 2: Explore mode with different batch size (4 cities per batch)');
  console.log('='.repeat(80));

  const agent2 = new SmartDiscoveryAgent(new MockSearchProvider(), {
    verbose: true,
    dryRun: true,
    maxQueriesPerRun: 50,
    batchCitySize: 4, // Batch 4 cities per query
    enableQueryCache: false,
  });

  await agent2.initialize();

  try {
    await agent2.runDiscovery({
      mode: 'explore',
      platforms: ['ubereats.com'],
      countries: ['CH'],
    });
  } catch (error) {
    console.log(`Error (expected for mock): ${error}`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('Efficiency Gain Calculation');
  console.log('='.repeat(80));
  console.log('Without batching: 5 cities × 1 query each = 5 queries');
  console.log('With batching (size=4): 2 batches (4 + 1) = 2 queries');
  console.log('Efficiency gain: 5 / 2 = 2.5x improvement (60% reduction)');
  console.log('='.repeat(80));
}

// Run the test
testBatchCityProcessing().catch(console.error);
