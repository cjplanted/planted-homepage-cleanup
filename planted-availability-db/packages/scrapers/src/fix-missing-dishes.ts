#!/usr/bin/env node
/**
 * Fix Missing Dishes Script
 *
 * This script identifies discovered venues that have confidence factors
 * mentioning dishes were found, but have empty dishes arrays.
 * It then re-extracts dishes from the delivery platform URLs.
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '../../..');

// Load environment variables from root .env
config({ path: resolve(rootDir, '.env') });

// Fix relative service account path to absolute
if (process.env.GOOGLE_APPLICATION_CREDENTIALS?.startsWith('./')) {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = resolve(
    rootDir,
    process.env.GOOGLE_APPLICATION_CREDENTIALS.slice(2)
  );
}

import { initializeFirestore, discoveredVenues } from '@pad/database';
import type { DeliveryPlatform, SupportedCountry } from '@pad/core';
import { PuppeteerFetcher, closePuppeteerFetcher } from './agents/smart-dish-finder/PuppeteerFetcher.js';
import { DishFinderAIClient } from './agents/smart-dish-finder/DishFinderAIClient.js';

// Initialize Firestore
initializeFirestore();

// Global fetcher and AI client for reuse
let puppeteerFetcher: PuppeteerFetcher | null = null;
let dishFinderAI: DishFinderAIClient | null = null;

interface CliArgs {
  dryRun: boolean;
  verbose: boolean;
  maxVenues?: number;
  country?: string;
  status?: string;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const result: CliArgs = {
    dryRun: false,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--dry-run' || arg === '-d') {
      result.dryRun = true;
    } else if (arg === '--verbose' || arg === '-v') {
      result.verbose = true;
    } else if (arg === '--max' || arg === '-m') {
      result.maxVenues = parseInt(args[++i], 10);
    } else if (arg === '--country' || arg === '-c') {
      result.country = args[++i];
    } else if (arg === '--status' || arg === '-s') {
      result.status = args[++i];
    }
  }

  return result;
}

function printUsage(): void {
  console.log(`
Fix Missing Dishes - Re-extract dishes for venues with empty dish arrays

Usage: pnpm tsx src/fix-missing-dishes.ts [options]

Options:
  -d, --dry-run     Find venues but don't extract (analysis only)
  -v, --verbose     Verbose output
  -m, --max N       Process maximum N venues
  -c, --country CC  Filter by country code (DE, CH, AT)
  -s, --status S    Filter by status (discovered, verified)

Examples:
  pnpm tsx src/fix-missing-dishes.ts --dry-run -v
  pnpm tsx src/fix-missing-dishes.ts --country DE --max 10
  pnpm tsx src/fix-missing-dishes.ts --status discovered -v
`);
}

async function findVenuesWithMissingDishes(args: CliArgs) {
  console.log('\n🔍 Finding venues with missing dishes...\n');

  // Get all venues based on status filter
  const status = args.status || 'discovered';
  let allVenues = await discoveredVenues.getByStatus(status as any);

  if (args.verbose) {
    console.log(`Found ${allVenues.length} venues with status "${status}"`);
  }

  // Filter by country if specified
  if (args.country) {
    allVenues = allVenues.filter(v => v.address.country === args.country);
    if (args.verbose) {
      console.log(`Filtered to ${allVenues.length} venues in ${args.country}`);
    }
  }

  // Find venues that:
  // 1. Have empty dishes array
  // 2. Have confidence factors mentioning dishes
  const venuesWithMissingDishes = allVenues.filter(venue => {
    // Check if dishes array is empty
    if (venue.dishes && venue.dishes.length > 0) {
      return false;
    }

    // Check if any confidence factor mentions dishes
    const hasDishFactor = venue.confidence_factors?.some(factor => {
      const reason = factor.reason.toLowerCase();
      return reason.includes('dish') ||
             reason.includes('menu') ||
             reason.includes('planted.chicken') ||
             reason.includes('planted.pulled') ||
             reason.includes('planted.kebab');
    });

    // Also check planted_products
    const hasProducts = venue.planted_products && venue.planted_products.length > 0;

    return hasDishFactor || hasProducts;
  });

  console.log(`\n📊 Analysis Results:`);
  console.log(`   Total venues: ${allVenues.length}`);
  console.log(`   Venues with dishes: ${allVenues.filter(v => v.dishes?.length > 0).length}`);
  console.log(`   Venues missing dishes (but evidence found): ${venuesWithMissingDishes.length}`);
  console.log(`   Venues with no dish evidence: ${allVenues.length - allVenues.filter(v => v.dishes?.length > 0).length - venuesWithMissingDishes.length}`);

  return venuesWithMissingDishes;
}

async function extractDishesForVenue(
  venueId: string,
  venueName: string,
  url: string,
  platform: DeliveryPlatform,
  country: SupportedCountry,
  dryRun: boolean,
  verbose: boolean
): Promise<{ success: boolean; dishCount: number; error?: string }> {
  if (verbose) {
    console.log(`\n   Extracting dishes from ${url}`);
  }

  if (dryRun) {
    return { success: true, dishCount: 0 };
  }

  try {
    // Initialize Puppeteer fetcher if not already done
    if (!puppeteerFetcher) {
      puppeteerFetcher = new PuppeteerFetcher({ headless: true });
      await puppeteerFetcher.init();
    }

    // Initialize AI client if not already done
    if (!dishFinderAI) {
      dishFinderAI = new DishFinderAIClient();
    }

    // Fetch the page with Puppeteer (handles JS-rendered content)
    const fetchResult = await puppeteerFetcher.fetchPage(url, {
      venue_id: venueId,
      venue_name: venueName,
    }, {
      scrollToBottom: true, // Load lazy content
      extractJson: true,    // Extract embedded JSON data
    });

    if (!fetchResult.success || !fetchResult.page) {
      if (verbose) {
        console.log(`   ⚠️ Failed to fetch page: ${fetchResult.error}`);
      }
      return { success: false, dishCount: 0, error: fetchResult.error };
    }

    // Now extract dishes using AI
    const result = await dishFinderAI.extractDishes(fetchResult.page);

    if (result.dishes.length > 0) {
      // Convert to the format expected by discoveredVenues
      const dishes = result.dishes.map(dish => ({
        name: dish.name,
        description: dish.description,
        price: dish.price,
        currency: dish.currency,
        planted_product: dish.planted_product_guess || 'planted.chicken',
        is_vegan: dish.is_vegan,
        confidence: dish.product_confidence || 50,
      }));

      // Update the venue with the extracted dishes
      await discoveredVenues.update(venueId, { dishes });

      if (verbose) {
        console.log(`   ✅ Found ${dishes.length} dishes`);
        dishes.forEach(d => console.log(`      - ${d.name} (${d.planted_product})`));
      }

      return { success: true, dishCount: dishes.length };
    } else {
      if (verbose) {
        console.log(`   ⚠️ No dishes found`);
        if (result.extraction_notes) {
          console.log(`   Notes: ${result.extraction_notes}`);
        }
      }
      return { success: true, dishCount: 0 };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (verbose) {
      console.log(`   ❌ Error: ${message}`);
    }
    return { success: false, dishCount: 0, error: message };
  }
}

async function main(): Promise<void> {
  const args = parseArgs();

  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  console.log(`\n🍽️  Fix Missing Dishes`);
  console.log(`   Mode: ${args.dryRun ? 'DRY RUN (analysis only)' : 'LIVE (will extract dishes)'}`);
  if (args.country) console.log(`   Country: ${args.country}`);
  if (args.maxVenues) console.log(`   Max venues: ${args.maxVenues}`);
  if (args.status) console.log(`   Status filter: ${args.status}`);

  try {
    // Find venues with missing dishes
    const venuesWithMissingDishes = await findVenuesWithMissingDishes(args);

    if (venuesWithMissingDishes.length === 0) {
      console.log('\n✅ No venues found with missing dishes!\n');
      process.exit(0);
    }

    // Limit if max specified
    const venuesToProcess = args.maxVenues
      ? venuesWithMissingDishes.slice(0, args.maxVenues)
      : venuesWithMissingDishes;

    console.log(`\n📋 Venues with missing dishes (${venuesToProcess.length}/${venuesWithMissingDishes.length}):\n`);

    // Show list of venues
    venuesToProcess.forEach((venue, idx) => {
      const platforms = venue.delivery_platforms.map(p => p.platform).join(', ');
      const factors = venue.confidence_factors
        ?.filter(f => f.reason.toLowerCase().includes('dish') || f.reason.toLowerCase().includes('menu'))
        .map(f => f.reason)
        .slice(0, 2);

      console.log(`${idx + 1}. ${venue.name} (${venue.address.city}, ${venue.address.country})`);
      console.log(`   Platforms: ${platforms}`);
      console.log(`   Products: ${venue.planted_products?.join(', ') || 'none'}`);
      if (factors?.length) {
        console.log(`   Evidence: ${factors.join('; ')}`);
      }
    });

    if (args.dryRun) {
      console.log('\n📝 DRY RUN - No changes made');
      console.log('   Run without --dry-run to extract dishes\n');
      process.exit(0);
    }

    // Process venues
    console.log(`\n🚀 Processing ${venuesToProcess.length} venues...\n`);

    let successCount = 0;
    let failCount = 0;
    let totalDishes = 0;

    for (const venue of venuesToProcess) {
      console.log(`\n[${successCount + failCount + 1}/${venuesToProcess.length}] ${venue.name}`);

      // Get the first available delivery platform URL
      const platform = venue.delivery_platforms[0];
      if (!platform?.url) {
        console.log(`   ⚠️ No delivery URL available, skipping`);
        continue;
      }

      // Detect platform type
      let platformType: DeliveryPlatform = 'wolt';
      if (platform.url.includes('lieferando')) platformType = 'lieferando';
      else if (platform.url.includes('ubereats')) platformType = 'uber-eats';
      else if (platform.url.includes('just-eat') || platform.url.includes('eat.ch')) platformType = 'just-eat';
      else if (platform.url.includes('smood')) platformType = 'smood';

      // Fix eat.ch URLs - ensure they point to menu page
      let urlToFetch = platform.url;
      if (platform.url.includes('eat.ch') && !platform.url.includes('/menu/') && !platform.url.includes('/speisekarte/')) {
        // Convert "eat.ch/restaurant-name" to "eat.ch/en/menu/restaurant-name"
        const urlObj = new URL(platform.url);
        const pathParts = urlObj.pathname.split('/').filter(p => p);
        // Remove language prefix if present (en, de, fr, it)
        const langPrefixes = ['en', 'de', 'fr', 'it'];
        if (pathParts.length > 0 && langPrefixes.includes(pathParts[0])) {
          pathParts.shift();
        }
        if (pathParts.length > 0 && pathParts[0] !== 'menu' && pathParts[0] !== 'speisekarte') {
          // Construct menu URL
          urlToFetch = `${urlObj.origin}/en/menu/${pathParts.join('/')}`;
          if (args.verbose) {
            console.log(`   Converting URL to menu page: ${urlToFetch}`);
          }
        }
      }

      const result = await extractDishesForVenue(
        venue.id,
        venue.name,
        urlToFetch,
        platformType,
        venue.address.country as SupportedCountry,
        args.dryRun,
        args.verbose
      );

      if (result.success) {
        successCount++;
        totalDishes += result.dishCount;
      } else {
        failCount++;
      }

      // Rate limiting - wait 3 seconds between venues
      if (venuesToProcess.indexOf(venue) < venuesToProcess.length - 1) {
        await new Promise(r => setTimeout(r, 3000));
      }
    }

    console.log(`\n📊 Results:`);
    console.log(`   Processed: ${successCount + failCount}`);
    console.log(`   Successful: ${successCount}`);
    console.log(`   Failed: ${failCount}`);
    console.log(`   Total dishes found: ${totalDishes}`);
    console.log('');

    // Clean up Puppeteer browser
    await closePuppeteerFetcher();

    process.exit(failCount > 0 ? 1 : 0);
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    // Clean up on error too
    await closePuppeteerFetcher();
    process.exit(1);
  }
}

main();
