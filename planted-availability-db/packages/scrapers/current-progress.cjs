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
    // Get all venues
    const allVenues = await db.collection('venues').get();
    const allDishes = await db.collection('dishes').get();

    console.log('=== CURRENT DATABASE STATE ===\n');
    console.log('Total venues:', allVenues.size);
    console.log('Total dishes:', allDishes.size);

    // Group venues by type
    const byType = {};
    const byCountry = {};

    allVenues.docs.forEach(doc => {
      const data = doc.data();
      const type = data.venue_type || 'unknown';
      const country = data.country || 'unknown';

      if (!byType[type]) byType[type] = 0;
      if (!byCountry[country]) byCountry[country] = { total: 0, withDishes: 0, totalDishes: 0, dishesWithImages: 0 };

      byType[type]++;
      byCountry[country].total++;
    });

    console.log('\nVenues by type:');
    Object.entries(byType).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });

    // Count venues with dishes
    let venuesWithDishes = 0;
    let totalVenueDishes = 0;
    let dishesWithImages = 0;

    allVenues.docs.forEach(doc => {
      const dishes = doc.data().embedded_dishes || [];
      if (dishes.length > 0) venuesWithDishes++;
      totalVenueDishes += dishes.length;

      const country = doc.data().country || 'unknown';
      byCountry[country].withDishes += (dishes.length > 0 ? 1 : 0);
      byCountry[country].totalDishes += dishes.length;

      dishes.forEach(d => {
        if (d.image_url) {
          dishesWithImages++;
          byCountry[country].dishesWithImages++;
        }
      });
    });

    console.log('\nVenues with dishes:', venuesWithDishes, `(${((venuesWithDishes/allVenues.size)*100).toFixed(1)}%)`);
    console.log('Total embedded dishes:', totalVenueDishes);
    console.log('Dishes with images:', dishesWithImages, `(${((dishesWithImages/totalVenueDishes)*100).toFixed(1)}%)`);

    console.log('\nBy country (venue_count: with_dishes/total, dish_image_coverage):');
    Object.entries(byCountry)
      .sort((a, b) => b[1].total - a[1].total)
      .forEach(([country, stats]) => {
        const venuePct = ((stats.withDishes / stats.total) * 100).toFixed(1);
        const dishPct = stats.totalDishes > 0 ? ((stats.dishesWithImages / stats.totalDishes) * 100).toFixed(1) : '0.0';
        const venues = `${stats.withDishes}/${stats.total}`;
        const images = `${stats.dishesWithImages}/${stats.totalDishes}`;
        console.log(`  ${country.padEnd(4)} | Venues: ${venues.padEnd(8)} (${venuePct.padStart(5)}%) | Images: ${images.padEnd(8)} (${dishPct.padStart(5)}%)`);
      });

    // Identify gaps
    console.log('\n=== DATA QUALITY GAPS ===\n');

    const venuesWithoutDishes = allVenues.size - venuesWithDishes;
    console.log(`Venues without dishes: ${venuesWithoutDishes} (${((venuesWithoutDishes/allVenues.size)*100).toFixed(1)}%)`);

    const dishesWithoutImages = totalVenueDishes - dishesWithImages;
    console.log(`Dishes without images: ${dishesWithoutImages} (${((dishesWithoutImages/totalVenueDishes)*100).toFixed(1)}%)`);

    // Quick breakdown
    console.log('\n=== QUICK METRICS ===\n');
    console.log(`Venue coverage:          ${venuesWithDishes}/${allVenues.size} (${((venuesWithDishes/allVenues.size)*100).toFixed(1)}%)`);
    console.log(`Dish image coverage:     ${dishesWithImages}/${totalVenueDishes} (${((dishesWithImages/totalVenueDishes)*100).toFixed(1)}%)`);
    console.log(`Target (upstream):       458 restaurants with dishes`);
    console.log(`Progress toward target:  ${((venuesWithDishes/458)*100).toFixed(1)}%`);

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
})();
