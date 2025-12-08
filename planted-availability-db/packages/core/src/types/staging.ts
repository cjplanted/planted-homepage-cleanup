/**
 * Staging Types
 *
 * Staged entities are partner-submitted data awaiting review before
 * being promoted to production.
 */

import type { StagedEntityBase } from './partner.js';
import type { VenueType, VenueStatus } from './venue.js';
import type { PromoType } from './promotion.js';

/**
 * Staged Venue - Partner-submitted venue awaiting review
 */
export interface StagedVenue extends StagedEntityBase {
  // Venue linking
  /** If linking to existing production venue */
  production_venue_id?: string;

  // Venue data
  data: {
    type: VenueType;
    name: string;
    chain_id?: string;
    address: {
      street: string;
      city: string;
      postal_code: string;
      country: string;
      /** Original address before parsing */
      raw_address?: string;
    };
    opening_hours?: {
      regular: Record<string, { open: string; close: string }[]>;
      exceptions?: { date: string; hours: { open: string; close: string }[] | 'closed' }[];
    };
    contact?: {
      phone?: string;
      email?: string;
      website?: string;
    };
    delivery_partners?: string[];
    /** Additional partner-provided metadata */
    metadata?: Record<string, unknown>;
  };

  // Geocoding results
  geocoding: {
    status: 'pending' | 'success' | 'failed' | 'manual';
    /** Coordinates provided by partner */
    original_coordinates?: { lat: number; lng: number };
    /** Coordinates resolved by geocoder */
    resolved_coordinates?: { lat: number; lng: number };
    geocoder_used?: string;
    geocoding_confidence?: number;
  };
}

/**
 * Staged Dish - Partner-submitted dish awaiting review
 */
export interface StagedDish extends StagedEntityBase {
  // Venue linking
  /** If venue also staged in same batch */
  staged_venue_id?: string;
  /** If linking to existing production venue */
  production_venue_id?: string;
  /** Partner's venue reference */
  venue_external_id?: string;

  // Dish data
  data: {
    name: string;
    name_localized?: Record<string, string>;
    description: string;
    description_localized?: Record<string, string>;
    /** Planted product SKUs */
    planted_products: string[];
    price: {
      amount: number;
      currency: string;
    };
    image_url?: string;
    image_source?: string;
    dietary_tags: string[];
    cuisine_type?: string;
    availability: {
      type: 'permanent' | 'limited' | 'seasonal';
      start_date?: Date;
      end_date?: Date;
      days_available?: string[];
    };
    delivery_partners?: {
      partner: string;
      url: string;
      price?: number;
    }[];
    /** Additional partner-provided metadata */
    metadata?: Record<string, unknown>;
  };

  // Product mapping
  product_mapping: {
    /** Was this auto-mapped or manual? */
    auto_mapped: boolean;
    mapping_method: 'keyword' | 'sku_lookup' | 'ai_inference' | 'manual';
    mapping_confidence: number;
    /** Original product text from partner */
    original_product_text?: string;
    /** Alternative product mappings suggested */
    suggested_products?: string[];
  };
}

/**
 * Staged Promotion - Partner-submitted promotion awaiting review
 */
export interface StagedPromotion extends StagedEntityBase {
  // Linking
  staged_venue_id?: string;
  production_venue_id?: string;
  chain_id?: string;

  // Promotion data
  data: {
    promo_type: PromoType;
    title: string;
    description?: string;
    /** Planted product SKUs this applies to */
    product_skus: string[];
    discount?: {
      type: 'percent' | 'fixed';
      value: number;
    };
    image_url?: string;
    valid_from: Date;
    valid_until: Date;
    terms?: string;
    /** Additional partner-provided metadata */
    metadata?: Record<string, unknown>;
  };
}

/**
 * Staged Availability - Partner-submitted retail availability update
 */
export interface StagedAvailability extends StagedEntityBase {
  // Linking
  staged_venue_id?: string;
  production_venue_id?: string;

  // Availability data
  data: {
    product_sku: string;
    in_stock: boolean;
    price?: {
      regular: number;
      sale?: number;
      currency: string;
    };
    /** Reference to associated promotion */
    promotion_ref?: string;
    shelf_location?: string;
    /** Last time this was verified */
    verified_at?: Date;
    /** Additional partner-provided metadata */
    metadata?: Record<string, unknown>;
  };
}

// Helper types for confidence breakdown
export interface VenueConfidenceBreakdown {
  completeness: number;
  geocoding: number;
  name_match: number;
  source_reliability: number;
}

export interface DishConfidenceBreakdown {
  completeness: number;
  product_mapping: number;
  price_validity: number;
  venue_link: number;
}

export interface PromotionConfidenceBreakdown {
  completeness: number;
  date_validity: number;
  product_mapping: number;
  venue_link: number;
}
