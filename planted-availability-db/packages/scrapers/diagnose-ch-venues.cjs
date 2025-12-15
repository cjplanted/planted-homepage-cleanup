#!/usr/bin/env node
/**
 * Diagnose CH Venues - Analyze Swiss venues for locator issues
 *
 * Usage: node diagnose-ch-venues.cjs
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '..', '..', 'service-account.json');
const serviceAccount = require(serviceAccountPath);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function diagnoseChVenues() {
  console.log('\n=== CH VENUES DIAGNOSTIC ===\n');

  // Query all CH venues from production
  const venuesSnap = await db.collection('venues')
    .where('address.country', '==', 'CH')
    .get();

  const venues = venuesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  console.log(`Total CH venues in production: ${venues.length}`);

  // Analyze by type
  const byType = {};
  venues.forEach(v => {
    byType[v.type] = (byType[v.type] || 0) + 1;
  });
  console.log('\nBy Type:', byType);

  // Analyze by status
  const byStatus = {};
  venues.forEach(v => {
    byStatus[v.status] = (byStatus[v.status] || 0) + 1;
  });
  console.log('By Status:', byStatus);

  // Check coordinates
  const withValidCoords = venues.filter(v => {
    const lat = v.location?.latitude || v.location?._latitude || 0;
    const lng = v.location?.longitude || v.location?._longitude || 0;
    return lat !== 0 && lng !== 0;
  });
  console.log(`\nWith valid coordinates: ${withValidCoords.length}/${venues.length}`);

  // Get all dishes for CH venues
  const dishesSnap = await db.collection('dishes').get();
  const allDishes = dishesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  const venueIds = new Set(venues.map(v => v.id));
  const chDishes = allDishes.filter(d => venueIds.has(d.venue_id));
  console.log(`Total CH dishes: ${chDishes.length}`);

  // Count venues with dishes
  const venuesWithDishIds = new Set(chDishes.map(d => d.venue_id));
  const venuesWithDishes = venues.filter(v => venuesWithDishIds.has(v.id));
  console.log(`Venues with dishes: ${venuesWithDishes.length}`);

  // The critical metric: venues with BOTH valid coords AND dishes
  const readyForLocator = withValidCoords.filter(v => venuesWithDishIds.has(v.id));
  console.log(`\n⭐ LOCATOR-READY VENUES (coords + dishes): ${readyForLocator.length}`);

  // List them
  console.log('\n--- LOCATOR-READY CH VENUES ---');
  readyForLocator.forEach(v => {
    const lat = v.location?.latitude || v.location?._latitude;
    const lng = v.location?.longitude || v.location?._longitude;
    const dishCount = chDishes.filter(d => d.venue_id === v.id).length;
    console.log(`  ${v.name} (${v.address?.city}) - ${dishCount} dishes - [${lat?.toFixed(4)}, ${lng?.toFixed(4)}]`);
  });

  // List venues WITH dishes but NO coords
  const dishesButNoCoords = venues.filter(v =>
    venuesWithDishIds.has(v.id) && !withValidCoords.includes(v)
  );
  console.log(`\n--- HAVE DISHES BUT NO COORDS (${dishesButNoCoords.length}) ---`);
  dishesButNoCoords.slice(0, 20).forEach(v => {
    const dishCount = chDishes.filter(d => d.venue_id === v.id).length;
    console.log(`  ${v.name} (${v.address?.city}) - ${dishCount} dishes - [0,0]`);
  });

  // Also check discovered_venues for CH
  console.log('\n\n=== DISCOVERED_VENUES (CH) ===\n');
  const discoveredSnap = await db.collection('discovered_venues')
    .where('address.country', '==', 'CH')
    .get();

  const discovered = discoveredSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  console.log(`Total discovered CH venues: ${discovered.length}`);

  const discoveredWithCoords = discovered.filter(v => {
    const lat = v.location?.latitude || v.location?._latitude || 0;
    const lng = v.location?.longitude || v.location?._longitude || 0;
    return lat !== 0 && lng !== 0;
  });
  console.log(`With valid coordinates: ${discoveredWithCoords.length}`);

  const discoveredWithDishes = discovered.filter(v => v.dishes && v.dishes.length > 0);
  console.log(`With embedded dishes: ${discoveredWithDishes.length}`);

  const discoveredReady = discoveredWithCoords.filter(v => v.dishes && v.dishes.length > 0);
  console.log(`⭐ READY (coords + dishes): ${discoveredReady.length}`);

  // List discovered ready venues
  console.log('\n--- DISCOVERED READY CH VENUES ---');
  discoveredReady.slice(0, 30).forEach(v => {
    const lat = v.location?.latitude || v.location?._latitude;
    const lng = v.location?.longitude || v.location?._longitude;
    console.log(`  ${v.name} (${v.address?.city}) - ${v.dishes?.length} dishes - [${lat?.toFixed(4)}, ${lng?.toFixed(4)}]`);
  });

  // Summary
  console.log('\n\n=== SUMMARY ===');
  console.log(`Production venues with coords + dishes: ${readyForLocator.length}`);
  console.log(`Discovered venues with coords + dishes: ${discoveredReady.length}`);
  console.log(`\n💡 ISSUE: The /nearby API only queries 'venues' collection (${readyForLocator.length} CH venues).`);
  console.log(`   Discovered venues (${discoveredReady.length}) with coords+dishes are NOT being shown!`);

  if (discoveredReady.length > readyForLocator.length) {
    console.log('\n🔧 FIX OPTIONS:');
    console.log('   1. Promote discovered venues to production (sync script)');
    console.log('   2. Update /nearby API to also query discovered_venues');
    console.log('   3. Copy coordinates from discovered to production venues');
  }

  // Check chain breakdown
  console.log('\n\n=== CHAIN ANALYSIS (Production) ===');
  const chainVenues = {};
  venues.forEach(v => {
    const chain = v.chain_id || 'no_chain';
    if (!chainVenues[chain]) chainVenues[chain] = [];
    chainVenues[chain].push(v);
  });

  const chainStats = Object.entries(chainVenues)
    .map(([chain, vs]) => {
      const withCoords = vs.filter(v => {
        const lat = v.location?.latitude || 0;
        return lat !== 0;
      }).length;
      const withDishes = vs.filter(v => venuesWithDishIds.has(v.id)).length;
      return { chain, total: vs.length, withCoords, withDishes };
    })
    .filter(s => s.total > 1)
    .sort((a, b) => b.total - a.total);

  console.log('Chain | Total | With Coords | With Dishes');
  chainStats.slice(0, 15).forEach(s => {
    console.log(`  ${s.chain?.slice(0, 20)?.padEnd(20)} | ${s.total} | ${s.withCoords} | ${s.withDishes}`);
  });
}

diagnoseChVenues()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
