const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');

// Initialize
initializeApp({
  credential: cert(path.resolve(__dirname, '../../service-account.json'))
});
const db = getFirestore();

async function checkPromotedWithDishes() {
  console.log('Checking promoted discovered venues for embedded dishes...\n');

  const promotedSnap = await db.collection('discovered_venues')
    .where('status', '==', 'promoted')
    .get();

  let withDishes = 0;
  let withoutDishes = 0;
  let totalEmbeddedDishes = 0;

  const venuesWithDishes = [];
  const venuesWithoutDishes = [];

  for (const doc of promotedSnap.docs) {
    const data = doc.data();
    const dishCount = (data.dishes || []).length;

    if (dishCount > 0) {
      withDishes++;
      totalEmbeddedDishes += dishCount;
      venuesWithDishes.push({
        id: doc.id,
        name: data.name,
        city: data.address?.city,
        country: data.address?.country,
        dishCount,
        productionId: data.production_venue_id
      });
    } else {
      withoutDishes++;
      venuesWithoutDishes.push({
        id: doc.id,
        name: data.name,
        city: data.address?.city,
        country: data.address?.country,
        productionId: data.production_venue_id
      });
    }
  }

  console.log(`=== SUMMARY ===`);
  console.log(`Total promoted venues: ${promotedSnap.size}`);
  console.log(`With embedded dishes: ${withDishes}`);
  console.log(`Without embedded dishes: ${withoutDishes}`);
  console.log(`Total embedded dishes: ${totalEmbeddedDishes}`);

  console.log(`\n=== PROMOTED VENUES WITH DISHES (sample) ===\n`);
  venuesWithDishes.slice(0, 20).forEach(v => {
    console.log(`  ${v.name} (${v.city}, ${v.country})`);
    console.log(`    Discovered ID: ${v.id}`);
    console.log(`    Production ID: ${v.productionId || 'MISSING'}`);
    console.log(`    Embedded dishes: ${v.dishCount}`);
    console.log('');
  });

  console.log(`\n=== PROMOTED VENUES WITHOUT DISHES (sample) ===\n`);
  venuesWithoutDishes.slice(0, 20).forEach(v => {
    console.log(`  ${v.name} (${v.city}, ${v.country})`);
    console.log(`    Discovered ID: ${v.id}`);
    console.log(`    Production ID: ${v.productionId || 'MISSING'}`);
    console.log('');
  });

  // Check production dish counts for venues with embedded dishes
  console.log(`\n=== PRODUCTION DISH CHECK ===\n`);
  for (const v of venuesWithDishes.slice(0, 10)) {
    if (v.productionId) {
      const dishCount = await db.collection('dishes')
        .where('venue_id', '==', v.productionId)
        .count()
        .get();
      console.log(`  ${v.name}: Embedded=${v.dishCount}, Production=${dishCount.data().count}`);
    }
  }
}

checkPromotedWithDishes().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
