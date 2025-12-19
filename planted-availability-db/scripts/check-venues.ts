/**
 * Quick script to check venue counts in Firestore
 */
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize with default credentials
if (!getApps().length) {
  initializeApp({ projectId: 'get-planted-db' });
}
const db = getFirestore();

async function checkVenues() {
  console.log('Checking venue counts...\n');

  // Check venues collection
  const venuesSnap = await db.collection('venues').get();
  const venueStatusCounts: Record<string, number> = {};
  venuesSnap.docs.forEach(doc => {
    const status = doc.data().status || 'unknown';
    venueStatusCounts[status] = (venueStatusCounts[status] || 0) + 1;
  });
  console.log('VENUES collection:');
  console.log('  Total:', venuesSnap.size);
  console.log('  By status:', venueStatusCounts);

  // Check discovered_venues collection
  const discoveredSnap = await db.collection('discovered_venues').get();
  const discoveredStatusCounts: Record<string, number> = {};
  discoveredSnap.docs.forEach(doc => {
    const status = doc.data().status || 'unknown';
    discoveredStatusCounts[status] = (discoveredStatusCounts[status] || 0) + 1;
  });
  console.log('\nDISCOVERED_VENUES collection:');
  console.log('  Total:', discoveredSnap.size);
  console.log('  By status:', discoveredStatusCounts);

  // Check staging collection
  const stagingSnap = await db.collection('staging').doc('review_queue').collection('venues').get();
  console.log('\nSTAGING/REVIEW_QUEUE:');
  console.log('  Total:', stagingSnap.size);

  // Check dishes
  const dishesSnap = await db.collection('dishes').get();
  console.log('\nDISHES collection:');
  console.log('  Total:', dishesSnap.size);

  // Sample active venue
  const activeVenues = await db.collection('venues').where('status', '==', 'active').limit(5).get();
  console.log('\nSample ACTIVE venues:');
  activeVenues.docs.forEach(doc => {
    const v = doc.data();
    console.log(`  - ${v.name} (${v.address?.city})`);
  });
}

checkVenues().catch(console.error);
