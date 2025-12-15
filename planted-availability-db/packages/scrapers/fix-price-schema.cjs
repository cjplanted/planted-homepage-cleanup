#!/usr/bin/env node
/**
 * Fix Price Schema Mismatch
 *
 * Some dishes have price as a number with separate currency field:
 *   { price: 33.4, currency: "CHF" }
 *
 * Expected schema is:
 *   { price: { amount: 33.4, currency: "CHF" } }
 *
 * This script fixes the schema mismatch.
 *
 * Usage:
 *   node fix-price-schema.cjs           # Dry run
 *   node fix-price-schema.cjs --execute # Apply fixes
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const path = require('path');

initializeApp({
  credential: cert(path.resolve(__dirname, '../../service-account.json'))
});
const db = getFirestore();

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    execute: args.includes('--execute'),
  };
}

async function fixPriceSchema() {
  const { execute } = parseArgs();

  console.log('\n' + '='.repeat(60));
  console.log(execute ? 'FIXING PRICE SCHEMA (EXECUTE MODE)' : 'PRICE SCHEMA FIX (DRY RUN)');
  console.log('='.repeat(60) + '\n');

  const dishesSnap = await db.collection('dishes').get();
  console.log(`Loaded ${dishesSnap.size} dishes\n`);

  const toFix = [];

  for (const doc of dishesSnap.docs) {
    const dish = doc.data();

    // Check if price is a number (old schema)
    if (typeof dish.price === 'number') {
      toFix.push({
        id: doc.id,
        name: dish.name,
        venue_id: dish.venue_id,
        oldPrice: dish.price,
        currency: dish.currency || 'CHF', // Default to CHF if missing
      });
    }
  }

  console.log(`Found ${toFix.length} dishes with old price schema\n`);

  if (toFix.length === 0) {
    console.log('No dishes to fix');
    return { fixed: 0 };
  }

  // Show examples
  console.log('Examples:');
  toFix.slice(0, 5).forEach(d => {
    console.log(`  ${d.name} (${d.id})`);
    console.log(`    Old: price=${d.oldPrice}, currency="${d.currency}"`);
    console.log(`    New: price={ amount: ${d.oldPrice}, currency: "${d.currency}" }`);
  });

  if (toFix.length > 5) {
    console.log(`  ... and ${toFix.length - 5} more`);
  }

  if (execute) {
    console.log('\nApplying fixes...');
    const batch = db.batch();

    for (const dish of toFix) {
      const docRef = db.collection('dishes').doc(dish.id);
      batch.update(docRef, {
        price: {
          amount: dish.oldPrice,
          currency: dish.currency
        },
        // Remove the separate currency field (if it exists)
        currency: FieldValue.delete()
      });
    }

    await batch.commit();
    console.log(`✓ Fixed ${toFix.length} dishes`);
  } else {
    console.log('\n' + '='.repeat(60));
    console.log('To apply fixes, run:');
    console.log('  node fix-price-schema.cjs --execute');
    console.log('='.repeat(60));
  }

  return { fixed: toFix.length };
}

fixPriceSchema()
  .then(result => {
    console.log('\n✓ Done\n');
    process.exit(0);
  })
  .catch(e => {
    console.error('\n✗ Fatal error:', e);
    process.exit(1);
  });
