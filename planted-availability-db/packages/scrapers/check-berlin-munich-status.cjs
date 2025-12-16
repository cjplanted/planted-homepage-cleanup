const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');

initializeApp({
  credential: cert(path.resolve(__dirname, '../../service-account.json'))
});
const db = getFirestore();

async function checkStatus() {
  const venuesSnap = await db.collection('venues')
    .where('address.country', '==', 'DE')
    .where('status', '==', 'active')
    .get();

  const allVenues = venuesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  const berlinVenues = allVenues.filter(v => {
    const lat = v.location?.latitude || v.location?._latitude || 0;
    const lng = v.location?.longitude || v.location?._longitude || 0;
    return lat > 52.42 && lat < 52.76 && lng > 13.25 && lng < 13.62;
  });

  const munichVenues = allVenues.filter(v => {
    const lat = v.location?.latitude || v.location?._latitude || 0;
    const lng = v.location?.longitude || v.location?._longitude || 0;
    return lat > 48.05 && lat < 48.25 && lng > 11.35 && lng < 11.75;
  });

  const dishesSnap = await db.collection('dishes').get();
  const allDishes = dishesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  console.log('\n=== BERLIN STATUS ===');
  console.log(`Venues: ${berlinVenues.length}`);
  const berlinDishes = allDishes.filter(d => berlinVenues.some(v => v.id === d.venue_id));
  const berlinNoImage = berlinDishes.filter(d => !d.image_url);
  console.log(`Dishes: ${berlinDishes.length} total, ${berlinNoImage.length} missing images (${((berlinDishes.length - berlinNoImage.length) / berlinDishes.length * 100).toFixed(1)}% coverage)`);

  console.log('\nVenues with missing images:');
  berlinVenues.forEach(v => {
    const dishes = allDishes.filter(d => d.venue_id === v.id && !d.image_url);
    if (dishes.length > 0) {
      const platforms = v.delivery_platforms?.map(p => p.platform).join(', ') || 'none';
      console.log(`  ${v.name}: ${dishes.length} dishes (${platforms})`);
    }
  });

  console.log('\n=== MUNICH STATUS ===');
  console.log(`Venues: ${munichVenues.length}`);
  const munichDishes = allDishes.filter(d => munichVenues.some(v => v.id === d.venue_id));
  const munichNoImage = munichDishes.filter(d => !d.image_url);
  console.log(`Dishes: ${munichDishes.length} total, ${munichNoImage.length} missing images (${((munichDishes.length - munichNoImage.length) / munichDishes.length * 100).toFixed(1)}% coverage)`);

  console.log('\nVenues with missing images:');
  munichVenues.forEach(v => {
    const dishes = allDishes.filter(d => d.venue_id === v.id && !d.image_url);
    if (dishes.length > 0) {
      const platforms = v.delivery_platforms?.map(p => p.platform).join(', ') || 'none';
      console.log(`  ${v.name}: ${dishes.length} dishes (${platforms})`);
    }
  });
}

checkStatus().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
