const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');

initializeApp({
  credential: cert(path.resolve(__dirname, '../../service-account.json'))
});
const db = getFirestore();

async function analyzeDishNames() {
  // Get venues with multiple platforms
  const venuesSnap = await db.collection('venues')
    .where('status', '==', 'active')
    .get();

  const venues = venuesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // Get all dishes
  const dishesSnap = await db.collection('dishes').get();
  const allDishes = dishesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  console.log('=== DISH NAME ANALYSIS ===\n');

  // Group dishes by venue
  const venueGroups = {};
  for (const dish of allDishes) {
    if (!venueGroups[dish.venue_id]) {
      venueGroups[dish.venue_id] = [];
    }
    venueGroups[dish.venue_id].push(dish);
  }

  // Find venues with dishes - show sample
  console.log('SAMPLE VENUES WITH DISHES:\n');

  let count = 0;
  for (const venue of venues) {
    const dishes = venueGroups[venue.id] || [];
    if (dishes.length === 0) continue;

    const platforms = venue.delivery_platforms || [];
    if (platforms.length === 0) continue;

    count++;
    if (count > 10) break;

    console.log('\n' + venue.name);
    console.log('   ID: ' + venue.id);
    console.log('   Platforms: ' + platforms.map(p => p.platform).join(', '));
    console.log('   Dishes (' + dishes.length + '):');
    dishes.forEach(d => {
      const hasImage = d.image_url ? ' [has image]' : ' [no image]';
      console.log('     - "' + d.name + '"' + hasImage);
      if (d.source_platform) console.log('       source: ' + d.source_platform);
    });
  }

  // Analyze dish name patterns
  console.log('\n\n=== DISH NAME PATTERNS ===\n');

  const namePatterns = {};
  for (const dish of allDishes) {
    // Extract keywords
    const keywords = dish.name.toLowerCase()
      .split(/[^a-z]+/)
      .filter(w => w.length > 3);

    for (const kw of keywords) {
      if (!namePatterns[kw]) namePatterns[kw] = 0;
      namePatterns[kw]++;
    }
  }

  // Sort by frequency
  const sorted = Object.entries(namePatterns)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30);

  console.log('Most common words in dish names:');
  sorted.forEach(([word, count]) => {
    console.log('  ' + word + ': ' + count);
  });

  // Check for "planted" variations
  console.log('\n\n=== PLANTED DISH NAME VARIATIONS ===\n');

  const plantedDishes = allDishes.filter(d =>
    d.name.toLowerCase().includes('planted') ||
    d.name.toLowerCase().includes('plant')
  );

  const uniqueNames = [...new Set(plantedDishes.map(d => d.name))].sort();
  console.log('Found ' + uniqueNames.length + ' unique "planted" dish names:\n');
  uniqueNames.forEach(name => console.log('  - ' + name));

  // Check for dishes that might be duplicates with different names
  console.log('\n\n=== POTENTIAL CROSS-PLATFORM DUPLICATES ===\n');

  // Find venues that have similar dish names
  for (const venue of venues.slice(0, 20)) {
    const dishes = venueGroups[venue.id] || [];
    if (dishes.length < 2) continue;

    // Check for similar names
    const names = dishes.map(d => d.name);
    const similar = [];

    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const n1 = names[i].toLowerCase();
        const n2 = names[j].toLowerCase();

        // Check if they share 50% of keywords
        const words1 = n1.split(/[^a-z]+/).filter(w => w.length > 2);
        const words2 = n2.split(/[^a-z]+/).filter(w => w.length > 2);

        const shared = words1.filter(w => words2.includes(w)).length;
        const minLen = Math.min(words1.length, words2.length);

        if (shared >= minLen * 0.5 && shared > 0 && names[i] !== names[j]) {
          similar.push([names[i], names[j]]);
        }
      }
    }

    if (similar.length > 0) {
      console.log('\n' + venue.name + ':');
      similar.forEach(([a, b]) => {
        console.log('  "' + a + '" vs "' + b + '"');
      });
    }
  }
}

analyzeDishNames().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
