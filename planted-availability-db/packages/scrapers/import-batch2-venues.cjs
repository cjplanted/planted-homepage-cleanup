/**
 * Import Batch 2 Discovered Venues to Firestore
 *
 * Imports high-confidence venues from discovered-venues-2024-12-16-batch2.json
 * - Checks for existing venues by name+city to avoid duplicates
 * - Links to existing chains where applicable
 * - Sets up delivery platform URLs for dish extraction
 */

const admin = require('firebase-admin');
const { getFirestore, GeoPoint } = require('firebase-admin/firestore');
const path = require('path');
const fs = require('fs');

// Initialize Firebase
const serviceAccountPath = path.resolve(__dirname, '../../service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccountPath)
});
const db = getFirestore();

// Chain name to chain_id mapping (from existing database)
const CHAIN_MAPPINGS = {
  'stadtsalat': 'pWxhD5MK4TtE5jVKLqyP', // Stadtsalat chain
  'beets&roots': 'PLQR8WlX4EOtXWr4D19Y', // Beets & Roots chain
  'birdie birdie': 'BirdieBirdieChainId', // Need to look up or create
  'dean&david': '5EdXTj5AhoUcWigjonQT', // dean&david chain
  'katzentempel': null, // Single venue, no chain
  'kronenhalle': null,
  'lindenhofkeller': null,
};

async function getExistingChains() {
  const chains = {};
  const chainsSnap = await db.collection('chains').get();
  chainsSnap.forEach(doc => {
    const data = doc.data();
    chains[data.name?.toLowerCase()] = doc.id;
  });
  return chains;
}

async function venueExists(name, city) {
  const snapshot = await db.collection('venues')
    .where('name', '==', name)
    .get();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.address?.city === city) {
      return { exists: true, id: doc.id };
    }
  }
  return { exists: false };
}

async function importVenues() {
  // Load batch 2 venues
  const batch2Path = path.join(__dirname, 'discovered-venues-2024-12-16-batch2.json');
  const batch2Data = JSON.parse(fs.readFileSync(batch2Path, 'utf8'));
  const venues = batch2Data.high_confidence_venues;

  console.log(`\n=== Importing ${venues.length} Batch 2 Venues ===\n`);

  // Get existing chains
  const existingChains = await getExistingChains();
  console.log('Found existing chains:', Object.keys(existingChains).length);

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const venue of venues) {
    try {
      // Check if venue already exists
      const existing = await venueExists(venue.name, venue.city);
      if (existing.exists) {
        console.log(`SKIP: ${venue.name} (${venue.city}) - already exists (${existing.id})`);
        skipped++;
        continue;
      }

      // Determine chain_id
      let chain_id = null;
      const nameLower = venue.name.toLowerCase();
      for (const [chainName, chainId] of Object.entries(existingChains)) {
        if (nameLower.includes(chainName)) {
          chain_id = chainId;
          break;
        }
      }

      // Build venue document
      const venueDoc = {
        name: venue.name,
        type: venue.type || 'restaurant',
        status: 'active',
        address: {
          street: venue.address?.street || '',
          city: venue.address?.city || venue.city,
          postal_code: venue.address?.postal_code || '',
          country: venue.address?.country || venue.country,
        },
        // Default location (0,0) - needs geocoding later
        location: new GeoPoint(0, 0),
        delivery_platforms: (venue.delivery_platforms || []).map(dp => ({
          platform: dp.platform,
          url: dp.url,
          active: true,
        })),
        opening_hours: {
          monday: { open: '11:00', close: '22:00' },
          tuesday: { open: '11:00', close: '22:00' },
          wednesday: { open: '11:00', close: '22:00' },
          thursday: { open: '11:00', close: '22:00' },
          friday: { open: '11:00', close: '22:00' },
          saturday: { open: '11:00', close: '22:00' },
          sunday: { open: '11:00', close: '22:00' },
        },
        source: {
          type: 'discovered',
          partner_id: 'venue-discovery-agent-batch2',
        },
        planted_products: venue.planted_products || [],
        created_at: new Date(),
        updated_at: new Date(),
        last_verified: new Date(),
      };

      if (chain_id) {
        venueDoc.chain_id = chain_id;
      }

      // Add to Firestore
      const docRef = await db.collection('venues').add(venueDoc);
      console.log(`ADD: ${venue.name} (${venue.city}) -> ${docRef.id}${chain_id ? ` [chain: ${chain_id}]` : ''}`);
      imported++;

    } catch (err) {
      console.error(`ERROR: ${venue.name} - ${err.message}`);
      errors++;
    }
  }

  console.log(`\n=== Import Summary ===`);
  console.log(`Imported: ${imported}`);
  console.log(`Skipped (existing): ${skipped}`);
  console.log(`Errors: ${errors}`);
  console.log(`Total processed: ${venues.length}`);
}

// Run import
importVenues()
  .then(() => {
    console.log('\nImport complete!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Import failed:', err);
    process.exit(1);
  });
