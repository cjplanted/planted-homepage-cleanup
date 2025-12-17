#!/usr/bin/env node
/**
 * Quick Zero-Dish Restaurant Analysis
 *
 * Uses embedded_dishes field for faster analysis (no N+1 queries)
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');

initializeApp({
  credential: cert(path.resolve(__dirname, '../../service-account.json'))
});
const db = getFirestore();

async function quickAnalysis() {
  console.log('Quick Zero-Dish Restaurant Analysis');
  console.log('='.repeat(60));

  // Get all venues
  const venuesSnap = await db.collection('venues').get();
  console.log(`Total venues: ${venuesSnap.size}\n`);

  const zeroDishRestaurants = [];
  const withDishRestaurants = [];
  const retail = [];

  for (const doc of venuesSnap.docs) {
    const data = doc.data();
    const venueType = data.type || data.venue_type || 'unknown';

    // Use embedded_dishes for faster checking (if available)
    // Otherwise fall back to dishes array
    const embeddedDishes = data.embedded_dishes || data.dishes || [];
    const dishCount = embeddedDishes.length;

    const venueInfo = {
      id: doc.id,
      name: data.name,
      city: data.address?.city,
      country: data.address?.country || data.country || 'Unknown',
      type: venueType,
      chain: data.chain || null,
      dishCount,
      platformUrls: data.platform_urls || {},
      website: data.website || null
    };

    // Check if has any platform URL
    venueInfo.hasPlatformUrl = !!(
      venueInfo.platformUrls.uber_eats ||
      venueInfo.platformUrls.wolt ||
      venueInfo.platformUrls.lieferando ||
      venueInfo.platformUrls.just_eat ||
      venueInfo.platformUrls.deliveroo
    );

    if (venueType !== 'restaurant') {
      retail.push(venueInfo);
    } else if (dishCount === 0) {
      zeroDishRestaurants.push(venueInfo);
    } else {
      withDishRestaurants.push(venueInfo);
    }
  }

  console.log('SUMMARY');
  console.log('-'.repeat(60));
  console.log(`Retail/Other: ${retail.length}`);
  console.log(`Restaurants with dishes: ${withDishRestaurants.length}`);
  console.log(`Restaurants WITHOUT dishes: ${zeroDishRestaurants.length}`);

  // Analyze zero-dish restaurants
  const withPlatforms = zeroDishRestaurants.filter(v => v.hasPlatformUrl);
  const withoutPlatforms = zeroDishRestaurants.filter(v => !v.hasPlatformUrl);

  console.log(`\n  - WITH platform URLs: ${withPlatforms.length}`);
  console.log(`  - WITHOUT platform URLs: ${withoutPlatforms.length}`);

  // Country breakdown
  console.log('\n' + '='.repeat(60));
  console.log('BY COUNTRY (Zero-Dish Restaurants)');
  console.log('-'.repeat(60));

  const byCountry = {};
  zeroDishRestaurants.forEach(v => {
    if (!byCountry[v.country]) byCountry[v.country] = { total: 0, withPlatforms: 0 };
    byCountry[v.country].total++;
    if (v.hasPlatformUrl) byCountry[v.country].withPlatforms++;
  });

  Object.entries(byCountry)
    .sort((a, b) => b[1].total - a[1].total)
    .forEach(([country, data]) => {
      console.log(`${country}: ${data.total} venues (${data.withPlatforms} with platforms)`);
    });

  // Chain breakdown
  console.log('\n' + '='.repeat(60));
  console.log('BY CHAIN (Zero-Dish Restaurants)');
  console.log('-'.repeat(60));

  const byChain = {};
  zeroDishRestaurants.forEach(v => {
    const chain = v.chain || 'Independent';
    if (!byChain[chain]) byChain[chain] = [];
    byChain[chain].push(v);
  });

  Object.entries(byChain)
    .sort((a, b) => b[1].length - a[1].length)
    .forEach(([chain, venues]) => {
      const withUrls = venues.filter(v => v.hasPlatformUrl).length;
      console.log(`\n${chain}: ${venues.length} venues (${withUrls} with platform URLs)`);
      venues.slice(0, 3).forEach(v => {
        const platforms = [];
        if (v.platformUrls.uber_eats) platforms.push('UE');
        if (v.platformUrls.wolt) platforms.push('Wolt');
        if (v.platformUrls.lieferando) platforms.push('Lief');
        if (v.platformUrls.just_eat) platforms.push('JE');
        if (v.platformUrls.deliveroo) platforms.push('Del');
        const pStr = platforms.length > 0 ? `[${platforms.join(',')}]` : '[NO URL]';
        console.log(`  - ${v.name} (${v.city}) ${pStr}`);
      });
      if (venues.length > 3) console.log(`  ... and ${venues.length - 3} more`);
    });

  // List all venues WITH platform URLs (extraction ready)
  console.log('\n' + '='.repeat(60));
  console.log('EXTRACTION-READY VENUES (WITH PLATFORM URLs)');
  console.log('-'.repeat(60));

  if (withPlatforms.length === 0) {
    console.log('None found - all zero-dish restaurants lack platform URLs');
  } else {
    withPlatforms.forEach((v, i) => {
      const platforms = [];
      if (v.platformUrls.uber_eats) platforms.push(`UE: ${v.platformUrls.uber_eats.substring(0, 50)}...`);
      if (v.platformUrls.wolt) platforms.push(`Wolt: ${v.platformUrls.wolt.substring(0, 50)}...`);
      if (v.platformUrls.lieferando) platforms.push(`Lief: ${v.platformUrls.lieferando.substring(0, 50)}...`);
      if (v.platformUrls.just_eat) platforms.push(`JE: ${v.platformUrls.just_eat.substring(0, 50)}...`);
      if (v.platformUrls.deliveroo) platforms.push(`Del: ${v.platformUrls.deliveroo.substring(0, 50)}...`);

      console.log(`\n${i + 1}. ${v.name} (${v.city}, ${v.country})`);
      console.log(`   ID: ${v.id}`);
      console.log(`   Chain: ${v.chain || 'Independent'}`);
      platforms.forEach(p => console.log(`   ${p}`));
    });
  }

  // Output JSON summary for processing
  console.log('\n' + '='.repeat(60));
  console.log('JSON SUMMARY');
  console.log('-'.repeat(60));

  const summary = {
    timestamp: new Date().toISOString(),
    restaurantsWithDishes: withDishRestaurants.length,
    restaurantsWithoutDishes: zeroDishRestaurants.length,
    zeroDishWithPlatforms: withPlatforms.length,
    zeroDishWithoutPlatforms: withoutPlatforms.length,
    byCountry,
    extractionReady: withPlatforms.map(v => ({
      id: v.id,
      name: v.name,
      city: v.city,
      country: v.country,
      chain: v.chain,
      platforms: Object.keys(v.platformUrls).filter(k => v.platformUrls[k])
    }))
  };

  console.log(JSON.stringify(summary, null, 2));
}

quickAnalysis()
  .then(() => process.exit(0))
  .catch(e => {
    console.error('Error:', e);
    process.exit(1);
  });
