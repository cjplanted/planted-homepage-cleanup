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
    // Get a venue with dishes
    const allDishes = await db.collection('dishes').limit(1).get();
    if (allDishes.empty) {
      console.log('No dishes found');
      process.exit(0);
    }

    const firstDish = allDishes.docs[0].data();
    console.log('First dish:', firstDish);

    const venueId = firstDish.venue_id;
    const venueDoc = await db.collection('venues').doc(venueId).get();
    const venueData = venueDoc.data();

    console.log('\nVenue data (full):');
    console.log(JSON.stringify(venueData, null, 2));

    // Get several venues with different countries
    console.log('\n\nSampling 10 venues:');
    const venues = await db.collection('venues').limit(10).get();
    venues.docs.forEach((doc, i) => {
      const data = doc.data();
      console.log(`\nVenue ${i + 1}:`);
      console.log(`  name: ${data.name}`);
      console.log(`  address: ${JSON.stringify(data.address)}`);
      console.log(`  location: ${JSON.stringify(data.location)}`);
    });

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
})();
