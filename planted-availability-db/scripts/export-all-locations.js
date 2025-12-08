/**
 * Export ALL Planted Location Data
 *
 * Transforms all Salesforce Store_Locator__c data (Stores + Restaurants)
 * for the Planted Availability Database.
 */

const fs = require('fs');
const path = require('path');

const data = require('../data/planted-locations.json');

// Transform all to our venue format
const venues = data.map(r => ({
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

  // Type
  type: (r.Type__c || 'unknown').toLowerCase(),

  // Metadata
  source: 'planted-locations-api',
  source_url: 'https://locations.eatplanted.com/',

  // Brand/chain info
  brand: extractBrand(r.Thumbnail__c),
  logo_url: r.Thumbnail__c,

  // Planted-specific flags
  is_promoted: r.Is_Promoted__c || false,
  steak_available: r.Steak_Available__c || false,

  // Timestamps
  scraped_at: new Date().toISOString()
}));

function extractBrand(thumbnailUrl) {
  if (!thumbnailUrl) return null;
  const filename = thumbnailUrl.split('/').pop();
  return filename
    .replace('.png', '')
    .replace('.jpg', '')
    .replace('.svg', '')
    .split('?')[0]
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

// Statistics
const byType = {};
const byCountry = {};
const byBrand = {};

venues.forEach(v => {
  byType[v.type] = (byType[v.type] || 0) + 1;
  byCountry[v.address.country] = (byCountry[v.address.country] || 0) + 1;
  const brand = v.brand || 'Unknown';
  byBrand[brand] = (byBrand[brand] || 0) + 1;
});

// Output summary
console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║           🌱 PLANTED LOCATIONS COMPLETE EXPORT                 ║');
console.log('╠════════════════════════════════════════════════════════════════╣');
console.log(`║  Total Locations: ${venues.length.toString().padEnd(44)}║`);
console.log('╠════════════════════════════════════════════════════════════════╣');
console.log('║  BY TYPE:                                                      ║');
Object.entries(byType)
  .sort((a, b) => b[1] - a[1])
  .forEach(([type, count]) => {
    console.log(`║    ${type}: ${count}`.padEnd(65) + '║');
  });
console.log('╠════════════════════════════════════════════════════════════════╣');
console.log('║  BY COUNTRY:                                                   ║');

const flags = {
  'Switzerland': '🇨🇭',
  'Germany': '🇩🇪',
  'Austria': '🇦🇹',
  'United Kingdom': '🇬🇧',
  'Italy': '🇮🇹'
};

Object.entries(byCountry)
  .sort((a, b) => b[1] - a[1])
  .forEach(([country, count]) => {
    const flag = flags[country] || '🌍';
    console.log(`║    ${flag} ${country}: ${count}`.padEnd(65) + '║');
  });

console.log('╠════════════════════════════════════════════════════════════════╣');
console.log('║  TOP BRANDS/CHAINS:                                            ║');
Object.entries(byBrand)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 15)
  .forEach(([brand, count]) => {
    console.log(`║    • ${brand}: ${count}`.padEnd(65) + '║');
  });
console.log('╚════════════════════════════════════════════════════════════════╝');

// Save exports
const outputDir = path.join(__dirname, '../data');

// Save all venues
fs.writeFileSync(
  path.join(outputDir, 'planted-all-locations.json'),
  JSON.stringify(venues, null, 2)
);

// Save stores only
const stores = venues.filter(v => v.type === 'store');
fs.writeFileSync(
  path.join(outputDir, 'planted-stores.json'),
  JSON.stringify(stores, null, 2)
);

console.log('\n✅ Exported to:');
console.log('   • data/planted-all-locations.json (all 1800)');
console.log('   • data/planted-stores.json (1731 stores)');
console.log('   • data/planted-restaurants.json (69 restaurants - previous export)');
