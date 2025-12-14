#!/usr/bin/env node
/**
 * Find Duplicate Venues Dynamically
 * Scans all venues and groups by normalized name+city to find duplicates
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');

initializeApp({
  credential: cert(path.resolve(__dirname, '../../service-account.json'))
});
const db = getFirestore();

function normalizeKey(name, city) {
  // Normalize: lowercase, remove special chars, trim
  const normName = (name || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
  const normCity = (city || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
  return `${normName}:${normCity}`;
}

async function findDuplicates() {
  console.log('Scanning for duplicate venues...\n');

  // Get all venues
  const venuesSnap = await db.collection('venues').get();
  console.log(`Total venues: ${venuesSnap.size}\n`);

  // Group by normalized name+city
  const groups = {};

  for (const doc of venuesSnap.docs) {
    const v = doc.data();
    const city = v.address?.city || v.city || '';
    const key = normalizeKey(v.name, city);

    if (!groups[key]) groups[key] = [];

    // Get dish count
    const dishSnap = await db.collection('dishes')
      .where('venue_id', '==', doc.id)
      .count()
      .get();

    groups[key].push({
      id: doc.id,
      name: v.name,
      city: city,
      country: v.country,
      dishes: dishSnap.data().count,
    });
  }

  // Find groups with duplicates
  const duplicates = Object.entries(groups)
    .filter(([key, venues]) => venues.length > 1)
    .sort((a, b) => b[1].length - a[1].length);

  if (duplicates.length === 0) {
    console.log('✓ No duplicates found!');
    return;
  }

  console.log(`Found ${duplicates.length} groups with duplicates:\n`);

  let totalDuplicates = 0;
  const safeToDelete = [];

  for (const [key, venues] of duplicates) {
    console.log(`\n📍 ${venues[0].name} - ${venues[0].city}`);

    // Sort by dishes (keep the one with most dishes)
    venues.sort((a, b) => b.dishes - a.dishes);

    const primary = venues[0];
    const duplicatesForThis = venues.slice(1);

    console.log(`   Keep: ${primary.id} (${primary.dishes} dishes) ${primary.country}`);

    for (const dup of duplicatesForThis) {
      totalDuplicates++;
      console.log(`   Delete: ${dup.id} (${dup.dishes} dishes) ${dup.country}`);

      // Only safe to delete if 0 dishes
      if (dup.dishes === 0) {
        safeToDelete.push({
          delete: dup.id,
          primary: primary.id,
          reason: `${dup.name} - ${dup.city} duplicate (0 vs ${primary.dishes} dishes)`,
        });
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Duplicate groups: ${duplicates.length}`);
  console.log(`Total duplicates: ${totalDuplicates}`);
  console.log(`Safe to delete (0 dishes): ${safeToDelete.length}`);

  if (safeToDelete.length > 0) {
    console.log('\n\nSafe to delete (add to fix-duplicates.cjs):');
    console.log('```javascript');
    for (const d of safeToDelete) {
      console.log(`  { delete: '${d.delete}', primary: '${d.primary}', reason: '${d.reason}' },`);
    }
    console.log('```');
  }
}

findDuplicates().catch(console.error);
