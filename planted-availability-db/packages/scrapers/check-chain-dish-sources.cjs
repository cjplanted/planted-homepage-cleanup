#!/usr/bin/env node
/**
 * Check for chain venues with dishes that can be copied to zero-dish venues
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');

initializeApp({
  credential: cert(path.resolve(__dirname, '../../service-account.json'))
});
const db = getFirestore();

async function checkChainSources() {
  console.log('Checking for chain dish sources');
  console.log('='.repeat(70));

  // Get dish counts
  const dishesSnap = await db.collection('dishes').get();
  const dishCountByVenue = {};
  const dishesByVenue = {};

  for (const doc of dishesSnap.docs) {
    const data = doc.data();
    if (data.venue_id) {
      dishCountByVenue[data.venue_id] = (dishCountByVenue[data.venue_id] || 0) + 1;
      if (!dishesByVenue[data.venue_id]) dishesByVenue[data.venue_id] = [];
      dishesByVenue[data.venue_id].push({
        id: doc.id,
        name: data.name,
        description: data.description
      });
    }
  }

  // Get all venues
  const venuesSnap = await db.collection('venues').get();

  // Target chains to check (from zero-dish list)
  const targetChains = ['vapiano', 'barburrito', 'hiltl', 'tibits', 'veganitas', 'chupenga', 'immergrun', 'immergrün'];

  const chainVenues = {};

  for (const doc of venuesSnap.docs) {
    const data = doc.data();
    const name = (data.name || '').toLowerCase();
    const dishCount = dishCountByVenue[doc.id] || 0;

    // Check if matches any target chain
    for (const chain of targetChains) {
      if (name.includes(chain)) {
        if (!chainVenues[chain]) chainVenues[chain] = { withDishes: [], withoutDishes: [] };

        const venueInfo = {
          id: doc.id,
          name: data.name,
          city: data.address?.city,
          country: data.address?.country || data.country,
          dishCount,
          dishes: dishesByVenue[doc.id] || []
        };

        if (dishCount > 0) {
          chainVenues[chain].withDishes.push(venueInfo);
        } else {
          chainVenues[chain].withoutDishes.push(venueInfo);
        }
        break;
      }
    }
  }

  // Report findings
  for (const [chain, data] of Object.entries(chainVenues)) {
    console.log('\n' + '='.repeat(70));
    console.log(`${chain.toUpperCase()}`);
    console.log('='.repeat(70));
    console.log(`Venues WITH dishes: ${data.withDishes.length}`);
    console.log(`Venues WITHOUT dishes: ${data.withoutDishes.length}`);

    if (data.withDishes.length > 0) {
      console.log('\n--- SOURCE VENUES (with dishes) ---');
      data.withDishes.forEach(v => {
        console.log(`  ${v.name} (${v.city}, ${v.country}) - ${v.dishCount} dishes`);
        v.dishes.slice(0, 3).forEach(d => console.log(`    - ${d.name}`));
        if (v.dishes.length > 3) console.log(`    ... and ${v.dishes.length - 3} more`);
      });
    }

    if (data.withoutDishes.length > 0) {
      console.log('\n--- TARGET VENUES (need dishes) ---');
      data.withoutDishes.forEach(v => {
        console.log(`  ${v.name} (${v.city}, ${v.country})`);
        console.log(`    ID: ${v.id}`);
      });
    }

    if (data.withDishes.length > 0 && data.withoutDishes.length > 0) {
      console.log(`\n*** CAN COPY: ${data.withDishes[0].dishCount} dishes from ${data.withDishes[0].name} to ${data.withoutDishes.length} venues ***`);
    }
  }
}

checkChainSources()
  .then(() => process.exit(0))
  .catch(e => {
    console.error('Error:', e);
    process.exit(1);
  });
