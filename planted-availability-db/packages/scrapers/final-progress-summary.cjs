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

    // Count dishes per venue
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

    // Group by country
    const byCountry = {};

    allVenues.docs.forEach(doc => {
      const data = doc.data();
      const country = data.address?.country || 'unknown';

      if (!byCountry[country]) {
        byCountry[country] = {
          total: 0,
          withDishes: 0,
          restaurant: 0,
          restaurantWithDishes: 0,
          retail: 0,
          totalDishes: 0,
          dishesWithImages: 0,
          chains: {},
          chainsNeeded: {}
        };
      }

      const type = data.type || 'unknown';
      byCountry[country].total++;

      if (type === 'restaurant' || type === 'restaurant_delivery') {
        byCountry[country].restaurant++;
      } else if (type === 'retail') {
        byCountry[country].retail++;
      }

      const hasDishes = dishesPerVenue[doc.id];
      if (hasDishes) {
        byCountry[country].withDishes++;
        if (type === 'restaurant' || type === 'restaurant_delivery') {
          byCountry[country].restaurantWithDishes++;
        }
        byCountry[country].totalDishes += dishesPerVenue[doc.id];
        byCountry[country].dishesWithImages += (dishesPerVenueWithImages[doc.id] || 0);
      } else if (type === 'restaurant' || type === 'restaurant_delivery') {
        byCountry[country].chainsNeeded[data.chain_id || 'indie'] = (byCountry[country].chainsNeeded[data.chain_id || 'indie'] || 0) + 1;
      }

      // Count by chain
      const chain = data.chain_id || 'indie';
      if (!byCountry[country].chains[chain]) {
        byCountry[country].chains[chain] = { total: 0, withDishes: 0 };
      }
      byCountry[country].chains[chain].total++;
      if (hasDishes) byCountry[country].chains[chain].withDishes++;
    });

    // Overall metrics
    const venuesWithDishes = Object.keys(dishesPerVenue).length;
    const totalDishes = allDishes.size;
    const dishesWithImages = allDishes.docs.filter(d => d.data().image_url).length;

    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║          PLANTED ATTACK ZERO - PROGRESS SUMMARY               ║');
    console.log('║                   Generated: 2025-12-16T22:30Z                 ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    console.log('CURRENT STATE:');
    console.log(`  Total venues:                 ${allVenues.size}`);
    console.log(`  Venues with dishes:           ${venuesWithDishes} (${((venuesWithDishes/allVenues.size)*100).toFixed(1)}%)`);
    console.log(`  Total dishes:                 ${totalDishes}`);
    console.log(`  Dishes with images:           ${dishesWithImages} (${((dishesWithImages/totalDishes)*100).toFixed(1)}%)`);
    console.log(`\n  Attack Zero Target:           458 restaurants with dishes`);
    console.log(`  PROGRESS:                     ${venuesWithDishes}/458 (${((venuesWithDishes/458)*100).toFixed(1)}%)`);

    console.log('\n\nBY COUNTRY:');
    console.log('  Country  | Restaurants | Coverage      | Images         | Gap');
    console.log('  ---------|-------------|---------------|----------------|----------');

    const sortedCountries = Object.entries(byCountry)
      .filter(([_, stats]) => stats.restaurant > 0)
      .sort((a, b) => b[1].restaurant - a[1].restaurant);

    let totalRestaurants = 0;
    let totalRestaurantsWithDishes = 0;

    sortedCountries.forEach(([country, stats]) => {
      totalRestaurants += stats.restaurant;
      totalRestaurantsWithDishes += stats.restaurantWithDishes;

      const restPct = ((stats.restaurantWithDishes / stats.restaurant) * 100).toFixed(1);
      const dishPct = stats.totalDishes > 0 ? ((stats.dishesWithImages / stats.totalDishes) * 100).toFixed(1) : '0.0';
      const gap = stats.restaurant - stats.restaurantWithDishes;

      const countryLabel = country.padEnd(8);
      const restLabel = `${stats.restaurantWithDishes}/${stats.restaurant}`.padEnd(11);
      const coverageLabel = `${restPct}%`.padEnd(13);
      const imageLabel = `${stats.dishesWithImages}/${stats.totalDishes}`.padEnd(14);

      console.log(`  ${countryLabel} | ${restLabel} | ${coverageLabel} | ${imageLabel} | ${gap}`);
    });

    console.log('\n\nHIGHEST-IMPACT GAPS:\n');

    const gaps = [];

    // Gap 1: Dishes without images
    gaps.push({
      rank: 1,
      name: 'Dish images missing',
      current: dishesWithImages,
      target: totalDishes,
      gap: totalDishes - dishesWithImages,
      pct: 100 - ((dishesWithImages / totalDishes) * 100),
      impact: 'Affects visual appeal on locator - most noticeable to users',
      effort: 'MEDIUM',
      timeEstimate: '2-3 hours',
      expectedGain: '~590 additional dish images'
    });

    // Gap 2: Venues without dishes
    gaps.push({
      rank: 2,
      name: 'Venues without dishes',
      current: venuesWithDishes,
      target: 458,
      gap: 458 - venuesWithDishes,
      pct: 100 - ((venuesWithDishes / 458) * 100),
      impact: 'Venues appear on locator but show "no planted options" - users see empty cards',
      effort: 'MEDIUM',
      timeEstimate: '4-6 hours (chain research + manual extraction)',
      expectedGain: '~100-150 additional venues'
    });

    // Gap 3: Retail vs Restaurant targeting
    const retailVenues = allVenues.docs.filter(v => v.data().type === 'retail').length;
    gaps.push({
      rank: 3,
      name: 'Retail chains with dishes',
      current: 0,
      target: retailVenues,
      gap: retailVenues,
      pct: 0,
      impact: 'Retail stores (BILLA, REWE, etc) - lower priority but could show planted products',
      effort: 'HIGH',
      timeEstimate: '8+ hours (platform integration needed)',
      expectedGain: '~500+ retail venues'
    });

    gaps.forEach(gap => {
      console.log(`${gap.rank}. ${gap.name}`);
      console.log(`   Metric:        ${gap.current}/${gap.target} (${gap.pct.toFixed(1)}% gap)`);
      console.log(`   Impact:        ${gap.impact}`);
      console.log(`   Effort:        ${gap.effort} - ${gap.timeEstimate}`);
      console.log(`   Expected Gain: ${gap.expectedGain}`);
      console.log();
    });

    // Recommended actions
    console.log('\nRECOMMENDED NEXT ACTIONS (Priority Order):\n');

    console.log('1. QUICK WIN - Extract dish images (1-2 hours)');
    console.log('   • Use existing Puppeteer scraper (T026) for JS-rendered platforms');
    console.log('   • Target: Lieferando/Just Eat venues in DE, AT, CH');
    console.log('   • Expected gain: +200-300 dish images (58% → 75% coverage)');
    console.log('   • Impact: High - visual appeal drives conversions\n');

    console.log('2. MEDIUM EFFORT - Close restaurant gap (4-6 hours)');
    console.log('   • Identify chains with 0 dishes but active venues');
    console.log('   • Research delivery platform menus for planted options');
    console.log('   • Copy dishes from existing chain venues to others');
    console.log('   • Expected gain: +100-150 venues (72% → 85% coverage)');
    console.log('   • Impact: Medium - completeness matters for locator\n');

    console.log('3. OPTIMIZATION - Data cleanup (2-3 hours)');
    console.log('   • Fix 50 restaurants without dishes');
    console.log('   • Verify coordinates for all venues');
    console.log('   • Update delivery platform links');
    console.log('   • Expected gain: Better locator accuracy\n');

    console.log('4. LONG-TERM - Retail integration (8+ hours)');
    console.log('   • Research retail chain supply (BILLA, REWE, INTERSPAR, Coop)');
    console.log('   • Add product presence data for retail stores');
    console.log('   • Enable "Buy at [retailer]" option on locator');
    console.log('   • Expected gain: +500+ retail venues\n');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
})();
