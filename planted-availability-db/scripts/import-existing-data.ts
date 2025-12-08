/**
 * Import Script: Migrate existing data from planted-website to Firestore
 *
 * This script imports:
 * 1. Chains from retailer JSON files
 * 2. Venues and Dishes from deliveryRestaurants.ts
 *
 * Run with: npx tsx scripts/import-existing-data.ts
 */

import { initializeApp, cert, ServiceAccount } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Initialize Firebase Admin
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

const db = getFirestore();

// ============================================
// DELIVERY RESTAURANTS DATA
// ============================================

interface DeliveryPlatform {
  name: 'wolt' | 'lieferando' | 'uber-eats' | 'deliveroo' | 'just-eat' | 'own';
  url: string;
  displayName: string;
}

interface PlantedDish {
  name: string;
  description: string;
  price?: string;
  product: string;
  isVegan?: boolean;
}

interface DeliveryRestaurant {
  id: string;
  name: string;
  country: 'ch' | 'de' | 'at' | 'nl' | 'uk' | 'fr' | 'it' | 'es';
  city: string;
  cuisine: string;
  dishes: PlantedDish[];
  deliveryPlatforms: DeliveryPlatform[];
  rating?: number;
}

// Hardcoded delivery restaurants data (from planted-astro/src/data/deliveryRestaurants.ts)
const deliveryRestaurants: DeliveryRestaurant[] = [
  {
    id: 'vapiano-vienna',
    name: 'Vapiano',
    country: 'at',
    city: 'Vienna',
    cuisine: 'Italian',
    dishes: [
      { name: 'Pasta Planted Chicken Alfredo', description: 'Creamy alfredo sauce with planted chicken, mushrooms, and parmesan', price: '€15.90', product: 'planted.chicken', isVegan: true },
      { name: 'Pasta Planted Chicken Orange-Chili', description: 'Planted chicken with spicy orange-chili sauce, pak choi, and bell peppers', price: '€15.90', product: 'planted.chicken', isVegan: true },
      { name: 'Planted Chicken Salad Bowl', description: 'Fresh salad with grilled planted chicken, cherry tomatoes, and balsamic', price: '€14.50', product: 'planted.chicken', isVegan: true },
    ],
    deliveryPlatforms: [
      { name: 'wolt', url: 'https://wolt.com/en/aut/vienna/restaurant/vapiano-shopping-city-sd-vsendorf', displayName: 'Wolt' },
      { name: 'lieferando', url: 'https://www.lieferando.at/en/menu/vapiano', displayName: 'Lieferando' },
    ],
    rating: 4.2,
  },
  {
    id: 'neni-vienna',
    name: 'NENI am Naschmarkt',
    country: 'at',
    city: 'Vienna',
    cuisine: 'Tel Aviv / Mediterranean',
    dishes: [
      { name: 'Hummus Bowl with Planted Chicken', description: 'Classic hummus, planted chicken, Jerusalem spice, amba, yellow pepper, tahina, warm pita', price: '€16.90', product: 'planted.chicken', isVegan: true },
      { name: 'Planted Chicken Shawarma Plate', description: 'Spiced planted chicken with pickled vegetables, herb yogurt, and flatbread', price: '€18.50', product: 'planted.chicken', isVegan: true },
    ],
    deliveryPlatforms: [
      { name: 'wolt', url: 'https://wolt.com/en/aut/vienna/restaurant/neni-am-naschmarkt', displayName: 'Wolt' },
    ],
    rating: 4.5,
  },
  {
    id: 'doen-doen-berlin',
    name: 'doen doen planted kebap',
    country: 'de',
    city: 'Berlin',
    cuisine: 'Kebab / Vegan',
    dishes: [
      { name: 'Planted Kebap Döner', description: 'Vegan döner with planted kebab, fresh salad, red cabbage, tomatoes, cucumbers, grilled vegetables, choice of sauces', price: '€8.90', product: 'planted.kebab', isVegan: true },
      { name: 'Planted Kebap Dürüm', description: 'Wrap with planted kebab, salad mix, grilled vegetables, herb-yogurt and hot sauce', price: '€9.50', product: 'planted.kebab', isVegan: true },
      { name: 'Planted Kebap Teller', description: 'Plate with planted kebab, rice, salad, grilled vegetables, and all sauces', price: '€12.90', product: 'planted.kebab', isVegan: true },
    ],
    deliveryPlatforms: [
      { name: 'wolt', url: 'https://wolt.com/en/deu/berlin/restaurant/doen-doen-planted-kebap-berlin', displayName: 'Wolt' },
    ],
    rating: 9.2,
  },
  {
    id: 'doen-doen-stuttgart',
    name: 'doen doen planted kebap',
    country: 'de',
    city: 'Stuttgart',
    cuisine: 'Kebab / Vegan',
    dishes: [
      { name: 'Planted Kebap Döner', description: 'Vegan döner with planted kebab, fresh salad, red cabbage, tomatoes, cucumbers, grilled vegetables', price: '€8.90', product: 'planted.kebab', isVegan: true },
      { name: 'Planted Kebap Box', description: 'Planted kebab with fries, salad, and signature sauces', price: '€11.90', product: 'planted.kebab', isVegan: true },
    ],
    deliveryPlatforms: [
      { name: 'wolt', url: 'https://wolt.com/en/deu/stuttgart/restaurant/doen-doen-planted-kebap', displayName: 'Wolt' },
    ],
    rating: 8.6,
  },
  {
    id: 'peter-pane-berlin',
    name: 'Peter Pane',
    country: 'de',
    city: 'Berlin',
    cuisine: 'Burgers',
    dishes: [
      { name: 'Kebab Klaus Burger', description: 'Planted kebab, microgreens, lemon thyme sauce, crispy onions on brioche bun', price: '€14.90', product: 'planted.kebab', isVegan: false },
      { name: 'Meatless Monday Special', description: 'All vegan burgers including planted options for only €9.90 every Monday', price: '€9.90', product: 'planted.kebab', isVegan: true },
    ],
    deliveryPlatforms: [
      { name: 'lieferando', url: 'https://www.lieferando.de/en/peter-pane-berlin', displayName: 'Lieferando' },
      { name: 'uber-eats', url: 'https://www.ubereats.com/de-en/store/peter-pane-burgergrill-&-bar-east-side/eZYUJfP-TsWYlwALitZ3eg', displayName: 'Uber Eats' },
    ],
    rating: 4.3,
  },
  {
    id: 'dean-david-munich',
    name: 'dean&david',
    country: 'de',
    city: 'Munich',
    cuisine: 'Healthy Bowls & Salads',
    dishes: [
      { name: 'Planted Chicken Kebab Bowl', description: 'Jasmine rice, grilled planted chicken, cherry tomatoes, cucumber, red cabbage, mint dip, pomegranate seeds, harissa sesame', price: '€13.90', product: 'planted.chicken', isVegan: true },
      { name: 'Golden Curry Bowl with Planted Chicken', description: 'Jasmine rice, planted chicken, red cabbage, pomegranate, chickpeas with cinnamon, creamy korma sauce', price: '€14.50', product: 'planted.chicken', isVegan: true },
      { name: 'Planted Chicken Caesar Salad', description: 'Grilled planted chicken, romaine, sun-ripened tomatoes, Italian hard cheese, roasted croutons, Caesar dressing', price: '€12.90', product: 'planted.chicken', isVegan: false },
      { name: 'Watermelon Feta Bowl with Planted Chicken', description: 'Planted chicken, feta, watermelon, cucumber, marinated onions, chickpeas, mint, lime dressing', price: '€14.90', product: 'planted.chicken', isVegan: false },
    ],
    deliveryPlatforms: [
      { name: 'lieferando', url: 'https://www.lieferando.de/en/menu/dean-david-muenchen-leopoldstrasse', displayName: 'Lieferando' },
    ],
    rating: 4.4,
  },
  {
    id: 'hans-im-glueck-munich',
    name: 'Hans im Glück',
    country: 'de',
    city: 'Munich',
    cuisine: 'Burgers',
    dishes: [
      { name: 'The Better Bagel with Planted Pastrami', description: '100% vegan bagel filled with planted pastrami, pickles, mustard, fresh greens', price: '€12.90', product: 'planted.pulled', isVegan: true },
      { name: 'Planted Burger Deluxe', description: 'Plant-based patty with cheese, tomato, lettuce, special sauce on pretzel bun', price: '€14.50', product: 'planted.burger', isVegan: false },
    ],
    deliveryPlatforms: [
      { name: 'lieferando', url: 'https://www.lieferando.de/en/hans-im-glueck-munich', displayName: 'Lieferando' },
      { name: 'uber-eats', url: 'https://www.ubereats.com/de-en/store/hans-im-gluck-munchen-isartor/SfFAe9YwRUGI3I89RP--Aw', displayName: 'Uber Eats' },
    ],
    rating: 4.2,
  },
  {
    id: 'subway-germany',
    name: 'Subway',
    country: 'de',
    city: 'Nationwide',
    cuisine: 'Sandwiches',
    dishes: [
      { name: 'Plant-based Chicken Teriyaki Sub', description: 'Vegan soy strips in spicy teriyaki marinade with fresh vegetables on your choice of bread', price: '€7.49', product: 'planted.chicken', isVegan: true },
      { name: 'Plant-based Teriyaki Salad', description: 'Teriyaki planted chicken on fresh salad greens with your choice of dressing', price: '€8.99', product: 'planted.chicken', isVegan: true },
    ],
    deliveryPlatforms: [
      { name: 'lieferando', url: 'https://www.lieferando.de/subway', displayName: 'Lieferando' },
      { name: 'uber-eats', url: 'https://www.ubereats.com/de-en/brand-city/berlin-be/subway', displayName: 'Uber Eats' },
    ],
    rating: 4.0,
  },
  {
    id: 'hiltl-zurich',
    name: 'Hiltl',
    country: 'ch',
    city: 'Zurich',
    cuisine: 'Vegetarian / World Cuisine',
    dishes: [
      { name: 'Planted Protein Power Bowl', description: 'Planted chicken with quinoa, avocado, edamame, roasted vegetables, and tahini dressing', price: 'CHF 24.50', product: 'planted.chicken', isVegan: true },
      { name: 'Hiltl Burger with Planted Patty', description: 'Plant-based patty on house brioche with caramelized onions, pickles, special sauce', price: 'CHF 22.00', product: 'planted.burger', isVegan: false },
      { name: 'Green Thai Curry with Planted Chicken', description: 'Aromatic Thai green curry with planted chicken, vegetables, and jasmine rice', price: 'CHF 26.00', product: 'planted.chicken', isVegan: true },
      { name: 'Planted Chicken Tikka Masala', description: 'Creamy tikka masala with planted chicken, basmati rice, and naan bread', price: 'CHF 25.50', product: 'planted.chicken', isVegan: true },
    ],
    deliveryPlatforms: [
      { name: 'uber-eats', url: 'https://www.ubereats.com/ch-de/store/hiltl/1mD1LSc4WJKCJBQr5CoxCg', displayName: 'Uber Eats' },
    ],
    rating: 4.6,
  },
  {
    id: 'wagamama-uk',
    name: 'Wagamama',
    country: 'uk',
    city: 'Nationwide',
    cuisine: 'Asian Fusion',
    dishes: [
      { name: 'Vegan Katsu Curry', description: 'Crispy plant-based katsu with sticky rice, pickled vegetables, and katsu curry sauce', price: '£13.75', product: 'planted.schnitzel', isVegan: true },
      { name: 'Vegan Firecracker', description: 'Spicy stir-fried noodles with plant-based chicken, chili, vegetables, and peanuts', price: '£12.95', product: 'planted.chicken', isVegan: true },
      { name: 'Yasai Pad Thai', description: 'Rice noodles with tofu, beansprouts, spring onion, and tamarind-lime dressing', price: '£12.50', product: 'planted.chicken', isVegan: true },
    ],
    deliveryPlatforms: [
      { name: 'deliveroo', url: 'https://deliveroo.co.uk/brands/wagamama', displayName: 'Deliveroo' },
      { name: 'uber-eats', url: 'https://www.ubereats.com/gb/brand/wagamama', displayName: 'Uber Eats' },
      { name: 'just-eat', url: 'https://www.just-eat.co.uk/takeaway/brands/wagamama', displayName: 'Just Eat' },
    ],
    rating: 4.3,
  },
];

// ============================================
// RETAILER DATA
// ============================================

interface Retailer {
  name: string;
  logo: string;
  url?: string;
  countries: string[];
  order: number;
  type: 'retail' | 'foodservice';
  products?: string[];
  description?: string;
}

// City coordinates for venues
const cityCoordinates: Record<string, { lat: number; lng: number; country: string }> = {
  'Vienna': { lat: 48.2082, lng: 16.3738, country: 'AT' },
  'Berlin': { lat: 52.5200, lng: 13.4050, country: 'DE' },
  'Stuttgart': { lat: 48.7758, lng: 9.1829, country: 'DE' },
  'Munich': { lat: 48.1351, lng: 11.5820, country: 'DE' },
  'Zurich': { lat: 47.3769, lng: 8.5417, country: 'CH' },
  'Nationwide': { lat: 51.1657, lng: 10.4515, country: 'DE' }, // Germany center as fallback
};

// Platform name mapping
const platformNameMap: Record<string, string> = {
  'wolt': 'wolt',
  'lieferando': 'lieferando',
  'uber-eats': 'uber_eats',
  'deliveroo': 'deliveroo',
  'just-eat': 'just_eat',
};

// Parse price string to amount
function parsePrice(priceStr?: string): { amount: number; currency: string } {
  if (!priceStr) return { amount: 0, currency: 'EUR' };

  const currency = priceStr.startsWith('CHF') ? 'CHF' : priceStr.startsWith('£') ? 'GBP' : 'EUR';
  const amount = parseFloat(priceStr.replace(/[^0-9.]/g, '')) || 0;

  return { amount, currency };
}

// ============================================
// IMPORT FUNCTIONS
// ============================================

async function importChains(): Promise<Map<string, string>> {
  console.log('\n📦 Importing Chains...');
  const chainIdMap = new Map<string, string>();

  // Read retailer JSON files
  const retailersPath = join(__dirname, '../../planted-astro/src/content/retailers');
  const files = readdirSync(retailersPath).filter(f => f.endsWith('.json'));

  for (const file of files) {
    const content = readFileSync(join(retailersPath, file), 'utf8');
    const retailer: Retailer = JSON.parse(content);

    const chainId = file.replace('.json', '');

    // Convert country codes
    const markets = [...new Set(retailer.countries.map(c => {
      const parts = c.split('-');
      return parts[0].toUpperCase();
    }))];

    const chainData = {
      name: retailer.name,
      type: retailer.type === 'retail' ? 'retail' : 'restaurant',
      logo_url: retailer.logo,
      website: retailer.url || null,
      markets,
      partnership_level: retailer.order <= 5 ? 'premium' : 'standard',
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    };

    await db.collection('chains').doc(chainId).set(chainData);
    chainIdMap.set(retailer.name.toLowerCase(), chainId);
    console.log(`  ✅ Chain: ${retailer.name} (${chainId})`);
  }

  return chainIdMap;
}

async function importVenuesAndDishes(chainIdMap: Map<string, string>): Promise<void> {
  console.log('\n🏪 Importing Venues and Dishes...');

  for (const restaurant of deliveryRestaurants) {
    const coords = cityCoordinates[restaurant.city] || cityCoordinates['Nationwide'];
    const countryCode = restaurant.country.toUpperCase();

    // Find chain ID if this is part of a chain
    const chainId = chainIdMap.get(restaurant.name.toLowerCase());

    // Create venue
    const venueData = {
      type: 'restaurant',
      name: restaurant.name,
      chain_id: chainId || null,
      location: {
        latitude: coords.lat + (Math.random() - 0.5) * 0.01, // Slight offset for uniqueness
        longitude: coords.lng + (Math.random() - 0.5) * 0.01,
      },
      address: {
        street: 'See delivery platform for address',
        city: restaurant.city,
        postal_code: '00000',
        country: countryCode,
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
        website: restaurant.deliveryPlatforms[0]?.url,
      },
      source: {
        type: 'manual',
        url: restaurant.deliveryPlatforms[0]?.url,
      },
      last_verified: FieldValue.serverTimestamp(),
      status: 'active',
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    };

    const venueRef = await db.collection('venues').add(venueData);
    console.log(`  ✅ Venue: ${restaurant.name} (${restaurant.city}) - ${venueRef.id}`);

    // Create dishes for this venue
    for (const dish of restaurant.dishes) {
      const price = parsePrice(dish.price);

      // Map delivery platforms
      const deliveryPartners = restaurant.deliveryPlatforms.map(p => ({
        partner: platformNameMap[p.name] || p.name,
        url: p.url,
      }));

      // Extract dietary tags
      const dietaryTags: string[] = [];
      if (dish.isVegan) dietaryTags.push('vegan');
      dietaryTags.push('plant-based');

      const dishData = {
        venue_id: venueRef.id,
        name: dish.name,
        description: dish.description,
        planted_products: [dish.product],
        price: {
          amount: price.amount,
          currency: price.currency,
        },
        dietary_tags: dietaryTags,
        cuisine_type: restaurant.cuisine,
        availability: {
          type: 'permanent',
        },
        delivery_partners: deliveryPartners,
        source: {
          type: 'manual',
        },
        last_verified: FieldValue.serverTimestamp(),
        status: 'active',
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      };

      const dishRef = await db.collection('dishes').add(dishData);
      console.log(`    📋 Dish: ${dish.name} - ${dishRef.id}`);
    }
  }
}

async function main() {
  console.log('🚀 Starting data import...');
  console.log('================================');

  try {
    // Import chains
    const chainIdMap = await importChains();
    console.log(`\n✅ Imported ${chainIdMap.size} chains`);

    // Import venues and dishes
    await importVenuesAndDishes(chainIdMap);

    console.log('\n================================');
    console.log('🎉 Import completed successfully!');
    console.log('\nSummary:');
    console.log(`  - Chains: ${chainIdMap.size}`);
    console.log(`  - Venues: ${deliveryRestaurants.length}`);
    console.log(`  - Dishes: ${deliveryRestaurants.reduce((sum, r) => sum + r.dishes.length, 0)}`);
  } catch (error) {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  }
}

main();
