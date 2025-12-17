#!/usr/bin/env node
/**
 * Analyze restaurants without dishes
 *
 * Comprehensive analysis for Attack Zero - identifies:
 * 1. Restaurants by country without dishes
 * 2. Which venues have platform URLs (extraction-ready)
 * 3. Which venues need platform URL research
 * 4. Chain vs indie breakdown
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');

initializeApp({
  credential: cert(path.resolve(__dirname, '../../service-account.json'))
});
const db = getFirestore();

async function analyzeZeroDishRestaurants() {
  console.log('='.repeat(70));
  console.log('ZERO-DISH RESTAURANT ANALYSIS');
  console.log('='.repeat(70));
  console.log('');

  // Get all venues
  const venuesSnap = await db.collection('venues').get();
  console.log(`Total venues in database: ${venuesSnap.size}`);

  const restaurants = [];
  const retail = [];

  for (const doc of venuesSnap.docs) {
    const data = doc.data();
    const venueType = data.type || data.venue_type || 'unknown';

    // Get dish count
    const dishSnap = await db.collection('dishes')
      .where('venue_id', '==', doc.id)
      .count()
      .get();

    const dishCount = dishSnap.data().count;

    const venueInfo = {
      id: doc.id,
      name: data.name,
      city: data.address?.city,
      country: data.address?.country || data.country || 'Unknown',
      type: venueType,
      chain: data.chain || null,
      chain_id: data.chain_id || null,
      dishCount,
      platformUrls: {
        uber_eats: data.platform_urls?.uber_eats || null,
        wolt: data.platform_urls?.wolt || null,
        lieferando: data.platform_urls?.lieferando || null,
        just_eat: data.platform_urls?.just_eat || null,
        deliveroo: data.platform_urls?.deliveroo || null,
      },
      website: data.website || null
    };

    venueInfo.hasPlatformUrl = !!(
      venueInfo.platformUrls.uber_eats ||
      venueInfo.platformUrls.wolt ||
      venueInfo.platformUrls.lieferando ||
      venueInfo.platformUrls.just_eat ||
      venueInfo.platformUrls.deliveroo
    );

    venueInfo.platformCount = [
      venueInfo.platformUrls.uber_eats,
      venueInfo.platformUrls.wolt,
      venueInfo.platformUrls.lieferando,
      venueInfo.platformUrls.just_eat,
      venueInfo.platformUrls.deliveroo
    ].filter(Boolean).length;

    if (venueType === 'restaurant') {
      restaurants.push(venueInfo);
    } else {
      retail.push(venueInfo);
    }
  }

  console.log(`Restaurants: ${restaurants.length}`);
  console.log(`Retail/Other: ${retail.length}`);
  console.log('');

  // Filter to zero-dish restaurants
  const zeroDishRestaurants = restaurants.filter(v => v.dishCount === 0);
  const withDishRestaurants = restaurants.filter(v => v.dishCount > 0);

  console.log('='.repeat(70));
  console.log('RESTAURANT DISH STATUS');
  console.log('='.repeat(70));
  console.log(`Restaurants with dishes: ${withDishRestaurants.length}`);
  console.log(`Restaurants WITHOUT dishes: ${zeroDishRestaurants.length}`);
  console.log('');

  // Analyze zero-dish restaurants
  const withPlatforms = zeroDishRestaurants.filter(v => v.hasPlatformUrl);
  const withoutPlatforms = zeroDishRestaurants.filter(v => !v.hasPlatformUrl);

  console.log('='.repeat(70));
  console.log('ZERO-DISH RESTAURANTS - PLATFORM URL STATUS');
  console.log('='.repeat(70));
  console.log(`WITH platform URLs (can extract): ${withPlatforms.length}`);
  console.log(`WITHOUT platform URLs (need research): ${withoutPlatforms.length}`);
  console.log('');

  // Country breakdown for zero-dish restaurants
  const byCountry = {};
  zeroDishRestaurants.forEach(v => {
    if (!byCountry[v.country]) {
      byCountry[v.country] = { withPlatforms: [], withoutPlatforms: [] };
    }
    if (v.hasPlatformUrl) {
      byCountry[v.country].withPlatforms.push(v);
    } else {
      byCountry[v.country].withoutPlatforms.push(v);
    }
  });

  console.log('='.repeat(70));
  console.log('ZERO-DISH RESTAURANTS BY COUNTRY');
  console.log('='.repeat(70));

  for (const [country, data] of Object.entries(byCountry).sort((a, b) =>
    (b[1].withPlatforms.length + b[1].withoutPlatforms.length) - (a[1].withPlatforms.length + a[1].withoutPlatforms.length)
  )) {
    const total = data.withPlatforms.length + data.withoutPlatforms.length;
    console.log(`\n${country}: ${total} venues (${data.withPlatforms.length} with platforms, ${data.withoutPlatforms.length} without)`);
  }

  // Chain analysis for zero-dish restaurants
  const chainGroups = {};
  zeroDishRestaurants.forEach(v => {
    const chain = v.chain || 'Independent (no chain)';
    if (!chainGroups[chain]) chainGroups[chain] = [];
    chainGroups[chain].push(v);
  });

  console.log('\n' + '='.repeat(70));
  console.log('ZERO-DISH RESTAURANTS BY CHAIN');
  console.log('='.repeat(70));

  const sortedChains = Object.entries(chainGroups)
    .sort((a, b) => b[1].length - a[1].length);

  for (const [chain, venues] of sortedChains) {
    const withUrls = venues.filter(v => v.hasPlatformUrl).length;
    console.log(`\n${chain}: ${venues.length} venues (${withUrls} with platform URLs)`);

    // Show first 3 venues
    venues.slice(0, 3).forEach(v => {
      const platforms = [];
      if (v.platformUrls.uber_eats) platforms.push('UberEats');
      if (v.platformUrls.wolt) platforms.push('Wolt');
      if (v.platformUrls.lieferando) platforms.push('Lieferando');
      if (v.platformUrls.just_eat) platforms.push('JustEat');
      if (v.platformUrls.deliveroo) platforms.push('Deliveroo');

      const platformStr = platforms.length > 0 ? `[${platforms.join(', ')}]` : '[NO PLATFORMS]';
      console.log(`  - ${v.name} (${v.city}, ${v.country}) ${platformStr}`);
    });
    if (venues.length > 3) {
      console.log(`  ... and ${venues.length - 3} more`);
    }
  }

  // High priority: Venues WITH platform URLs (extraction-ready)
  console.log('\n' + '='.repeat(70));
  console.log('HIGH PRIORITY: EXTRACTION-READY (WITH PLATFORM URLs)');
  console.log('='.repeat(70));

  withPlatforms.forEach((v, i) => {
    const platforms = [];
    if (v.platformUrls.uber_eats) platforms.push(`UberEats: ${v.platformUrls.uber_eats}`);
    if (v.platformUrls.wolt) platforms.push(`Wolt: ${v.platformUrls.wolt}`);
    if (v.platformUrls.lieferando) platforms.push(`Lieferando: ${v.platformUrls.lieferando}`);
    if (v.platformUrls.just_eat) platforms.push(`JustEat: ${v.platformUrls.just_eat}`);
    if (v.platformUrls.deliveroo) platforms.push(`Deliveroo: ${v.platformUrls.deliveroo}`);

    console.log(`\n${i + 1}. ${v.name} (${v.city}, ${v.country})`);
    console.log(`   ID: ${v.id}`);
    console.log(`   Chain: ${v.chain || 'Independent'}`);
    platforms.forEach(p => console.log(`   - ${p}`));
  });

  // Summary JSON for further processing
  const summary = {
    timestamp: new Date().toISOString(),
    totalRestaurants: restaurants.length,
    restaurantsWithDishes: withDishRestaurants.length,
    restaurantsWithoutDishes: zeroDishRestaurants.length,
    zeroDishWithPlatforms: withPlatforms.length,
    zeroDishWithoutPlatforms: withoutPlatforms.length,
    byCountry: Object.fromEntries(
      Object.entries(byCountry).map(([country, data]) => [
        country,
        { withPlatforms: data.withPlatforms.length, withoutPlatforms: data.withoutPlatforms.length }
      ])
    ),
    byChain: Object.fromEntries(
      sortedChains.map(([chain, venues]) => [
        chain,
        { total: venues.length, withPlatforms: venues.filter(v => v.hasPlatformUrl).length }
      ])
    ),
    extractionReadyVenues: withPlatforms.map(v => ({
      id: v.id,
      name: v.name,
      city: v.city,
      country: v.country,
      chain: v.chain,
      platforms: Object.entries(v.platformUrls).filter(([k, v]) => v).map(([k]) => k)
    }))
  };

  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY JSON');
  console.log('='.repeat(70));
  console.log(JSON.stringify(summary, null, 2));

  return summary;
}

analyzeZeroDishRestaurants()
  .then(() => process.exit(0))
  .catch(e => {
    console.error('Error:', e);
    process.exit(1);
  });
