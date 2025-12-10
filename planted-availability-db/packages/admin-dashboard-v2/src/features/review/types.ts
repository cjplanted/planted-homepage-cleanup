/**
 * Review Feature Types
 *
 * Type definitions for the Review Queue feature.
 */

/**
 * Review Status
 */
export type ReviewStatus = 'pending' | 'verified' | 'rejected';

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
 * Confidence Factor
 */
export interface ConfidenceFactor {
  factor: string;
  score: number;
  weight: number;
  details?: string;
}

/**
 * Review Dish
 */
export interface ReviewDish {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  imageUrl?: string;
  productMatch: ProductType;
  confidence: number;
  confidenceFactors?: ConfidenceFactor[];
}

/**
 * Review Venue
 */
export interface ReviewVenue {
  id: string;
  name: string;
  chain?: string;
  venueType: VenueType;
  address: string;
  city: string;
  country: string;
  countryCode: string; // ISO 3166-1 alpha-2
  coordinates?: {
    lat: number;
    lng: number;
  };
  platform: DeliveryPlatform;
  platformUrl: string;
  deliveryPlatforms?: Array<{
    platform: string;
    url: string;
    active: boolean;
  }>;
  confidence: number;
  confidenceFactors: ConfidenceFactor[];
  dishes: ReviewDish[];
  status: ReviewStatus;
  scrapedAt: string; // ISO date string
  reviewedAt?: string; // ISO date string
  reviewedBy?: string;
  feedback?: string;
  rejectionReason?: string;
}

/**
 * Hierarchy Node
 */
export interface HierarchyNode {
  id: string;
  type: 'country' | 'venueType' | 'chain' | 'venue';
  label: string;
  count: number;
  children?: HierarchyNode[];
  venue?: ReviewVenue; // Only for venue nodes
  expanded?: boolean; // Client-side state
}

/**
 * Review Stats
 */
export interface ReviewStats {
  pending: number;
  verified: number;
  rejected: number;
  total: number;
  averageConfidence: number;
  byCountry: Record<string, number>;
  byVenueType: Record<string, number>;
  byPlatform: Record<string, number>;
}

/**
 * Review Queue Response
 */
export interface ReviewQueueResponse {
  items: ReviewVenue[];
  hierarchy: HierarchyNode[];
  stats: ReviewStats;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

/**
 * Review Queue Filters
 */
export interface ReviewQueueFilters {
  country?: string;
  status?: ReviewStatus;
  venueType?: VenueType;
  platform?: DeliveryPlatform;
  minConfidence?: number;
  maxConfidence?: number;
  search?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Approval Action
 */
export type ApprovalAction = 'approve' | 'partial-approve' | 'reject';

/**
 * Approval Request
 */
export interface ApprovalRequest {
  venueId: string;
  action: ApprovalAction;
  feedback?: string;
  reason?: string;
  dishIds?: string[]; // For partial approval
}

/**
 * Bulk Action Request
 */
export interface BulkActionRequest {
  venueIds: string[];
  action: 'approve' | 'reject';
  reason?: string;
}

/**
 * Feedback Request
 */
export interface FeedbackRequest {
  venueId: string;
  feedback: string;
  tags?: string[];
}

/**
 * Feedback Tag
 */
export const FEEDBACK_TAGS = [
  'Wrong Price',
  'Missing Dish',
  'Wrong Product',
  'Duplicate',
  'Poor Quality',
  'Location Error',
  'Other',
] as const;

export type FeedbackTag = typeof FEEDBACK_TAGS[number];

/**
 * Rejection Reason
 */
export const REJECTION_REASONS = [
  'Not a planted venue',
  'Duplicate entry',
  'Incorrect location',
  'No planted products',
  'Data quality issues',
  'Other',
] as const;

export type RejectionReason = typeof REJECTION_REASONS[number];

/**
 * Country Emoji Mapping
 */
export const COUNTRY_EMOJIS: Record<string, string> = {
  CH: '🇨🇭',
  DE: '🇩🇪',
  AT: '🇦🇹',
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
