#!/usr/bin/env node
/**
 * Copy dishes for additional chains not in the main script
 */

const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');

admin.initializeApp({
  credential: admin.credential.cert(path.resolve(__dirname, '../../service-account.json'))
});
const db = getFirestore();

const EXECUTE = process.argv.includes('--execute');

async function copyChainDishes(chainPattern) {
  console.log('\n=== Processing:', chainPattern, '===');

  const venuesSnap = await db.collection('venues').get();
  const withDishes = [];
  const withoutDishes = [];

  for (const doc of venuesSnap.docs) {
    const v = doc.data();
    const name = (v.name || '').toLowerCase();

    if (!name.includes(chainPattern.toLowerCase())) continue;

    const dishSnap = await db.collection('dishes')
      .where('venue_id', '==', doc.id)
      .get();

    if (dishSnap.size > 0) {
      withDishes.push({
        id: doc.id,
        name: v.name,
        city: v.address?.city,
        dishes: dishSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      });
    } else {
      withoutDishes.push({
        id: doc.id,
        name: v.name,
        city: v.address?.city
      });
    }
  }

  if (withDishes.length === 0) {
    console.log('No venues with dishes found for', chainPattern);
    return 0;
  }

  if (withoutDishes.length === 0) {
    console.log('All venues already have dishes');
    return 0;
  }

  const source = withDishes.sort((a, b) => b.dishes.length - a.dishes.length)[0];
  console.log('Source:', source.name, '(' + source.city + ') -', source.dishes.length, 'dishes');
  console.log('Targets:', withoutDishes.length, 'venues without dishes');

  let totalCopied = 0;
  for (const target of withoutDishes) {
    let copied = 0;
    for (const dish of source.dishes) {
      const newDish = {
        ...dish,
        venue_id: target.id,
        copied_from: dish.id,
        copied_at: new Date().toISOString()
      };
      delete newDish.id;

      if (EXECUTE) {
        await db.collection('dishes').add(newDish);
      }
      copied++;
    }
    console.log(EXECUTE ? '  Copied' : '  Would copy', copied, 'dishes to', target.name, '(' + target.city + ')');
    totalCopied += copied;
  }

  return totalCopied;
}

async function main() {
  console.log('='.repeat(60));
  console.log(EXECUTE ? 'EXECUTING CHAIN DISH COPY' : 'DRY RUN - No changes will be made');
  console.log('='.repeat(60));

  const extraChains = ['katzentempel'];
  let totalCopied = 0;

  for (const chain of extraChains) {
    totalCopied += await copyChainDishes(chain);
  }

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log('Total dishes', EXECUTE ? 'copied:' : 'would copy:', totalCopied);

  if (!EXECUTE && totalCopied > 0) {
    console.log('\nTo execute, run: node copy-extra-chains.cjs --execute');
  }
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.error('Error:', e);
    process.exit(1);
  });
