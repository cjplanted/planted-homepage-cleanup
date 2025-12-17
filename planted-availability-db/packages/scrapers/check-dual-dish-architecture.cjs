#!/usr/bin/env node
/**
 * Check Dual Dish Architecture
 *
 * Dishes exist in TWO places:
 * 1. Embedded in venues.dishes[] or venues.embedded_dishes[]
 * 2. Separate 'dishes' collection with venue_id
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');

initializeApp({
  credential: cert(path.resolve(__dirname, '../../service-account.json'))
});
const db = getFirestore();

async function checkDualArchitecture() {
  console.log('Checking Dual Dish Architecture');
  console.log('='.repeat(60));

  // 1. Check venues collection
  const venuesSnap = await db.collection('venues').get();
  console.log(`\nVenues collection: ${venuesSnap.size} documents`);

  let embeddedDishCount = 0;
  let venuesWithEmbeddedDishes = 0;
  const sampleVenuesWithDishes = [];

  for (const doc of venuesSnap.docs) {
    const data = doc.data();
    const dishes = data.dishes || data.embedded_dishes || [];
    if (dishes.length > 0) {
      embeddedDishCount += dishes.length;
      venuesWithEmbeddedDishes++;
      if (sampleVenuesWithDishes.length < 5) {
        sampleVenuesWithDishes.push({
          id: doc.id,
          name: data.name,
          dishCount: dishes.length,
          type: data.type
        });
      }
    }
  }

  console.log(`Venues with embedded dishes: ${venuesWithEmbeddedDishes}`);
  console.log(`Total embedded dishes: ${embeddedDishCount}`);
  console.log('\nSample venues with embedded dishes:');
  sampleVenuesWithDishes.forEach(v => {
    console.log(`  - ${v.name}: ${v.dishCount} dishes (type: ${v.type})`);
  });

  // 2. Check dishes collection
  const dishesSnap = await db.collection('dishes').get();
  console.log(`\nDishes collection: ${dishesSnap.size} documents`);

  // Get unique venue IDs from dishes collection
  const venueIdsWithSeparateDishes = new Set();
  for (const doc of dishesSnap.docs) {
    const data = doc.data();
    if (data.venue_id) {
      venueIdsWithSeparateDishes.add(data.venue_id);
    }
  }
  console.log(`Unique venues with separate dishes: ${venueIdsWithSeparateDishes.size}`);

  // 3. Check discovered_venues collection
  const discoveredSnap = await db.collection('discovered_venues').get();
  console.log(`\nDiscovered_venues collection: ${discoveredSnap.size} documents`);

  let discoveredWithDishes = 0;
  let discoveredDishCount = 0;
  for (const doc of discoveredSnap.docs) {
    const data = doc.data();
    const dishes = data.dishes || [];
    if (dishes.length > 0) {
      discoveredWithDishes++;
      discoveredDishCount += dishes.length;
    }
  }
  console.log(`Discovered venues with dishes: ${discoveredWithDishes}`);
  console.log(`Total discovered dishes: ${discoveredDishCount}`);

  // 4. Check discovered_dishes collection
  try {
    const discoveredDishesSnap = await db.collection('discovered_dishes').get();
    console.log(`\nDiscovered_dishes collection: ${discoveredDishesSnap.size} documents`);
  } catch (e) {
    console.log(`\nDiscovered_dishes collection: Not found or error`);
  }

  // 5. Check production_venues collection
  try {
    const productionSnap = await db.collection('production_venues').get();
    console.log(`\nProduction_venues collection: ${productionSnap.size} documents`);

    let prodWithDishes = 0;
    let prodDishCount = 0;
    for (const doc of productionSnap.docs) {
      const data = doc.data();
      const dishes = data.dishes || data.embedded_dishes || [];
      if (dishes.length > 0) {
        prodWithDishes++;
        prodDishCount += dishes.length;
      }
    }
    console.log(`Production venues with embedded dishes: ${prodWithDishes}`);
    console.log(`Total production embedded dishes: ${prodDishCount}`);
  } catch (e) {
    console.log(`\nProduction_venues collection: Not found or error`);
  }

  // 6. Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`\nData sources found:`);
  console.log(`1. venues collection: ${venuesSnap.size} venues, ${venuesWithEmbeddedDishes} with embedded dishes`);
  console.log(`2. dishes collection: ${dishesSnap.size} separate dish documents for ${venueIdsWithSeparateDishes.size} venues`);
  console.log(`3. discovered_venues collection: ${discoveredSnap.size} venues, ${discoveredWithDishes} with dishes`);

  // 7. Check which venues have dishes in separate collection but not embedded
  console.log('\n' + '='.repeat(60));
  console.log('MISMATCH ANALYSIS');
  console.log('='.repeat(60));

  // Get venues that have dishes in separate collection
  const venuesWithSeparateDishesDetails = [];
  for (const venueId of venueIdsWithSeparateDishes) {
    const venueDoc = await db.collection('venues').doc(venueId).get();
    if (venueDoc.exists) {
      const data = venueDoc.data();
      const embeddedCount = (data.dishes || data.embedded_dishes || []).length;
      if (embeddedCount === 0) {
        venuesWithSeparateDishesDetails.push({
          id: venueId,
          name: data.name,
          type: data.type
        });
      }
    }
  }

  console.log(`\nVenues with dishes in separate collection but NOT embedded: ${venuesWithSeparateDishesDetails.length}`);
  venuesWithSeparateDishesDetails.slice(0, 10).forEach(v => {
    console.log(`  - ${v.name} (${v.id}) [type: ${v.type}]`);
  });
  if (venuesWithSeparateDishesDetails.length > 10) {
    console.log(`  ... and ${venuesWithSeparateDishesDetails.length - 10} more`);
  }
}

checkDualArchitecture()
  .then(() => process.exit(0))
  .catch(e => {
    console.error('Error:', e);
    process.exit(1);
  });
