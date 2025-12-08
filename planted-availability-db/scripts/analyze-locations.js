const data = require('../data/planted-locations.json');
const restaurants = data.filter(d => d.Type__c === 'Restaurant');

console.log('🍽️  PLANTED RESTAURANTS (' + restaurants.length + ' total)');
console.log('═'.repeat(60));

// Group by country
const byCountry = {};
restaurants.forEach(r => {
  const country = r.Country__c || 'Unknown';
  if (!byCountry[country]) byCountry[country] = [];
  byCountry[country].push(r);
});

Object.entries(byCountry).sort((a,b) => b[1].length - a[1].length).forEach(([country, locs]) => {
  console.log('\n🌍 ' + country.toUpperCase() + ' (' + locs.length + ')');
  console.log('-'.repeat(40));
  locs.forEach(r => {
    const city = r.City__c || '';
    const name = r.Name || 'Unknown';
    console.log('  • ' + name);
    console.log('    ' + r.Street__c + ', ' + city);
  });
});

// Get unique restaurant chains/brands
const brands = {};
restaurants.forEach(r => {
  const brand = r.Thumbnail__c ? r.Thumbnail__c.split('/').pop().replace('.png','').replace('.jpg','') : 'unknown';
  brands[brand] = (brands[brand] || 0) + 1;
});

console.log('\n\n📊 RESTAURANT BRANDS (by logo):');
Object.entries(brands).sort((a,b) => b[1]-a[1]).forEach(([brand, count]) => {
  console.log('  ' + brand + ': ' + count);
});
