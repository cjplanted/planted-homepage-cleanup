#!/usr/bin/env node
/**
 * Analyze the remaining 30 zero-dish restaurants
 *
 * Check for:
 * 1. Duplicates (same name, different ID)
 * 2. Stale status (should be archived?)
 * 3. Possible platform URLs to add
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');

initializeApp({
  credential: cert(path.resolve(__dirname, '../../service-account.json'))
});
const db = getFirestore();

async function analyzeRemaining() {
  console.log('Analyzing Remaining Zero-Dish Restaurants');
  console.log('='.repeat(70));

  // Get dish counts
  const dishesSnap = await db.collection('dishes').get();
  const dishCountByVenue = {};
  for (const doc of dishesSnap.docs) {
    const data = doc.data();
    if (data.venue_id) {
      dishCountByVenue[data.venue_id] = (dishCountByVenue[data.venue_id] || 0) + 1;
    }
  }

  // Get all venues
  const venuesSnap = await db.collection('venues').get();
  const zeroDishRestaurants = [];
  const allVenues = [];

  for (const doc of venuesSnap.docs) {
    const data = doc.data();
    const dishCount = dishCountByVenue[doc.id] || 0;

    const venue = {
      id: doc.id,
      name: data.name,
      normalizedName: (data.name || '').toLowerCase().replace(/[^a-z0-9]/g, ''),
      city: data.address?.city || 'Unknown',
      country: data.address?.country || data.country || 'Unknown',
      type: data.type,
      status: data.status || 'unknown',
      dishCount,
      website: data.website || null,
      platformUrls: data.platform_urls || {}
    };

    allVenues.push(venue);

    if (data.type === 'restaurant' && dishCount === 0) {
      zeroDishRestaurants.push(venue);
    }
  }

  console.log(`Total zero-dish restaurants: ${zeroDishRestaurants.length}\n`);

  // Check for duplicates (venues with same name + city)
  console.log('='.repeat(70));
  console.log('DUPLICATE CHECK');
  console.log('='.repeat(70));

  const nameCityIndex = {};
  zeroDishRestaurants.forEach(v => {
    const key = `${v.normalizedName}|${v.city.toLowerCase()}`;
    if (!nameCityIndex[key]) nameCityIndex[key] = [];
    nameCityIndex[key].push(v);
  });

  // Also check if any zero-dish venue has a WITH-dish counterpart
  const withDishVenues = allVenues.filter(v => v.dishCount > 0);
  const withDishIndex = {};
  withDishVenues.forEach(v => {
    const key = v.normalizedName;
    if (!withDishIndex[key]) withDishIndex[key] = [];
    withDishIndex[key].push(v);
  });

  console.log('\n--- Zero-dish venues that have a WITH-dish counterpart ---');
  const duplicatesWithDishes = [];
  for (const v of zeroDishRestaurants) {
    const matches = withDishIndex[v.normalizedName];
    if (matches && matches.length > 0) {
      duplicatesWithDishes.push({ zeroDish: v, withDish: matches });
      console.log(`\n  ${v.name} (${v.city}) [ID: ${v.id}] - NO DISHES`);
      matches.forEach(m => {
        console.log(`    -> ${m.name} (${m.city}) [ID: ${m.id}] - ${m.dishCount} dishes`);
      });
    }
  }

  if (duplicatesWithDishes.length === 0) {
    console.log('  None found');
  }

  // Status breakdown
  console.log('\n' + '='.repeat(70));
  console.log('STATUS BREAKDOWN');
  console.log('='.repeat(70));

  const byStatus = {};
  zeroDishRestaurants.forEach(v => {
    if (!byStatus[v.status]) byStatus[v.status] = [];
    byStatus[v.status].push(v);
  });

  for (const [status, venues] of Object.entries(byStatus)) {
    console.log(`\n${status.toUpperCase()}: ${venues.length} venues`);
    venues.forEach(v => {
      console.log(`  - ${v.name} (${v.city}, ${v.country})`);
    });
  }

  // Actionable items
  console.log('\n' + '='.repeat(70));
  console.log('ACTIONABLE ITEMS');
  console.log('='.repeat(70));

  // 1. Stale venues - consider archiving
  const staleVenues = zeroDishRestaurants.filter(v => v.status === 'stale');
  console.log(`\n1. STALE VENUES (${staleVenues.length}) - Consider archiving:`);
  staleVenues.forEach(v => {
    console.log(`   - ${v.name} (${v.city}, ${v.country}) [${v.id}]`);
  });

  // 2. Active venues without dishes - need research
  const activeNoDish = zeroDishRestaurants.filter(v => v.status === 'active');
  console.log(`\n2. ACTIVE WITHOUT DISHES (${activeNoDish.length}) - Need research:`);
  activeNoDish.forEach(v => {
    console.log(`   - ${v.name} (${v.city}, ${v.country}) [${v.id}]`);
    if (v.website) console.log(`     Website: ${v.website}`);
  });

  // 3. Potential duplicates
  console.log(`\n3. POTENTIAL DUPLICATES TO DELETE (${duplicatesWithDishes.length}):`);
  duplicatesWithDishes.forEach(d => {
    console.log(`   DELETE: ${d.zeroDish.name} [${d.zeroDish.id}]`);
    console.log(`   KEEP: ${d.withDish[0].name} [${d.withDish[0].id}]`);
  });

  // Output venue IDs for potential actions
  console.log('\n' + '='.repeat(70));
  console.log('JSON OUTPUT');
  console.log('='.repeat(70));

  const output = {
    staleVenueIds: staleVenues.map(v => v.id),
    activeNoDishVenueIds: activeNoDish.map(v => v.id),
    duplicatesToDelete: duplicatesWithDishes.map(d => d.zeroDish.id),
    allZeroDish: zeroDishRestaurants.map(v => ({
      id: v.id,
      name: v.name,
      city: v.city,
      country: v.country,
      status: v.status
    }))
  };

  console.log(JSON.stringify(output, null, 2));
}

analyzeRemaining()
  .then(() => process.exit(0))
  .catch(e => {
    console.error('Error:', e);
    process.exit(1);
  });
