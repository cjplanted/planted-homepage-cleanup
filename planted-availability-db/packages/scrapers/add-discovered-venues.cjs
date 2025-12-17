/**
 * Add Discovered Venues to Database
 *
 * This script adds new venues discovered by the venue discovery agent.
 * Run with --dry-run to preview changes, or --execute to apply them.
 *
 * Usage:
 *   node add-discovered-venues.cjs --dry-run
 *   node add-discovered-venues.cjs --execute
 */

const admin = require('firebase-admin');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const path = require('path');

// Initialize Firebase
const serviceAccount = require(path.resolve(__dirname, '../../service-account.json'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'get-planted-db'
});
const db = getFirestore();

// New venues to add (only those NOT already in database)
const newVenues = [
  {
    name: 'Doen Doen Planted Kebap',
    type: 'restaurant',
    chain_id: null,
    address: {
      street: 'Boblingerstrasse 19',
      postal_code: '70178',
      city: 'Stuttgart',
      country: 'DE'
    },
    // Approximate coordinates for Boblingerstrasse 19, Stuttgart
    location: {
      latitude: 48.7664,
      longitude: 9.1679
    },
    opening_hours: {
      regular: {
        monday: [{ open: '11:00', close: '22:00' }],
        tuesday: [{ open: '11:00', close: '22:00' }],
        wednesday: [{ open: '11:00', close: '22:00' }],
        thursday: [{ open: '11:00', close: '22:00' }],
        friday: [{ open: '11:00', close: '23:00' }],
        saturday: [{ open: '11:00', close: '23:00' }],
        sunday: [{ open: '12:00', close: '21:00' }]
      }
    },
    contact: {
      website: null
    },
    planted_products: ['planted.kebab'],
    rating: null,
    delivery_partners: [],
    source: {
      type: 'discovery_agent',
      scraper_id: 'venue-discovery-web-search',
      discovery_date: '2024-12-16'
    },
    notes: 'Second Stuttgart location of Doen Doen Planted Kebap. Discovered via web search agent.',
    status: 'active'
  },
  {
    name: 'NENI am Prater',
    type: 'restaurant',
    chain_id: null,
    address: {
      street: 'Nordbahnstrasse 4',
      postal_code: '1020',
      city: 'Vienna',
      country: 'AT'
    },
    // Coordinates for Superbude Vienna Prater
    location: {
      latitude: 48.2237,
      longitude: 16.3938
    },
    opening_hours: {
      regular: {
        monday: [{ open: '07:00', close: '23:00' }],
        tuesday: [{ open: '07:00', close: '23:00' }],
        wednesday: [{ open: '07:00', close: '23:00' }],
        thursday: [{ open: '07:00', close: '23:00' }],
        friday: [{ open: '07:00', close: '23:00' }],
        saturday: [{ open: '07:00', close: '23:00' }],
        sunday: [{ open: '07:00', close: '23:00' }]
      }
    },
    contact: {
      website: 'https://www.superbude.com/en/hotel-wien/prater/neni-am-prater/'
    },
    planted_products: ['planted.chicken'],
    rating: null,
    delivery_partners: [],
    source: {
      type: 'discovery_agent',
      scraper_id: 'venue-discovery-web-search',
      discovery_date: '2024-12-16'
    },
    notes: 'NENI restaurant at Superbude Vienna Prater hotel. Serves Jerusalem Spiced PLANTED Chicken (EUR 16.50).',
    status: 'active'
  },
  {
    name: 'planted.bistro by Hiltl',
    type: 'restaurant',
    chain_id: null,
    address: {
      street: 'Kemptpark 32/34',
      postal_code: '8310',
      city: 'Kemptthal',
      country: 'CH'
    },
    // Coordinates for Kemptpark, Kemptthal (Planted HQ area)
    location: {
      latitude: 47.4617,
      longitude: 8.6964
    },
    opening_hours: {
      regular: {
        monday: [{ open: '11:30', close: '14:00' }],
        tuesday: [{ open: '11:30', close: '14:00' }],
        wednesday: [{ open: '11:30', close: '14:00' }],
        thursday: [{ open: '11:30', close: '14:00' }],
        friday: [{ open: '11:30', close: '14:00' }],
        saturday: [],
        sunday: []
      }
    },
    contact: {
      website: 'https://hiltl.ch'
    },
    planted_products: ['planted.chicken', 'planted.kebab', 'planted.pulled', 'planted.schnitzel'],
    rating: null,
    delivery_partners: [],
    source: {
      type: 'discovery_agent',
      scraper_id: 'venue-discovery-web-search',
      discovery_date: '2024-12-16'
    },
    notes: 'Bistro operated by Hiltl at Planted Foods AG headquarters. Extensive planted product menu.',
    status: 'active'
  }
];

async function addVenues(dryRun = true) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`VENUE IMPORT AGENT - ${dryRun ? 'DRY RUN' : 'EXECUTING'}`);
  console.log(`${'='.repeat(60)}\n`);

  const results = {
    added: [],
    errors: []
  };

  for (const venue of newVenues) {
    console.log(`\nProcessing: ${venue.name} (${venue.address.city})`);
    console.log(`  Address: ${venue.address.street}`);
    console.log(`  Country: ${venue.address.country}`);
    console.log(`  Products: ${venue.planted_products.join(', ')}`);

    if (dryRun) {
      console.log(`  [DRY RUN] Would add venue`);
      results.added.push({
        name: venue.name,
        city: venue.address.city,
        address: venue.address.street,
        id: '[dry-run]'
      });
    } else {
      try {
        const now = FieldValue.serverTimestamp();
        const venueData = {
          ...venue,
          created_at: now,
          updated_at: now,
          last_verified: now
        };

        const docRef = await db.collection('venues').add(venueData);
        console.log(`  [SUCCESS] Added with ID: ${docRef.id}`);
        results.added.push({
          name: venue.name,
          city: venue.address.city,
          address: venue.address.street,
          id: docRef.id
        });
      } catch (error) {
        console.log(`  [ERROR] ${error.message}`);
        results.errors.push({
          name: venue.name,
          error: error.message
        });
      }
    }
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('SUMMARY');
  console.log(`${'='.repeat(60)}`);
  console.log(`Total venues processed: ${newVenues.length}`);
  console.log(`Successfully added: ${results.added.length}`);
  console.log(`Errors: ${results.errors.length}`);

  if (results.added.length > 0) {
    console.log('\nAdded venues:');
    results.added.forEach((v, i) => {
      console.log(`  ${i + 1}. ${v.name} (${v.city}) - ID: ${v.id}`);
    });
  }

  if (results.errors.length > 0) {
    console.log('\nErrors:');
    results.errors.forEach((e, i) => {
      console.log(`  ${i + 1}. ${e.name}: ${e.error}`);
    });
  }

  if (dryRun) {
    console.log('\n[DRY RUN COMPLETE] Run with --execute to add venues.');
  }

  return results;
}

// Main execution
const args = process.argv.slice(2);
const dryRun = !args.includes('--execute');

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage: node add-discovered-venues.cjs [options]

Options:
  --dry-run    Preview changes without making them (default)
  --execute    Actually add venues to database
  --help, -h   Show this help message
`);
  process.exit(0);
}

addVenues(dryRun)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
