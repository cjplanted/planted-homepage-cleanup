#!/usr/bin/env node
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '../../..');
config({ path: resolve(rootDir, '.env') });

if (process.env.GOOGLE_APPLICATION_CREDENTIALS?.startsWith('./')) {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = resolve(
    rootDir,
    process.env.GOOGLE_APPLICATION_CREDENTIALS.slice(2)
  );
}

import { initializeFirestore, discoveredDishes, discoveredVenues } from '@pad/database';
initializeFirestore();

async function main() {
  // Get all discovered dishes
  const allDishes = await discoveredDishes.getAll();
  console.log('Total dishes in database:', allDishes.length);

  if (allDishes.length > 0) {
    // Group by venue
    const byVenue: Record<string, typeof allDishes> = {};
    for (const d of allDishes) {
      if (!byVenue[d.venue_id]) byVenue[d.venue_id] = [];
      byVenue[d.venue_id].push(d);
    }
    console.log('\nVenues with dishes:', Object.keys(byVenue).length);

    // Show venues and their dish counts
    console.log('\nDishes per venue:');
    for (const [venueId, dishes] of Object.entries(byVenue)) {
      const venue = await discoveredVenues.getById(venueId);
      console.log(`  ${venue?.name || venueId}: ${dishes.length} dishes`);
    }

    // Show sample dishes
    console.log('\nSample dishes:');
    for (const d of allDishes.slice(0, 5)) {
      console.log(`  - ${d.name} (${d.planted_product || 'unknown product'})`);
      if (d.price_by_country) {
        console.log(`    Prices:`, JSON.stringify(d.price_by_country));
      }
    }
  }
}

main();
