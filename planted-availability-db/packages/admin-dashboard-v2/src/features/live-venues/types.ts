/**
 * Live Venues Feature Types
 *
 * Types for browsing and managing production venues.
 */

import type { VenueType, VenueStatus } from '@pad/core';

/**
 * LiveVenue - A production venue with display-ready fields
 */
export interface LiveVenue {
  id: string;
  name: string;
  type: VenueType;
  chainId?: string;
  chainName?: string;
  address: {
    street?: string;
    city: string;
    postalCode?: string;
    country: string;
  };
  location: {
    latitude: number;
    longitude: number;
  };
  status: VenueStatus;
  lastVerified: string; // ISO date string
  createdAt: string; // ISO date string
  deliveryPlatforms: DeliveryPlatformInfo[];
  dishCount: number;
}

/**
 * Delivery platform information
 */
export interface DeliveryPlatformInfo {
  platform: string;
  url: string;
  active: boolean;
}

/**
 * Hierarchy node for tree display
 */
export interface HierarchyNode {
  id: string;
  type: 'country' | 'venueType' | 'chain' | 'venue';
  label: string;
  count: number;
  children?: HierarchyNode[];
  venue?: LiveVenue;
}

/**
 * Stats for the live venues browser
 */
export interface LiveVenuesStats {
  active: number;
  stale: number;
  archived: number;
  total: number;
  byCountry: Record<string, number>;
  byType: Record<string, number>;
  avgDaysSinceVerification: number;
}

/**
 * Filter options for the live venues query
 */
export interface LiveVenuesFilters {
  country?: string;
  status?: VenueStatus;
  venueType?: VenueType;
  search?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Pagination info
 */
export interface LiveVenuesPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

/**
 * Full response from the live venues API
 */
export interface LiveVenuesResponse {
  items: LiveVenue[];
  hierarchy: HierarchyNode[];
  stats: LiveVenuesStats;
  pagination: LiveVenuesPagination;
}

/**
 * Status update request
 */
export interface UpdateVenueStatusRequest {
  venueId: string;
  status: VenueStatus;
}

/**
 * Status update response
 */
export interface UpdateVenueStatusResponse {
  success: boolean;
  message: string;
  venue: {
    id: string;
    name: string;
    previousStatus: VenueStatus;
    status: VenueStatus;
    lastVerified: string;
  };
}

/**
 * Country display info
 */
export const COUNTRY_LABELS: Record<string, string> = {
  CH: 'Switzerland',
  DE: 'Germany',
  AT: 'Austria',
};

export const COUNTRY_EMOJIS: Record<string, string> = {
  CH: '\u{1F1E8}\u{1F1ED}',
  DE: '\u{1F1E9}\u{1F1EA}',
  AT: '\u{1F1E6}\u{1F1F9}',
};

/**
 * Venue type display info
 */
export const VENUE_TYPE_LABELS: Record<VenueType, string> = {
  restaurant: 'Restaurants',
  retail: 'Retail',
  delivery_kitchen: 'Delivery Kitchens',
};

/**
 * Status display info
 */
export const STATUS_LABELS: Record<VenueStatus, string> = {
  active: 'Active',
  stale: 'Stale',
  archived: 'Archived',
};

export const STATUS_COLORS: Record<VenueStatus, string> = {
  active: 'bg-green-100 text-green-800',
  stale: 'bg-yellow-100 text-yellow-800',
  archived: 'bg-gray-100 text-gray-800',
};

/**
 * Platform display info
 */
export const PLATFORM_LABELS: Record<string, string> = {
  uber_eats: 'Uber Eats',
  wolt: 'Wolt',
  lieferando: 'Lieferando',
  deliveroo: 'Deliveroo',
  just_eat: 'Just Eat',
  glovo: 'Glovo',
};

/**
 * Venue dish for display
 */
export interface VenueDish {
  id: string;
  name: string;
  description: string;
  plantedProducts: string[];
  price: {
    amount: number;
    currency: string;
  };
  dietaryTags: string[];
  cuisineType?: string;
  imageUrl?: string;
  status: string;
  lastVerified: string;
}

/**
 * Response from venue dishes API
 */
export interface VenueDishesResponse {
  venueId: string;
  dishes: VenueDish[];
  total: number;
}
