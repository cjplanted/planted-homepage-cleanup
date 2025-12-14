#!/usr/bin/env node
/**
 * Fix Venue Coordinates
 *
 * Discovery venues often have 0,0 coordinates but valid addresses.
 * Salesforce venues have valid coordinates but no dishes.
 *
 * Strategy:
 * 1. Find discovery venues with dishes but invalid coordinates (0,0)
 * 2. Find matching Salesforce venue by name + city
 * 3. Copy coordinates from Salesforce venue to discovery venue
 *
 * Usage:
 *   node fix-venue-coordinates.cjs                    # Dry run
 *   node fix-venue-coordinates.cjs --execute          # Actually fix
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, GeoPoint } = require('firebase-admin/firestore');
const path = require('path');

initializeApp({
  credential: cert(path.resolve(__dirname, '../../service-account.json'))
});
const db = getFirestore();

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    execute: args.includes('--execute'),
  };
}

function normalizeForMatch(str) {
  return (str || '').toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function hasValidLocation(venue) {
  const loc = venue.location;
  return loc && loc.latitude && loc.longitude &&
    (Math.abs(loc.latitude) > 1 || Math.abs(loc.longitude) > 1);
}

async function fixCoordinates() {
  const { execute } = parseArgs();

  console.log(`\n${'='.repeat(60)}`);
  console.log(execute ? 'EXECUTING COORDINATE FIX' : 'DRY RUN - No changes will be made');
  console.log(`${'='.repeat(60)}\n`);

  // Load all venues
  const venuesSnap = await db.collection('venues').get();
  console.log(`Loaded ${venuesSnap.size} venues\n`);

  // Separate into discovery (random ID) and Salesforce (planted- prefix)
  const discoveryVenues = [];
  const salesforceVenues = [];

  for (const doc of venuesSnap.docs) {
    const v = doc.data();
    v.id = doc.id;

    if (doc.id.startsWith('planted-')) {
      if (hasValidLocation(v)) {
        salesforceVenues.push(v);
      }
    } else {
      discoveryVenues.push(v);
    }
  }

  console.log(`Salesforce venues with valid coords: ${salesforceVenues.length}`);
  console.log(`Discovery venues: ${discoveryVenues.length}\n`);

  // Build lookup index by normalized name+city
  const sfIndex = {};
  for (const v of salesforceVenues) {
    const key = normalizeForMatch(v.name) + ':' + normalizeForMatch(v.address?.city || v.city);
    if (!sfIndex[key]) sfIndex[key] = [];
    sfIndex[key].push(v);
  }

  // Find discovery venues needing coordinate fix
  let fixed = 0;
  let notFound = 0;
  let errors = 0;

  for (const discVenue of discoveryVenues) {
    if (hasValidLocation(discVenue)) continue; // Already has valid coords

    // Check if has dishes
    const dishSnap = await db.collection('dishes')
      .where('venue_id', '==', discVenue.id)
      .count()
      .get();

    if (dishSnap.data().count === 0) continue; // Skip venues without dishes

    // Try to find matching Salesforce venue
    const key = normalizeForMatch(discVenue.name) + ':' + normalizeForMatch(discVenue.address?.city || discVenue.city);
    const matches = sfIndex[key];

    if (!matches || matches.length === 0) {
      console.log(`No match: ${discVenue.name} (${discVenue.address?.city || discVenue.city})`);
      notFound++;
      continue;
    }

    const sfVenue = matches[0]; // Use first match
    const lat = sfVenue.location.latitude;
    const lng = sfVenue.location.longitude;

    console.log(`Match: ${discVenue.name} (${discVenue.address?.city || discVenue.city})`);
    console.log(`  Copy coords from ${sfVenue.id}: ${lat}, ${lng}`);

    if (execute) {
      try {
        await db.collection('venues').doc(discVenue.id).update({
          location: new GeoPoint(lat, lng)
        });
        console.log(`  Fixed!`);
        fixed++;
      } catch (e) {
        console.log(`  Error: ${e.message}`);
        errors++;
      }
    } else {
      console.log(`  Would fix`);
      fixed++;
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`${execute ? 'Fixed' : 'Would fix'}: ${fixed}`);
  console.log(`No matching SF venue: ${notFound}`);
  console.log(`Errors: ${errors}`);

  if (!execute && fixed > 0) {
    console.log(`\nTo actually fix, run:`);
    console.log(`   node fix-venue-coordinates.cjs --execute`);
  }

  return { fixed, notFound, errors };
}

fixCoordinates()
  .then(result => {
    console.log('\nDone');
    process.exit(result.errors > 0 ? 1 : 0);
  })
  .catch(e => {
    console.error('\nFatal error:', e);
    process.exit(1);
  });
