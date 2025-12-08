/**
 * Import Script: Import discovered restaurant partners to Firestore
 *
 * This script imports restaurant partners discovered via WebSearch tool.
 * Partners are stored in packages/scrapers/data/discovered-partners.json
 *
 * Run with: npx tsx scripts/import-discovered-partners.ts [--dry-run]
 */

import { initializeApp, cert, ServiceAccount } from 'firebase-admin/app';
import { getFirestore, FieldValue, Firestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Check for dry-run flag
const isDryRun = process.argv.includes('--dry-run');

// City coordinates for venues
const cityCoordinates: Record<string, { lat: number; lng: number; country: string }> = {
  'Berlin': { lat: 52.5200, lng: 13.4050, country: 'DE' },
  'Munich': { lat: 48.1351, lng: 11.5820, country: 'DE' },
  'Frankfurt': { lat: 50.1109, lng: 8.6821, country: 'DE' },
  'Hamburg': { lat: 53.5511, lng: 9.9937, country: 'DE' },
  'Stuttgart': { lat: 48.7758, lng: 9.1829, country: 'DE' },
  'Bremen': { lat: 53.0793, lng: 8.8017, country: 'DE' },
  'Düsseldorf': { lat: 51.2277, lng: 6.7735, country: 'DE' },
  'Hannover': { lat: 52.3759, lng: 9.7320, country: 'DE' },
  'Nürnberg': { lat: 49.4521, lng: 11.0767, country: 'DE' },
  'Fürth': { lat: 49.4772, lng: 10.9883, country: 'DE' },
  'Erlangen': { lat: 49.5897, lng: 11.0120, country: 'DE' },
  'Vienna': { lat: 48.2082, lng: 16.3738, country: 'AT' },
  'Zurich': { lat: 47.3769, lng: 8.5417, country: 'CH' },
  'London': { lat: 51.5074, lng: -0.1278, country: 'UK' },
};

interface DiscoveredPartner {
  name: string;
  type: 'restaurant' | 'chain';
  country: string;
  cities?: string[];
  locationCount?: string | number;
  products: string[];
  menuItems?: string[];
  deliveryPlatforms?: string[];
  woltUrls?: string[];
  uberEatsUrls?: string[];
  addresses?: Record<string, string>;
  ratings?: Record<string, number>;
  website?: string;
  storeLocator?: string;
  notes?: string;
}

interface DiscoveredPartnersData {
  discoveredAt: string;
  source: string;
  totalPartners: number;
  partners: DiscoveredPartner[];
}

let db: Firestore;

// Initialize Firebase Admin
function initFirebase(): void {
  const serviceAccountPath = join(__dirname, '../service-account.json');
  let serviceAccount: ServiceAccount;

  try {
    serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
  } catch {
    console.error('Service account file not found at:', serviceAccountPath);
    console.log('\nTo create a service account:');
    console.log('1. Go to Firebase Console > Project Settings > Service Accounts');
    console.log('2. Click "Generate new private key"');
    console.log('3. Save the file as "service-account.json" in planted-availability-db/');
    process.exit(1);
  }

  initializeApp({
    credential: cert(serviceAccount),
  });

  db = getFirestore();
}

// Load discovered partners data
function loadDiscoveredPartners(): DiscoveredPartnersData {
  const dataPath = join(__dirname, '../packages/scrapers/data/discovered-partners.json');
  return JSON.parse(readFileSync(dataPath, 'utf8'));
}

// Create a chain document
async function createChain(partner: DiscoveredPartner): Promise<string> {
  const chainId = partner.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  // Determine markets from country field
  const markets = partner.country.split('/').map(c => c.trim());

  const chainData = {
    name: partner.name,
    type: partner.type === 'chain' ? 'restaurant' : 'restaurant',
    logo_url: null,
    website: partner.website || null,
    markets,
    partnership_level: 'standard',
    notes: partner.notes || null,
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  };

  if (isDryRun) {
    console.log(`  [DRY-RUN] Would create chain: ${partner.name} (${chainId})`);
    console.log(`    Markets: ${markets.join(', ')}`);
  } else {
    await db.collection('chains').doc(chainId).set(chainData, { merge: true });
    console.log(`  ✅ Chain: ${partner.name} (${chainId})`);
  }

  return chainId;
}

// Create venue documents for a partner
async function createVenues(partner: DiscoveredPartner, chainId?: string): Promise<number> {
  let venueCount = 0;
  const cities = partner.cities || [];

  // If no cities specified but we have addresses, use those
  if (cities.length === 0 && partner.addresses) {
    cities.push(...Object.keys(partner.addresses));
  }

  // If still no cities, create one venue based on country
  if (cities.length === 0) {
    // For chains without specific cities, we'll just log them
    console.log(`    ⚠️  No specific cities for ${partner.name}, skipping venue creation`);
    return 0;
  }

  for (const city of cities) {
    const coords = cityCoordinates[city];
    if (!coords) {
      console.log(`    ⚠️  Unknown city: ${city}, skipping`);
      continue;
    }

    // Build delivery partners array
    const deliveryPartners: Array<{ partner: string; url: string }> = [];

    // Add Wolt URLs
    if (partner.woltUrls) {
      for (const url of partner.woltUrls) {
        if (url.toLowerCase().includes(city.toLowerCase())) {
          deliveryPartners.push({ partner: 'wolt', url });
        }
      }
    }

    // Add Uber Eats URLs
    if (partner.uberEatsUrls) {
      for (const url of partner.uberEatsUrls) {
        if (url.toLowerCase().includes(city.toLowerCase())) {
          deliveryPartners.push({ partner: 'uber_eats', url });
        }
      }
    }

    // If no matching URLs, add generic platform references
    if (deliveryPartners.length === 0 && partner.deliveryPlatforms) {
      for (const platform of partner.deliveryPlatforms) {
        deliveryPartners.push({
          partner: platform.toLowerCase().replace(' ', '_'),
          url: partner.website || '',
        });
      }
    }

    // Get address if available
    const address = partner.addresses?.[city] || 'See website for address';

    // Get rating if available
    const rating = partner.ratings?.[city];

    const venueData = {
      type: 'restaurant',
      name: partner.name,
      chain_id: chainId || null,
      location: {
        latitude: coords.lat + (Math.random() - 0.5) * 0.005, // Small offset for uniqueness
        longitude: coords.lng + (Math.random() - 0.5) * 0.005,
      },
      address: {
        street: address,
        city: city,
        postal_code: '00000',
        country: coords.country,
      },
      opening_hours: {
        regular: {
          monday: [{ open: '11:00', close: '22:00' }],
          tuesday: [{ open: '11:00', close: '22:00' }],
          wednesday: [{ open: '11:00', close: '22:00' }],
          thursday: [{ open: '11:00', close: '22:00' }],
          friday: [{ open: '11:00', close: '23:00' }],
          saturday: [{ open: '11:00', close: '23:00' }],
          sunday: [{ open: '12:00', close: '21:00' }],
        },
      },
      contact: {
        website: partner.website || null,
      },
      planted_products: partner.products,
      rating: rating || null,
      delivery_partners: deliveryPartners.length > 0 ? deliveryPartners : null,
      source: {
        type: 'manual',
        scraper_id: 'websearch-discovery',
      },
      notes: partner.notes || null,
      last_verified: FieldValue.serverTimestamp(),
      status: 'active',
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    };

    if (isDryRun) {
      console.log(`    [DRY-RUN] Would create venue: ${partner.name} (${city})`);
      console.log(`      Products: ${partner.products.join(', ')}`);
      if (deliveryPartners.length > 0) {
        console.log(`      Delivery: ${deliveryPartners.map(d => d.partner).join(', ')}`);
      }
    } else {
      const venueRef = await db.collection('venues').add(venueData);
      console.log(`    ✅ Venue: ${partner.name} (${city}) - ${venueRef.id}`);

      // Create dishes if menu items are specified
      if (partner.menuItems && partner.menuItems.length > 0) {
        await createDishes(venueRef.id, partner);
      }
    }

    venueCount++;
  }

  return venueCount;
}

// Create dish documents for a venue
async function createDishes(venueId: string, partner: DiscoveredPartner): Promise<void> {
  if (!partner.menuItems) return;

  for (const menuItem of partner.menuItems) {
    const dishData = {
      venue_id: venueId,
      name: menuItem,
      description: `${menuItem} featuring ${partner.products.join(', ')}`,
      planted_products: partner.products,
      price: {
        amount: 0, // Unknown price
        currency: partner.country === 'CH' ? 'CHF' : partner.country === 'UK' ? 'GBP' : 'EUR',
      },
      dietary_tags: ['plant-based', 'vegan'],
      availability: {
        type: 'permanent',
      },
      source: {
        type: 'manual',
        scraper_id: 'websearch-discovery',
      },
      last_verified: FieldValue.serverTimestamp(),
      status: 'active',
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    };

    if (isDryRun) {
      console.log(`      [DRY-RUN] Would create dish: ${menuItem}`);
    } else {
      const dishRef = await db.collection('dishes').add(dishData);
      console.log(`      📋 Dish: ${menuItem} - ${dishRef.id}`);
    }
  }
}

async function main() {
  console.log('🚀 Importing discovered partners...');
  console.log('================================');

  if (isDryRun) {
    console.log('🔍 DRY-RUN MODE - No data will be written\n');
  }

  // Initialize Firebase
  if (!isDryRun) {
    initFirebase();
  }

  // Load discovered partners
  const data = loadDiscoveredPartners();
  console.log(`📦 Loaded ${data.partners.length} partners from ${data.source}\n`);

  let chainCount = 0;
  let venueCount = 0;

  // Process each partner
  for (const partner of data.partners) {
    console.log(`\n📍 Processing: ${partner.name} (${partner.type})`);

    let chainId: string | undefined;

    // Create chain for chain-type partners
    if (partner.type === 'chain') {
      chainId = await createChain(partner);
      chainCount++;
    }

    // Create venues
    const venues = await createVenues(partner, chainId);
    venueCount += venues;
  }

  console.log('\n================================');
  console.log('🎉 Import completed!');
  console.log('\nSummary:');
  console.log(`  - Chains: ${chainCount}`);
  console.log(`  - Venues: ${venueCount}`);

  if (isDryRun) {
    console.log('\n💡 Run without --dry-run to actually import the data');
  }
}

main().catch(console.error);
