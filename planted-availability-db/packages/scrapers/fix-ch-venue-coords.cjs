#!/usr/bin/env node
/**
 * Fix CH Venue Coordinates
 * Finds CH venues with dishes but 0,0 coordinates and fixes them
 *
 * Usage:
 *   node fix-ch-venue-coords.cjs          # Dry run - show what would be fixed
 *   node fix-ch-venue-coords.cjs --execute  # Actually fix the coordinates
 */

const admin = require('firebase-admin');
const path = require('path');
const https = require('https');
const http = require('http');

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '..', '..', 'service-account.json');
const serviceAccount = require(serviceAccountPath);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
const EXECUTE = process.argv.includes('--execute');

// Hardcoded coordinates for known venues (Swiss addresses)
// Using venue name + city for more accurate matching
const KNOWN_COORDS_BY_ID = {
  // Zürich venues
  '0W64AG4CXsUcDI9YKz4O': { lat: 47.3781, lng: 8.5386 }, // kaisin. (Zürich)
  '3OnKGnneXCY9MIRL2lxx': { lat: 47.3673, lng: 8.5476 }, // KAIMUG Zürich
  '5aUig8ozMgCgChFBIFbV': { lat: 47.3764, lng: 8.5374 }, // Rice Up! (Zürich) - Löwenplatz
  '6wyarWdx4KHu9xGjybXB': { lat: 47.3724, lng: 8.5382 }, // Hiltl - Vegetarian Restaurant
  'eirQAcKOT0E1A4M1Ejz0': { lat: 47.3773, lng: 8.5393 }, // dean&david (Zürich)
  'MqSc1ctTUyFzrdSMuwuE': { lat: 47.3695, lng: 8.5399 }, // Nama Take Me Out Zürich
  'YtmsLvfvfDcwdjexAui7': { lat: 47.3857, lng: 8.5318 }, // Zekis World (Zürich)
  'iznOCLXZXBm5Lum0CULb': { lat: 47.3857, lng: 8.5318 }, // Zekisworld (Zurich)
  'y1NOXXuX8je24ogWgAUL': { lat: 47.3776, lng: 8.5240 }, // mit&ohne kebab - Lochergut Zürich
  'LTOvmC5gly8Zg97GvzOP': { lat: 47.3773, lng: 8.5393 }, // MADOS Restaurant & Take Away

  // Basel venues
  '4NV11MD90ZfzRPdkDjsl': { lat: 47.5470, lng: 7.5892 }, // Brezelkönig Basel
  '7iGtwFeQA1XqolVwbLVa': { lat: 47.5528, lng: 7.5891 }, // TukTuk Thai Kitchen Basel
  'EBHEAxvXczf2fC4TWJJo': { lat: 47.5528, lng: 7.5891 }, // TukTuk Thai Kitchen Basel
  'UB8Me6UXB1aVdlchlMPW': { lat: 47.5528, lng: 7.5891 }, // TukTuk Thai Kitchen Basel
  'bBgFnXWtFDCrVtCnYZYg': { lat: 47.5528, lng: 7.5891 }, // TukTuk Thai Kitchen Basel
  'TzydqRq5WqmMAHca33ff': { lat: 47.5540, lng: 7.5890 }, // CHOI Asian Garden Basel
  'xKLPGvoIBZjfxmacIhoo': { lat: 47.5540, lng: 7.5890 }, // CHOI Asian Garden Basel
  'cbjKUSpNDUWWgS1l3nNT': { lat: 47.5528, lng: 7.5891 }, // BURGERMEISTER (Basel)
  'nvNIawnFkxCU9Jjhh9Kz': { lat: 47.5470, lng: 7.5892 }, // dean&david Basel Centralbahnplatz
  'zGvwLrb4rB1LQs6afXly': { lat: 47.5576, lng: 7.5880 }, // dean&david (Basel)
  'z4TpY523mGyVdjruVBLU': { lat: 47.5586, lng: 7.5872 }, // Nooch Asian Kitchen (Basel)

  // Bern venues
  'VDJQ2MGFCvY6CI6aJfFA': { lat: 46.9480, lng: 7.4474 }, // Subway (Bern)
  'fEAa5UxvHvKBNT0SUA83': { lat: 46.9487, lng: 7.4402 }, // Rice Up! (Bern)

  // Biel venues
  '3KbdGJQxbiBvlNAo4gPo': { lat: 47.1330, lng: 7.2426 }, // Bari Pizzeria Restaurant Biel

  // Luzern venues
  'PxiozTieDsxuvxuBm0ii': { lat: 47.0503, lng: 8.3093 }, // BaBa Luzern
};

// Fallback coordinates by venue name pattern (only if ID not found)
const KNOWN_COORDS = {
  'Hiltl': { lat: 47.3724, lng: 8.5382, city: 'Zürich' },
  'kaisin.': { lat: 47.3781, lng: 8.5386, city: 'Zürich' },
  'KAIMUG': { lat: 47.3673, lng: 8.5476, city: 'Zürich' },
  'TukTuk': { lat: 47.5528, lng: 7.5891, city: 'Basel' },
  'CHOI': { lat: 47.5540, lng: 7.5890, city: 'Basel' },
  'BaBa': { lat: 47.0503, lng: 8.3093, city: 'Luzern' },
  'Bari': { lat: 47.1330, lng: 7.2426, city: 'Biel' },
};

// Nominatim geocoder
async function geocodeAddress(name, city, country = 'Switzerland') {
  // Try to match known venues first
  for (const [knownName, coords] of Object.entries(KNOWN_COORDS)) {
    if (name.includes(knownName) || knownName.includes(name.split(' ')[0])) {
      console.log(`    [KNOWN] Matched "${name}" to known coords`);
      return coords;
    }
  }

  // Fallback to Nominatim
  const query = encodeURIComponent(`${name}, ${city}, ${country}`);
  const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;

  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'PlantedVenueLocator/1.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const results = JSON.parse(data);
          if (results.length > 0) {
            resolve({
              lat: parseFloat(results[0].lat),
              lng: parseFloat(results[0].lon),
              city: city
            });
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

// Extract coords from Uber Eats URL page
async function extractCoordsFromUberEats(url) {
  return new Promise((resolve) => {
    const urlObj = new URL(url);
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        // Look for coordinates in the page
        const latMatch = data.match(/"latitude":\s*([\d.-]+)/);
        const lngMatch = data.match(/"longitude":\s*([\d.-]+)/);
        if (latMatch && lngMatch) {
          resolve({
            lat: parseFloat(latMatch[1]),
            lng: parseFloat(lngMatch[1])
          });
        } else {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

async function fixChVenueCoords() {
  console.log('\n=== FIX CH VENUE COORDINATES ===\n');
  console.log(`Mode: ${EXECUTE ? '🔥 EXECUTE' : '🔍 DRY RUN'}\n`);

  // Get all CH venues
  const venuesSnap = await db.collection('venues')
    .where('address.country', '==', 'CH')
    .get();

  const venues = venuesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // Get all dishes to find venues with dishes
  const dishesSnap = await db.collection('dishes').get();
  const allDishes = dishesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const venueIds = new Set(venues.map(v => v.id));
  const chDishes = allDishes.filter(d => venueIds.has(d.venue_id));
  const venuesWithDishIds = new Set(chDishes.map(d => d.venue_id));

  // Find venues with dishes but 0,0 coordinates
  const needsFix = venues.filter(v => {
    const hasDishes = venuesWithDishIds.has(v.id);
    const lat = v.location?.latitude || v.location?._latitude || 0;
    const lng = v.location?.longitude || v.location?._longitude || 0;
    return hasDishes && (lat === 0 || lng === 0);
  });

  console.log(`Found ${needsFix.length} CH venues with dishes but 0,0 coordinates:\n`);

  let fixed = 0;
  let failed = 0;

  for (const venue of needsFix) {
    const dishCount = chDishes.filter(d => d.venue_id === venue.id).length;
    console.log(`\n[${venue.id}] ${venue.name} (${venue.address?.city || 'Unknown'}) - ${dishCount} dishes`);

    // Try to get coordinates
    let coords = null;

    // Method 1: Try known coordinates by venue ID (most accurate)
    if (KNOWN_COORDS_BY_ID[venue.id]) {
      coords = KNOWN_COORDS_BY_ID[venue.id];
      console.log(`  → Found by ID: [${coords.lat}, ${coords.lng}]`);
    }

    // Method 2: Try known coordinates by name pattern
    if (!coords) {
      for (const [knownName, knownCoords] of Object.entries(KNOWN_COORDS)) {
        if (venue.name?.includes(knownName) || venue.name?.startsWith(knownName.split(' ')[0])) {
          coords = knownCoords;
          console.log(`  → Found by name pattern "${knownName}": [${coords.lat}, ${coords.lng}]`);
          break;
        }
      }
    }

    // Method 2: Try delivery platform URL
    if (!coords && venue.delivery_platforms?.length > 0) {
      const uberUrl = venue.delivery_platforms.find(p => p.url?.includes('ubereats'));
      if (uberUrl) {
        console.log(`  → Trying Uber Eats URL...`);
        coords = await extractCoordsFromUberEats(uberUrl.url);
        if (coords) {
          console.log(`  → Extracted from Uber Eats: [${coords.lat}, ${coords.lng}]`);
        }
      }
    }

    // Method 3: Try Nominatim geocoding
    if (!coords) {
      console.log(`  → Trying Nominatim geocoding...`);
      coords = await geocodeAddress(venue.name, venue.address?.city || 'Zürich');
      if (coords) {
        console.log(`  → Geocoded: [${coords.lat}, ${coords.lng}]`);
      }
      // Rate limit Nominatim
      await new Promise(r => setTimeout(r, 1100));
    }

    if (coords) {
      if (EXECUTE) {
        await db.collection('venues').doc(venue.id).update({
          'location': new admin.firestore.GeoPoint(coords.lat, coords.lng)
        });
        console.log(`  ✓ FIXED!`);
      } else {
        console.log(`  [DRY RUN] Would fix to [${coords.lat}, ${coords.lng}]`);
      }
      fixed++;
    } else {
      console.log(`  ✗ Could not find coordinates`);
      failed++;
    }
  }

  console.log('\n\n=== SUMMARY ===');
  console.log(`Total venues needing fix: ${needsFix.length}`);
  console.log(`Successfully ${EXECUTE ? 'fixed' : 'would fix'}: ${fixed}`);
  console.log(`Failed to geocode: ${failed}`);

  if (!EXECUTE && fixed > 0) {
    console.log('\n💡 Run with --execute to apply fixes');
  }
}

fixChVenueCoords()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
