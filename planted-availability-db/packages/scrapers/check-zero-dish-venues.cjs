const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');

// Initialize
initializeApp({
  credential: cert(path.resolve(__dirname, '../../service-account.json'))
});
const db = getFirestore();

async function checkZeroDishVenues() {
  console.log('Checking production venues with 0 dishes...\n');

  const venuesSnap = await db.collection('venues').get();

  const zeroDishVenues = [];
  const withDishVenues = [];

  for (const doc of venuesSnap.docs) {
    const data = doc.data();

    // Count dishes from dishes collection
    const dishCountSnap = await db.collection('dishes')
      .where('venue_id', '==', doc.id)
      .count()
      .get();

    const dishCount = dishCountSnap.data().count;

    if (dishCount === 0) {
      zeroDishVenues.push({
        id: doc.id,
        name: data.name,
        city: data.address?.city,
        country: data.address?.country,
        status: data.status
      });
    } else {
      withDishVenues.push({
        id: doc.id,
        name: data.name,
        dishCount
      });
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Total production venues: ${venuesSnap.size}`);
  console.log(`Venues with dishes: ${withDishVenues.length}`);
  console.log(`Venues with 0 dishes: ${zeroDishVenues.length}`);

  console.log(`\n=== ZERO-DISH VENUES ===\n`);

  // Group by country
  const byCountry = {};
  zeroDishVenues.forEach(v => {
    const country = v.country || 'Unknown';
    if (!byCountry[country]) byCountry[country] = [];
    byCountry[country].push(v);
  });

  for (const [country, venues] of Object.entries(byCountry)) {
    console.log(`\n${country} (${venues.length} venues with 0 dishes):`);
    venues.slice(0, 10).forEach(v => {
      console.log(`  - ${v.name} (${v.city}) [${v.id}]`);
    });
    if (venues.length > 10) {
      console.log(`  ... and ${venues.length - 10} more`);
    }
  }
}

checkZeroDishVenues().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
