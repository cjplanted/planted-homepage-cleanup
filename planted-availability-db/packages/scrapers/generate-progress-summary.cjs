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
    const allVenues = await db.collection('venues').get();
    const allDishes = await db.collection('dishes').get();

    console.log('=== PLANTED ATTACK ZERO - CURRENT PROGRESS SUMMARY ===\n');

    // Count venues with dishes via venue_id in dishes collection
    const dishesPerVenue = {};
    const dishesPerVenueWithImages = {};

    allDishes.docs.forEach(doc => {
      const data = doc.data();
      const venueId = data.venue_id;

      if (!dishesPerVenue[venueId]) dishesPerVenue[venueId] = 0;
      if (!dishesPerVenueWithImages[venueId]) dishesPerVenueWithImages[venueId] = 0;

      dishesPerVenue[venueId]++;
      if (data.image_url) dishesPerVenueWithImages[venueId]++;
    });

    const venuesWithDishes = Object.keys(dishesPerVenue).length;
    const totalDishes = allDishes.size;

    // Group by country, type
    const byCountry = {};
    const chainCounts = {};

    allVenues.docs.forEach(doc => {
      const data = doc.data();
      const country = data.location?.geopoint ? 'unknown' : (data.address?.country_code || 'unknown');
      const chain = data.chain_id || 'indie';
      const type = data.type || 'unknown';

      if (!byCountry[country]) {
        byCountry[country] = {
          total: 0,
          withDishes: 0,
          restaurant: 0,
          restaurantWithDishes: 0,
          retail: 0,
          totalDishes: 0,
          dishesWithImages: 0
        };
      }

      byCountry[country].total++;
      if (type === 'restaurant' || type === 'restaurant_delivery') {
        byCountry[country].restaurant++;
      } else if (type === 'retail') {
        byCountry[country].retail++;
      }

      const hasdishes = dishesPerVenue[doc.id];
      if (hasdishes) {
        byCountry[country].withDishes++;
        if (type === 'restaurant' || type === 'restaurant_delivery') {
          byCountry[country].restaurantWithDishes++;
        }
        byCountry[country].totalDishes += dishesPerVenue[doc.id];
        byCountry[country].dishesWithImages += (dishesPerVenueWithImages[doc.id] || 0);
      }

      if (!chainCounts[chain]) {
        chainCounts[chain] = { total: 0, withDishes: 0 };
      }
      chainCounts[chain].total++;
      if (hasdishes) chainCounts[chain].withDishes++;
    });

    // Metrics
    console.log('CURRENT STATE:');
    console.log(`  Total venues:                 ${allVenues.size}`);
    console.log(`  Venues with dishes:           ${venuesWithDishes} (${((venuesWithDishes/allVenues.size)*100).toFixed(1)}%)`);
    console.log(`  Total dishes:                 ${totalDishes}`);
    console.log(`  Dishes with images:           ${allDishes.docs.filter(d => d.data().image_url).length} (${((allDishes.docs.filter(d => d.data().image_url).length/totalDishes)*100).toFixed(1)}%)`);
    console.log(`  Target (Attack Zero):         458 restaurants with dishes`);
    console.log(`  Progress to target:           ${venuesWithDishes}/458 (${((venuesWithDishes/458)*100).toFixed(1)}%)`);

    console.log('\nBY COUNTRY:');
    Object.entries(byCountry)
      .sort((a, b) => b[1].total - a[1].total)
      .forEach(([country, stats]) => {
        const venuePct = ((stats.withDishes / stats.total) * 100).toFixed(1);
        const dishPct = stats.totalDishes > 0 ? ((stats.dishesWithImages / stats.totalDishes) * 100).toFixed(1) : '0.0';
        console.log(`  ${country || 'unknown'}`);
        console.log(`    Venues: ${stats.withDishes}/${stats.total} (${venuePct}%)`);
        if (stats.restaurant > 0) {
          console.log(`    Restaurants: ${stats.restaurantWithDishes}/${stats.restaurant} (${((stats.restaurantWithDishes/stats.restaurant)*100).toFixed(1)}%)`);
        }
        if (stats.totalDishes > 0) {
          console.log(`    Dishes: ${stats.dishesWithImages}/${stats.totalDishes} images (${dishPct}%)`);
        }
      });

    // Top chains
    console.log('\nTOP CHAINS BY COVERAGE:');
    Object.entries(chainCounts)
      .sort((a, b) => {
        const aPct = b[1].withDishes / b[1].total;
        const bPct = a[1].withDishes / a[1].total;
        return aPct - bPct || b[1].total - a[1].total;
      })
      .slice(0, 15)
      .forEach(([chain, stats]) => {
        const pct = ((stats.withDishes / stats.total) * 100).toFixed(1);
        const label = chain === 'indie' ? '(indie)' : chain;
        console.log(`  ${label.padEnd(25)} ${stats.withDishes}/${stats.total} (${pct.padStart(5)}%)`);
      });

    // Data gaps analysis
    console.log('\n=== HIGH-IMPACT GAPS ===\n');

    const gaps = [];

    // Gap 1: Venues without dishes
    gaps.push({
      name: 'Venues without dishes',
      current: venuesWithDishes,
      target: 458,
      gap: 458 - venuesWithDishes,
      impact: 'Users see empty venue cards on locator',
      complexity: 'MEDIUM'
    });

    // Gap 2: Dishes without images
    const dishesWithImages = allDishes.docs.filter(d => d.data().image_url).length;
    gaps.push({
      name: 'Dishes without images',
      current: dishesWithImages,
      target: totalDishes,
      gap: totalDishes - dishesWithImages,
      impact: 'Low visual appeal in locator results',
      complexity: 'MEDIUM'
    });

    // Gap 3: Specific countries
    const deRestaurants = byCountry['DE']?.restaurantWithDishes || 0;
    const deRestaurantTotal = byCountry['DE']?.restaurant || 0;
    gaps.push({
      name: 'German restaurants without dishes',
      current: deRestaurants,
      target: deRestaurantTotal,
      gap: deRestaurantTotal - deRestaurants,
      impact: 'DE is 2nd largest market after CH',
      complexity: 'MEDIUM'
    });

    // Sort by gap size
    gaps.sort((a, b) => b.gap - a.gap);

    gaps.forEach((gap, i) => {
      console.log(`${i + 1}. ${gap.name}`);
      console.log(`   Current:    ${gap.current}/${gap.target}`);
      console.log(`   Gap:        ${gap.gap} (${((gap.gap/gap.target)*100).toFixed(1)}%)`);
      console.log(`   Impact:     ${gap.impact}`);
      console.log(`   Complexity: ${gap.complexity}`);
      console.log();
    });

    // Suggested actions
    console.log('=== RECOMMENDED NEXT ACTIONS ===\n');
    console.log('1. QUICK WINS (Low effort, high impact):');
    console.log('   - Identify and copy dishes from chain restaurants with dishes to same chain without');
    console.log(`   - Expected impact: +50-100 venues with dishes`);
    console.log();
    console.log('2. MEDIUM EFFORT (Manual research + extraction):');
    console.log('   - Research top 10 restaurant chains without dishes');
    console.log('   - Extract menu items from delivery platforms (Lieferando, Just Eat, Wolt, Uber Eats)');
    console.log(`   - Expected impact: +100-200 venues with dishes`);
    console.log();
    console.log('3. IMAGE EXTRACTION (Automated):');
    console.log('   - Scrape dish images from delivery platform pages');
    console.log(`   - Current coverage: ${((dishesWithImages/totalDishes)*100).toFixed(1)}%`);
    console.log(`   - Target: 80%+ coverage (${Math.round(totalDishes * 0.8)} images)`);
    console.log(`   - Gap: ${Math.round(totalDishes * 0.8) - dishesWithImages} images needed`);

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
})();
