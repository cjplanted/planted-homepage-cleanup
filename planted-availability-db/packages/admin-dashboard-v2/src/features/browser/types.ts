/**
 * Browser Feature Types
 *
 * Type definitions for the Venue Browser feature.
 */

/**
 * View Mode
 */
export type ViewMode = 'tree' | 'table' | 'cards';

/**
 * Status Filter
 */
export type StatusFilter = 'all' | 'live' | 'pending' | 'rejected';

/**
 * Venue Status
 */
export type VenueStatus = 'live' | 'pending' | 'rejected';

/**
 * Venue Type
 */
export type VenueType = 'restaurant' | 'cafe' | 'hotel' | 'food_truck' | 'catering' | 'other';

/**
 * Delivery Platform
 */
export type DeliveryPlatform = 'uber_eats' | 'deliveroo' | 'wolt' | 'just_eat' | 'doordash' | 'other';

/**
 * Product Type
 */
export type ProductType =
  | 'planted.chicken'
  | 'planted.pulled'
  | 'planted.kebab'
  | 'planted.schnitzel'
  | 'planted.burger'
  | 'planted.other';

/**
 * Browser Dish
 */
export interface BrowserDish {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  imageUrl?: string;
  productType: ProductType;
  availability: boolean;
  lastUpdated: string; // ISO date string
}

/**
 * Platform Link
 */
export interface PlatformLink {
  platform: DeliveryPlatform;
  url: string;
  isActive: boolean;
}

/**
 * Browser Venue
 */
export interface BrowserVenue {
  id: string;
  name: string;
  chain?: string;
  venueType: VenueType;
  status: VenueStatus;
  address: string;
  city: string;
  country: string;
  countryCode: string; // ISO 3166-1 alpha-2
  coordinates?: {
    lat: number;
    lng: number;
  };
  dishes: BrowserDish[];
  platforms: PlatformLink[];
  dishCount: number;
  liveAt?: string; // ISO date string
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

/**
 * Browser Filters
 */
export interface BrowserFilters {
  status?: StatusFilter;
  country?: string;
  chain?: string;
  venueType?: VenueType;
  platform?: DeliveryPlatform;
  search?: string;
  sortBy?: 'name' | 'city' | 'dishCount' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Browser Stats
 */
export interface BrowserStats {
  total: number;
  live: number;
  pending: number;
  rejected: number;
  byCountry: Record<string, number>;
  byVenueType: Record<string, number>;
  byChain: Record<string, number>;
  totalDishes: number;
}

/**
 * Hierarchy Node
 */
export interface BrowserHierarchyNode {
  id: string;
  type: 'country' | 'venueType' | 'chain' | 'venue';
  label: string;
  count: number;
  children?: BrowserHierarchyNode[];
  venue?: BrowserVenue; // Only for venue nodes
  expanded?: boolean; // Client-side state
}

/**
 * Browser Response
 */
export interface BrowserResponse {
  venues: BrowserVenue[];
  hierarchy: BrowserHierarchyNode[];
  stats: BrowserStats;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

/**
 * Country Emoji Mapping
 */
export const COUNTRY_EMOJIS: Record<string, string> = {
  CH: '🇨🇭',
  DE: '🇩🇪',
  AT: '🇦🇹',
  GB: '🇬🇧',
  UK: '🇬🇧',
  FR: '🇫🇷',
  IT: '🇮🇹',
  ES: '🇪🇸',
  NL: '🇳🇱',
  BE: '🇧🇪',
  LU: '🇱🇺',
  US: '🇺🇸',
};

/**
 * Status Labels
 */
export const STATUS_LABELS: Record<VenueStatus, string> = {
  live: 'Live',
  pending: 'Pending',
  rejected: 'Rejected',
};

/**
 * Status Emojis
 */
export const STATUS_EMOJIS: Record<VenueStatus, string> = {
  live: '🟢',
  pending: '📋',
  rejected: '❌',
};

/**
 * Platform Labels
 */
export const PLATFORM_LABELS: Record<DeliveryPlatform, string> = {
  uber_eats: 'Uber Eats',
  deliveroo: 'Deliveroo',
  wolt: 'Wolt',
  just_eat: 'Just Eat',
  doordash: 'DoorDash',
  other: 'Other',
};

/**
 * Venue Type Labels
 */
export const VENUE_TYPE_LABELS: Record<VenueType, string> = {
  restaurant: 'Restaurant',
  cafe: 'Cafe',
  hotel: 'Hotel',
  food_truck: 'Food Truck',
  catering: 'Catering',
  other: 'Other',
};

/**
 * Product Labels
 */
export const PRODUCT_LABELS: Record<ProductType, string> = {
  'planted.chicken': 'Planted Chicken',
  'planted.pulled': 'Planted Pulled',
  'planted.kebab': 'Planted Kebab',
  'planted.schnitzel': 'Planted Schnitzel',
  'planted.burger': 'Planted Burger',
  'planted.other': 'Planted Other',
};
