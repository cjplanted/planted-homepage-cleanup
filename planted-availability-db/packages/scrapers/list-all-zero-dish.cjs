#!/usr/bin/env node
/**
 * List all zero-dish restaurants with full details
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');

initializeApp({
  credential: cert(path.resolve(__dirname, '../../service-account.json'))
});
const db = getFirestore();

async function listAllZeroDish() {
  // Get dish counts
  const dishesSnap = await db.collection('dishes').get();
  const dishCountByVenue = {};
  for (const doc of dishesSnap.docs) {
    const data = doc.data();
    if (data.venue_id) {
      dishCountByVenue[data.venue_id] = (dishCountByVenue[data.venue_id] || 0) + 1;
    }
  }

  // Get restaurants
  const venuesSnap = await db.collection('venues').get();
  const zeroDish = [];

  for (const doc of venuesSnap.docs) {
    const data = doc.data();
    if (data.type !== 'restaurant') continue;
    if (dishCountByVenue[doc.id]) continue; // Has dishes

    zeroDish.push({
      id: doc.id,
      name: data.name,
      city: data.address?.city || 'Unknown',
      country: data.address?.country || data.country || 'Unknown',
      chain: data.chain || null,
      website: data.website || null,
      platformUrls: data.platform_urls || {},
      status: data.status || 'unknown'
    });
  }

  // Sort by country, then city, then name
  zeroDish.sort((a, b) => {
    if (a.country !== b.country) return a.country.localeCompare(b.country);
    if (a.city !== b.city) return a.city.localeCompare(b.city);
    return a.name.localeCompare(b.name);
  });

  console.log('ALL ZERO-DISH RESTAURANTS');
  console.log('='.repeat(80));
  console.log(`Total: ${zeroDish.length} venues\n`);

  let currentCountry = '';
  zeroDish.forEach((v, i) => {
    if (v.country !== currentCountry) {
      currentCountry = v.country;
      console.log('\n' + '='.repeat(80));
      console.log(`${currentCountry}`);
      console.log('='.repeat(80));
    }

    console.log(`\n${i + 1}. ${v.name}`);
    console.log(`   City: ${v.city}`);
    console.log(`   ID: ${v.id}`);
    console.log(`   Chain: ${v.chain || 'Independent'}`);
    console.log(`   Status: ${v.status}`);

    if (v.website) {
      console.log(`   Website: ${v.website}`);
    }

    const platforms = Object.entries(v.platformUrls).filter(([k, v]) => v);
    if (platforms.length > 0) {
      console.log(`   Platform URLs:`);
      platforms.forEach(([platform, url]) => {
        console.log(`     - ${platform}: ${url}`);
      });
    } else {
      console.log(`   Platform URLs: NONE`);
    }
  });

  // Output JSON for processing
  console.log('\n\n' + '='.repeat(80));
  console.log('JSON OUTPUT');
  console.log('='.repeat(80));
  console.log(JSON.stringify(zeroDish, null, 2));
}

listAllZeroDish()
  .then(() => process.exit(0))
  .catch(e => {
    console.error('Error:', e);
    process.exit(1);
  });
