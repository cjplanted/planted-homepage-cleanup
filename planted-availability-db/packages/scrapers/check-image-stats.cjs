#!/usr/bin/env node
/**
 * Check dish image statistics
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');

initializeApp({
  credential: cert(path.resolve(__dirname, '../../service-account.json'))
});
const db = getFirestore();

async function main() {
  const dishesSnap = await db.collection('dishes').get();
  const allDishes = dishesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  const withImages = allDishes.filter(d => d.image_url);
  const withoutImages = allDishes.filter(d => !d.image_url);

  console.log('=== DISH IMAGE STATISTICS ===\n');
  console.log('Total dishes:', allDishes.length);
  console.log('With images:', withImages.length, '(' + Math.round(withImages.length/allDishes.length*100) + '%)');
  console.log('Without images:', withoutImages.length, '(' + Math.round(withoutImages.length/allDishes.length*100) + '%)');

  // Count by image_source
  const bySrc = {};
  for (const d of withImages) {
    const src = d.image_source || 'unknown';
    bySrc[src] = (bySrc[src] || 0) + 1;
  }
  console.log('\nBy source:');
  for (const [src, count] of Object.entries(bySrc).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${src}: ${count}`);
  }

  // Show some dishes without images
  console.log('\nSample dishes without images:');
  for (const d of withoutImages.slice(0, 10)) {
    console.log(`  - ${d.name} (${d.id})`);
  }
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
