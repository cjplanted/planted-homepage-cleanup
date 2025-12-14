#!/usr/bin/env node
/**
 * Fix Duplicate Venues - DYNAMIC VERSION
 *
 * Automatically finds all duplicate venues (same name+city) and safely deletes
 * those with fewer dishes, keeping the primary with most dishes.
 *
 * Usage:
 *   node fix-duplicates.cjs                    # Dry run - show what would be deleted
 *   node fix-duplicates.cjs --execute          # Actually delete
 *   node fix-duplicates.cjs --chain="Vapiano"  # Filter by chain name
 *   node fix-duplicates.cjs --country=UK       # Filter by country
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');

initializeApp({
  credential: cert(path.resolve(__dirname, '../../service-account.json'))
});
const db = getFirestore();

function normalizeKey(name, city, street) {
  // Normalize: lowercase, remove special chars, trim
  const normName = (name || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
  const normCity = (city || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();

  // For retail chains (BILLA, REWE, INTERSPAR, Coop, Brezelkönig), include street
  // to avoid false positives (same name in same city but different locations)
  const retailChains = ['billa', 'rewe', 'interspar', 'coop', 'brezelkonig', 'brezelkoenig'];
  const isRetail = retailChains.some(chain => normName.includes(chain));

  if (isRetail && street) {
    const normStreet = (street || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
    return `${normName}:${normCity}:${normStreet}`;
  }

  return `${normName}:${normCity}`;
}

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    execute: args.includes('--execute'),
    chain: args.find(a => a.startsWith('--chain='))?.split('=')[1],
    country: args.find(a => a.startsWith('--country='))?.split('=')[1],
  };
}

async function findAllDuplicates(filterChain, filterCountry) {
  console.log('Scanning for duplicate venues...\n');

  // Get all venues
  const venuesSnap = await db.collection('venues').get();
  console.log(`Total venues in database: ${venuesSnap.size}\n`);

  // Group by normalized name+city
  const groups = {};
  let processed = 0;

  for (const doc of venuesSnap.docs) {
    const v = doc.data();
    const city = v.address?.city || v.city || '';
    const country = v.address?.country || v.country || '';

    // Apply filters
    if (filterChain && !v.name?.toLowerCase().includes(filterChain.toLowerCase())) {
      continue;
    }
    if (filterCountry && country.toUpperCase() !== filterCountry.toUpperCase()) {
      continue;
    }

    const street = v.address?.street || v.street || '';
    const key = normalizeKey(v.name, city, street);
    if (!groups[key]) groups[key] = [];

    // Get dish count
    const dishSnap = await db.collection('dishes')
      .where('venue_id', '==', doc.id)
      .count()
      .get();

    groups[key].push({
      id: doc.id,
      name: v.name,
      city: city,
      country: country,
      dishes: dishSnap.data().count,
    });

    processed++;
    if (processed % 100 === 0) {
      process.stdout.write(`\rProcessed ${processed} venues...`);
    }
  }
  console.log(`\rProcessed ${processed} venues total.`);

  // Find groups with duplicates
  return Object.entries(groups)
    .filter(([key, venues]) => venues.length > 1)
    .sort((a, b) => b[1].length - a[1].length);
}

async function fixDuplicates() {
  const { execute, chain, country } = parseArgs();

  console.log(`\n${'='.repeat(60)}`);
  console.log(execute ? '🚀 EXECUTING DUPLICATE FIX' : '🔍 DRY RUN - No changes will be made');
  if (chain) console.log(`   Filtering by chain: ${chain}`);
  if (country) console.log(`   Filtering by country: ${country}`);
  console.log(`${'='.repeat(60)}\n`);

  const duplicates = await findAllDuplicates(chain, country);

  if (duplicates.length === 0) {
    console.log('✓ No duplicates found!');
    return { deleted: 0, skipped: 0, errors: 0, wouldLoseData: 0 };
  }

  console.log(`\nFound ${duplicates.length} groups with duplicates:\n`);

  let deleted = 0;
  let skipped = 0;
  let errors = 0;
  let wouldLoseData = 0;

  for (const [key, venues] of duplicates) {
    // Sort by dishes (keep the one with most dishes)
    venues.sort((a, b) => b.dishes - a.dishes);

    const primary = venues[0];
    const duplicatesToDelete = venues.slice(1);

    console.log(`\n📍 ${primary.name} - ${primary.city} (${primary.country})`);
    console.log(`   ✓ Keep: ${primary.id} (${primary.dishes} dishes)`);

    for (const dup of duplicatesToDelete) {
      if (dup.dishes > 0) {
        // SAFETY: Never delete venues with dishes
        console.log(`   ⚠️ SKIP: ${dup.id} (${dup.dishes} dishes) - would lose data!`);
        wouldLoseData++;
        continue;
      }

      if (execute) {
        try {
          await db.collection('venues').doc(dup.id).delete();
          console.log(`   ✅ Deleted: ${dup.id}`);
          deleted++;
        } catch (e) {
          console.log(`   ❌ Error deleting ${dup.id}: ${e.message}`);
          errors++;
        }
      } else {
        console.log(`   📝 Would delete: ${dup.id}`);
        deleted++;
      }
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Duplicate groups found: ${duplicates.length}`);
  console.log(`${execute ? 'Deleted' : 'Would delete'}: ${deleted}`);
  console.log(`Skipped (would lose data): ${wouldLoseData}`);
  console.log(`Errors: ${errors}`);

  if (!execute && deleted > 0) {
    console.log(`\n💡 To actually delete, run:`);
    console.log(`   node fix-duplicates.cjs --execute`);
  }

  return { deleted, skipped, errors, wouldLoseData };
}

fixDuplicates()
  .then(result => {
    console.log('\n✓ Done');
    process.exit(result.errors > 0 ? 1 : 0);
  })
  .catch(e => {
    console.error('\n❌ Fatal error:', e);
    process.exit(1);
  });
