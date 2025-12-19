#!/usr/bin/env npx tsx

/**
 * Geocode Venues Migration Script
 *
 * This script geocodes venues in the discovered_venues collection that have
 * coordinates set to { latitude: 0, longitude: 0 }.
 *
 * It uses Nominatim (OpenStreetMap, free) or Google Geocoding API to convert
 * address data (city + postal_code + country) into real geographic coordinates.
 *
 * Usage:
 *   npx tsx src/cli/geocode-venues.ts [--dry-run] [--limit N] [--batch-size N] [--use-google]
 *
 * Options:
 *   --dry-run       Preview changes without writing to database
 *   --limit N       Process at most N venues (default: unlimited)
 *   --batch-size N  Process N venues at a time (default: 50)
 *   --use-google    Use Google Geocoding API (requires GOOGLE_MAPS_API_KEY)
 *
 * Environment Variables:
 *   GOOGLE_MAPS_API_KEY  Required only when using --use-google
 */

// Load environment variables
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../../../..'); // planted-availability-db/

// Load .env files
dotenv.config({ path: path.resolve(rootDir, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Fix relative GOOGLE_APPLICATION_CREDENTIALS path
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!path.isAbsolute(credPath)) {
    const resolvedPath = path.resolve(rootDir, credPath);
    if (fs.existsSync(resolvedPath)) {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = resolvedPath;
    }
  }
}

import { initializeFirestore, getFirestore } from '@pad/database';
import type { SupportedCountry } from '@pad/core';

initializeFirestore();
const db = getFirestore();

// Country code to name mapping for Nominatim
const COUNTRY_NAMES: Record<string, string> = {
  'CH': 'Switzerland',
  'DE': 'Germany',
  'AT': 'Austria',
  'UK': 'United Kingdom',
  'NL': 'Netherlands',
  'FR': 'France',
  'IT': 'Italy',
  'ES': 'Spain',
};

interface GeocodeResult {
  venueId: string;
  venueName: string;
  address: string;
  oldCoordinates: { latitude: number; longitude: number };
  newCoordinates?: { latitude: number; longitude: number };
  accuracy?: 'exact' | 'approximate' | 'city-center';
  status: 'updated' | 'skipped' | 'no_results' | 'error';
  error?: string;
}

/**
 * Format address for geocoding
 */
function formatAddressForGeocoding(
  city: string,
  postalCode?: string,
  country?: SupportedCountry
): string {
  const parts: string[] = [];

  if (city) parts.push(city);
  if (postalCode) parts.push(postalCode);
  if (country) parts.push(country);

  return parts.join(', ');
}

/**
 * Determine geocoding accuracy based on result type
 */
function determineAccuracy(types: string[]): 'exact' | 'approximate' | 'city-center' {
  if (types.includes('street_address') || types.includes('premise') || types.includes('route')) {
    return 'exact';
  }
  if (types.includes('locality') || types.includes('postal_code')) {
    return 'approximate';
  }
  return 'city-center';
}

/**
 * Delay helper
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Geocode using Nominatim (OpenStreetMap) - FREE, no API key needed
 * Rate limit: 1 request per second
 */
async function geocodeWithNominatim(
  city: string,
  postalCode?: string,
  country?: string
): Promise<{ lat: number; lng: number; accuracy: 'exact' | 'approximate' | 'city-center' } | null> {
  const countryName = country ? COUNTRY_NAMES[country] || country : '';
  const query = [city, postalCode, countryName].filter(Boolean).join(', ');

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'PlantedVenueGeocoder/1.0 (contact@planted.com)',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (!data || data.length === 0) {
      return null;
    }

    const result = data[0];
    const resultType = result.type || '';

    // Determine accuracy based on result type
    let accuracy: 'exact' | 'approximate' | 'city-center' = 'city-center';
    if (['house', 'building', 'street'].includes(resultType)) {
      accuracy = 'exact';
    } else if (['postcode', 'suburb', 'neighbourhood'].includes(resultType)) {
      accuracy = 'approximate';
    }

    return {
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
      accuracy,
    };
  } catch (error) {
    console.error('Nominatim error:', error);
    return null;
  }
}

/**
 * Geocode using Google Geocoding API
 */
async function geocodeWithGoogle(
  apiKey: string,
  city: string,
  postalCode?: string,
  country?: string
): Promise<{ lat: number; lng: number; accuracy: 'exact' | 'approximate' | 'city-center' } | null> {
  // Dynamically import Google Maps client only when needed
  const { Client } = await import('@googlemaps/google-maps-services-js');
  const client = new Client({});

  const address = [city, postalCode, country].filter(Boolean).join(', ');

  try {
    const response = await client.geocode({
      params: {
        address,
        key: apiKey,
      },
    });

    if (response.data.status !== 'OK' || !response.data.results.length) {
      return null;
    }

    const location = response.data.results[0].geometry.location;
    const types = response.data.results[0].types || [];

    return {
      lat: location.lat,
      lng: location.lng,
      accuracy: determineAccuracy(types),
    };
  } catch (error) {
    console.error('Google geocoding error:', error);
    return null;
  }
}

/**
 * Geocode a single venue
 */
async function geocodeVenue(
  venue: { id: string; name: string; address: any; coordinates: any },
  useGoogle: boolean,
  apiKey?: string
): Promise<GeocodeResult> {
  const result: GeocodeResult = {
    venueId: venue.id,
    venueName: venue.name || 'Unknown',
    address: formatAddressForGeocoding(
      venue.address?.city,
      venue.address?.postal_code,
      venue.address?.country
    ),
    oldCoordinates: {
      latitude: venue.coordinates?.latitude || 0,
      longitude: venue.coordinates?.longitude || 0,
    },
    status: 'skipped',
  };

  try {
    // Skip if coordinates are already set (valid, non-zero coordinates)
    const coords = venue.coordinates;
    if (coords && coords.latitude && coords.longitude &&
        (coords.latitude !== 0 || coords.longitude !== 0)) {
      result.status = 'skipped';
      return result;
    }

    // Skip if no address data
    if (!venue.address?.city) {
      result.status = 'skipped';
      result.error = 'No city in address';
      return result;
    }

    // Geocode using the selected provider
    let geocodeResult;
    if (useGoogle && apiKey) {
      geocodeResult = await geocodeWithGoogle(
        apiKey,
        venue.address.city,
        venue.address.postal_code,
        venue.address.country
      );
    } else {
      geocodeResult = await geocodeWithNominatim(
        venue.address.city,
        venue.address.postal_code,
        venue.address.country
      );
    }

    if (!geocodeResult) {
      result.status = 'no_results';
      result.error = 'No geocoding results found';
      return result;
    }

    result.newCoordinates = {
      latitude: geocodeResult.lat,
      longitude: geocodeResult.lng,
    };
    result.accuracy = geocodeResult.accuracy;
    result.status = 'updated';

    return result;
  } catch (error) {
    result.status = 'error';
    result.error = error instanceof Error ? error.message : String(error);
    return result;
  }
}

/**
 * Main geocoding function
 */
async function runGeocoding(
  dryRun: boolean,
  limit: number | null,
  batchSize: number,
  useGoogle: boolean
): Promise<void> {
  console.log('\n🌍 Venue Geocoding Migration Script');
  console.log('='.repeat(50));
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE (changes will be written)'}`);
  console.log(`Provider: ${useGoogle ? 'Google Geocoding API' : 'Nominatim (OpenStreetMap)'}`);
  console.log(`Limit: ${limit ? `${limit} venues` : 'unlimited'}`);
  console.log(`Batch size: ${batchSize} venues\n`);

  // Check for API key if using Google
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (useGoogle && !apiKey) {
    console.error('❌ Error: GOOGLE_MAPS_API_KEY environment variable is required when using --use-google');
    process.exit(1);
  }

  // Query ALL venues and filter for those needing geocoding
  // (Firestore can't query for null/undefined fields efficiently)
  console.log('Querying venues needing geocoding...');

  const allVenuesSnapshot = await db.collection('discovered_venues').get();

  // Filter venues that need geocoding (no coordinates or 0,0 coordinates)
  const venuesNeedingGeocoding = allVenuesSnapshot.docs.filter(doc => {
    const data = doc.data();
    const coords = data.coordinates;
    // Need geocoding if: no coords, or coords are 0,0
    if (!coords || coords.latitude === undefined || coords.longitude === undefined) {
      return true;
    }
    if (coords.latitude === 0 && coords.longitude === 0) {
      return true;
    }
    return false;
  });

  // Apply limit if specified
  const snapshot = {
    docs: limit ? venuesNeedingGeocoding.slice(0, limit) : venuesNeedingGeocoding
  };

  console.log(`Found ${snapshot.docs.length} venues to geocode (out of ${allVenuesSnapshot.size} total)\n`);

  if (snapshot.docs.length === 0) {
    console.log('No venues need geocoding.');
    return;
  }

  const results: GeocodeResult[] = [];
  let updatedCount = 0;
  let skippedCount = 0;
  let noResultsCount = 0;
  let errorCount = 0;

  // Process in batches
  const docs = snapshot.docs;
  const totalDocs = docs.length;

  for (let i = 0; i < totalDocs; i += batchSize) {
    const batch = docs.slice(i, Math.min(i + batchSize, totalDocs));
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(totalDocs / batchSize);

    console.log(`\nProcessing batch ${batchNum}/${totalBatches} (${batch.length} venues)...`);

    for (let j = 0; j < batch.length; j++) {
      const doc = batch[j];
      const data = doc.data();
      const venueNum = i + j + 1;

      console.log(`[${venueNum}/${totalDocs}] Geocoding: ${data.name || 'Unknown'}`);

      // Geocode the venue
      const result = await geocodeVenue(
        {
          id: doc.id,
          name: data.name,
          address: data.address,
          coordinates: data.coordinates,
        },
        useGoogle,
        apiKey
      );

      results.push(result);

      // Log result
      if (result.status === 'updated' && result.newCoordinates) {
        console.log(`  ✅ Found: ${result.newCoordinates.latitude.toFixed(6)}, ${result.newCoordinates.longitude.toFixed(6)} (${result.accuracy})`);

        // Update venue if not dry run
        if (!dryRun) {
          await doc.ref.update({
            coordinates: {
              latitude: result.newCoordinates.latitude,
              longitude: result.newCoordinates.longitude,
              accuracy: result.accuracy,
            },
            updated_at: new Date(),
          });
        }

        updatedCount++;
      } else if (result.status === 'skipped') {
        console.log(`  ⏭️  Skipped: ${result.error || 'Already has coordinates'}`);
        skippedCount++;
      } else if (result.status === 'no_results') {
        console.log(`  ⚠️  No results: ${result.error}`);
        noResultsCount++;
      } else if (result.status === 'error') {
        console.log(`  ❌ Error: ${result.error}`);
        errorCount++;
      }

      // Rate limiting: Nominatim requires 1 request/second, Google is faster
      await delay(useGoogle ? 50 : 1100);
    }

    // Longer delay between batches
    if (i + batchSize < totalDocs) {
      console.log(`\nWaiting ${useGoogle ? '2s' : '5s'} before next batch...`);
      await delay(useGoogle ? 2000 : 5000);
    }
  }

  // Print summary
  console.log('\n📊 Geocoding Summary');
  console.log('='.repeat(50));
  console.log(`Total processed:  ${totalDocs}`);
  console.log(`✅ Updated: ${updatedCount}`);
  console.log(`⏭️  Skipped: ${skippedCount}`);
  console.log(`⚠️  No results: ${noResultsCount}`);
  console.log(`❌ Errors: ${errorCount}`);

  // Print accuracy breakdown
  const byAccuracy = results
    .filter(r => r.status === 'updated')
    .reduce((acc, r) => {
      const accuracy = r.accuracy || 'unknown';
      acc[accuracy] = (acc[accuracy] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  if (Object.keys(byAccuracy).length > 0) {
    console.log('\nAccuracy breakdown:');
    for (const [accuracy, count] of Object.entries(byAccuracy)) {
      console.log(`  ${accuracy}: ${count}`);
    }
  }

  // Print sample updated venues
  const updatedVenues = results.filter(r => r.status === 'updated');
  if (updatedVenues.length > 0) {
    console.log('\n✅ Sample Updated Venues (first 10):');
    console.log('-'.repeat(50));
    for (const venue of updatedVenues.slice(0, 10)) {
      console.log(`\n  ${venue.venueName} (${venue.venueId})`);
      console.log(`    Address: ${venue.address}`);
      console.log(`    Old: ${venue.oldCoordinates.latitude}, ${venue.oldCoordinates.longitude}`);
      console.log(`    New: ${venue.newCoordinates?.latitude.toFixed(6)}, ${venue.newCoordinates?.longitude.toFixed(6)} (${venue.accuracy})`);
    }
    if (updatedVenues.length > 10) {
      console.log(`\n  ... and ${updatedVenues.length - 10} more`);
    }
  }

  // Print errors
  const errorVenues = results.filter(r => r.status === 'error' || r.status === 'no_results');
  if (errorVenues.length > 0) {
    console.log('\n⚠️  Issues (first 10):');
    console.log('-'.repeat(50));
    for (const venue of errorVenues.slice(0, 10)) {
      console.log(`  ${venue.venueName}: ${venue.error || venue.status}`);
    }
    if (errorVenues.length > 10) {
      console.log(`  ... and ${errorVenues.length - 10} more`);
    }
  }

  if (dryRun) {
    console.log('\n⚡ This was a dry run. Run without --dry-run to apply changes.');
  } else {
    console.log('\n✅ Geocoding complete!');
  }
}

// Parse CLI arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitIndex = args.indexOf('--limit');
const limit = limitIndex >= 0 && args[limitIndex + 1]
  ? parseInt(args[limitIndex + 1], 10)
  : null;
const batchSizeIndex = args.indexOf('--batch-size');
const batchSize = batchSizeIndex >= 0 && args[batchSizeIndex + 1]
  ? parseInt(args[batchSizeIndex + 1], 10)
  : 50;

const useGoogle = args.includes('--use-google');

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Venue Geocoding Migration Script

Usage:
  npx tsx src/cli/geocode-venues.ts [options]

Options:
  --dry-run          Preview changes without writing to database
  --limit N          Process at most N venues (default: unlimited)
  --batch-size N     Process N venues at a time (default: 50)
  --use-google       Use Google Geocoding API (requires GOOGLE_MAPS_API_KEY)
  --help, -h         Show this help

Geocoding Providers:
  Default: Nominatim (OpenStreetMap) - FREE, no API key required
           Rate limited to 1 request/second

  Google:  Use --use-google flag
           Requires GOOGLE_MAPS_API_KEY environment variable
           Much faster (50+ requests/second)

Examples:
  # Use Nominatim (free, slower)
  npx tsx src/cli/geocode-venues.ts --dry-run --limit 10
  npx tsx src/cli/geocode-venues.ts --limit 100

  # Use Google (requires API key)
  npx tsx src/cli/geocode-venues.ts --use-google --limit 100
`);
  process.exit(0);
}

// Main execution
runGeocoding(dryRun, limit, batchSize, useGoogle)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Geocoding failed:', error);
    process.exit(1);
  });
