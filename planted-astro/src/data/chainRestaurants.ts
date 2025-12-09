/**
 * Chain Restaurant Data with Locations
 *
 * Discovered via Intelligent Chain Discovery Agent - December 2024
 * Each location has coordinates for distance-based filtering.
 * When user enters ZIP code, we show only the closest location per chain.
 */

import { discoveredChainLocations } from './discoveredLocations';

export interface ChainLocation {
  id: string;
  chainId: string;
  chainName: string;
  name: string;
  city: string;
  address?: string;
  postalCode?: string;
  country: 'ch' | 'de' | 'at' | 'lu' | 'uk' | 'nl';
  coordinates: {
    lat: number;
    lng: number;
  };
  deliveryPlatforms: DeliveryPlatformLink[];
  plantedProducts: string[];
  dishes?: ChainDish[];
}

export interface DeliveryPlatformLink {
  name: 'wolt' | 'lieferando' | 'uber-eats' | 'just-eat' | 'smood' | 'own';
  url: string;
  displayName: string;
}

export interface ChainDish {
  name: string;
  description?: string;
  /** Single price - use for chains operating in one country only */
  price?: string;
  /** Country-specific prices for multi-country chains (e.g., { ch: 'CHF 14.90', de: '€12.90' }) */
  priceByCountry?: Partial<Record<'ch' | 'de' | 'at' | 'lu' | 'uk' | 'nl', string>>;
  plantedProduct: string;
  isVegan?: boolean;
}

export interface Chain {
  id: string;
  name: string;
  logo?: string;
  website?: string;
  cuisine: string;
  plantedProducts: string[];
  totalLocations: number;
  countries: string[];
  highlight?: string;
  deliveryRadiusKm: number; // Maximum delivery distance in km
}

// City coordinates for geocoding (Central points)
const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  // Germany
  'Berlin': { lat: 52.5200, lng: 13.4050 },
  'München': { lat: 48.1351, lng: 11.5820 },
  'Hamburg': { lat: 53.5511, lng: 9.9937 },
  'Frankfurt': { lat: 50.1109, lng: 8.6821 },
  'Köln': { lat: 50.9375, lng: 6.9603 },
  'Stuttgart': { lat: 48.7758, lng: 9.1829 },
  'Düsseldorf': { lat: 51.2277, lng: 6.7735 },
  'Leipzig': { lat: 51.3397, lng: 12.3731 },
  'Nürnberg': { lat: 49.4521, lng: 11.0767 },
  'Augsburg': { lat: 48.3705, lng: 10.8978 },
  'Karlsruhe': { lat: 49.0069, lng: 8.4037 },
  'Potsdam': { lat: 52.3906, lng: 13.0645 },
  'Dortmund': { lat: 51.5136, lng: 7.4653 },
  'Braunschweig': { lat: 52.2689, lng: 10.5268 },
  'Oldenburg': { lat: 53.1435, lng: 8.2146 },
  'Kiel': { lat: 54.3233, lng: 10.1228 },
  'Mainz': { lat: 49.9929, lng: 8.2473 },
  'Wiesbaden': { lat: 50.0782, lng: 8.2397 },
  'Hofheim': { lat: 50.0900, lng: 8.4500 },
  'Viersen': { lat: 51.2537, lng: 6.3944 },
  // Switzerland
  'Zürich': { lat: 47.3769, lng: 8.5417 },
  'Basel': { lat: 47.5596, lng: 7.5886 },
  'Bern': { lat: 46.9480, lng: 7.4474 },
  'Genf': { lat: 46.2044, lng: 6.1432 },
  'Lausanne': { lat: 46.5197, lng: 6.6323 },
  'Luzern': { lat: 47.0502, lng: 8.3093 },
  'Wallisellen': { lat: 47.4150, lng: 8.5950 },
  'Uster': { lat: 47.3500, lng: 8.7167 },
  'Ebikon': { lat: 47.0833, lng: 8.3333 },
  'Kriens': { lat: 47.0333, lng: 8.2833 },
  'Regensdorf': { lat: 47.4333, lng: 8.4667 },
  'Pfäffikon SZ': { lat: 47.2000, lng: 8.7833 },
  'St. Gallen': { lat: 47.4245, lng: 9.3767 },
  'Winterthur': { lat: 47.5001, lng: 8.7240 },
  'Olten': { lat: 47.3500, lng: 7.9000 },
  'Thun': { lat: 46.7580, lng: 7.6280 },
  'Fribourg': { lat: 46.8065, lng: 7.1620 },
  'Dietikon': { lat: 47.4044, lng: 8.4005 },
  'Vevey': { lat: 46.4628, lng: 6.8430 },
  // Austria
  'Wien': { lat: 48.2082, lng: 16.3738 },
  'Graz': { lat: 47.0707, lng: 15.4395 },
  'Salzburg': { lat: 47.8095, lng: 13.0550 },
  'Linz': { lat: 48.3069, lng: 14.2858 },
  'Innsbruck': { lat: 47.2692, lng: 11.4041 },
  // Luxembourg
  'Luxembourg': { lat: 49.6116, lng: 6.1319 },
  // United Kingdom
  'London': { lat: 51.5074, lng: -0.1278 },
  'Manchester': { lat: 53.4808, lng: -2.2426 },
  'Edinburgh': { lat: 55.9533, lng: -3.1883 },
  'Glasgow': { lat: 55.8642, lng: -4.2518 },
  'Liverpool': { lat: 53.4084, lng: -2.9916 },
  'Sheffield': { lat: 53.3811, lng: -1.4701 },
  'Nottingham': { lat: 52.9548, lng: -1.1581 },
  'Cardiff': { lat: 51.4816, lng: -3.1791 },
  'Ingliston': { lat: 55.9482, lng: -3.3647 },
  'Stretford': { lat: 53.4656, lng: -2.3475 },
};

// Chain metadata with delivery radius
// Typical delivery radius: 5-10km for food delivery platforms
// Ghost kitchens often have slightly larger radius due to delivery optimization
export const chains: Chain[] = [
  {
    id: 'dean-david',
    name: 'dean&david',
    logo: '/images/chains/dean-david.svg',
    website: 'https://deananddavid.com',
    cuisine: 'Healthy Bowls & Salads',
    plantedProducts: ['planted.chicken'],
    totalLocations: 118,
    countries: ['DE', 'AT', 'CH', 'LU'],
    highlight: 'Largest Planted partner chain',
    deliveryRadiusKm: 8,
  },
  {
    id: 'birdie-birdie',
    name: 'Birdie Birdie Chicken',
    logo: '/images/chains/birdie-birdie.svg',
    website: 'https://birdiebirdie-food.com',
    cuisine: 'Chicken Burgers',
    plantedProducts: ['planted.chicken'],
    totalLocations: 50,
    countries: ['DE'],
    highlight: 'Ghost kitchen in 20+ cities',
    deliveryRadiusKm: 10, // Ghost kitchens often have larger radius
  },
  {
    id: 'kaimug',
    name: 'KAIMUG',
    logo: '/images/chains/kaimug.svg',
    website: 'https://kaimug.ch',
    cuisine: 'Thai Street Food',
    plantedProducts: ['planted.chicken'],
    totalLocations: 35,
    countries: ['CH', 'DE'],
    highlight: 'Authentic Thai cuisine',
    deliveryRadiusKm: 8,
  },
  {
    id: 'nooch',
    name: 'Nooch Asian Kitchen',
    logo: '/images/chains/nooch.svg',
    website: 'https://nooch.ch',
    cuisine: 'Asian Fusion',
    plantedProducts: ['planted.chicken'],
    totalLocations: 9,
    countries: ['CH'],
    highlight: 'Swiss Asian street food',
    deliveryRadiusKm: 8,
  },
  {
    id: 'chidoba',
    name: 'Chidoba Mexican Grill',
    logo: '/images/chains/chidoba.svg',
    website: 'https://chidoba.com',
    cuisine: 'Mexican',
    plantedProducts: ['planted.chicken'],
    totalLocations: 9,
    countries: ['DE'],
    highlight: 'Mexican fast-casual',
    deliveryRadiusKm: 8,
  },
  {
    id: 'stadtsalat',
    name: 'Stadtsalat',
    logo: '/images/chains/stadtsalat.svg',
    website: 'https://stadtsalat.de',
    cuisine: 'Salads & Bowls',
    plantedProducts: ['planted.chicken'],
    totalLocations: 5,
    countries: ['DE'],
    highlight: 'Healthy bowl delivery',
    deliveryRadiusKm: 10, // Delivery-focused business
  },
  {
    id: 'doen-doen',
    name: 'doen doen planted kebap',
    logo: '/images/chains/doen-doen.svg',
    website: 'https://doendoen.de',
    cuisine: 'Vegan Kebab',
    plantedProducts: ['planted.kebab'],
    totalLocations: 3,
    countries: ['DE'],
    highlight: '100% vegan kebab',
    deliveryRadiusKm: 8,
  },
  {
    id: 'rabowls',
    name: 'råbowls',
    logo: '/images/chains/rabowls.svg',
    website: 'https://rabowls.de',
    cuisine: 'Healthy Bowls',
    plantedProducts: ['planted.chicken', 'planted.duck', 'planted.pulled'],
    totalLocations: 2,
    countries: ['DE'],
    highlight: '3 different Planted products',
    deliveryRadiusKm: 8,
  },
  {
    id: 'brezelkoenig',
    name: 'Brezelkönig',
    logo: '/images/chains/brezelkoenig.svg',
    website: 'https://brezelkoenig.ch',
    cuisine: 'Pretzels & Baguettes',
    plantedProducts: ['planted.chicken'],
    totalLocations: 51,
    countries: ['CH'],
    highlight: 'Baguette Planted Chicken Curry',
    deliveryRadiusKm: 5,
  },
  {
    id: 'barburrito',
    name: 'Barburrito',
    logo: '/images/chains/barburrito.svg',
    website: 'https://barburrito.co.uk',
    cuisine: 'Mexican Burritos',
    plantedProducts: ['planted.chicken'],
    totalLocations: 12,
    countries: ['UK'],
    highlight: 'UK Mexican chain with planted.chicken',
    deliveryRadiusKm: 8,
  },
  // New chains discovered via Smart Discovery Agent
  {
    id: 'green-club',
    name: 'Green Club',
    cuisine: 'Healthy Fast Food',
    plantedProducts: ['planted.chicken', 'planted.kebab', 'planted.pastrami'],
    totalLocations: 5,
    countries: ['DE'],
    highlight: 'Vegan-friendly healthy bowls',
    deliveryRadiusKm: 8,
  },
  {
    id: 'beets-roots',
    name: 'beets&roots',
    website: 'https://beetsandroots.de',
    cuisine: 'Healthy Bowls',
    plantedProducts: ['planted.chicken', 'planted.steak'],
    totalLocations: 5,
    countries: ['DE'],
    highlight: 'Fresh salads and bowls',
    deliveryRadiusKm: 8,
  },
  {
    id: 'kaspar-schmauser',
    name: 'Kaspar Schmauser',
    website: 'https://kaspar-schmauser.de',
    cuisine: 'German Comfort Food',
    plantedProducts: ['planted.chicken', 'planted.kebab', 'planted.steak'],
    totalLocations: 4,
    countries: ['DE'],
    highlight: 'German comfort dishes with planted',
    deliveryRadiusKm: 8,
  },
  {
    id: 'veganitas',
    name: 'Veganitas',
    cuisine: 'Vegan',
    plantedProducts: ['planted.steak', 'planted.chicken'],
    totalLocations: 3,
    countries: ['CH'],
    highlight: '100% vegan restaurant',
    deliveryRadiusKm: 8,
  },
  {
    id: 'kaisin',
    name: 'kaisin.',
    website: 'https://kaisin.ch',
    cuisine: 'Asian Fusion',
    plantedProducts: ['planted.chicken'],
    totalLocations: 3,
    countries: ['CH'],
    highlight: 'Asian fusion bowls',
    deliveryRadiusKm: 8,
  },
  {
    id: 'rice-up',
    name: 'Rice Up!',
    website: 'https://rice-up.ch',
    cuisine: 'Asian Bowls',
    plantedProducts: ['planted.chicken'],
    totalLocations: 8,
    countries: ['CH'],
    highlight: 'Swiss Asian fast-casual',
    deliveryRadiusKm: 8,
  },
  {
    id: 'cotidiano',
    name: 'Cotidiano',
    website: 'https://cotidiano.de',
    cuisine: 'Café & Restaurant',
    plantedProducts: ['planted.chicken_burger', 'planted.pastrami'],
    totalLocations: 2,
    countries: ['DE'],
    highlight: 'All-day café with planted options',
    deliveryRadiusKm: 8,
  },
  {
    id: 'tibits',
    name: 'Tibits',
    website: 'https://tibits.ch',
    cuisine: 'Vegetarian Buffet',
    plantedProducts: ['planted.chicken'],
    totalLocations: 9,
    countries: ['CH'],
    highlight: 'Vegetarian buffet restaurant',
    deliveryRadiusKm: 8,
  },
  {
    id: 'hiltl',
    name: 'Hiltl',
    website: 'https://hiltl.ch',
    cuisine: 'Vegetarian World Cuisine',
    plantedProducts: ['planted.chicken'],
    totalLocations: 4,
    countries: ['CH'],
    highlight: "World's oldest vegetarian restaurant",
    deliveryRadiusKm: 8,
  },
];

// Default delivery radius if not specified
export const DEFAULT_DELIVERY_RADIUS_KM = 8;

// All chain locations with coordinates
export const chainLocations: ChainLocation[] = [
  // ============================================
  // DEAN & DAVID - Major locations (sample of 118)
  // ============================================
  {
    id: 'dd-munich-leo',
    chainId: 'dean-david',
    chainName: 'dean&david',
    name: 'dean&david Leopoldstraße',
    city: 'München',
    address: 'Leopoldstraße 82',
    postalCode: '80802',
    country: 'de',
    coordinates: { lat: 48.1601, lng: 11.5863 },
    deliveryPlatforms: [
      { name: 'lieferando', url: 'https://www.lieferando.de/en/menu/dean-david-muenchen-leopoldstrasse', displayName: 'Lieferando' },
      { name: 'uber-eats', url: 'https://www.ubereats.com/de/store/dean-david-leopoldstrasse', displayName: 'Uber Eats' },
    ],
    plantedProducts: ['planted.chicken'],
    dishes: [
      { name: 'Tuscany Chicken Salad', description: 'planted.chicken with Italian flavors, sun-dried tomatoes, pine nuts', priceByCountry: { de: '€12.90', at: '€13.50', ch: 'CHF 18.90', lu: '€13.90' }, plantedProduct: 'planted.chicken', isVegan: true },
      { name: 'Planted Chicken Kebab Bowl', description: 'Jasmine rice, planted chicken, pomegranate, harissa', priceByCountry: { de: '€13.90', at: '€14.50', ch: 'CHF 19.90', lu: '€14.90' }, plantedProduct: 'planted.chicken', isVegan: true },
    ],
  },
  {
    id: 'dd-berlin-mitte',
    chainId: 'dean-david',
    chainName: 'dean&david',
    name: 'dean&david Berlin Mitte',
    city: 'Berlin',
    address: 'Friedrichstraße 90',
    postalCode: '10117',
    country: 'de',
    coordinates: { lat: 52.5200, lng: 13.3886 },
    deliveryPlatforms: [
      { name: 'lieferando', url: 'https://www.lieferando.de/en/menu/dean-david-berlin-friedrichstrasse', displayName: 'Lieferando' },
    ],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'dd-hamburg-hbf',
    chainId: 'dean-david',
    chainName: 'dean&david',
    name: 'dean&david Hamburg Hbf',
    city: 'Hamburg',
    address: 'Hachmannplatz 16',
    postalCode: '20099',
    country: 'de',
    coordinates: { lat: 53.5530, lng: 10.0065 },
    deliveryPlatforms: [
      { name: 'lieferando', url: 'https://www.lieferando.de/en/menu/dean-david-hamburg-hbf', displayName: 'Lieferando' },
    ],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'dd-frankfurt-main',
    chainId: 'dean-david',
    chainName: 'dean&david',
    name: 'dean&david Frankfurt',
    city: 'Frankfurt',
    address: 'Kaiserstraße 63',
    postalCode: '60329',
    country: 'de',
    coordinates: { lat: 50.1072, lng: 8.6647 },
    deliveryPlatforms: [
      { name: 'lieferando', url: 'https://www.lieferando.de/en/menu/dean-david-frankfurt', displayName: 'Lieferando' },
    ],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'dd-koeln-ehrenstr',
    chainId: 'dean-david',
    chainName: 'dean&david',
    name: 'dean&david Köln Ehrenstraße',
    city: 'Köln',
    address: 'Ehrenstraße 77',
    postalCode: '50672',
    country: 'de',
    coordinates: { lat: 50.9387, lng: 6.9461 },
    deliveryPlatforms: [
      { name: 'lieferando', url: 'https://www.lieferando.de/en/menu/dean-david-koeln', displayName: 'Lieferando' },
    ],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'dd-stuttgart-koenig',
    chainId: 'dean-david',
    chainName: 'dean&david',
    name: 'dean&david Stuttgart',
    city: 'Stuttgart',
    address: 'Königstraße 26',
    postalCode: '70173',
    country: 'de',
    coordinates: { lat: 48.7784, lng: 9.1760 },
    deliveryPlatforms: [
      { name: 'lieferando', url: 'https://www.lieferando.de/en/menu/dean-david-stuttgart', displayName: 'Lieferando' },
    ],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'dd-vienna-stephans',
    chainId: 'dean-david',
    chainName: 'dean&david',
    name: 'dean&david Wien Stephansplatz',
    city: 'Wien',
    address: 'Stephansplatz 4',
    postalCode: '1010',
    country: 'at',
    coordinates: { lat: 48.2088, lng: 16.3726 },
    deliveryPlatforms: [
      { name: 'lieferando', url: 'https://www.lieferando.at/en/menu/dean-david-wien', displayName: 'Lieferando' },
      { name: 'wolt', url: 'https://wolt.com/en/aut/vienna/restaurant/dean-david-stephansplatz', displayName: 'Wolt' },
    ],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'dd-zurich-hb',
    chainId: 'dean-david',
    chainName: 'dean&david',
    name: 'dean&david Zürich HB',
    city: 'Zürich',
    address: 'Bahnhofplatz 15',
    postalCode: '8001',
    country: 'ch',
    coordinates: { lat: 47.3779, lng: 8.5403 },
    deliveryPlatforms: [
      { name: 'uber-eats', url: 'https://www.ubereats.com/ch/store/dean-david-zurich-hb', displayName: 'Uber Eats' },
    ],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'dd-luzern',
    chainId: 'dean-david',
    chainName: 'dean&david',
    name: 'dean&david Luzern',
    city: 'Luzern',
    address: 'Morgartenstrasse 4',
    postalCode: '6003',
    country: 'ch',
    coordinates: { lat: 47.0502, lng: 8.3093 },
    deliveryPlatforms: [
      { name: 'uber-eats', url: 'https://www.ubereats.com/ch/store/dean-david-luzern', displayName: 'Uber Eats' },
    ],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'dd-luxembourg',
    chainId: 'dean-david',
    chainName: 'dean&david',
    name: 'dean&david Luxembourg',
    city: 'Luxembourg',
    country: 'lu',
    coordinates: { lat: 49.6116, lng: 6.1319 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },

  // ============================================
  // BIRDIE BIRDIE CHICKEN - Ghost kitchen locations
  // ============================================
  {
    id: 'bb-berlin-prenzl',
    chainId: 'birdie-birdie',
    chainName: 'Birdie Birdie Chicken',
    name: 'Birdie Birdie Prenzlauer Berg',
    city: 'Berlin',
    address: 'Danziger Str. 63',
    postalCode: '10435',
    country: 'de',
    coordinates: { lat: 52.5390, lng: 13.4200 },
    deliveryPlatforms: [
      { name: 'wolt', url: 'https://wolt.com/en/deu/berlin/restaurant/birdie-birdie-prenzlauer-berg', displayName: 'Wolt' },
      { name: 'uber-eats', url: 'https://www.ubereats.com/de-en/store/birdie-birdie-chicken-prenzlauer-berg/P-S868PmUYyIuX82FFqwvA', displayName: 'Uber Eats' },
      { name: 'lieferando', url: 'https://www.lieferando.de/speisekarte/birdie-birdie-prenzlauer-berg', displayName: 'Lieferando' },
    ],
    plantedProducts: ['planted.chicken'],
    dishes: [
      { name: 'Classic Planted Burger', description: 'Crispy planted.chicken, cheese, salad, pickle, Signature Sauce', price: '€8.85', plantedProduct: 'planted.chicken', isVegan: true },
      { name: 'Spicy Planted Burger', description: 'planted.chicken, jalapeños, Chipotle Mayo, Buffalo Sauce', price: '€9.75', plantedProduct: 'planted.chicken', isVegan: true },
    ],
  },
  {
    id: 'bb-berlin-kreuz',
    chainId: 'birdie-birdie',
    chainName: 'Birdie Birdie Chicken',
    name: 'Birdie Birdie Kreuzberg',
    city: 'Berlin',
    address: 'Kreuzberg',
    country: 'de',
    coordinates: { lat: 52.4990, lng: 13.4000 },
    deliveryPlatforms: [
      { name: 'wolt', url: 'https://wolt.com/de/deu/berlin/restaurant/birdie-birdie-kreuzberg', displayName: 'Wolt' },
    ],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'bb-hamburg-barmbek',
    chainId: 'birdie-birdie',
    chainName: 'Birdie Birdie Chicken',
    name: 'Birdie Birdie Hamburg Barmbek',
    city: 'Hamburg',
    address: 'Wagnerstr. 60',
    postalCode: '22081',
    country: 'de',
    coordinates: { lat: 53.5840, lng: 10.0450 },
    deliveryPlatforms: [
      { name: 'wolt', url: 'https://wolt.com/en/deu/hamburg/restaurant/birdie-birdie-hamburg-brmbk', displayName: 'Wolt' },
      { name: 'lieferando', url: 'https://www.lieferando.de/speisekarte/birdie-birdie-hamburg-barmbek', displayName: 'Lieferando' },
    ],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'bb-munich-laim',
    chainId: 'birdie-birdie',
    chainName: 'Birdie Birdie Chicken',
    name: 'Birdie Birdie München Laim',
    city: 'München',
    address: 'Laim',
    country: 'de',
    coordinates: { lat: 48.1400, lng: 11.5000 },
    deliveryPlatforms: [
      { name: 'wolt', url: 'https://wolt.com/en/deu/munich/restaurant/birdie-birdie-laim', displayName: 'Wolt' },
      { name: 'uber-eats', url: 'https://www.ubereats.com/de-en/store/birdie-birdie-chicken-laim/Eb0YkFW8XtyK595BtUc7VA', displayName: 'Uber Eats' },
    ],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'bb-koeln-sued',
    chainId: 'birdie-birdie',
    chainName: 'Birdie Birdie Chicken',
    name: 'Birdie Birdie Köln Südbahnhof',
    city: 'Köln',
    country: 'de',
    coordinates: { lat: 50.9213, lng: 6.9633 },
    deliveryPlatforms: [
      { name: 'wolt', url: 'https://wolt.com/en/deu/cologne/restaurant/birdie-birdie-sdbahnhof', displayName: 'Wolt' },
      { name: 'lieferando', url: 'https://www.lieferando.de/speisekarte/birdie-birdie-kln-sdbahnhof', displayName: 'Lieferando' },
    ],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'bb-leipzig-gohlis',
    chainId: 'birdie-birdie',
    chainName: 'Birdie Birdie Chicken',
    name: 'Birdie Birdie Leipzig Gohlis',
    city: 'Leipzig',
    country: 'de',
    coordinates: { lat: 51.3600, lng: 12.3700 },
    deliveryPlatforms: [
      { name: 'wolt', url: 'https://wolt.com/en/deu/leipzig/restaurant/birdie-birdie-chicken-gohlis', displayName: 'Wolt' },
      { name: 'lieferando', url: 'https://www.lieferando.de/speisekarte/birdie-birdie-chicken-gohlis', displayName: 'Lieferando' },
    ],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'bb-augsburg',
    chainId: 'birdie-birdie',
    chainName: 'Birdie Birdie Chicken',
    name: 'Birdie Birdie Augsburg',
    city: 'Augsburg',
    country: 'de',
    coordinates: { lat: 48.3705, lng: 10.8978 },
    deliveryPlatforms: [
      { name: 'wolt', url: 'https://wolt.com/en/deu/augsburg/restaurant/birdie-birdie-augsburg', displayName: 'Wolt' },
      { name: 'lieferando', url: 'https://www.lieferando.de/speisekarte/birdie-birdie-augsburg-1', displayName: 'Lieferando' },
    ],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'bb-duesseldorf',
    chainId: 'birdie-birdie',
    chainName: 'Birdie Birdie Chicken',
    name: 'Birdie Birdie Düsseldorf',
    city: 'Düsseldorf',
    country: 'de',
    coordinates: { lat: 51.2277, lng: 6.7735 },
    deliveryPlatforms: [
      { name: 'uber-eats', url: 'https://www.ubereats.com/de-en/store/birdie-birdie-chicken-derendorf/8I-MNxb8XIm_2G0jF7dxDg', displayName: 'Uber Eats' },
    ],
    plantedProducts: ['planted.chicken'],
  },

  // ============================================
  // KAIMUG - Thai Street Food
  // ============================================
  {
    id: 'kaimug-zurich-hb',
    chainId: 'kaimug',
    chainName: 'KAIMUG',
    name: 'KAIMUG Zürich HB',
    city: 'Zürich',
    country: 'ch',
    coordinates: { lat: 47.3779, lng: 8.5403 },
    deliveryPlatforms: [
      { name: 'smood', url: 'https://www.smood.ch/de/restaurants/kaimug-zurich', displayName: 'Smood' },
    ],
    plantedProducts: ['planted.chicken'],
    dishes: [
      { name: 'Thai-Gericht mit planted.chicken', description: 'planted chicken with broccoli, bamboo, carrots, mushrooms in soy sauce, jasmine rice', priceByCountry: { ch: 'CHF 22.90', de: '€16.90' }, plantedProduct: 'planted.chicken', isVegan: true },
    ],
  },
  {
    id: 'kaimug-wallisellen',
    chainId: 'kaimug',
    chainName: 'KAIMUG',
    name: 'KAIMUG Glattzentrum',
    city: 'Wallisellen',
    address: 'Neue Winterthurerstrasse 99',
    postalCode: '8304',
    country: 'ch',
    coordinates: { lat: 47.4150, lng: 8.5950 },
    deliveryPlatforms: [
      { name: 'smood', url: 'https://www.smood.ch/de/restaurants/kaimug-glattzentrum', displayName: 'Smood' },
    ],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'kaimug-munich',
    chainId: 'kaimug',
    chainName: 'KAIMUG',
    name: 'KAIMUG München Karlsplatz',
    city: 'München',
    address: 'Karlsplatz, 1. UG',
    postalCode: '80335',
    country: 'de',
    coordinates: { lat: 48.1392, lng: 11.5651 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  // ============================================
  // NOOCH ASIAN KITCHEN
  // ============================================
  {
    id: 'nooch-zurich-steinfels',
    chainId: 'nooch',
    chainName: 'Nooch Asian Kitchen',
    name: 'Nooch Steinfels',
    city: 'Zürich',
    address: 'Heinrichstrasse 267',
    country: 'ch',
    coordinates: { lat: 47.3900, lng: 8.5300 },
    deliveryPlatforms: [
      { name: 'uber-eats', url: 'https://www.ubereats.com/ch/store/nooch-asian-kitchen-steinfels', displayName: 'Uber Eats' },
    ],
    plantedProducts: ['planted.chicken'],
    dishes: [
      { name: 'Fried Rice with planted.chicken', description: 'Fried rice with planted chicken, vegetables, bean sprouts, chili, coriander', price: 'CHF 24.50', plantedProduct: 'planted.chicken', isVegan: true },
      { name: "Sweet'n'Sour planted.chicken", description: 'planted chicken in tempura batter with peppers, pineapple, sweet & sour sauce, jasmine rice', price: 'CHF 25.90', plantedProduct: 'planted.chicken', isVegan: true },
    ],
  },
  {
    id: 'nooch-zurich-badener',
    chainId: 'nooch',
    chainName: 'Nooch Asian Kitchen',
    name: 'Nooch Badenerstrasse',
    city: 'Zürich',
    country: 'ch',
    coordinates: { lat: 47.3769, lng: 8.5200 },
    deliveryPlatforms: [
      { name: 'uber-eats', url: 'https://www.ubereats.com/ch/store/nooch-asian-kitchen-badenerstrasse/KEEw39QXS4qeonR4BIC86w', displayName: 'Uber Eats' },
    ],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'nooch-basel',
    chainId: 'nooch',
    chainName: 'Nooch Asian Kitchen',
    name: 'Nooch Singerhaus',
    city: 'Basel',
    country: 'ch',
    coordinates: { lat: 47.5596, lng: 7.5886 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'nooch-bern',
    chainId: 'nooch',
    chainName: 'Nooch Asian Kitchen',
    name: 'Nooch Bern',
    city: 'Bern',
    address: 'Viktoriapl. 1',
    postalCode: '3013',
    country: 'ch',
    coordinates: { lat: 46.9480, lng: 7.4474 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },

  // ============================================
  // CHIDOBA MEXICAN GRILL
  // ============================================
  {
    id: 'chidoba-frankfurt-kaiser',
    chainId: 'chidoba',
    chainName: 'Chidoba Mexican Grill',
    name: 'Chidoba Frankfurt Kaiserstraße',
    city: 'Frankfurt',
    address: 'Kaiserstraße 49',
    postalCode: '60329',
    country: 'de',
    coordinates: { lat: 50.1072, lng: 8.6647 },
    deliveryPlatforms: [
      { name: 'wolt', url: 'https://wolt.com/en/deu/frankfurt/restaurant/chidoba-mexican-grill', displayName: 'Wolt' },
    ],
    plantedProducts: ['planted.chicken'],
    dishes: [
      { name: 'planted.chicken Burrito', description: 'planted.chicken with guacamole, salad, rice, beans, salsa', price: '€11.90', plantedProduct: 'planted.chicken', isVegan: true },
    ],
  },
  {
    id: 'chidoba-mainz',
    chainId: 'chidoba',
    chainName: 'Chidoba Mexican Grill',
    name: 'Chidoba Mainz',
    city: 'Mainz',
    address: 'Schillerstr. 50',
    postalCode: '55116',
    country: 'de',
    coordinates: { lat: 49.9929, lng: 8.2473 },
    deliveryPlatforms: [
      { name: 'lieferando', url: 'https://www.lieferando.de/speisekarte/chidoba-mainz', displayName: 'Lieferando' },
    ],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'chidoba-berlin',
    chainId: 'chidoba',
    chainName: 'Chidoba Mexican Grill',
    name: 'Chidoba Berlin Lichtenberg',
    city: 'Berlin',
    address: 'Prerower Platz 1',
    postalCode: '13051',
    country: 'de',
    coordinates: { lat: 52.5500, lng: 13.4900 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'chidoba-wiesbaden',
    chainId: 'chidoba',
    chainName: 'Chidoba Mexican Grill',
    name: 'Chidoba Wiesbaden',
    city: 'Wiesbaden',
    address: 'Bahnhofsplatz 3',
    postalCode: '65189',
    country: 'de',
    coordinates: { lat: 50.0703, lng: 8.2434 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },

  // ============================================
  // STADTSALAT
  // ============================================
  {
    id: 'stadtsalat-hamburg',
    chainId: 'stadtsalat',
    chainName: 'Stadtsalat',
    name: 'Stadtsalat Hamburg',
    city: 'Hamburg',
    address: 'Große Theaterstraße 31-35',
    postalCode: '20354',
    country: 'de',
    coordinates: { lat: 53.5575, lng: 9.9866 },
    deliveryPlatforms: [
      { name: 'uber-eats', url: 'https://www.ubereats.com/de/store/stadtsalat-salate-&-bowls-hamburg/cyWtPSydVQujqwBw5001IA', displayName: 'Uber Eats' },
      { name: 'wolt', url: 'https://wolt.com/en/deu/hamburg/restaurant/stadtsalat-hamburg', displayName: 'Wolt' },
    ],
    plantedProducts: ['planted.chicken'],
    dishes: [
      { name: 'Vegan Fit Planted', description: 'Quinoa, chickpea, planted chicken, broccoli, beetroot hummus, cashew', price: '€13.95', plantedProduct: 'planted.chicken', isVegan: true },
      { name: 'Mexican Taco Planted', description: 'Rice, planted chicken, sweet potato, black bean, guacamole, tortilla chips', price: '€13.95', plantedProduct: 'planted.chicken', isVegan: true },
    ],
  },
  {
    id: 'stadtsalat-berlin',
    chainId: 'stadtsalat',
    chainName: 'Stadtsalat',
    name: 'Stadtsalat Berlin Mitte',
    city: 'Berlin',
    country: 'de',
    coordinates: { lat: 52.5200, lng: 13.4050 },
    deliveryPlatforms: [
      { name: 'uber-eats', url: 'https://www.ubereats.com/de/store/stadtsalat-salate-&-bowls-berlin/LFmYSk-TXDSD64x310mgeA', displayName: 'Uber Eats' },
      { name: 'wolt', url: 'https://wolt.com/en/deu/berlin/restaurant/stadtsalat-berlin', displayName: 'Wolt' },
    ],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'stadtsalat-frankfurt',
    chainId: 'stadtsalat',
    chainName: 'Stadtsalat',
    name: 'Stadtsalat Frankfurt',
    city: 'Frankfurt',
    country: 'de',
    coordinates: { lat: 50.1109, lng: 8.6821 },
    deliveryPlatforms: [
      { name: 'uber-eats', url: 'https://www.ubereats.com/de/store/stadtsalat-frankfurt', displayName: 'Uber Eats' },
      { name: 'wolt', url: 'https://wolt.com/en/deu/frankfurt/restaurant/stadtsalat', displayName: 'Wolt' },
    ],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'stadtsalat-koeln',
    chainId: 'stadtsalat',
    chainName: 'Stadtsalat',
    name: 'Stadtsalat Köln',
    city: 'Köln',
    country: 'de',
    coordinates: { lat: 50.9375, lng: 6.9603 },
    deliveryPlatforms: [
      { name: 'uber-eats', url: 'https://www.ubereats.com/de/store/stadtsalat-koeln', displayName: 'Uber Eats' },
      { name: 'wolt', url: 'https://wolt.com/en/deu/cologne/restaurant/stadtsalat', displayName: 'Wolt' },
    ],
    plantedProducts: ['planted.chicken'],
  },

  // ============================================
  // DOEN DOEN PLANTED KEBAP
  // ============================================
  {
    id: 'doen-doen-stuttgart',
    chainId: 'doen-doen',
    chainName: 'doen doen planted kebap',
    name: 'doen doen Stuttgart',
    city: 'Stuttgart',
    address: 'Josef-Hirn-Platz 8',
    postalCode: '70173',
    country: 'de',
    coordinates: { lat: 48.7784, lng: 9.1760 },
    deliveryPlatforms: [
      { name: 'wolt', url: 'https://wolt.com/en/deu/stuttgart/restaurant/doen-doen-planted-kebap', displayName: 'Wolt' },
    ],
    plantedProducts: ['planted.kebab'],
    dishes: [
      { name: 'Planted Kebap Döner', description: 'Vegan döner with planted kebab, fresh salad, grilled vegetables, sauces', price: '€8.90', plantedProduct: 'planted.kebab', isVegan: true },
      { name: 'Planted Kebap Dürüm', description: 'Wrap with planted kebab, salad mix, grilled vegetables, herb-yogurt sauce', price: '€9.50', plantedProduct: 'planted.kebab', isVegan: true },
    ],
  },
  {
    id: 'doen-doen-berlin-fried',
    chainId: 'doen-doen',
    chainName: 'doen doen planted kebap',
    name: 'doen doen Berlin Friedrichshain',
    city: 'Berlin',
    country: 'de',
    coordinates: { lat: 52.5100, lng: 13.4540 },
    deliveryPlatforms: [
      { name: 'wolt', url: 'https://wolt.com/en/deu/berlin/district/friedrichshain/deu-doendoen', displayName: 'Wolt' },
      { name: 'uber-eats', url: 'https://www.ubereats.com/de/store/doen-doen-planted-kebap/sne7dq9YT3iXmoAkE4jtMQ', displayName: 'Uber Eats' },
    ],
    plantedProducts: ['planted.kebab'],
  },
  {
    id: 'doen-doen-berlin-prenzl',
    chainId: 'doen-doen',
    chainName: 'doen doen planted kebap',
    name: 'doen doen Berlin Prenzlauer Berg',
    city: 'Berlin',
    country: 'de',
    coordinates: { lat: 52.5390, lng: 13.4200 },
    deliveryPlatforms: [
      { name: 'wolt', url: 'https://wolt.com/en/deu/berlin/district/prenzlauer-berg/deu-doendoen', displayName: 'Wolt' },
    ],
    plantedProducts: ['planted.kebab'],
  },

  // ============================================
  // RÅBOWLS
  // ============================================
  {
    id: 'rabowls-hamburg-eppendorf',
    chainId: 'rabowls',
    chainName: 'råbowls',
    name: 'råbowls Eppendorf',
    city: 'Hamburg',
    country: 'de',
    coordinates: { lat: 53.5900, lng: 9.9800 },
    deliveryPlatforms: [
      { name: 'wolt', url: 'https://wolt.com/en/deu/hamburg/restaurant/rabowls-eppendorf', displayName: 'Wolt' },
      { name: 'lieferando', url: 'https://www.lieferando.de/speisekarte/rabowls-eppendorf', displayName: 'Lieferando' },
    ],
    plantedProducts: ['planted.chicken', 'planted.duck', 'planted.pulled'],
    dishes: [
      { name: 'Mad Mediterranean', description: 'Lemon-herbs planted.chicken bowl', price: '€14.90', plantedProduct: 'planted.chicken', isVegan: true },
      { name: 'Decadent Duck', description: 'Hoisin planted.duck bowl', price: '€15.90', plantedProduct: 'planted.duck', isVegan: true },
      { name: 'Cheating Chili', description: 'BBQ chili planted.pulled bowl', price: '€14.90', plantedProduct: 'planted.pulled', isVegan: true },
    ],
  },
  {
    id: 'rabowls-hamburg-winterhude',
    chainId: 'rabowls',
    chainName: 'råbowls',
    name: 'råbowls Winterhude',
    city: 'Hamburg',
    country: 'de',
    coordinates: { lat: 53.5950, lng: 10.0000 },
    deliveryPlatforms: [
      { name: 'wolt', url: 'https://wolt.com/en/deu/hamburg/restaurant/rabowls-winterhude', displayName: 'Wolt' },
      { name: 'lieferando', url: 'https://www.lieferando.de/speisekarte/rabowls-winterhude', displayName: 'Lieferando' },
    ],
    plantedProducts: ['planted.chicken', 'planted.duck', 'planted.pulled'],
  },

  // ============================================
  // BARBURRITO - UK Mexican Chain
  // ============================================
  {
    id: 'barburrito-edinburgh-airport',
    chainId: 'barburrito',
    chainName: 'Barburrito',
    name: 'Barburrito - Edinburgh Airport',
    city: 'Edinburgh',
    address: 'Departures, Edinburgh Airport',
    postalCode: 'EH12 9DN',
    country: 'uk',
    coordinates: { lat: 55.9481753, lng: -3.3647135 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
    dishes: [
      { name: 'Planted Chicken Burrito', description: 'Burrito with planted.chicken, rice, beans, salsa, guacamole', price: '£9.95', plantedProduct: 'planted.chicken', isVegan: true },
    ],
  },
  {
    id: 'barburrito-edinburgh-forrest-road',
    chainId: 'barburrito',
    chainName: 'Barburrito',
    name: 'Barburrito - Edinburgh Forrest Road',
    city: 'Edinburgh',
    address: '55 Forrest Road',
    postalCode: 'EH1 2QP',
    country: 'uk',
    coordinates: { lat: 55.9454548, lng: -3.191497 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'barburrito-glasgow-queen-street',
    chainId: 'barburrito',
    chainName: 'Barburrito',
    name: 'Barburrito - Glasgow Queen Street',
    city: 'Glasgow',
    address: '138 Queen Street',
    postalCode: 'G1 3BX',
    country: 'uk',
    coordinates: { lat: 55.8606211, lng: -4.2514455 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'barburrito-liverpool',
    chainId: 'barburrito',
    chainName: 'Barburrito',
    name: 'Barburrito - Liverpool',
    city: 'Liverpool',
    address: 'The Galleria, 14 Paradise Street',
    postalCode: 'L1 8JF',
    country: 'uk',
    coordinates: { lat: 53.4041807, lng: -2.9870867 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'barburrito-paddington-station',
    chainId: 'barburrito',
    chainName: 'Barburrito',
    name: 'Barburrito - Paddington Station',
    city: 'London',
    address: 'Unit 18, The Lawn, Paddington Station',
    postalCode: 'W2 1HB',
    country: 'uk',
    coordinates: { lat: 51.5159981, lng: -0.1766912 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'barburrito-manchester-airport-t2',
    chainId: 'barburrito',
    chainName: 'Barburrito',
    name: 'Barburrito - Manchester Airport T2',
    city: 'Manchester',
    address: 'Terminal 2 Departures, Manchester Airport',
    postalCode: 'M90 1QX',
    country: 'uk',
    coordinates: { lat: 53.3680295, lng: -2.2816847 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'barburrito-manchester-arndale',
    chainId: 'barburrito',
    chainName: 'Barburrito',
    name: 'Barburrito - Manchester Arndale',
    city: 'Manchester',
    address: 'Manchester Arndale',
    postalCode: 'M4 1AZ',
    country: 'uk',
    coordinates: { lat: 53.4835467, lng: -2.2420169 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'barburrito-manchester-piccadilly',
    chainId: 'barburrito',
    chainName: 'Barburrito',
    name: 'Barburrito - Manchester Piccadilly Gardens',
    city: 'Manchester',
    address: '1 Piccadilly Gardens',
    postalCode: 'M1 1RG',
    country: 'uk',
    coordinates: { lat: 53.480349, lng: -2.2364387 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'barburrito-trafford-centre',
    chainId: 'barburrito',
    chainName: 'Barburrito',
    name: 'Barburrito - Trafford Centre',
    city: 'Manchester',
    address: '134 The Orient, The Trafford Centre',
    postalCode: 'M17 8EH',
    country: 'uk',
    coordinates: { lat: 53.465808, lng: -2.347621 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'barburrito-nottingham',
    chainId: 'barburrito',
    chainName: 'Barburrito',
    name: 'Barburrito - Nottingham',
    city: 'Nottingham',
    address: '22 King Street',
    postalCode: 'NG1 2AS',
    country: 'uk',
    coordinates: { lat: 52.9546697, lng: -1.1493416 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'barburrito-sheffield-meadowhall',
    chainId: 'barburrito',
    chainName: 'Barburrito',
    name: 'Barburrito - Sheffield Meadowhall',
    city: 'Sheffield',
    address: 'Meadowhall Centre',
    postalCode: 'S9 1EP',
    country: 'uk',
    coordinates: { lat: 53.4139328, lng: -1.412974 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'barburrito-cardiff',
    chainId: 'barburrito',
    chainName: 'Barburrito',
    name: 'Barburrito - Cardiff',
    city: 'Cardiff',
    address: 'St Davids',
    postalCode: 'CF10 2EF',
    country: 'uk',
    coordinates: { lat: 51.4792748, lng: -3.1742173 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },

  // ============================================
  // BREZELKÖNIG - Swiss Pretzel Chain (51 locations)
  // ============================================
  {
    id: 'bk-aarau',
    chainId: 'brezelkoenig',
    chainName: 'Brezelkönig',
    name: 'Brezelkönig Bahnhofsplatz Aarau',
    city: 'Aarau',
    address: 'Bahnhofplatz 3',
    country: 'ch',
    coordinates: { lat: 47.39175150000001, lng: 8.0522683 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
    dishes: [
      { name: 'Baguette Planted Chicken Curry', description: 'Pretzel baguette with planted.chicken, Lollo Verde lettuce, and curry sauce', price: 'CHF 8.20', plantedProduct: 'planted.chicken', isVegan: true },
    ],
  },
  {
    id: 'bk-baden',
    chainId: 'brezelkoenig',
    chainName: 'Brezelkönig',
    name: 'Brezelkönig Bahnhof Baden',
    city: 'Baden',
    address: 'Bahnhof Baden Gleis 1',
    country: 'ch',
    coordinates: { lat: 47.4762321, lng: 8.3076213 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'bk-basel-globus',
    chainId: 'brezelkoenig',
    chainName: 'Brezelkönig',
    name: 'Brezelkönig Globus',
    city: 'Basel',
    address: 'Marktplatz 2',
    country: 'ch',
    coordinates: { lat: 47.5588986, lng: 7.5879691 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'bk-basel-passarelle',
    chainId: 'brezelkoenig',
    chainName: 'Brezelkönig',
    name: 'Brezelkönig Bahnhof Basel, Passarelle 9/10',
    city: 'Basel',
    address: 'Passarelle, Perron 09/10',
    country: 'ch',
    coordinates: { lat: 47.5469856, lng: 7.5891549 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'bk-bern-bollwerk',
    chainId: 'brezelkoenig',
    chainName: 'Brezelkönig',
    name: 'Brezelkönig Bahnhof Bern, Ausgang Bollwerk',
    city: 'Bern',
    address: 'Bahnhofplatz',
    country: 'ch',
    coordinates: { lat: 46.9492918, lng: 7.440233 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'bk-bern-perron',
    chainId: 'brezelkoenig',
    chainName: 'Brezelkönig',
    name: 'Brezelkönig Bahnhof Bern, Unterführung Perron 3/4',
    city: 'Bern',
    address: 'Unterführung, Perron 7/8',
    country: 'ch',
    coordinates: { lat: 46.9489354, lng: 7.437076999999999 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'bk-bern-welle',
    chainId: 'brezelkoenig',
    chainName: 'Brezelkönig',
    name: 'Brezelkönig Bahnhof Bern, Welle',
    city: 'Bern',
    address: 'Bern Welle',
    country: 'ch',
    coordinates: { lat: 46.9488345, lng: 7.4367046 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'bk-biel',
    chainId: 'brezelkoenig',
    chainName: 'Brezelkönig',
    name: 'Brezelkönig Biel',
    city: 'Biel',
    address: 'Bahnhofplatz 4',
    country: 'ch',
    coordinates: { lat: 47.1330258, lng: 7.242623300000001 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'bk-buelach',
    chainId: 'brezelkoenig',
    chainName: 'Brezelkönig',
    name: 'Brezelkönig Bülach',
    city: 'Bülach',
    address: 'Bahnhofring',
    country: 'ch',
    coordinates: { lat: 47.5232561, lng: 8.5372329 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'bk-chur',
    chainId: 'brezelkoenig',
    chainName: 'Brezelkönig',
    name: 'Brezelkönig Chur',
    city: 'Chur',
    address: 'Unterführung',
    country: 'ch',
    coordinates: { lat: 46.8536555, lng: 9.5298945 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'bk-dietikon',
    chainId: 'brezelkoenig',
    chainName: 'Brezelkönig',
    name: 'Brezelkönig Dietikon',
    city: 'Dietikon',
    address: 'Bahnhofplatz',
    country: 'ch',
    coordinates: { lat: 47.4061332, lng: 8.404715 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'bk-emmen',
    chainId: 'brezelkoenig',
    chainName: 'Brezelkönig',
    name: 'Brezelkönig Emmen',
    city: 'Emmen',
    address: 'Staufacherstrasse 1',
    country: 'ch',
    coordinates: { lat: 47.07412739999999, lng: 8.2871613 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'bk-frauenfeld',
    chainId: 'brezelkoenig',
    chainName: 'Brezelkönig',
    name: 'Brezelkönig Frauenfeld',
    city: 'Frauenfeld',
    address: 'Bahnhofplatz 75',
    country: 'ch',
    coordinates: { lat: 47.5579638, lng: 8.8963606 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'bk-fribourg',
    chainId: 'brezelkoenig',
    chainName: 'Brezelkönig',
    name: 'Brezelkönig Gare de Fribourg',
    city: 'Fribourg',
    address: 'Place de la gare 1',
    country: 'ch',
    coordinates: { lat: 46.8033337, lng: 7.150662 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'bk-geneve-cornavin',
    chainId: 'brezelkoenig',
    chainName: 'Brezelkönig',
    name: 'Brezelkönig Genève Cornavin',
    city: 'Genève',
    address: 'West, 3 Place Cornavin',
    country: 'ch',
    coordinates: { lat: 46.2101704, lng: 6.1418881 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'bk-geneve-eaux-vives',
    chainId: 'brezelkoenig',
    chainName: 'Brezelkönig',
    name: 'Brezelkönig Avenue de la gare des Eaux-Vives, Genève',
    city: 'Genève',
    address: 'Avenue De la Gare des Eaux-Vives 11',
    country: 'ch',
    coordinates: { lat: 46.2009836, lng: 6.1664615 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'bk-kloten-checkin',
    chainId: 'brezelkoenig',
    chainName: 'Brezelkönig',
    name: 'Brezelkönig Flughafen Check-in',
    city: 'Kloten',
    address: 'Check in, Halle 3',
    country: 'ch',
    coordinates: { lat: 47.451049, lng: 8.5607645 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'bk-kloten-airside',
    chainId: 'brezelkoenig',
    chainName: 'Brezelkönig',
    name: 'Brezelkönig Flughafen Zürich, Airside Center',
    city: 'Kloten',
    address: 'Airside Center, Level 1',
    country: 'ch',
    coordinates: { lat: 47.45240219999999, lng: 8.560831199999999 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'bk-lausanne-gare',
    chainId: 'brezelkoenig',
    chainName: 'Brezelkönig',
    name: 'Brezelkönig Lausanne Gare',
    city: 'Lausanne',
    address: 'Place de la Gare 3',
    country: 'ch',
    coordinates: { lat: 46.5169106, lng: 6.630292499999999 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'bk-lausanne-europe',
    chainId: 'brezelkoenig',
    chainName: 'Brezelkönig',
    name: "Brezelkönig Place de l'Europe 3, Lausanne",
    city: 'Lausanne',
    address: 'Voie du Chariot 5-7',
    country: 'ch',
    coordinates: { lat: 46.5202153, lng: 6.6303053 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'bk-lenzburg',
    chainId: 'brezelkoenig',
    chainName: 'Brezelkönig',
    name: 'Brezelkönig Lenzburg',
    city: 'Lenzburg',
    address: 'Bahnhofstrasse 60',
    country: 'ch',
    coordinates: { lat: 47.3910913, lng: 8.170365199999999 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'bk-lugano-nassa',
    chainId: 'brezelkoenig',
    chainName: 'Brezelkönig',
    name: 'Brezelkönig Lugano Via Nassa',
    city: 'Lugano',
    address: 'via Nassa 22',
    country: 'ch',
    coordinates: { lat: 46.0027341, lng: 8.9498616 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'bk-lugano-stazione',
    chainId: 'brezelkoenig',
    chainName: 'Brezelkönig',
    name: 'Brezelkönig Stazione Lugano FFS',
    city: 'Lugano',
    address: 'Palazzo della stazione',
    country: 'ch',
    coordinates: { lat: 46.0052855, lng: 8.946876999999999 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'bk-luzern',
    chainId: 'brezelkoenig',
    chainName: 'Brezelkönig',
    name: 'Brezelkönig Luzern',
    city: 'Luzern',
    address: 'Bahnhofplatz 1',
    country: 'ch',
    coordinates: { lat: 47.0502942, lng: 8.310271900000002 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'bk-morges',
    chainId: 'brezelkoenig',
    chainName: 'Brezelkönig',
    name: 'Brezelkönig Gare de Morges',
    city: 'Morges',
    address: 'Place de la gare 2',
    country: 'ch',
    coordinates: { lat: 46.51105810000001, lng: 6.4940361 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'bk-neuchatel',
    chainId: 'brezelkoenig',
    chainName: 'Brezelkönig',
    name: 'Brezelkönig Gare de Neuchâtel',
    city: 'Neuchâtel',
    address: 'Place de la gare',
    country: 'ch',
    coordinates: { lat: 46.99654109999999, lng: 6.9359327 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'bk-olten',
    chainId: 'brezelkoenig',
    chainName: 'Brezelkönig',
    name: 'Brezelkönig Olten',
    city: 'Olten',
    address: 'Geissfluhweg 19',
    country: 'ch',
    coordinates: { lat: 47.3515709, lng: 7.9070942 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'bk-rapperswil',
    chainId: 'brezelkoenig',
    chainName: 'Brezelkönig',
    name: 'Brezelkönig Rapperswil-Jona',
    city: 'Rapperswil-Jona',
    address: 'Bahnhofplatz',
    country: 'ch',
    coordinates: { lat: 47.2250613, lng: 8.8171727 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'bk-schaffhausen',
    chainId: 'brezelkoenig',
    chainName: 'Brezelkönig',
    name: 'Brezelkönig Bahnhof Schaffhausen, Unterführung',
    city: 'Schaffhausen',
    address: 'Areal Süd',
    country: 'ch',
    coordinates: { lat: 47.6985628, lng: 8.6334541 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'bk-solothurn',
    chainId: 'brezelkoenig',
    chainName: 'Brezelkönig',
    name: 'Brezelkönig Bahnhof Solothurn, Unterführung',
    city: 'Solothurn',
    address: 'Unterführung',
    country: 'ch',
    coordinates: { lat: 47.2040739, lng: 7.543239199999999 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'bk-stgallen-multergasse',
    chainId: 'brezelkoenig',
    chainName: 'Brezelkönig',
    name: 'Brezelkönig St. Gallen Multergasse',
    city: 'St. Gallen',
    address: 'Multergasse 47',
    country: 'ch',
    coordinates: { lat: 47.4234427, lng: 9.3742783 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'bk-stgallen-bahnhof',
    chainId: 'brezelkoenig',
    chainName: 'Brezelkönig',
    name: 'Brezelkönig Bahnhof St. Gallen, Unterführung Ost',
    city: 'St. Gallen',
    address: 'Bahnhofplatz 2 Personenunterführung Ost',
    country: 'ch',
    coordinates: { lat: 47.4236866, lng: 9.3698858 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'bk-stgallen-bahnhofsplatz',
    chainId: 'brezelkoenig',
    chainName: 'Brezelkönig',
    name: 'Brezelkönig Bahnhofsplatz 8, St. Gallen',
    city: 'St. Gallen',
    address: 'Bahnhofplatz 8',
    country: 'ch',
    coordinates: { lat: 47.422353, lng: 9.368622199999999 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'bk-thun',
    chainId: 'brezelkoenig',
    chainName: 'Brezelkönig',
    name: 'Brezelkönig Thun',
    city: 'Thun',
    address: 'Seestrasse 2',
    country: 'ch',
    coordinates: { lat: 46.7548939, lng: 7.629724299999999 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'bk-schoenbuhl',
    chainId: 'brezelkoenig',
    chainName: 'Brezelkönig',
    name: 'Brezelkönig Im Shoppyland, Schönbühl',
    city: 'Urtenen-Schönbühl',
    address: 'Industriestrasse',
    country: 'ch',
    coordinates: { lat: 47.0168427, lng: 7.492344999999999 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'bk-uster',
    chainId: 'brezelkoenig',
    chainName: 'Brezelkönig',
    name: 'Brezelkönig Uster',
    city: 'Uster',
    address: 'Bankstrasse',
    country: 'ch',
    coordinates: { lat: 47.3505936, lng: 8.718301499999999 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'bk-vevey',
    chainId: 'brezelkoenig',
    chainName: 'Brezelkönig',
    name: 'Brezelkönig Vevey',
    city: 'Vevey',
    address: 'Avenue General Guisan 15',
    country: 'ch',
    coordinates: { lat: 46.4630772, lng: 6.8408069 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'bk-waedenswil',
    chainId: 'brezelkoenig',
    chainName: 'Brezelkönig',
    name: 'Brezelkönig Wädenswil',
    city: 'Wädenswil',
    address: 'Bahnhofstrasse 4',
    country: 'ch',
    coordinates: { lat: 47.2293916, lng: 8.6750244 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'bk-wallisellen',
    chainId: 'brezelkoenig',
    chainName: 'Brezelkönig',
    name: 'Brezelkönig Glattzentrum, Wallisellen',
    city: 'Wallisellen',
    address: 'Neue Winterthurerstrasse 99',
    country: 'ch',
    coordinates: { lat: 47.40845340000001, lng: 8.5960556 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'bk-wil',
    chainId: 'brezelkoenig',
    chainName: 'Brezelkönig',
    name: 'Brezelkönig Bahnhofsplatz Wil',
    city: 'Wil',
    address: 'Bahnhofplatz 1',
    country: 'ch',
    coordinates: { lat: 47.4624183, lng: 9.0417544 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'bk-winterthur',
    chainId: 'brezelkoenig',
    chainName: 'Brezelkönig',
    name: 'Brezelkönig Bahnhof Winterthur, Unterführung',
    city: 'Winterthur',
    address: 'Bahnhofplatz 5',
    country: 'ch',
    coordinates: { lat: 47.49974779999999, lng: 8.7233732 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'bk-zermatt',
    chainId: 'brezelkoenig',
    chainName: 'Brezelkönig',
    name: 'Brezelkönig Zermatt',
    city: 'Zermatt',
    address: 'Bahnhofplatz 3',
    country: 'ch',
    coordinates: { lat: 46.0239804, lng: 7.7477428 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'bk-zug-industrie',
    chainId: 'brezelkoenig',
    chainName: 'Brezelkönig',
    name: 'Brezelkönig Zug Industriestrasse',
    city: 'Zug',
    address: 'Industriestrasse 15b',
    country: 'ch',
    coordinates: { lat: 47.1730695, lng: 8.5179264 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'bk-zug-bahnhof',
    chainId: 'brezelkoenig',
    chainName: 'Brezelkönig',
    name: 'Brezelkönig Bahnhof Zug',
    city: 'Zug',
    address: 'Bahnhofplatz',
    country: 'ch',
    coordinates: { lat: 47.1736681, lng: 8.5153356 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'bk-zurich-altstetten',
    chainId: 'brezelkoenig',
    chainName: 'Brezelkönig',
    name: 'Brezelkönig Zürich Altstetten',
    city: 'Zürich',
    address: 'Altstetterplatz 11',
    country: 'ch',
    coordinates: { lat: 47.3915154, lng: 8.4886078 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'bk-zurich-hb-shopville',
    chainId: 'brezelkoenig',
    chainName: 'Brezelkönig',
    name: 'Brezelkönig Zürich HB, Shopville',
    city: 'Zürich',
    address: 'Tessinerplatz 10',
    country: 'ch',
    coordinates: { lat: 47.3777511, lng: 8.538122699999999 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'bk-zurich-hardbruecke',
    chainId: 'brezelkoenig',
    chainName: 'Brezelkönig',
    name: 'Brezelkönig Zürich Hardbrücke',
    city: 'Zürich',
    address: 'Hardbrücke',
    country: 'ch',
    coordinates: { lat: 47.3853205, lng: 8.5169876 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'bk-zurich-landesmuseum',
    chainId: 'brezelkoenig',
    chainName: 'Brezelkönig',
    name: 'Brezelkönig Zürich Landesmuseum',
    city: 'Zürich',
    address: 'Museumstrasse 1',
    country: 'ch',
    coordinates: { lat: 47.3792331, lng: 8.5362831 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'bk-zurich-sihlquai',
    chainId: 'brezelkoenig',
    chainName: 'Brezelkönig',
    name: 'Brezelkönig Zürich HB, Unterführung Sihlquai',
    city: 'Zürich',
    address: 'Sihlquai Unterführung',
    country: 'ch',
    coordinates: { lat: 47.3788315, lng: 8.536961699999999 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'bk-zurich-oerlikon',
    chainId: 'brezelkoenig',
    chainName: 'Brezelkönig',
    name: 'Brezelkönig Bahnhof Oerlikon, Unterführung Ost',
    city: 'Zürich',
    address: 'Hofwiesenstrasse 369',
    country: 'ch',
    coordinates: { lat: 47.4124299, lng: 8.5455934 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
  {
    id: 'bk-zurich-stadelhofen',
    chainId: 'brezelkoenig',
    chainName: 'Brezelkönig',
    name: 'Brezelkönig Zürich Stadelhofen',
    city: 'Zürich',
    address: 'Stadelhoferstrasse 8',
    country: 'ch',
    coordinates: { lat: 47.3664114, lng: 8.5488009 },
    deliveryPlatforms: [],
    plantedProducts: ['planted.chicken'],
  },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Calculate distance between two points using Haversine formula
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Get chain locations filtered by country
 */
export function getLocationsByCountry(country: string): ChainLocation[] {
  const countryCode = country.toLowerCase();
  return chainLocations.filter(loc => loc.country === countryCode);
}

/**
 * Get the closest location for each chain from a given point
 */
export function getClosestChainLocations(
  lat: number,
  lng: number,
  country?: string
): (ChainLocation & { distance: number })[] {
  // Filter by country if provided
  let locations = country ? getLocationsByCountry(country) : chainLocations;

  // Calculate distances
  const locationsWithDistance = locations.map(loc => ({
    ...loc,
    distance: calculateDistance(lat, lng, loc.coordinates.lat, loc.coordinates.lng),
  }));

  // Group by chain and get closest for each
  const chainMap = new Map<string, ChainLocation & { distance: number }>();

  for (const loc of locationsWithDistance) {
    const existing = chainMap.get(loc.chainId);
    if (!existing || loc.distance < existing.distance) {
      chainMap.set(loc.chainId, loc);
    }
  }

  // Sort by distance
  return Array.from(chainMap.values()).sort((a, b) => a.distance - b.distance);
}

/**
 * Get all locations sorted by distance
 */
export function getAllLocationsByDistance(
  lat: number,
  lng: number,
  country?: string
): (ChainLocation & { distance: number })[] {
  let locations = country ? getLocationsByCountry(country) : chainLocations;

  return locations
    .map(loc => ({
      ...loc,
      distance: calculateDistance(lat, lng, loc.coordinates.lat, loc.coordinates.lng),
    }))
    .sort((a, b) => a.distance - b.distance);
}

/**
 * Format distance for display
 */
export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)}m`;
  }
  return `${km.toFixed(1)}km`;
}

/**
 * Get chain by ID
 */
export function getChainById(chainId: string): Chain | undefined {
  return chains.find(c => c.id === chainId);
}

/**
 * Get dish price for a specific country
 * Falls back to default price if country-specific price not available
 */
export function getDishPrice(dish: ChainDish, country: 'ch' | 'de' | 'at' | 'lu' | 'uk' | 'nl'): string | undefined {
  if (dish.priceByCountry && dish.priceByCountry[country]) {
    return dish.priceByCountry[country];
  }
  return dish.price;
}

// Platform colors for UI
export const chainPlatformColors: Record<string, string> = {
  'wolt': '#00C2E8',
  'lieferando': '#FF8000',
  'uber-eats': '#06C167',
  'just-eat': '#FF5A00',
  'smood': '#E91E63',
};

// ============================================
// MERGED LOCATIONS (Manual + Discovered)
// ============================================

/**
 * All chain locations merged from manual curation and smart discovery
 * Deduplicates by URL to avoid showing the same location twice
 */
export const allChainLocations: ChainLocation[] = (() => {
  const seenUrls = new Set<string>();
  const merged: ChainLocation[] = [];

  // Add manual locations first (higher priority)
  for (const loc of chainLocations) {
    const url = loc.deliveryPlatforms[0]?.url;
    if (url && !seenUrls.has(url)) {
      seenUrls.add(url);
      merged.push(loc);
    } else if (!url) {
      // Include locations without delivery URLs (in-store only)
      merged.push(loc);
    }
  }

  // Add discovered locations (skip duplicates)
  for (const loc of discoveredChainLocations) {
    const url = loc.deliveryPlatforms[0]?.url;
    if (url && !seenUrls.has(url)) {
      seenUrls.add(url);
      merged.push(loc);
    }
  }

  return merged;
})();

/**
 * Get all locations (merged) sorted by distance
 */
export function getAllMergedLocationsByDistance(
  lat: number,
  lng: number,
  country?: string
): (ChainLocation & { distance: number })[] {
  let locations = country
    ? allChainLocations.filter(loc => loc.country === country.toLowerCase())
    : allChainLocations;

  return locations
    .map(loc => ({
      ...loc,
      distance: calculateDistance(lat, lng, loc.coordinates.lat, loc.coordinates.lng),
    }))
    .sort((a, b) => a.distance - b.distance);
}

/**
 * Get the closest location for each chain from merged locations
 */
export function getClosestMergedChainLocations(
  lat: number,
  lng: number,
  country?: string
): (ChainLocation & { distance: number })[] {
  let locations = country
    ? allChainLocations.filter(loc => loc.country === country.toLowerCase())
    : allChainLocations;

  // Calculate distances
  const locationsWithDistance = locations.map(loc => ({
    ...loc,
    distance: calculateDistance(lat, lng, loc.coordinates.lat, loc.coordinates.lng),
  }));

  // Group by chain and get closest for each
  const chainMap = new Map<string, ChainLocation & { distance: number }>();

  for (const loc of locationsWithDistance) {
    const existing = chainMap.get(loc.chainId);
    if (!existing || loc.distance < existing.distance) {
      chainMap.set(loc.chainId, loc);
    }
  }

  // Sort by distance
  return Array.from(chainMap.values()).sort((a, b) => a.distance - b.distance);
}
