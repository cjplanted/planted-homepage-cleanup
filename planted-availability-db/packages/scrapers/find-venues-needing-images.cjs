#!/usr/bin/env node
const admin = require('firebase-admin');
const path = require('path');

admin.initializeApp({
  credential: admin.credential.cert(require(path.join(__dirname, '../../service-account.json')))
});
const db = admin.firestore();

async function findVenuesNeedingImages() {
  const venuesSnap = await db.collection('venues').where('status', '==', 'active').get();
  const venues = venuesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const dishesSnap = await db.collection('dishes').get();
  const dishes = dishesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const dishesWithoutImages = dishes.filter(d => !d.image_url);

  const byVenue = {};
  dishesWithoutImages.forEach(d => {
    if (!byVenue[d.venue_id]) byVenue[d.venue_id] = [];
    byVenue[d.venue_id].push(d);
  });

  const targets = [];
  for (const venue of venues) {
    const dishCount = byVenue[venue.id] ? byVenue[venue.id].length : 0;
    if (dishCount === 0) continue;

    const platforms = venue.delivery_platforms || [];
    const lieferando = platforms.find(p =>
      p.url && (p.url.includes('lieferando') || p.url.includes('just-eat') || p.url.includes('eat.ch'))
    );

    if (lieferando) {
      targets.push({
        id: venue.id,
        name: venue.name,
        dishCount,
        url: lieferando.url,
        dishes: byVenue[venue.id].map(d => ({ id: d.id, name: d.name }))
      });
    }
  }

  targets.sort((a, b) => b.dishCount - a.dishCount);

  console.log('=== VENUES NEEDING IMAGES (with Lieferando/Just Eat) ===');
  console.log('Total: ' + targets.length + ' venues\n');

  targets.slice(0, 15).forEach((t, i) => {
    console.log((i+1) + '. ' + t.name + ' (' + t.dishCount + ' dishes)');
    console.log('   ID: ' + t.id);
    console.log('   URL: ' + t.url);
    console.log('   Dishes: ' + t.dishes.slice(0, 5).map(d => d.name).join(', ') + (t.dishCount > 5 ? '...' : ''));
    console.log('');
  });

  // Output JSON for first target
  if (targets.length > 0) {
    console.log('\n=== FIRST TARGET (JSON) ===');
    console.log(JSON.stringify(targets[0], null, 2));
  }
}

findVenuesNeedingImages().then(() => process.exit(0));
