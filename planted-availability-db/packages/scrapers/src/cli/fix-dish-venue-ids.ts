#!/usr/bin/env npx tsx

/**
 * Migration Script: Fix Dish venue_id References and Schema
 *
 * This script fixes existing dishes in the production collection that may have:
 * 1. Wrong venue_id (pointing to discovered_venues instead of venues)
 * 2. Legacy schema fields (product_sku instead of planted_products, string price)
 *
 * Usage:
 *   npx tsx src/cli/fix-dish-venue-ids.ts [--dry-run]
 *
 * Options:
 *   --dry-run  Preview changes without writing to database
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

import { initializeFirestore, getFirestore, discoveredVenues, venues } from '@pad/database';

initializeFirestore();
const db = getFirestore();

interface DishUpdate {
  dishId: string;
  dishName: string;
  oldVenueId: string;
  newVenueId?: string;
  schemaUpdates: string[];
  status: 'fixed' | 'orphan' | 'ok' | 'error';
  error?: string;
}

/**
 * Parse price from various formats
 */
function parsePrice(price: unknown): { amount: number; currency: string } {
  if (price && typeof price === 'object' && 'amount' in price && 'currency' in price) {
    return price as { amount: number; currency: string };
  }

  if (typeof price === 'string') {
    const match = price.match(/([A-Z]{3}|[€$£])?\s*(\d+(?:[.,]\d+)?)/);
    if (match) {
      const amount = parseFloat(match[2].replace(',', '.'));
      let currency = 'CHF';
      if (match[1]) {
        const symbolMap: Record<string, string> = { '€': 'EUR', '$': 'USD', '£': 'GBP' };
        currency = symbolMap[match[1]] || match[1];
      }
      return { amount: isNaN(amount) ? 0 : amount, currency };
    }
  }

  return { amount: 0, currency: 'CHF' };
}

async function runMigration(dryRun: boolean): Promise<void> {
  console.log('\n🔧 Dish Migration Script');
  console.log('='.repeat(50));
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE (changes will be written)'}\n`);

  // Fetch all production dishes
  const dishesSnapshot = await db.collection('dishes').get();
  console.log(`Found ${dishesSnapshot.size} dishes in production collection\n`);

  if (dishesSnapshot.empty) {
    console.log('No dishes to migrate.');
    return;
  }

  const results: DishUpdate[] = [];
  let fixedCount = 0;
  let orphanCount = 0;
  let okCount = 0;
  let errorCount = 0;

  for (const doc of dishesSnapshot.docs) {
    const data = doc.data();
    const result: DishUpdate = {
      dishId: doc.id,
      dishName: data.name || 'Unknown',
      oldVenueId: data.venue_id,
      schemaUpdates: [],
      status: 'ok',
    };

    try {
      const updates: Record<string, unknown> = {};

      // Check if venue_id exists in production venues collection
      const productionVenue = await venues.getById(data.venue_id);

      if (!productionVenue) {
        // venue_id might point to discovered_venues - try to find production_venue_id
        const discoveredVenue = await discoveredVenues.getById(data.venue_id);

        if (discoveredVenue?.production_venue_id) {
          result.newVenueId = discoveredVenue.production_venue_id;
          updates.venue_id = discoveredVenue.production_venue_id;
          result.schemaUpdates.push(`venue_id: ${data.venue_id} → ${discoveredVenue.production_venue_id}`);
          result.status = 'fixed';
        } else {
          result.status = 'orphan';
          orphanCount++;
          results.push(result);
          continue;
        }
      }

      // Fix product_sku → planted_products
      if (data.product_sku && !data.planted_products) {
        updates.planted_products = [data.product_sku];
        result.schemaUpdates.push(`product_sku → planted_products: [${data.product_sku}]`);
        result.status = 'fixed';
      }

      // Fix string price → object price
      if (typeof data.price === 'string') {
        const parsedPrice = parsePrice(data.price);
        updates.price = parsedPrice;
        result.schemaUpdates.push(`price: "${data.price}" → ${JSON.stringify(parsedPrice)}`);
        result.status = 'fixed';
      }

      // Add missing availability
      if (!data.availability) {
        updates.availability = { type: 'permanent' };
        result.schemaUpdates.push('Added availability: { type: "permanent" }');
        result.status = 'fixed';
      }

      // Add missing last_verified
      if (!data.last_verified) {
        const lastVerified = data.created_at || new Date();
        updates.last_verified = lastVerified;
        result.schemaUpdates.push('Added last_verified from created_at');
        result.status = 'fixed';
      }

      // Add missing source
      if (!data.source) {
        updates.source = { type: 'discovered', partner_id: 'unknown' };
        result.schemaUpdates.push('Added source: { type: "discovered", partner_id: "unknown" }');
        result.status = 'fixed';
      }

      // Apply updates if any
      if (Object.keys(updates).length > 0) {
        updates.updated_at = new Date();

        if (!dryRun) {
          await doc.ref.update(updates);
        }

        fixedCount++;
      } else {
        okCount++;
      }

      results.push(result);
    } catch (error) {
      result.status = 'error';
      result.error = error instanceof Error ? error.message : String(error);
      errorCount++;
      results.push(result);
    }
  }

  // Print summary
  console.log('\n📊 Migration Summary');
  console.log('='.repeat(50));
  console.log(`Total dishes:  ${dishesSnapshot.size}`);
  console.log(`✅ OK (no changes needed): ${okCount}`);
  console.log(`🔧 Fixed: ${fixedCount}`);
  console.log(`⚠️  Orphaned (venue not found): ${orphanCount}`);
  console.log(`❌ Errors: ${errorCount}`);

  // Print details for fixed dishes
  const fixedDishes = results.filter(r => r.status === 'fixed');
  if (fixedDishes.length > 0) {
    console.log('\n🔧 Fixed Dishes:');
    console.log('-'.repeat(50));
    for (const dish of fixedDishes) {
      console.log(`\n  ${dish.dishName} (${dish.dishId})`);
      for (const update of dish.schemaUpdates) {
        console.log(`    → ${update}`);
      }
    }
  }

  // Print orphaned dishes
  const orphanedDishes = results.filter(r => r.status === 'orphan');
  if (orphanedDishes.length > 0) {
    console.log('\n⚠️  Orphaned Dishes (venue_id not found in any collection):');
    console.log('-'.repeat(50));
    for (const dish of orphanedDishes) {
      console.log(`  ${dish.dishName} (${dish.dishId})`);
      console.log(`    venue_id: ${dish.oldVenueId}`);
    }
  }

  // Print errors
  const errorDishes = results.filter(r => r.status === 'error');
  if (errorDishes.length > 0) {
    console.log('\n❌ Errors:');
    console.log('-'.repeat(50));
    for (const dish of errorDishes) {
      console.log(`  ${dish.dishName} (${dish.dishId}): ${dish.error}`);
    }
  }

  if (dryRun) {
    console.log('\n⚡ This was a dry run. Run without --dry-run to apply changes.');
  } else {
    console.log('\n✅ Migration complete!');
  }
}

// Main execution
const dryRun = process.argv.includes('--dry-run');
runMigration(dryRun)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
