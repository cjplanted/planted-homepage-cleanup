#!/usr/bin/env node
/**
 * Analyze which venues need Puppeteer scraping
 * Identifies venues with Lieferando/Just Eat platforms and dishes without images
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

async function analyzePuppeteerTargets() {
  console.log('\n=== ANALYZE PUPPETEER SCRAPING TARGETS ===\n');

  // Get all active venues
  const venuesSnap = await db.collection('venues')
    .where('status', '==', 'active')
    .get();

  const venues = venuesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // Get all dishes
  const dishesSnap = await db.collection('dishes').get();
  const allDishes = dishesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // Find venues with JS-rendered platforms and dishes without images
  const targets = [];

  for (const venue of venues) {
    const venueDishes = allDishes.filter(d => d.venue_id === venue.id && !d.image_url);
    if (venueDishes.length === 0) continue;

    const platforms = venue.delivery_platforms || [];
    const jsRenderPlatforms = platforms.filter(p =>
      p.platform === 'lieferando' || p.platform === 'just-eat'
    );

    if (jsRenderPlatforms.length > 0) {
      targets.push({
        id: venue.id,
        name: venue.name,
        city: venue.address?.city || 'Unknown',
        country: venue.address?.country || 'Unknown',
        dishCount: venueDishes.length,
        platforms: jsRenderPlatforms.map(p => ({
          platform: p.platform,
          url: p.url
        })),
        dishes: venueDishes.map(d => d.name)
      });
    }
  }

  // Sort by country, city, venue name
  targets.sort((a, b) => {
    if (a.country !== b.country) return a.country.localeCompare(b.country);
    if (a.city !== b.city) return a.city.localeCompare(b.city);
    return a.name.localeCompare(b.name);
  });

  // Display results
  console.log(`Found ${targets.length} venues needing Puppeteer scraping\n`);

  let currentCountry = '';
  let currentCity = '';
  let totalDishes = 0;
  const platformCounts = { lieferando: 0, 'just-eat': 0 };

  for (const target of targets) {
    if (target.country !== currentCountry) {
      currentCountry = target.country;
      currentCity = '';
      console.log(`\n=== ${currentCountry} ===\n`);
    }

    if (target.city !== currentCity) {
      currentCity = target.city;
      console.log(`\n${currentCity}:`);
    }

    console.log(`  ${target.name} (${target.dishCount} dishes)`);
    console.log(`    ID: ${target.id}`);

    for (const platform of target.platforms) {
      console.log(`    ${platform.platform}: ${platform.url}`);
      platformCounts[platform.platform]++;
    }

    console.log(`    Dishes: ${target.dishes.join(', ')}`);
    totalDishes += target.dishCount;
  }

  console.log(`\n\n=== SUMMARY ===`);
  console.log(`Total venues: ${targets.length}`);
  console.log(`Total dishes: ${totalDishes}`);
  console.log(`Lieferando platforms: ${platformCounts.lieferando}`);
  console.log(`Just Eat platforms: ${platformCounts['just-eat']}`);

  console.log(`\n\n=== TEST COMMANDS ===`);
  if (targets.length > 0) {
    console.log(`\nTest on first venue (${targets[0].name}):`);
    console.log(`  node puppeteer-dish-scraper.cjs --venue=${targets[0].id}\n`);

    console.log(`Test Lieferando only:`);
    console.log(`  node puppeteer-dish-scraper.cjs --platform=lieferando\n`);

    console.log(`Test Just Eat only:`);
    console.log(`  node puppeteer-dish-scraper.cjs --platform=just-eat\n`);

    console.log(`Execute all:`);
    console.log(`  node puppeteer-dish-scraper.cjs --execute\n`);
  }
}

analyzePuppeteerTargets()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
