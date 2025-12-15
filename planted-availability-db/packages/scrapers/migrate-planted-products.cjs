#!/usr/bin/env node
/**
 * Migrate planted_product to planted_products
 *
 * Some dishes have the old field name "planted_product" (singular)
 * instead of "planted_products" (plural array).
 *
 * This script migrates the old field to the new schema.
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const path = require('path');

initializeApp({
  credential: cert(path.resolve(__dirname, '../../service-account.json'))
});
const db = getFirestore();

async function migratePlantedProducts() {
  console.log('\n' + '='.repeat(60));
  console.log('MIGRATING planted_product → planted_products');
  console.log('='.repeat(60) + '\n');

  const batch = db.batch();
  const ids = ['3ROA9A5xwKqUkktj69gV', 'pUcqH4Risi9KXRajmbAZ', 'px7bFsN3WrynEWEA3DNo'];

  for (const id of ids) {
    const docRef = db.collection('dishes').doc(id);
    const doc = await docRef.get();
    const dish = doc.data();

    console.log(`Migrating: ${dish.name}`);
    console.log(`  Old: planted_product = "${dish.planted_product}"`);
    console.log(`  New: planted_products = ["${dish.planted_product}"]`);

    batch.update(docRef, {
      planted_products: [dish.planted_product],
      planted_product: FieldValue.delete()
    });
  }

  await batch.commit();
  console.log(`\n✓ Migrated ${ids.length} dishes`);
}

migratePlantedProducts()
  .then(() => {
    console.log('\n✓ Done\n');
    process.exit(0);
  })
  .catch(e => {
    console.error('\n✗ Fatal error:', e);
    process.exit(1);
  });
