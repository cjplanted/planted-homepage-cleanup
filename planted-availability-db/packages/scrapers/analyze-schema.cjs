const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

try {
  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || 'get-planted-db'
  });
} catch (e) {
  // Already initialized
}

const db = getFirestore();

(async () => {
  try {
    // Sample a few venues
    const venuesSample = await db.collection('venues').limit(5).get();
    console.log('Sample venues:');
    venuesSample.docs.forEach((doc, i) => {
      console.log(`\nVenue ${i + 1}:`);
      const data = doc.data();
      console.log(`  Keys: ${Object.keys(data).join(', ')}`);
      console.log(`  venue_type: ${data.venue_type}`);
      console.log(`  country: ${data.country}`);
      console.log(`  embedded_dishes: ${data.embedded_dishes ? `${data.embedded_dishes.length} dishes` : 'undefined'}`);
      console.log(`  dishes: ${data.dishes ? `${Array.isArray(data.dishes) ? data.dishes.length : 'object'}` : 'undefined'}`);
    });

    // Sample a few dishes
    console.log('\n\nSample dishes:');
    const dishesSample = await db.collection('dishes').limit(3).get();
    dishesSample.docs.forEach((doc, i) => {
      console.log(`\nDish ${i + 1}:`);
      const data = doc.data();
      console.log(`  Keys: ${Object.keys(data).join(', ')}`);
      console.log(`  name: ${data.name}`);
      console.log(`  venue_id: ${data.venue_id}`);
      console.log(`  image_url: ${data.image_url ? 'yes' : 'no'}`);
    });

    // Check relationships
    console.log('\n\nAnalyzing relationships:');
    const allVenues = await db.collection('venues').get();
    const allDishes = await db.collection('dishes').get();

    // Count dishes per venue_id
    const dishesPerVenue = {};
    allDishes.docs.forEach(doc => {
      const venueId = doc.data().venue_id;
      if (!dishesPerVenue[venueId]) dishesPerVenue[venueId] = 0;
      dishesPerVenue[venueId]++;
    });

    const venueIds = new Set(Object.keys(dishesPerVenue));
    const venueCount = allVenues.size;

    console.log(`  Total venues: ${venueCount}`);
    console.log(`  Venues with dishes: ${venueIds.size}`);
    console.log(`  Total dishes: ${allDishes.size}`);

    // Sample venue with dishes
    console.log('\n  Example venue with dishes:');
    for (const [vid, count] of Object.entries(dishesPerVenue).slice(0, 3)) {
      console.log(`    ${vid}: ${count} dishes`);
    }

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
})();
