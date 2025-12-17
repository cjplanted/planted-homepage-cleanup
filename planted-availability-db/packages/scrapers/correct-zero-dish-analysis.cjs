#!/usr/bin/env node
/**
 * Correct Zero-Dish Restaurant Analysis
 *
 * Uses dishes collection (the authoritative source) to count dishes per venue
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');

initializeApp({
  credential: cert(path.resolve(__dirname, '../../service-account.json'))
});
const db = getFirestore();

async function correctAnalysis() {
  console.log('Correct Zero-Dish Restaurant Analysis (using dishes collection)');
  console.log('='.repeat(70));

  // 1. Get dish counts from dishes collection
  console.log('\nStep 1: Getting dish counts from dishes collection...');
  const dishesSnap = await db.collection('dishes').get();

  const dishCountByVenue = {};
  for (const doc of dishesSnap.docs) {
    const data = doc.data();
    if (data.venue_id) {
      dishCountByVenue[data.venue_id] = (dishCountByVenue[data.venue_id] || 0) + 1;
    }
  }

  console.log(`Total dishes: ${dishesSnap.size}`);
  console.log(`Unique venues with dishes: ${Object.keys(dishCountByVenue).length}`);

  // 2. Get all restaurants from venues collection
  console.log('\nStep 2: Getting all venues...');
  const venuesSnap = await db.collection('venues').get();

  const restaurants = [];
  const retail = [];

  for (const doc of venuesSnap.docs) {
    const data = doc.data();
    const venueType = data.type || data.venue_type || 'unknown';
    const dishCount = dishCountByVenue[doc.id] || 0;

    const venueInfo = {
      id: doc.id,
      name: data.name,
      city: data.address?.city,
      country: data.address?.country || data.country || 'Unknown',
      type: venueType,
      chain: data.chain || null,
      chain_id: data.chain_id || null,
      dishCount,
      platformUrls: data.platform_urls || {},
      website: data.website || null
    };

    venueInfo.hasPlatformUrl = !!(
      venueInfo.platformUrls.uber_eats ||
      venueInfo.platformUrls.wolt ||
      venueInfo.platformUrls.lieferando ||
      venueInfo.platformUrls.just_eat ||
      venueInfo.platformUrls.deliveroo
    );

    venueInfo.platforms = Object.keys(venueInfo.platformUrls).filter(k => venueInfo.platformUrls[k]);

    if (venueType !== 'restaurant') {
      retail.push(venueInfo);
    } else {
      restaurants.push(venueInfo);
    }
  }

  // Split restaurants by dish status
  const zeroDish = restaurants.filter(v => v.dishCount === 0);
  const withDish = restaurants.filter(v => v.dishCount > 0);

  console.log(`\nTotal venues: ${venuesSnap.size}`);
  console.log(`  - Retail/Other: ${retail.length}`);
  console.log(`  - Restaurants: ${restaurants.length}`);
  console.log(`    - WITH dishes: ${withDish.length}`);
  console.log(`    - WITHOUT dishes: ${zeroDish.length}`);

  // 3. Analyze zero-dish restaurants
  const withPlatforms = zeroDish.filter(v => v.hasPlatformUrl);
  const withoutPlatforms = zeroDish.filter(v => !v.hasPlatformUrl);

  console.log('\n' + '='.repeat(70));
  console.log('ZERO-DISH RESTAURANTS ANALYSIS');
  console.log('='.repeat(70));
  console.log(`\nTotal zero-dish restaurants: ${zeroDish.length}`);
  console.log(`  - WITH platform URLs (extraction ready): ${withPlatforms.length}`);
  console.log(`  - WITHOUT platform URLs: ${withoutPlatforms.length}`);

  // 4. Country breakdown
  console.log('\n' + '-'.repeat(70));
  console.log('BY COUNTRY');
  console.log('-'.repeat(70));

  const byCountry = {};
  zeroDish.forEach(v => {
    if (!byCountry[v.country]) byCountry[v.country] = { total: 0, withPlatforms: 0, names: [] };
    byCountry[v.country].total++;
    if (v.hasPlatformUrl) byCountry[v.country].withPlatforms++;
    if (byCountry[v.country].names.length < 5) byCountry[v.country].names.push(v.name);
  });

  Object.entries(byCountry)
    .sort((a, b) => b[1].total - a[1].total)
    .forEach(([country, data]) => {
      console.log(`\n${country}: ${data.total} venues (${data.withPlatforms} with platforms)`);
      data.names.forEach(n => console.log(`  - ${n}`));
      if (data.total > 5) console.log(`  ... and ${data.total - 5} more`);
    });

  // 5. Chain breakdown
  console.log('\n' + '-'.repeat(70));
  console.log('BY CHAIN');
  console.log('-'.repeat(70));

  const byChain = {};
  zeroDish.forEach(v => {
    const chain = v.chain || 'Independent';
    if (!byChain[chain]) byChain[chain] = [];
    byChain[chain].push(v);
  });

  Object.entries(byChain)
    .sort((a, b) => b[1].length - a[1].length)
    .forEach(([chain, venues]) => {
      const withUrls = venues.filter(v => v.hasPlatformUrl).length;
      console.log(`\n${chain}: ${venues.length} venues (${withUrls} with platform URLs)`);
      venues.slice(0, 5).forEach(v => {
        const pStr = v.platforms.length > 0 ? `[${v.platforms.join(', ')}]` : '[NO URL]';
        console.log(`  - ${v.name} (${v.city}, ${v.country}) ${pStr}`);
      });
      if (venues.length > 5) console.log(`  ... and ${venues.length - 5} more`);
    });

  // 6. Extraction-ready venues (WITH platform URLs)
  if (withPlatforms.length > 0) {
    console.log('\n' + '='.repeat(70));
    console.log('EXTRACTION-READY VENUES (with platform URLs)');
    console.log('='.repeat(70));

    withPlatforms.forEach((v, i) => {
      console.log(`\n${i + 1}. ${v.name} (${v.city}, ${v.country})`);
      console.log(`   ID: ${v.id}`);
      console.log(`   Chain: ${v.chain || 'Independent'}`);
      v.platforms.forEach(p => {
        const url = v.platformUrls[p];
        console.log(`   ${p}: ${url}`);
      });
    });
  } else {
    console.log('\n' + '='.repeat(70));
    console.log('NO EXTRACTION-READY VENUES');
    console.log('All zero-dish restaurants lack platform URLs');
    console.log('='.repeat(70));
  }

  // 7. Compare with progress file numbers
  console.log('\n' + '='.repeat(70));
  console.log('PROGRESS COMPARISON');
  console.log('='.repeat(70));
  console.log('\nProgress file says: 195 restaurants need extraction');
  console.log(`Actual count: ${zeroDish.length} restaurants have 0 dishes`);
  console.log(`Discrepancy: ${zeroDish.length - 195} venues`);

  // 8. Summary JSON
  const summary = {
    timestamp: new Date().toISOString(),
    totalVenues: venuesSnap.size,
    restaurants: restaurants.length,
    restaurantsWithDishes: withDish.length,
    restaurantsWithoutDishes: zeroDish.length,
    zeroDishWithPlatforms: withPlatforms.length,
    zeroDishWithoutPlatforms: withoutPlatforms.length,
    byCountry,
    byChain: Object.fromEntries(
      Object.entries(byChain).map(([k, v]) => [k, {
        total: v.length,
        withPlatforms: v.filter(x => x.hasPlatformUrl).length
      }])
    ),
    extractionReady: withPlatforms.map(v => ({
      id: v.id, name: v.name, city: v.city, country: v.country, platforms: v.platforms
    }))
  };

  console.log('\n' + '='.repeat(70));
  console.log('JSON SUMMARY');
  console.log('='.repeat(70));
  console.log(JSON.stringify(summary, null, 2));
}

correctAnalysis()
  .then(() => process.exit(0))
  .catch(e => {
    console.error('Error:', e);
    process.exit(1);
  });
