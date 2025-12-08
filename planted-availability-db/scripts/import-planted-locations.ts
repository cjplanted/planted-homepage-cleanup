#!/usr/bin/env node
/**
 * Import Planted Locations to Firestore
 *
 * This script imports all scraped location data from the Planted Salesforce API
 * into the Firestore database, creating venues and chains.
 *
 * Usage:
 *   npx tsx scripts/import-planted-locations.ts [--dry-run]
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  path.join(__dirname, '../service-account.json');

if (fs.existsSync(serviceAccountPath)) {
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'get-planted-db',
  });
} else {
  // Use default credentials (for Cloud Functions or local emulator)
  admin.initializeApp({
    projectId: 'get-planted-db',
  });
}

const db = admin.firestore();
const isDryRun = process.argv.includes('--dry-run');

// Brand mappings
const BRAND_MAPPINGS: Record<string, { chainId: string; chainName: string; type: 'retail' | 'restaurant' }> = {
  'brezelkoenig': { chainId: 'brezelkoenig', chainName: 'Brezelkönig', type: 'restaurant' },
  'billa': { chainId: 'billa', chainName: 'Billa', type: 'retail' },
  '2000px-coop': { chainId: 'coop', chainName: 'Coop', type: 'retail' },
  '2000px coop': { chainId: 'coop', chainName: 'Coop', type: 'retail' },
  'rewe': { chainId: 'rewe', chainName: 'REWE', type: 'retail' },
  'interspar-weiss': { chainId: 'interspar', chainName: 'Interspar', type: 'retail' },
  'interspar weiss': { chainId: 'interspar', chainName: 'Interspar', type: 'retail' },
};

// Country code mappings
const COUNTRY_CODES: Record<string, string> = {
  'Switzerland': 'CH',
  'Germany': 'DE',
  'Austria': 'AT',
  'United Kingdom': 'UK',
  'Italy': 'IT',
  'France': 'FR',
  'Netherlands': 'NL',
  'Spain': 'ES',
};

interface ScrapedLocation {
  Id: string;
  Name: string;
  Street__c: string;
  City__c: string;
  Postal_Code__c?: string;
  Country__c: string;
  lat__c: number;
  lng__c: number;
  Type__c: 'Restaurant' | 'Store';
  Thumbnail__c?: string;
  Is_Promoted__c?: boolean;
  Steak_Available__c?: boolean;
}

interface VenueData {
  type: 'retail' | 'restaurant' | 'delivery_kitchen';
  name: string;
  chain_id?: string;
  location: admin.firestore.GeoPoint;
  address: {
    street: string;
    city: string;
    postal_code: string;
    country: string;
  };
  opening_hours: {
    regular: Record<string, never>;
  };
  contact?: {
    website?: string;
  };
  source: {
    type: 'scraped';
    url: string;
    scraper_id: string;
  };
  last_verified: admin.firestore.Timestamp;
  status: 'active';
  created_at: admin.firestore.Timestamp;
  updated_at: admin.firestore.Timestamp;
  // Custom fields for Planted data
  salesforce_id: string;
  logo_url?: string;
  is_promoted?: boolean;
  steak_available?: boolean;
}

function extractBrand(thumbnailUrl?: string): string | null {
  if (!thumbnailUrl) return null;
  const filename = thumbnailUrl.split('/').pop() || '';
  return filename
    .replace('.png', '')
    .replace('.jpg', '')
    .replace('.svg', '')
    .split('?')[0]
    .toLowerCase()
    .replace(/[_-]/g, ' ')
    .trim();
}

function getBrandMapping(brand: string | null): { chainId: string; chainName: string; type: 'retail' | 'restaurant' } | null {
  if (!brand) return null;

  // Direct match
  if (BRAND_MAPPINGS[brand]) {
    return BRAND_MAPPINGS[brand];
  }

  // Partial match
  for (const [key, value] of Object.entries(BRAND_MAPPINGS)) {
    if (brand.includes(key) || key.includes(brand)) {
      return value;
    }
  }

  return null;
}

function transformLocation(loc: ScrapedLocation): Record<string, unknown> {
  const now = admin.firestore.Timestamp.now();
  const brand = extractBrand(loc.Thumbnail__c);
  const brandMapping = getBrandMapping(brand);
  const countryCode = COUNTRY_CODES[loc.Country__c] || loc.Country__c;

  // Determine type based on Salesforce Type__c or brand mapping
  let venueType: 'retail' | 'restaurant' | 'delivery_kitchen' = 'retail';
  if (loc.Type__c === 'Restaurant') {
    venueType = 'restaurant';
  } else if (brandMapping) {
    venueType = brandMapping.type;
  }

  const venue: Record<string, unknown> = {
    type: venueType,
    name: loc.Name,
    location: new admin.firestore.GeoPoint(loc.lat__c, loc.lng__c),
    address: {
      street: loc.Street__c || '',
      city: loc.City__c || '',
      postal_code: loc.Postal_Code__c || '',
      country: countryCode,
    },
    opening_hours: {
      regular: {},
    },
    source: {
      type: 'scraped',
      url: 'https://locations.eatplanted.com/',
      scraper_id: 'planted-salesforce-api',
    },
    last_verified: now,
    status: 'active',
    created_at: now,
    updated_at: now,
    salesforce_id: loc.Id,
    is_promoted: loc.Is_Promoted__c || false,
    steak_available: loc.Steak_Available__c || false,
  };

  // Only add optional fields if they have values
  if (brandMapping?.chainId) {
    venue.chain_id = brandMapping.chainId;
  }
  if (loc.Thumbnail__c) {
    venue.logo_url = loc.Thumbnail__c;
  }

  return venue;
}

async function createChains(): Promise<void> {
  console.log('\n📦 Creating chains...');

  const chains = [
    {
      id: 'brezelkoenig',
      name: 'Brezelkönig',
      type: 'restaurant',
      logo_url: 'https://plantedstatic.blob.core.windows.net/logos/brezelkoenig.png',
      countries: ['CH'],
      website: 'https://www.brezelkoenig.ch',
    },
    {
      id: 'barburrito',
      name: 'Barburrito',
      type: 'restaurant',
      logo_url: null,
      countries: ['UK'],
      website: 'https://www.barburrito.co.uk',
    },
    {
      id: 'billa',
      name: 'Billa',
      type: 'retail',
      logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Billa_Logo.svg/1200px-Billa_Logo.svg.png',
      countries: ['AT'],
      website: 'https://www.billa.at',
    },
    {
      id: 'coop',
      name: 'Coop',
      type: 'retail',
      logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/Coop.svg/2000px-Coop.svg.png',
      countries: ['CH'],
      website: 'https://www.coop.ch',
    },
    {
      id: 'rewe',
      name: 'REWE',
      type: 'retail',
      logo_url: 'https://upload.wikimedia.org/wikipedia/commons/4/4a/Rewe_Logo.svg',
      countries: ['DE'],
      website: 'https://www.rewe.de',
    },
    {
      id: 'interspar',
      name: 'Interspar',
      type: 'retail',
      logo_url: null,
      countries: ['AT'],
      website: 'https://www.interspar.at',
    },
  ];

  if (isDryRun) {
    console.log(`   [DRY RUN] Would create ${chains.length} chains`);
    chains.forEach(c => console.log(`     - ${c.name} (${c.id})`));
    return;
  }

  const batch = db.batch();
  const now = admin.firestore.Timestamp.now();

  for (const chain of chains) {
    const ref = db.collection('chains').doc(chain.id);
    batch.set(ref, {
      ...chain,
      created_at: now,
      updated_at: now,
    }, { merge: true });
  }

  await batch.commit();
  console.log(`   ✅ Created ${chains.length} chains`);
}

async function importVenues(): Promise<void> {
  console.log('\n📍 Importing venues...');

  // Read scraped data
  const dataPath = path.join(__dirname, '../data/planted-locations.json');
  if (!fs.existsSync(dataPath)) {
    console.error(`   ❌ Data file not found: ${dataPath}`);
    console.log('   Run the scrape-planted-locations script first.');
    process.exit(1);
  }

  const rawData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const locations: ScrapedLocation[] = rawData;

  console.log(`   Found ${locations.length} locations to import`);

  // Transform all locations
  const venues = locations.map(transformLocation);

  // Stats
  const stats = {
    total: venues.length,
    restaurants: venues.filter(v => v.type === 'restaurant').length,
    retail: venues.filter(v => v.type === 'retail').length,
    byCountry: {} as Record<string, number>,
    byChain: {} as Record<string, number>,
  };

  venues.forEach(v => {
    const country = v.address.country;
    stats.byCountry[country] = (stats.byCountry[country] || 0) + 1;
    if (v.chain_id) {
      stats.byChain[v.chain_id] = (stats.byChain[v.chain_id] || 0) + 1;
    }
  });

  console.log('\n   📊 Import Statistics:');
  console.log(`      Total: ${stats.total}`);
  console.log(`      Restaurants: ${stats.restaurants}`);
  console.log(`      Retail: ${stats.retail}`);
  console.log('\n      By Country:');
  Object.entries(stats.byCountry).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    console.log(`        ${k}: ${v}`);
  });
  console.log('\n      By Chain:');
  Object.entries(stats.byChain).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    console.log(`        ${k}: ${v}`);
  });

  if (isDryRun) {
    console.log(`\n   [DRY RUN] Would import ${venues.length} venues`);
    return;
  }

  // Batch write to Firestore (500 per batch - Firestore limit)
  const BATCH_SIZE = 500;
  let imported = 0;
  let errors = 0;

  for (let i = 0; i < venues.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = venues.slice(i, i + BATCH_SIZE);

    for (const venue of chunk) {
      // Use salesforce_id as document ID to prevent duplicates
      const docId = `planted-${venue.salesforce_id}`;
      const ref = db.collection('venues').doc(docId);
      batch.set(ref, venue, { merge: true });
    }

    try {
      await batch.commit();
      imported += chunk.length;
      process.stdout.write(`\r   Imported ${imported}/${venues.length} venues...`);
    } catch (error) {
      console.error(`\n   ❌ Error importing batch: ${error}`);
      errors += chunk.length;
    }
  }

  console.log(`\n   ✅ Import complete: ${imported} venues imported, ${errors} errors`);
}

async function verifyImport(): Promise<void> {
  if (isDryRun) return;

  console.log('\n🔍 Verifying import...');

  const venuesSnapshot = await db.collection('venues').count().get();
  const chainsSnapshot = await db.collection('chains').count().get();

  console.log(`   Venues in database: ${venuesSnapshot.data().count}`);
  console.log(`   Chains in database: ${chainsSnapshot.data().count}`);

  // Sample query
  const sampleVenues = await db.collection('venues')
    .where('type', '==', 'restaurant')
    .limit(3)
    .get();

  console.log('\n   Sample restaurants:');
  sampleVenues.docs.forEach(doc => {
    const data = doc.data();
    console.log(`     - ${data.name} (${data.address.city}, ${data.address.country})`);
  });
}

async function main(): Promise<void> {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║      🌱 PLANTED LOCATIONS IMPORT                           ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  Mode: ${isDryRun ? 'DRY RUN (no changes)' : 'LIVE (writing to Firestore)'}`.padEnd(61) + '║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  try {
    await createChains();
    await importVenues();
    await verifyImport();

    console.log('\n✅ Import complete!');
    console.log('\nNext steps:');
    console.log('  1. Check admin dashboard: https://get-planted-db.web.app');
    console.log('  2. Test API: curl https://europe-west6-get-planted-db.cloudfunctions.net/api/v1/venues');
    console.log('  3. Connect website to PAD API');
  } catch (error) {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

main();
