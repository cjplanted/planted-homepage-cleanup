#!/usr/bin/env node
/**
 * Fix Country Code Misclassifications
 *
 * Finds venues with incorrect country codes based on city name lookup.
 * Common issue: venues imported with country=FR when they're in DE/AT cities.
 *
 * Usage:
 *   node fix-country-codes.cjs                  # Dry run - show what would be fixed
 *   node fix-country-codes.cjs --execute        # Actually fix
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');

initializeApp({
  credential: cert(path.resolve(__dirname, '../../service-account.json'))
});
const db = getFirestore();

// City to country mapping for known misclassifications
const CITY_COUNTRY_MAP = {
  // German cities
  'erfurt': 'DE',
  'stuttgart': 'DE',
  'münchen': 'DE',
  'munich': 'DE',
  'leipzig': 'DE',
  'berlin': 'DE',
  'hamburg': 'DE',
  'köln': 'DE',
  'cologne': 'DE',
  'frankfurt': 'DE',
  'düsseldorf': 'DE',
  'dortmund': 'DE',
  'essen': 'DE',
  'bremen': 'DE',
  'hannover': 'DE',
  'nürnberg': 'DE',
  'dresden': 'DE',
  'mainz': 'DE',
  'wiesbaden': 'DE',
  'darmstadt': 'DE',

  // Austrian cities
  'wien': 'AT',
  'vienna': 'AT',
  'graz': 'AT',
  'linz': 'AT',
  'salzburg': 'AT',
  'innsbruck': 'AT',
  'klagenfurt': 'AT',
  'villach': 'AT',
  'wels': 'AT',
  'steyr': 'AT',

  // Swiss cities
  'zürich': 'CH',
  'zurich': 'CH',
  'genève': 'CH',
  'geneva': 'CH',
  'genf': 'CH',
  'basel': 'CH',
  'bern': 'CH',
  'lausanne': 'CH',
  'winterthur': 'CH',
  'luzern': 'CH',
  'lucerne': 'CH',
  'st. gallen': 'CH',
  'lugano': 'CH',

  // UK cities
  'london': 'UK',
  'manchester': 'UK',
  'birmingham': 'UK',
  'leeds': 'UK',
  'glasgow': 'UK',
  'liverpool': 'UK',
  'edinburgh': 'UK',

  // Italian cities
  'roma': 'IT',
  'rome': 'IT',
  'milano': 'IT',
  'milan': 'IT',
  'napoli': 'IT',
  'naples': 'IT',
  'torino': 'IT',
  'turin': 'IT',
};

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    execute: args.includes('--execute'),
    country: args.find(a => a.startsWith('--from='))?.split('=')[1],
  };
}

async function findMisclassifiedVenues(fromCountry) {
  console.log('Scanning for misclassified venues...\n');

  let query = db.collection('venues');
  if (fromCountry) {
    query = query.where('address.country', '==', fromCountry.toUpperCase());
  }

  const venuesSnap = await query.get();
  console.log(`Checking ${venuesSnap.size} venues...\n`);

  const misclassified = [];

  for (const doc of venuesSnap.docs) {
    const v = doc.data();
    const city = (v.address?.city || v.city || '').toLowerCase().trim();
    const currentCountry = (v.address?.country || v.country || '').toUpperCase();

    // Look up correct country by city
    const correctCountry = CITY_COUNTRY_MAP[city];

    if (correctCountry && correctCountry !== currentCountry) {
      misclassified.push({
        id: doc.id,
        name: v.name,
        city: v.address?.city || v.city,
        currentCountry,
        correctCountry,
      });
    }
  }

  return misclassified;
}

async function fixCountryCodes() {
  const { execute, country } = parseArgs();

  console.log(`\n${'='.repeat(60)}`);
  console.log(execute ? '🚀 EXECUTING COUNTRY CODE FIX' : '🔍 DRY RUN - No changes will be made');
  if (country) console.log(`   Filtering by current country: ${country}`);
  console.log(`${'='.repeat(60)}\n`);

  const misclassified = await findMisclassifiedVenues(country);

  if (misclassified.length === 0) {
    console.log('✓ No misclassified venues found!');
    return { fixed: 0, errors: 0 };
  }

  console.log(`Found ${misclassified.length} misclassified venues:\n`);

  let fixed = 0;
  let errors = 0;

  for (const venue of misclassified) {
    console.log(`📍 ${venue.name}`);
    console.log(`   City: ${venue.city}`);
    console.log(`   Current: ${venue.currentCountry} → Correct: ${venue.correctCountry}`);

    if (execute) {
      try {
        await db.collection('venues').doc(venue.id).update({
          'address.country': venue.correctCountry,
          'country': venue.correctCountry,
        });
        console.log(`   ✅ Fixed`);
        fixed++;
      } catch (e) {
        console.log(`   ❌ Error: ${e.message}`);
        errors++;
      }
    } else {
      console.log(`   📝 Would fix`);
      fixed++;
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Misclassified venues found: ${misclassified.length}`);
  console.log(`${execute ? 'Fixed' : 'Would fix'}: ${fixed}`);
  console.log(`Errors: ${errors}`);

  if (!execute && fixed > 0) {
    console.log(`\n💡 To actually fix, run:`);
    console.log(`   node fix-country-codes.cjs --execute`);
  }

  return { fixed, errors };
}

fixCountryCodes()
  .then(result => {
    console.log('\n✓ Done');
    process.exit(result.errors > 0 ? 1 : 0);
  })
  .catch(e => {
    console.error('\n❌ Fatal error:', e);
    process.exit(1);
  });
