/**
 * Import December 17 Discovered Venues to Firestore
 *
 * Imports high-confidence venues from discovered-venues-2024-12-17.json
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

// Map chain names to chain_id patterns
const CHAIN_NAME_PATTERNS = {
  'peter pane': 'peter_pane',
  'fat monk': 'fat_monk',
  'veganitas': 'veganitas',
  'swing kitchen': 'swing_kitchen',
  'beets&roots': 'beets_roots',
  'beets & roots': 'beets_roots',
  'dean&david': 'dean_david',
  'dean & david': 'dean_david',
  'birdie birdie': 'birdie_birdie',
};

async function importVenues() {
  // Load December 17 venues
  const dataPath = path.join(__dirname, 'discovered-venues-2024-12-17.json');
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const venues = data.high_confidence_venues;

  console.log(`\n=== Importing ${venues.length} December 17 Discovered Venues ===\n`);

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

      // First check explicit chain_name from discovery
      if (venue.chain_name) {
        const chainKey = venue.chain_name.toLowerCase();
        chain_id = existingChains[chainKey] || null;
      }

      // Fallback to pattern matching
      if (!chain_id) {
        for (const [chainName, chainId] of Object.entries(existingChains)) {
          if (nameLower.includes(chainName)) {
            chain_id = chainId;
            break;
          }
        }
      }

      // Determine venue type
      let venueType = venue.type || 'restaurant';
      if (venueType === 'fine_dining') venueType = 'restaurant';
      if (venueType === 'fast_food') venueType = 'restaurant';

      // Build venue document
      const venueDoc = {
        name: venue.name,
        type: venueType,
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
          partner_id: 'venue-discovery-agent-dec17',
          confidence: venue.confidence || 'high',
          discovery_source: venue.source || 'web-search',
        },
        planted_products: venue.planted_products || [],
        created_at: new Date(),
        updated_at: new Date(),
        last_verified: new Date(),
      };

      // Add special attributes
      if (venue.michelin_stars) {
        venueDoc.michelin_stars = venue.michelin_stars;
      }
      if (venue.website) {
        venueDoc.website = venue.website;
      }
      if (venue.notes) {
        venueDoc.discovery_notes = venue.notes;
      }

      if (chain_id) {
        venueDoc.chain_id = chain_id;
      }

      // Add to Firestore
      const docRef = await db.collection('venues').add(venueDoc);
      console.log(`ADD: ${venue.name} (${venue.city}) -> ${docRef.id}${chain_id ? ` [chain: ${chain_id}]` : ''}${venue.michelin_stars ? ` [${venue.michelin_stars}*]` : ''}`);
      imported++;

      // Also add menu items as dishes if provided
      if (venue.menu_items && venue.menu_items.length > 0) {
        for (const item of venue.menu_items) {
          const dishDoc = {
            venue_id: docRef.id,
            name: item.name,
            description: item.description || '',
            price: {
              amount: parseFloat(item.price) || 0,
              currency: item.currency || (venue.country === 'CH' ? 'CHF' : 'EUR'),
            },
            planted_products: venue.planted_products || [],
            status: 'active',
            source: 'venue-discovery-agent-dec17',
            created_at: new Date(),
            updated_at: new Date(),
          };

          await db.collection('dishes').add(dishDoc);
          console.log(`  + Dish: ${item.name}`);
        }
      }

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
