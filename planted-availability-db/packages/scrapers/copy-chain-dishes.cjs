#!/usr/bin/env node
/**
 * Copy Chain Dishes
 *
 * For chain restaurants, all locations serve the same menu.
 * This script copies dishes from a venue WITH dishes to all venues WITHOUT dishes.
 *
 * Usage:
 *   node copy-chain-dishes.cjs                    # Dry run
 *   node copy-chain-dishes.cjs --execute          # Actually copy
 *   node copy-chain-dishes.cjs --chain="dean&david"  # Filter by chain
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');

initializeApp({
  credential: cert(path.resolve(__dirname, '../../service-account.json'))
});
const db = getFirestore();

// Chain patterns to process
const CHAIN_PATTERNS = [
  'dean&david',
  'birdie birdie',
  'rice up',
  'doen doen',
  'subway',
  'kebhouze',
  'chidoba',
  'kaisin',
  'cap',
  'barburrito',
  'vapiano',
  'neni',
  'beets & roots',
  'yuícery',
  'stadtsalat',
  'cotidiano',
  '60 seconds',
  'fat monk',
  'immergrün',
  'tibits',
  'brezelkönig',
  'nooch',
  'green club',
];

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    execute: args.includes('--execute'),
    chain: args.find(a => a.startsWith('--chain='))?.split('=')[1],
  };
}

async function getVenuesByChain(chainPattern) {
  const venuesSnap = await db.collection('venues').get();
  const withDishes = [];
  const withoutDishes = [];

  for (const doc of venuesSnap.docs) {
    const v = doc.data();
    const name = (v.name || '').toLowerCase();

    if (!name.includes(chainPattern.toLowerCase())) continue;

    // Get dish count
    const dishSnap = await db.collection('dishes')
      .where('venue_id', '==', doc.id)
      .get();

    if (dishSnap.size > 0) {
      withDishes.push({
        id: doc.id,
        name: v.name,
        city: v.address?.city || v.city,
        country: v.address?.country || v.country,
        dishes: dishSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      });
    } else {
      withoutDishes.push({
        id: doc.id,
        name: v.name,
        city: v.address?.city || v.city,
        country: v.address?.country || v.country,
      });
    }
  }

  return { withDishes, withoutDishes };
}

async function copyDishesToVenue(sourceDishes, targetVenueId, execute) {
  const copied = [];

  for (const dish of sourceDishes) {
    // Create new dish document for target venue
    const newDish = {
      ...dish,
      venue_id: targetVenueId,
      copied_from: dish.id,
      copied_at: new Date().toISOString(),
    };
    delete newDish.id; // Remove source ID

    if (execute) {
      const docRef = await db.collection('dishes').add(newDish);
      copied.push({ id: docRef.id, name: dish.name });
    } else {
      copied.push({ id: '(would create)', name: dish.name });
    }
  }

  return copied;
}

async function copyChainDishes() {
  const { execute, chain } = parseArgs();

  console.log(`\n${'='.repeat(60)}`);
  console.log(execute ? 'EXECUTING CHAIN DISH COPY' : 'DRY RUN - No changes will be made');
  if (chain) console.log(`   Filtering by chain: ${chain}`);
  console.log(`${'='.repeat(60)}\n`);

  const chainsToProcess = chain
    ? CHAIN_PATTERNS.filter(c => c.toLowerCase().includes(chain.toLowerCase()))
    : CHAIN_PATTERNS;

  let totalCopied = 0;
  let totalVenuesUpdated = 0;
  let errors = 0;

  for (const chainPattern of chainsToProcess) {
    console.log(`\n Processing: ${chainPattern}`);
    console.log('-'.repeat(40));

    const { withDishes, withoutDishes } = await getVenuesByChain(chainPattern);

    if (withDishes.length === 0) {
      console.log(`   No venues with dishes found for ${chainPattern}`);
      continue;
    }

    if (withoutDishes.length === 0) {
      console.log(`   All ${chainPattern} venues already have dishes`);
      continue;
    }

    // Use the venue with most dishes as source
    const sourceVenue = withDishes.sort((a, b) => b.dishes.length - a.dishes.length)[0];
    console.log(`   Source: ${sourceVenue.name} (${sourceVenue.city}) - ${sourceVenue.dishes.length} dishes`);
    console.log(`   Targets: ${withoutDishes.length} venues without dishes\n`);

    for (const target of withoutDishes) {
      try {
        const copied = await copyDishesToVenue(sourceVenue.dishes, target.id, execute);
        console.log(`   ${execute ? 'Copied' : 'Would copy'} ${copied.length} dishes to ${target.name} (${target.city})`);
        totalCopied += copied.length;
        totalVenuesUpdated++;
      } catch (e) {
        console.log(`   Error copying to ${target.name}: ${e.message}`);
        errors++;
      }
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Chains processed: ${chainsToProcess.length}`);
  console.log(`Venues updated: ${totalVenuesUpdated}`);
  console.log(`Dishes ${execute ? 'copied' : 'would copy'}: ${totalCopied}`);
  console.log(`Errors: ${errors}`);

  if (!execute && totalCopied > 0) {
    console.log(`\n To actually copy, run:`);
    console.log(`   node copy-chain-dishes.cjs --execute`);
  }

  return { totalCopied, totalVenuesUpdated, errors };
}

copyChainDishes()
  .then(result => {
    console.log('\n Done');
    process.exit(result.errors > 0 ? 1 : 0);
  })
  .catch(e => {
    console.error('\n Fatal error:', e);
    process.exit(1);
  });
