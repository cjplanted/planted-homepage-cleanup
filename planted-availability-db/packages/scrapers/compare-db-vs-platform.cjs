const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');

initializeApp({
  credential: cert(path.resolve(__dirname, '../../service-account.json'))
});
const db = getFirestore();

async function compareDbVsPlatform() {
  // Get all dishes
  const dishesSnap = await db.collection('dishes').get();
  const allDishes = dishesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // Get all venues
  const venuesSnap = await db.collection('venues').get();
  const venueMap = {};
  venuesSnap.docs.forEach(doc => {
    venueMap[doc.id] = { id: doc.id, ...doc.data() };
  });

  console.log('=== DATABASE DISHES vs PLATFORM NAMES ===\n');
  console.log('Looking for dishes where DB name differs from platform name...\n');

  // Check dishes that have both name and a source_url
  const dishesWithSource = allDishes.filter(d => d.source_url || d.platform_url);

  console.log('Dishes with source URLs: ' + dishesWithSource.length + '\n');

  // Check for dishes that have both image and source - these were successfully scraped
  const scrapedDishes = allDishes.filter(d => d.image_url && (d.source_url || d.platform_url));
  console.log('Successfully scraped dishes: ' + scrapedDishes.length + '\n');

  // Group by venue chain to see naming patterns
  console.log('\n=== CHAIN-SPECIFIC NAMING PATTERNS ===\n');

  const chainPatterns = {};
  for (const dish of allDishes) {
    const venue = venueMap[dish.venue_id];
    if (!venue) continue;

    const chain = venue.chain || venue.name.split(' ')[0].toLowerCase();

    if (!chainPatterns[chain]) {
      chainPatterns[chain] = { names: new Set(), venues: new Set() };
    }
    chainPatterns[chain].names.add(dish.name);
    chainPatterns[chain].venues.add(venue.name);
  }

  // Sort by dish count
  const sortedChains = Object.entries(chainPatterns)
    .map(([chain, data]) => ({ chain, dishes: data.names.size, venues: data.venues.size }))
    .sort((a, b) => b.dishes - a.dishes)
    .slice(0, 15);

  sortedChains.forEach(({ chain, dishes, venues }) => {
    console.log('\n' + chain.toUpperCase() + ' (' + venues + ' venues, ' + dishes + ' unique dish names):');
    const names = [...chainPatterns[chain].names].slice(0, 10);
    names.forEach(n => console.log('  - ' + n));
    if (chainPatterns[chain].names.size > 10) {
      console.log('  ... and ' + (chainPatterns[chain].names.size - 10) + ' more');
    }
  });

  // FAT MONK specific analysis (from Puppeteer log we saw "Planted.Chicken Monk")
  console.log('\n\n=== FAT MONK ANALYSIS ===\n');

  const fatMonkVenues = Object.values(venueMap).filter(v =>
    v.name.toLowerCase().includes('fat monk')
  );

  console.log('FAT MONK venues: ' + fatMonkVenues.length);

  for (const venue of fatMonkVenues) {
    const dishes = allDishes.filter(d => d.venue_id === venue.id);
    console.log('\n' + venue.name + ' (' + venue.id + '):');
    console.log('  Platforms: ' + (venue.delivery_platforms || []).map(p => p.platform + ': ' + p.url).join('\n             '));
    console.log('  Dishes in DB:');
    dishes.forEach(d => {
      console.log('    - "' + d.name + '" ' + (d.image_url ? '[has image]' : '[no image]'));
    });
  }

  // Birdie Birdie analysis (we saw they have platform-specific menu)
  console.log('\n\n=== BIRDIE BIRDIE ANALYSIS ===\n');

  const birdieVenues = Object.values(venueMap).filter(v =>
    v.name.toLowerCase().includes('birdie')
  ).slice(0, 3);

  for (const venue of birdieVenues) {
    const dishes = allDishes.filter(d => d.venue_id === venue.id);
    console.log('\n' + venue.name + ' (' + venue.id + '):');
    console.log('  Platforms: ' + (venue.delivery_platforms || []).map(p => p.platform).join(', '));
    console.log('  Dishes in DB:');
    dishes.forEach(d => {
      console.log('    - "' + d.name + '" ' + (d.image_url ? '[has image]' : '[no image]'));
    });
  }

  // Look at dishes that have images vs don't - what's the pattern?
  console.log('\n\n=== IMAGE SUCCESS PATTERN ===\n');

  const withImages = allDishes.filter(d => d.image_url);
  const withoutImages = allDishes.filter(d => !d.image_url);

  console.log('Dishes WITH images: ' + withImages.length);
  console.log('Dishes WITHOUT images: ' + withoutImages.length);

  // Sample names that have images
  console.log('\nSample dish names WITH images:');
  withImages.slice(0, 15).forEach(d => {
    const venue = venueMap[d.venue_id];
    console.log('  "' + d.name + '" at ' + (venue ? venue.name : 'unknown'));
  });

  console.log('\nSample dish names WITHOUT images:');
  withoutImages.slice(0, 15).forEach(d => {
    const venue = venueMap[d.venue_id];
    console.log('  "' + d.name + '" at ' + (venue ? venue.name : 'unknown'));
  });
}

compareDbVsPlatform().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
