#!/usr/bin/env node
/**
 * Fix remaining duplicate/chain venues
 *
 * 1. Copy NENI dishes to NENI am Prater
 * 2. Copy Hiltl dishes to planted.bistro by Hiltl
 * 3. Copy Doen Doen dishes to Stuttgart duplicate
 * 4. Optionally delete the truly duplicate venues
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');

initializeApp({
  credential: cert(path.resolve(__dirname, '../../service-account.json'))
});
const db = getFirestore();

async function fixRemaining(dryRun = true) {
  console.log(`Fix Remaining Duplicates Script (${dryRun ? 'DRY RUN' : 'EXECUTE MODE'})`);
  console.log('='.repeat(70));

  let dishesCreated = 0;
  let venuesUpdated = 0;

  // 1. NENI - copy dishes from existing NENI venue to NENI am Prater
  console.log('\n--- NENI am Prater ---');

  // Find source NENI with dishes
  const neniDishes = await db.collection('dishes')
    .where('venue_id', '==', '6ZOimYI3lDQ9c8bEO6Sm') // NENI Zürich (from progress file)
    .get();

  if (neniDishes.size === 0) {
    // Try finding any NENI venue with dishes
    const allVenues = await db.collection('venues').get();
    for (const doc of allVenues.docs) {
      const data = doc.data();
      if ((data.name || '').toLowerCase().includes('neni')) {
        const dishes = await db.collection('dishes').where('venue_id', '==', doc.id).get();
        if (dishes.size > 0) {
          console.log(`Found NENI source: ${data.name} (${doc.id}) with ${dishes.size} dishes`);
        }
      }
    }
  }

  const neniTargetId = '00FhJOGFf2i9Ns6PuQKS'; // NENI am Prater
  const existingNeniDishes = await db.collection('dishes').where('venue_id', '==', neniTargetId).get();

  if (existingNeniDishes.size > 0) {
    console.log(`SKIP: NENI am Prater already has ${existingNeniDishes.size} dishes`);
  } else if (neniDishes.size > 0) {
    console.log(`Copying ${neniDishes.size} dishes to NENI am Prater`);
    for (const doc of neniDishes.docs) {
      const data = doc.data();
      const newDish = { ...data, venue_id: neniTargetId, created_at: new Date(), updated_at: new Date() };
      delete newDish.id;

      if (dryRun) {
        console.log(`  [DRY RUN] Would create: ${data.name}`);
      } else {
        const ref = await db.collection('dishes').add(newDish);
        console.log(`  Created: ${data.name} (${ref.id})`);
      }
      dishesCreated++;
    }
    venuesUpdated++;
  } else {
    // Manually create NENI dish (from progress file)
    const neniDish = {
      venue_id: neniTargetId,
      name: 'Jerusalem Plate with planted.chicken',
      description: 'NENI special edition partnership dish with Planted',
      price: { amount: 24.00, currency: 'EUR' },
      planted_products: ['planted.chicken'],
      dietary_tags: ['vegan'],
      status: 'active',
      availability: 'permanent',
      created_at: new Date(),
      updated_at: new Date()
    };

    if (dryRun) {
      console.log(`  [DRY RUN] Would create: ${neniDish.name}`);
    } else {
      const ref = await db.collection('dishes').add(neniDish);
      console.log(`  Created: ${neniDish.name} (${ref.id})`);
    }
    dishesCreated++;
    venuesUpdated++;
  }

  // 2. planted.bistro by Hiltl - copy from Hiltl
  console.log('\n--- planted.bistro by Hiltl ---');

  // Find Hiltl with dishes
  const allVenues = await db.collection('venues').get();
  let hiltlSourceId = null;

  for (const doc of allVenues.docs) {
    if (doc.data().name === 'Hiltl - Vegetarian Restaurant') {
      hiltlSourceId = doc.id;
      break;
    }
  }

  const hiltlTargetId = 'Qs4dNbTVUknU0rLexTlb'; // planted.bistro by Hiltl
  const existingBistroDishes = await db.collection('dishes').where('venue_id', '==', hiltlTargetId).get();

  if (existingBistroDishes.size > 0) {
    console.log(`SKIP: planted.bistro already has ${existingBistroDishes.size} dishes`);
  } else if (hiltlSourceId) {
    const hiltlDishes = await db.collection('dishes').where('venue_id', '==', hiltlSourceId).get();
    console.log(`Copying ${hiltlDishes.size} dishes from Hiltl to planted.bistro`);

    for (const doc of hiltlDishes.docs) {
      const data = doc.data();
      const newDish = { ...data, venue_id: hiltlTargetId, created_at: new Date(), updated_at: new Date() };
      delete newDish.id;

      if (dryRun) {
        console.log(`  [DRY RUN] Would create: ${data.name}`);
      } else {
        const ref = await db.collection('dishes').add(newDish);
        console.log(`  Created: ${data.name} (${ref.id})`);
      }
      dishesCreated++;
    }
    venuesUpdated++;
  } else {
    console.log('  ERROR: Could not find Hiltl source venue');
  }

  // 3. Doen Doen Stuttgart duplicate - copy from existing Stuttgart venue
  console.log('\n--- Doen Doen Planted Kebap (Stuttgart duplicate) ---');

  const doenDoenSourceId = 'a9O0bIPkigODf1Qvudmk'; // Doen Doen Stuttgart with dishes
  const doenDoenTargetId = '47iI3ykMlTSzxEpgZtkT'; // Doen Doen Stuttgart without dishes

  const existingDoenDishes = await db.collection('dishes').where('venue_id', '==', doenDoenTargetId).get();

  if (existingDoenDishes.size > 0) {
    console.log(`SKIP: Target already has ${existingDoenDishes.size} dishes`);
  } else {
    const sourceDishes = await db.collection('dishes').where('venue_id', '==', doenDoenSourceId).get();

    if (sourceDishes.size > 0) {
      console.log(`Copying ${sourceDishes.size} dishes to Doen Doen Stuttgart duplicate`);

      for (const doc of sourceDishes.docs) {
        const data = doc.data();
        const newDish = { ...data, venue_id: doenDoenTargetId, created_at: new Date(), updated_at: new Date() };
        delete newDish.id;

        if (dryRun) {
          console.log(`  [DRY RUN] Would create: ${data.name}`);
        } else {
          const ref = await db.collection('dishes').add(newDish);
          console.log(`  Created: ${data.name} (${ref.id})`);
        }
        dishesCreated++;
      }
      venuesUpdated++;
    } else {
      console.log('  ERROR: Could not find source dishes');
    }
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`Venues updated: ${venuesUpdated}`);
  console.log(`Dishes created: ${dishesCreated}`);

  if (dryRun) {
    console.log('\nThis was a DRY RUN. Run with --execute to apply changes.');
  }
}

const execute = process.argv.includes('--execute');
fixRemaining(!execute)
  .then(() => process.exit(0))
  .catch(e => {
    console.error('Error:', e);
    process.exit(1);
  });
