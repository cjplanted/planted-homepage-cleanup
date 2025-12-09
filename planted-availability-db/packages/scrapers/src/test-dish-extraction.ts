/**
 * Quick test of dish extraction from a single URL
 * Uses Google's Gemini API for extraction
 */

import { PuppeteerFetcher, closePuppeteerFetcher } from './agents/smart-dish-finder/PuppeteerFetcher.js';
import { DishFinderAIClient } from './agents/smart-dish-finder/DishFinderAIClient.js';

const TEST_URLS = [
  {
    url: 'https://www.lieferando.de/en/menu/dean-david-muenchen-leopoldstrasse',
    venue_id: 'test-dean-david-munich',
    venue_name: 'dean&david München',
    chain_id: 'dean-david',
  },
];

async function testExtraction() {
  console.log('🍽️  Dish Extraction Test (using Gemini)\n');

  const fetcher = new PuppeteerFetcher({ headless: true });
  const aiClient = new DishFinderAIClient();

  try {
    await fetcher.init();

    for (const test of TEST_URLS) {
      console.log(`\n📍 Testing: ${test.venue_name}`);
      console.log(`   URL: ${test.url}\n`);

      // Fetch the page
      console.log('Fetching page...');
      const result = await fetcher.fetchPage(test.url, {
        venue_id: test.venue_id,
        venue_name: test.venue_name,
        chain_id: test.chain_id,
      });

      if (!result.success || !result.page) {
        console.log('❌ Failed to fetch:', result.error);
        continue;
      }

      console.log('✅ Page fetched successfully');
      console.log(`   Platform: ${result.page.platform}`);
      console.log(`   Country: ${result.page.country}`);
      console.log(`   HTML size: ${result.page.html?.length || 0} chars`);
      console.log(`   Has JSON data: ${!!result.page.json_data}`);

      if (result.page.json_data) {
        const jsonStr = JSON.stringify(result.page.json_data);
        console.log(`   JSON data size: ${jsonStr.length} chars`);
      }

      // Extract dishes using Gemini
      console.log('\n🤖 Sending to Gemini for extraction...');

      const extractionResult = await aiClient.extractDishes(result.page);

      console.log('\n📋 Extraction Results:');
      console.log('─'.repeat(60));

      console.log(`Found ${extractionResult.dishes?.length || 0} Planted dishes:\n`);

      for (const dish of (extractionResult.dishes || [])) {
        console.log(`  🍽️  ${dish.name}`);
        if (dish.description) console.log(`      ${dish.description.substring(0, 80)}${dish.description.length > 80 ? '...' : ''}`);
        console.log(`      Price: ${dish.price} ${dish.currency}`);
        console.log(`      Product: ${dish.planted_product_guess} (${dish.product_confidence}% conf)`);
        console.log(`      Vegan: ${dish.is_vegan ? 'Yes' : 'No'}`);
        if (dish.dietary_tags?.length) console.log(`      Tags: ${dish.dietary_tags.join(', ')}`);
        console.log();
      }

      if (extractionResult.page_quality) {
        console.log('\nPage Quality:');
        console.log(`  Menu found: ${extractionResult.page_quality.menu_found}`);
        console.log(`  Prices visible: ${extractionResult.page_quality.prices_visible}`);
        console.log(`  Descriptions: ${extractionResult.page_quality.descriptions_available}`);
        console.log(`  Images: ${extractionResult.page_quality.images_available}`);
      }

      if (extractionResult.extraction_notes) {
        console.log(`\nNotes: ${extractionResult.extraction_notes}`);
      }
    }
  } finally {
    await closePuppeteerFetcher();
    console.log('\n✅ Test complete');
  }
}

testExtraction().catch(console.error);
