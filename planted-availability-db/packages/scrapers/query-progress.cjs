const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize Firebase Admin
try {
  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || 'get-planted-db'
  });
} catch (e) {
  // App already initialized
}

const db = getFirestore();

(async () => {
  try {
    // Total venues
    const allVenues = await db.collection('production_venues').count().get();
    console.log('Total venues:', allVenues.data().count);

    // Venues by type
    const restaurants = await db.collection('production_venues').where('venue_type', '==', 'restaurant').get();
    const retail = await db.collection('production_venues').where('venue_type', '==', 'retail').get();
    console.log('Restaurants:', restaurants.size);
    console.log('Retail:', retail.size);

    // Count venues with dishes
    let withDishes = 0;
    let totalDishes = 0;
    let dishesWithImages = 0;
    let dishesWithoutImages = 0;

    for (const doc of restaurants.docs) {
      const dishes = doc.data().embedded_dishes || [];
      if (dishes.length > 0) withDishes++;
      totalDishes += dishes.length;
      dishes.forEach(d => {
        if (d.image_url) dishesWithImages++;
        else dishesWithoutImages++;
      });
    }

    console.log('Restaurants with dishes:', withDishes);
    console.log('Total dishes:', totalDishes);
    console.log('Dishes with images:', dishesWithImages);
    console.log('Dishes without images:', dishesWithoutImages);

    // By country
    const byCountry = {};
    restaurants.docs.forEach(doc => {
      const country = doc.data().country || 'unknown';
      const hasDishes = (doc.data().embedded_dishes || []).length > 0;
      const dishCount = (doc.data().embedded_dishes || []).length;
      if (!byCountry[country]) {
        byCountry[country] = {total: 0, withDishes: 0, totalDishes: 0, dishesWithImages: 0};
      }
      byCountry[country].total++;
      if (hasDishes) byCountry[country].withDishes++;
      byCountry[country].totalDishes += dishCount;
      (doc.data().embedded_dishes || []).forEach(d => {
        if (d.image_url) byCountry[country].dishesWithImages++;
      });
    });

    console.log('\nBy country:');
    Object.entries(byCountry).sort((a, b) => b[1].total - a[1].total).forEach(([country, stats]) => {
      const venuePct = ((stats.withDishes / stats.total) * 100).toFixed(1);
      const dishPct = stats.totalDishes > 0 ? ((stats.dishesWithImages / stats.totalDishes) * 100).toFixed(1) : '0.0';
      console.log(`  ${country}: ${stats.withDishes}/${stats.total} venues (${venuePct}%), ${stats.dishesWithImages}/${stats.totalDishes} dish images (${dishPct}%)`);
    });

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
})();
