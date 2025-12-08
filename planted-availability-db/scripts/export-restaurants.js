/**
 * Export Planted Restaurant Data
 *
 * Transforms raw Salesforce Store_Locator__c data into venue format
 * for the Planted Availability Database.
 */

const fs = require('fs');
const path = require('path');

const data = require('../data/planted-locations.json');

// Filter to restaurants only
const restaurants = data.filter(d => d.Type__c === 'Restaurant');

// Transform to our venue format
const venues = restaurants.map(r => ({
  // Core identification
  id: `planted-loc-${r.Id}`,
  salesforce_id: r.Id,
  name: r.Name,

  // Location data
  address: {
    street: r.Street__c,
    city: r.City__c,
    postal_code: r.Postal_Code__c || null,
    country: r.Country__c,
    full_address: [r.Street__c, r.City__c, r.Country__c].filter(Boolean).join(', ')
  },

  // Coordinates
  coordinates: {
    lat: r.lat__c,
    lng: r.lng__c
  },

  // Metadata
  type: 'restaurant',
  source: 'planted-locations-api',
  source_url: 'https://locations.eatplanted.com/',

  // Brand/chain info (extracted from thumbnail URL)
  brand: extractBrand(r.Thumbnail__c),
  logo_url: r.Thumbnail__c,

  // Planted-specific flags
  is_promoted: r.Is_Promoted__c || false,
  steak_available: r.Steak_Available__c || false,

  // Timestamps
  scraped_at: new Date().toISOString(),

  // Raw data for reference
  _raw: r
}));

function extractBrand(thumbnailUrl) {
  if (!thumbnailUrl) return null;
  const filename = thumbnailUrl.split('/').pop();
  return filename
    .replace('.png', '')
    .replace('.jpg', '')
    .replace('.svg', '')
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

// Group by country for summary
const byCountry = {};
venues.forEach(v => {
  const country = v.address.country || 'Unknown';
  if (!byCountry[country]) byCountry[country] = [];
  byCountry[country].push(v);
});

// Output summary
console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║     🌱 PLANTED RESTAURANTS EXPORT                        ║');
console.log('╠══════════════════════════════════════════════════════════╣');
console.log(`║  Total Restaurants: ${venues.length.toString().padEnd(36)}║`);
console.log('╠══════════════════════════════════════════════════════════╣');

Object.entries(byCountry)
  .sort((a, b) => b[1].length - a[1].length)
  .forEach(([country, locs]) => {
    const flag = {
      'Switzerland': '🇨🇭',
      'Germany': '🇩🇪',
      'Austria': '🇦🇹',
      'United Kingdom': '🇬🇧',
      'Italy': '🇮🇹'
    }[country] || '🌍';
    console.log(`║  ${flag} ${country}: ${locs.length.toString().padEnd(39 - country.length)}║`);
  });

console.log('╠══════════════════════════════════════════════════════════╣');

// Get brands
const brands = {};
venues.forEach(v => {
  const brand = v.brand || 'Unknown';
  brands[brand] = (brands[brand] || 0) + 1;
});

console.log('║  BRANDS:'.padEnd(59) + '║');
Object.entries(brands)
  .sort((a, b) => b[1] - a[1])
  .forEach(([brand, count]) => {
    console.log(`║    • ${brand}: ${count}`.padEnd(59) + '║');
  });

console.log('╚══════════════════════════════════════════════════════════╝');

// Save exports
const outputDir = path.join(__dirname, '../data');

// Save full venue data
fs.writeFileSync(
  path.join(outputDir, 'planted-restaurants.json'),
  JSON.stringify(venues, null, 2)
);

// Save simplified list (without raw data)
const simplified = venues.map(({ _raw, ...v }) => v);
fs.writeFileSync(
  path.join(outputDir, 'planted-restaurants-clean.json'),
  JSON.stringify(simplified, null, 2)
);

// Save CSV for easy viewing
const csv = [
  'id,name,brand,street,city,country,lat,lng,steak_available,logo_url',
  ...venues.map(v => [
    v.salesforce_id,
    `"${v.name.replace(/"/g, '""')}"`,
    v.brand || '',
    `"${(v.address.street || '').replace(/"/g, '""')}"`,
    v.address.city || '',
    v.address.country || '',
    v.coordinates.lat,
    v.coordinates.lng,
    v.steak_available,
    v.logo_url || ''
  ].join(','))
].join('\n');

fs.writeFileSync(
  path.join(outputDir, 'planted-restaurants.csv'),
  csv
);

console.log('\n✅ Exported to:');
console.log('   • data/planted-restaurants.json (full data)');
console.log('   • data/planted-restaurants-clean.json (without raw)');
console.log('   • data/planted-restaurants.csv');
