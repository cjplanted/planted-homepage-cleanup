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

    // Extract country from address or location
    function getCountryCode(venue) {
      // Try address field
      if (venue.address?.country_code) {
        return venue.address.country_code.toUpperCase();
      }
      // Try address string
      if (venue.address?.formatted_address) {
        if (venue.address.formatted_address.includes('Germany') || venue.address.formatted_address.includes(', DE ')) return 'DE';
        if (venue.address.formatted_address.includes('Austria') || venue.address.formatted_address.includes(', AT ')) return 'AT';
        if (venue.address.formatted_address.includes('Switzerland') || venue.address.formatted_address.includes(', CH ')) return 'CH';
        if (venue.address.formatted_address.includes('United Kingdom') || venue.address.formatted_address.includes(', UK ')) return 'UK';
        if (venue.address.formatted_address.includes('France') || venue.address.formatted_address.includes(', FR ')) return 'FR';
        if (venue.address.formatted_address.includes('Italy') || venue.address.formatted_address.includes(', IT ')) return 'IT';
      }
      return 'OTHER';
    }

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
      const country = getCountryCode(doc.data());

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
          examples: []
        };
      }

      const data = doc.data();
      byCountry[country].total++;
      const type = data.type || 'unknown';
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

        // Track example
        if (byCountry[country].examples.length < 3) {
          byCountry[country].examples.push({
            name: data.name,
            chain: data.chain_id || 'indie',
            dishes: dishesPerVenue[doc.id],
            images: dishesPerVenueWithImages[doc.id] || 0
          });
        }
      }

      // Count by chain
      const chain = data.chain_id || 'indie';
      if (!byCountry[country].chains[chain]) {
        byCountry[country].chains[chain] = { total: 0, withDishes: 0 };
      }
      byCountry[country].chains[chain].total++;
      if (hasDishes) byCountry[country].chains[chain].withDishes++;
    });

    console.log('=== DETAILED COUNTRY ANALYSIS ===\n');

    Object.entries(byCountry)
      .sort((a, b) => b[1].total - a[1].total)
      .forEach(([country, stats]) => {
        const venuePct = ((stats.withDishes / stats.total) * 100).toFixed(1);
        const restPct = stats.restaurant > 0 ? ((stats.restaurantWithDishes / stats.restaurant) * 100).toFixed(1) : 'N/A';
        const dishPct = stats.totalDishes > 0 ? ((stats.dishesWithImages / stats.totalDishes) * 100).toFixed(1) : 'N/A';

        console.log(`\n${country} (${stats.total} venues)`);
        console.log(`  Coverage: ${stats.withDishes}/${stats.total} venues (${venuePct}%)`);
        if (stats.restaurant > 0) {
          console.log(`  Restaurants: ${stats.restaurantWithDishes}/${stats.restaurant} (${restPct}%)`);
        }
        if (stats.retail > 0) {
          console.log(`  Retail: ${stats.retail} stores`);
        }
        console.log(`  Dishes: ${stats.totalDishes} total, ${stats.dishesWithImages} with images (${dishPct}%)`);

        // Top chains
        const topChains = Object.entries(stats.chains)
          .sort((a, b) => b[1].withDishes - a[1].withDishes)
          .slice(0, 5);

        if (topChains.length > 0) {
          console.log(`  Top chains:`);
          topChains.forEach(([chain, cstats]) => {
            const cpct = ((cstats.withDishes / cstats.total) * 100).toFixed(1);
            const label = chain === 'indie' ? '(indie)' : chain;
            console.log(`    ${label.padEnd(20)} ${cstats.withDishes}/${cstats.total} (${cpct}%)`);
          });
        }

        // Examples
        if (stats.examples.length > 0) {
          console.log(`  Examples with dishes:`);
          stats.examples.forEach(ex => {
            console.log(`    ${ex.name}: ${ex.dishes} dishes (${ex.images} images)`);
          });
        }

        // Gap analysis
        const gapVenues = stats.restaurant - stats.restaurantWithDishes;
        if (gapVenues > 0) {
          console.log(`  Gap: ${gapVenues} restaurants without dishes`);
        }
      });

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
})();
