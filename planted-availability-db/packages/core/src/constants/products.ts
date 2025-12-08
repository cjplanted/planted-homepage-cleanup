import type { Product, ProductCategory } from '../types/product.js';

/**
 * Planted product catalog - reference data for scraper matching
 */
export const PLANTED_PRODUCTS: Product[] = [
  // Chicken
  {
    sku: 'PLANTED-CHICKEN-NATURE-200G',
    name: { de: 'planted.chicken Nature', en: 'planted.chicken Nature', fr: 'planted.chicken Nature' },
    category: 'chicken',
    variant: 'nature',
    weight_grams: 200,
    image_url: 'https://storage.googleapis.com/pad-images/products/chicken-nature.webp',
    markets: ['CH', 'DE', 'AT', 'FR', 'IT', 'NL', 'UK', 'ES'],
    retail_only: false,
    active: true,
  },
  {
    sku: 'PLANTED-CHICKEN-LEMON-HERBS-200G',
    name: { de: 'planted.chicken Zitrone & Kräuter', en: 'planted.chicken Lemon Herbs', fr: 'planted.chicken Citron & Herbes' },
    category: 'chicken',
    variant: 'lemon-herbs',
    weight_grams: 200,
    image_url: 'https://storage.googleapis.com/pad-images/products/chicken-lemon-herbs.webp',
    markets: ['CH', 'DE', 'AT', 'FR', 'IT', 'NL', 'UK', 'ES'],
    retail_only: false,
    active: true,
  },
  {
    sku: 'PLANTED-CHICKEN-JERUSALEM-200G',
    name: { de: 'planted.chicken Jerusalem Style', en: 'planted.chicken Jerusalem Style', fr: 'planted.chicken Style Jérusalem' },
    category: 'chicken',
    variant: 'jerusalem-style',
    weight_grams: 200,
    image_url: 'https://storage.googleapis.com/pad-images/products/chicken-jerusalem.webp',
    markets: ['CH', 'DE', 'AT'],
    retail_only: false,
    active: true,
  },
  {
    sku: 'PLANTED-CHICKEN-CRISPY-STRIPS-200G',
    name: { de: 'planted.chicken Crispy Strips', en: 'planted.chicken Crispy Strips', fr: 'planted.chicken Crispy Strips' },
    category: 'chicken',
    variant: 'crispy-strips',
    weight_grams: 200,
    image_url: 'https://storage.googleapis.com/pad-images/products/chicken-crispy-strips.webp',
    markets: ['CH', 'DE', 'AT', 'UK'],
    retail_only: true,
    active: true,
  },
  {
    sku: 'PLANTED-CHICKEN-BURGER-220G',
    name: { de: 'planted.chicken Burger', en: 'planted.chicken Burger', fr: 'planted.chicken Burger' },
    category: 'chicken',
    variant: 'burger',
    weight_grams: 220,
    image_url: 'https://storage.googleapis.com/pad-images/products/chicken-burger.webp',
    markets: ['CH', 'DE', 'AT', 'FR'],
    retail_only: false,
    active: true,
  },

  // Kebab
  {
    sku: 'PLANTED-KEBAB-ORIGINAL-200G',
    name: { de: 'planted.kebab Original', en: 'planted.kebab Original', fr: 'planted.kebab Original' },
    category: 'kebab',
    variant: 'original',
    weight_grams: 200,
    image_url: 'https://storage.googleapis.com/pad-images/products/kebab-original.webp',
    markets: ['CH', 'DE', 'AT', 'FR', 'NL'],
    retail_only: false,
    active: true,
  },

  // Pulled
  {
    sku: 'PLANTED-PULLED-BBQ-200G',
    name: { de: 'planted.pulled BBQ', en: 'planted.pulled BBQ', fr: 'planted.pulled BBQ' },
    category: 'pulled',
    variant: 'bbq',
    weight_grams: 200,
    image_url: 'https://storage.googleapis.com/pad-images/products/pulled-bbq.webp',
    markets: ['CH', 'DE', 'AT', 'FR', 'UK'],
    retail_only: false,
    active: true,
  },
  {
    sku: 'PLANTED-PULLED-SPICY-HERBS-200G',
    name: { de: 'planted.pulled Spicy Herbs', en: 'planted.pulled Spicy Herbs', fr: 'planted.pulled Épices & Herbes' },
    category: 'pulled',
    variant: 'spicy-herbs',
    weight_grams: 200,
    image_url: 'https://storage.googleapis.com/pad-images/products/pulled-spicy-herbs.webp',
    markets: ['CH', 'DE', 'AT'],
    retail_only: false,
    active: true,
  },

  // Schnitzel
  {
    sku: 'PLANTED-SCHNITZEL-WIENER-200G',
    name: { de: 'planted.schnitzel Wiener Art', en: 'planted.schnitzel Vienna Style', fr: 'planted.schnitzel Viennois' },
    category: 'schnitzel',
    variant: 'wiener-art',
    weight_grams: 200,
    image_url: 'https://storage.googleapis.com/pad-images/products/schnitzel-wiener.webp',
    markets: ['CH', 'DE', 'AT'],
    retail_only: true,
    active: true,
  },
  {
    sku: 'PLANTED-SCHNITZEL-CLASSIC-200G',
    name: { de: 'planted.schnitzel Classic', en: 'planted.schnitzel Classic', fr: 'planted.schnitzel Classic' },
    category: 'schnitzel',
    variant: 'classic',
    weight_grams: 200,
    image_url: 'https://storage.googleapis.com/pad-images/products/schnitzel-classic.webp',
    markets: ['CH', 'DE', 'AT'],
    retail_only: true,
    active: true,
  },

  // Bratwurst
  {
    sku: 'PLANTED-BRATWURST-ORIGINAL-200G',
    name: { de: 'planted.bratwurst Original', en: 'planted.bratwurst Original', fr: 'planted.bratwurst Original' },
    category: 'bratwurst',
    variant: 'original',
    weight_grams: 200,
    image_url: 'https://storage.googleapis.com/pad-images/products/bratwurst-original.webp',
    markets: ['CH', 'DE', 'AT'],
    retail_only: true,
    active: true,
  },
  {
    sku: 'PLANTED-BRATWURST-HERBS-200G',
    name: { de: 'planted.bratwurst Kräuter', en: 'planted.bratwurst Herbs', fr: 'planted.bratwurst Herbes' },
    category: 'bratwurst',
    variant: 'herbs',
    weight_grams: 200,
    image_url: 'https://storage.googleapis.com/pad-images/products/bratwurst-herbs.webp',
    markets: ['CH', 'DE', 'AT'],
    retail_only: true,
    active: true,
  },

  // Steak
  {
    sku: 'PLANTED-STEAK-CLASSIC-200G',
    name: { de: 'planted.steak Classic', en: 'planted.steak Classic', fr: 'planted.steak Classic' },
    category: 'steak',
    variant: 'classic',
    weight_grams: 200,
    image_url: 'https://storage.googleapis.com/pad-images/products/steak-classic.webp',
    markets: ['CH', 'DE', 'AT', 'FR'],
    retail_only: false,
    active: true,
  },
  {
    sku: 'PLANTED-STEAK-PAPRIKA-200G',
    name: { de: 'planted.steak Paprika', en: 'planted.steak Paprika', fr: 'planted.steak Paprika' },
    category: 'steak',
    variant: 'paprika',
    weight_grams: 200,
    image_url: 'https://storage.googleapis.com/pad-images/products/steak-paprika.webp',
    markets: ['CH', 'DE', 'AT'],
    retail_only: false,
    active: true,
  },

  // Duck
  {
    sku: 'PLANTED-DUCK-ASIAN-200G',
    name: { de: 'planted.duck Asian Style', en: 'planted.duck Asian Style', fr: 'planted.duck Style Asiatique' },
    category: 'duck',
    variant: 'asian-style',
    weight_grams: 200,
    image_url: 'https://storage.googleapis.com/pad-images/products/duck-asian.webp',
    markets: ['CH', 'DE'],
    retail_only: false,
    active: true,
  },

  // Skewers
  {
    sku: 'PLANTED-SKEWERS-HERBS-200G',
    name: { de: 'planted.skewers Kräuter', en: 'planted.skewers Herbs', fr: 'planted.skewers Herbes' },
    category: 'skewers',
    variant: 'herbs',
    weight_grams: 200,
    image_url: 'https://storage.googleapis.com/pad-images/products/skewers-herbs.webp',
    markets: ['CH', 'DE', 'AT'],
    retail_only: true,
    active: true,
  },
  {
    sku: 'PLANTED-SKEWERS-TANDOORI-200G',
    name: { de: 'planted.skewers Tandoori', en: 'planted.skewers Tandoori', fr: 'planted.skewers Tandoori' },
    category: 'skewers',
    variant: 'tandoori',
    weight_grams: 200,
    image_url: 'https://storage.googleapis.com/pad-images/products/skewers-tandoori.webp',
    markets: ['CH', 'DE', 'AT'],
    retail_only: true,
    active: true,
  },

  // Filetwürfel
  {
    sku: 'PLANTED-FILETWUERFEL-CLASSIC-200G',
    name: { de: 'planted.filetwürfel Classic', en: 'planted.cubes Classic', fr: 'planted.cubes Classic' },
    category: 'filetwuerfel',
    variant: 'classic',
    weight_grams: 200,
    image_url: 'https://storage.googleapis.com/pad-images/products/filetwuerfel-classic.webp',
    markets: ['CH', 'DE', 'AT'],
    retail_only: false,
    active: true,
  },
  {
    sku: 'PLANTED-FILETWUERFEL-MEXICANA-200G',
    name: { de: 'planted.filetwürfel A La Mexicana', en: 'planted.cubes A La Mexicana', fr: 'planted.cubes A La Mexicana' },
    category: 'filetwuerfel',
    variant: 'a-la-mexicana',
    weight_grams: 200,
    image_url: 'https://storage.googleapis.com/pad-images/products/filetwuerfel-mexicana.webp',
    markets: ['CH', 'DE', 'AT'],
    retail_only: false,
    active: true,
  },

  // Burger
  {
    sku: 'PLANTED-BURGER-CRISPY-220G',
    name: { de: 'planted.burger Crispy', en: 'planted.burger Crispy', fr: 'planted.burger Crispy' },
    category: 'burger',
    variant: 'crispy',
    weight_grams: 220,
    image_url: 'https://storage.googleapis.com/pad-images/products/burger-crispy.webp',
    markets: ['CH', 'DE', 'AT', 'FR', 'UK'],
    retail_only: false,
    active: true,
  },

  // Nuggets
  {
    sku: 'PLANTED-NUGGETS-CLASSIC-200G',
    name: { de: 'planted.nuggets Classic', en: 'planted.nuggets Classic', fr: 'planted.nuggets Classic' },
    category: 'nuggets',
    variant: 'classic',
    weight_grams: 200,
    image_url: 'https://storage.googleapis.com/pad-images/products/nuggets-classic.webp',
    markets: ['CH', 'DE', 'AT', 'UK'],
    retail_only: true,
    active: true,
  },
];

/**
 * Keywords for scraper matching (multiple languages)
 */
export const PRODUCT_KEYWORDS: Record<ProductCategory, string[]> = {
  chicken: ['planted chicken', 'planted.chicken', 'planted huhn', 'planted poulet'],
  steak: ['planted steak', 'planted.steak'],
  pulled: ['planted pulled', 'planted.pulled'],
  kebab: ['planted kebab', 'planted.kebab', 'planted döner', 'planted doner'],
  schnitzel: ['planted schnitzel', 'planted.schnitzel'],
  bratwurst: ['planted bratwurst', 'planted.bratwurst', 'planted wurst'],
  duck: ['planted duck', 'planted.duck', 'planted ente', 'planted canard'],
  skewers: ['planted skewers', 'planted.skewers', 'planted spiesse'],
  filetwuerfel: ['planted filetwürfel', 'planted.filetwürfel', 'planted cubes', 'planted würfel'],
  burger: ['planted burger', 'planted.burger'],
  nuggets: ['planted nuggets', 'planted.nuggets'],
};

/**
 * Get product by SKU
 */
export function getProductBySku(sku: string): Product | undefined {
  return PLANTED_PRODUCTS.find((p) => p.sku === sku);
}

/**
 * Get products by category
 */
export function getProductsByCategory(category: ProductCategory): Product[] {
  return PLANTED_PRODUCTS.filter((p) => p.category === category);
}

/**
 * Get products available in a market
 */
export function getProductsByMarket(countryCode: string): Product[] {
  return PLANTED_PRODUCTS.filter((p) => p.markets.includes(countryCode) && p.active);
}

/**
 * Get all active SKUs
 */
export function getAllActiveSkus(): string[] {
  return PLANTED_PRODUCTS.filter((p) => p.active).map((p) => p.sku);
}
