const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');

// Initialize
initializeApp({
  credential: cert(path.resolve(__dirname, '../../service-account.json'))
});
const db = getFirestore();

async function checkVenue() {
  const arg = process.argv[2];

  // If arg is --production, check production venues collection
  if (arg === '--production') {
    const searchTerm = process.argv[3]?.toLowerCase() || '';
    console.log('Searching PRODUCTION venues for: ' + searchTerm + '\n');

    const venuesSnap = await db.collection('venues').get();

    const matches = [];
    for (const doc of venuesSnap.docs) {
      const data = doc.data();
      const name = (data.name || '').toLowerCase();
      if (name.includes(searchTerm)) {
        // Count dishes from separate dishes collection
        const dishCountSnap = await db.collection('dishes')
          .where('venue_id', '==', doc.id)
          .count()
          .get();
        matches.push({
          id: doc.id,
          name: data.name,
          city: data.address?.city,
          country: data.address?.country,
          status: data.status,
          dishCount: dishCountSnap.data().count
        });
      }
    }

    console.log('Found ' + matches.length + ' production venues:\n');
    matches.forEach(m => {
      console.log('  ' + m.name);
      console.log('    ID: ' + m.id);
      console.log('    City: ' + m.city + ', ' + m.country);
      console.log('    Status: ' + m.status + ' | Dishes: ' + m.dishCount);
      console.log('');
    });
    return;
  }

  // If arg is --search, search for venues by name
  if (arg === '--search') {
    const searchTerm = process.argv[3]?.toLowerCase() || '';
    console.log('Searching for venues containing: ' + searchTerm + '\n');

    const venuesSnap = await db.collection('discovered_venues')
      .where('status', 'in', ['verified', 'promoted'])
      .get();

    const matches = [];
    venuesSnap.docs.forEach(doc => {
      const data = doc.data();
      const name = (data.name || '').toLowerCase();
      const chain = (data.chain_name || '').toLowerCase();
      if (name.includes(searchTerm) || chain.includes(searchTerm)) {
        matches.push({
          id: doc.id,
          name: data.name,
          chain: data.chain_name,
          city: data.address?.city,
          dishes: (data.dishes || []).length,
          platforms: Object.keys(data.platform_urls || {})
        });
      }
    });

    console.log('Found ' + matches.length + ' matches:\n');
    matches.forEach(m => {
      console.log('  ' + m.name + ' [' + (m.chain || 'no chain') + ']');
      console.log('    ID: ' + m.id);
      console.log('    City: ' + m.city + ' | Dishes: ' + m.dishes + ' | Platforms: ' + m.platforms.join(', '));
      console.log('');
    });
    return;
  }

  const venueId = arg || 'EnHyTub2MQ5txuL8KZT7';
  console.log('Checking venue: ' + venueId + '\n');

  const venueDoc = await db.collection('discovered_venues').doc(venueId).get();

  if (!venueDoc.exists) {
    console.log('Venue not found');
    return;
  }

  const venue = venueDoc.data();
  console.log('Venue: ' + venue.name);
  console.log('Address: ' + (venue.address?.city || 'N/A'));
  console.log('Status: ' + venue.status);
  console.log('Platform URLs:', JSON.stringify(venue.platform_urls, null, 2));
  console.log('Delivery Platforms:', JSON.stringify(venue.delivery_platforms, null, 2));
  console.log('\nDishes embedded:', (venue.dishes || []).length);

  if (venue.dishes && venue.dishes.length > 0) {
    console.log('\nDish details:');
    venue.dishes.forEach((d, i) => {
      console.log('  ' + (i+1) + '. ' + (d.dish_name || d.name || JSON.stringify(Object.keys(d))));
      console.log('     Price: ' + (d.price || 'N/A') + ' ' + (d.currency || 'N/A'));
      console.log('     Image: ' + (d.image_url ? 'Yes (' + d.image_url.substring(0,50) + '...)' : 'No'));
    });
    console.log('\nFirst dish raw:', JSON.stringify(venue.dishes[0], null, 2));
  }
}

checkVenue().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
