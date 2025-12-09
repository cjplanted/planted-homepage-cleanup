/**
 * Smart Dish Finder Types
 *
 * Types for the AI-powered dish extraction system that fetches menu data
 * from delivery platforms and learns from feedback to improve accuracy.
 */

import type { DeliveryPlatform, SupportedCountry, ConfidenceFactor } from './discovery.js';

// =============================================================================
// DISH EXTRACTION MODES
// =============================================================================

export type DishExtractionMode = 'enrich' | 'refresh' | 'verify';

// =============================================================================
// DISH EXTRACTION STRATEGIES
// =============================================================================

export type DishStrategyOrigin = 'seed' | 'agent' | 'manual' | 'evolved';

export type DishStrategyTag =
  | 'platform-default'
  | 'chain-specific'
  | 'high-precision'
  | 'experimental';

export interface ExtractionConfig {
  // CSS selectors for extraction (optional - Claude can work with raw HTML)
  dish_container_selector?: string;
  name_selector?: string;
  description_selector?: string;
  price_selector?: string;
  image_selector?: string;
  category_selector?: string;
  // JSON extraction paths (some platforms embed menu data as JSON)
  json_menu_path?: string;
  json_dish_path?: string;
}

export interface DishExtractionStrategy {
  id: string;

  // Targeting
  platform: DeliveryPlatform;
  chain_id?: string; // Optional: chain-specific strategy

  // Extraction configuration
  extraction_config: ExtractionConfig;

  // Performance metrics (reinforcement learning)
  success_rate: number; // 0-100
  total_uses: number;
  successful_extractions: number;
  failed_extractions: number;

  // Metadata
  tags: DishStrategyTag[];
  origin: DishStrategyOrigin;
  parent_strategy_id?: string;

  // Timestamps
  created_at: Date;
  updated_at: Date;
  last_used?: Date;
  deprecated_at?: Date;
  deprecation_reason?: string;
}

export type CreateDishExtractionStrategyInput = Omit<
  DishExtractionStrategy,
  'id' | 'success_rate' | 'total_uses' | 'successful_extractions' | 'failed_extractions' | 'created_at' | 'updated_at'
>;

// =============================================================================
// DISH EXTRACTION RUNS
// =============================================================================

export type DishExtractionRunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface DishExtractionRunConfig {
  mode: DishExtractionMode;
  target_venues?: string[]; // Specific venue IDs to process
  target_chains?: string[]; // Process all venues of these chains
  platforms?: DeliveryPlatform[];
  countries?: SupportedCountry[];
  max_venues?: number;
}

export interface DishExtractionRunStats {
  venues_processed: number;
  venues_successful: number;
  venues_failed: number;
  dishes_extracted: number;
  dishes_updated: number;
  dishes_verified: number;
  prices_found: number;
  images_found: number;
  errors: number;
}

export interface DishExtractionError {
  timestamp: Date;
  phase: 'fetch' | 'parse' | 'extract' | 'store';
  message: string;
  venue_id?: string;
  platform?: string;
  url?: string;
  stack?: string;
}

export interface DishExtractionRun {
  id: string;
  status: DishExtractionRunStatus;

  config: DishExtractionRunConfig;
  stats: DishExtractionRunStats;

  strategies_used: string[];
  errors: DishExtractionError[];

  created_at: Date;
  updated_at: Date;
  started_at?: Date;
  completed_at?: Date;

  triggered_by: 'scheduled' | 'manual' | 'webhook';
  triggered_by_user?: string;
}

export type CreateDishExtractionRunInput = Omit<
  DishExtractionRun,
  'id' | 'status' | 'stats' | 'strategies_used' | 'errors' | 'created_at' | 'updated_at'
>;

// =============================================================================
// PRICE TRACKING
// =============================================================================

export interface PriceEntry {
  country: SupportedCountry;
  platform: DeliveryPlatform;
  price: number;
  currency: string;
  formatted: string; // e.g., '€12.90' or 'CHF 18.90'
  last_seen: Date;
}

// =============================================================================
// DISCOVERED DISHES
// =============================================================================

export type ExtractedDishStatus =
  | 'discovered' // Just extracted, not yet verified
  | 'verified' // Confirmed correct
  | 'rejected' // False positive or incorrect
  | 'promoted' // Moved to production
  | 'stale'; // Needs re-verification

export interface ExtractedDish {
  id: string;
  extraction_run_id: string;

  // Source
  venue_id: string; // Reference to discovered_venues or venues collection
  venue_name: string;
  chain_id?: string;
  chain_name?: string;

  // Dish info
  name: string;
  description?: string;
  category?: string;
  image_url?: string;

  // Planted product matching
  planted_product: string; // e.g., 'planted.chicken'
  product_confidence: number; // 0-100
  product_match_reason: string;

  // All observed prices (for tracking)
  prices: PriceEntry[];

  // Consolidated price by country (for display)
  price_by_country: Partial<Record<SupportedCountry, string>>;

  // Dietary info
  is_vegan: boolean;
  dietary_tags: string[];

  // Confidence scoring
  confidence_score: number; // 0-100 overall
  confidence_factors: ConfidenceFactor[];

  // Status
  status: ExtractedDishStatus;
  rejection_reason?: string;
  production_dish_id?: string; // If promoted

  // Tracking
  discovered_by_strategy_id: string;
  source_url: string;

  created_at: Date;
  updated_at: Date;
  verified_at?: Date;
  promoted_at?: Date;
}

export type CreateExtractedDishInput = Omit<
  ExtractedDish,
  'id' | 'status' | 'created_at' | 'updated_at'
>;

// =============================================================================
// DISH FEEDBACK
// =============================================================================

export type DishFeedbackResultType =
  | 'correct' // Everything is correct
  | 'wrong_product' // Dish exists but wrong Planted product
  | 'wrong_price' // Price is incorrect
  | 'wrong_name' // Name is incorrect
  | 'not_planted' // Not actually a Planted dish
  | 'not_found' // Dish doesn't exist on platform
  | 'error'; // Error during verification

export interface DishFeedbackDetails {
  name_correct: boolean;
  description_correct: boolean;
  price_correct: boolean;
  product_correct: boolean;
  image_correct: boolean;
  corrected_product?: string;
  corrected_price?: string;
  notes?: string;
}

export interface DishFeedback {
  id: string;

  // Reference
  discovered_dish_id: string;
  strategy_id: string;

  // Feedback
  result_type: DishFeedbackResultType;
  feedback_details?: DishFeedbackDetails;

  // Reviewer
  reviewed_by?: string;

  // Timestamps
  created_at: Date;
  updated_at: Date;
  reviewed_at?: Date;
}

export type CreateDishFeedbackInput = Omit<DishFeedback, 'id' | 'created_at' | 'updated_at'>;

// =============================================================================
// CLAUDE EXTRACTION TYPES
// =============================================================================

export interface ExtractedDishFromPage {
  name: string;
  description?: string;
  category?: string;
  image_url?: string;
  price: string;
  currency: string;
  planted_product_guess: string;
  product_confidence: number;
  is_vegan: boolean;
  dietary_tags: string[];
  reasoning: string;
}

export interface PageExtractionResult {
  dishes: ExtractedDishFromPage[];
  page_quality: {
    menu_found: boolean;
    prices_visible: boolean;
    descriptions_available: boolean;
    images_available: boolean;
  };
  extraction_notes?: string;
}

export interface VenuePage {
  url: string;
  platform: DeliveryPlatform;
  country: SupportedCountry;
  venue_name: string;
  venue_id: string;
  chain_id?: string;
  html?: string;
  json_data?: unknown; // Some platforms embed menu as JSON
}

// =============================================================================
// STRATEGY LEARNING TYPES
// =============================================================================

export interface DishStrategyUpdate {
  strategy_id: string;
  action: 'boost' | 'penalize' | 'deprecate' | 'evolve';
  new_success_rate?: number;
  evolved_config?: ExtractionConfig;
  reason: string;
}

export interface DishLearningResult {
  strategy_updates: DishStrategyUpdate[];
  new_strategies: CreateDishExtractionStrategyInput[];
  insights: {
    type: 'extraction_pattern' | 'platform_change' | 'chain_specific' | 'error_pattern';
    description: string;
    confidence: number;
  }[];
}

// =============================================================================
// SEED STRATEGIES
// =============================================================================

export const DISH_SEED_STRATEGIES: Omit<DishExtractionStrategy, 'id' | 'created_at' | 'updated_at'>[] = [
  // Uber Eats - works in CH, DE, AT
  {
    platform: 'uber-eats',
    extraction_config: {
      // Uber Eats uses React with JSON data embedded
      json_menu_path: '__NEXT_DATA__',
    },
    success_rate: 70,
    total_uses: 0,
    successful_extractions: 0,
    failed_extractions: 0,
    tags: ['platform-default'],
    origin: 'seed',
  },
  // Lieferando - DE, AT
  {
    platform: 'lieferando',
    extraction_config: {
      // Lieferando has structured menu sections
      dish_container_selector: '[data-qa="menu-item"]',
      name_selector: '[data-qa="item-name"]',
      price_selector: '[data-qa="item-price"]',
    },
    success_rate: 70,
    total_uses: 0,
    successful_extractions: 0,
    failed_extractions: 0,
    tags: ['platform-default'],
    origin: 'seed',
  },
  // Wolt - DE, AT
  {
    platform: 'wolt',
    extraction_config: {
      // Wolt uses JSON-LD and embedded data
      json_menu_path: 'application/ld+json',
    },
    success_rate: 70,
    total_uses: 0,
    successful_extractions: 0,
    failed_extractions: 0,
    tags: ['platform-default'],
    origin: 'seed',
  },
  // Just Eat (eat.ch) - CH
  {
    platform: 'just-eat',
    extraction_config: {
      // Just Eat has menu item cards
      dish_container_selector: '.menu-item',
      name_selector: '.menu-item__name',
      price_selector: '.menu-item__price',
    },
    success_rate: 70,
    total_uses: 0,
    successful_extractions: 0,
    failed_extractions: 0,
    tags: ['platform-default'],
    origin: 'seed',
  },
  // Smood - CH
  {
    platform: 'smood',
    extraction_config: {
      // Smood has Vue-based menu
      dish_container_selector: '.menu-item',
    },
    success_rate: 65,
    total_uses: 0,
    successful_extractions: 0,
    failed_extractions: 0,
    tags: ['platform-default'],
    origin: 'seed',
  },
];

// =============================================================================
// CONFIGURATION
// =============================================================================

export interface DishFinderConfig {
  puppeteer: {
    headless: boolean;
    timeout_ms: number;
    viewport: { width: number; height: number };
  };
  extraction: {
    max_venues_per_run: number;
    rate_limit_ms: number;
    retry_attempts: number;
    retry_delay_ms: number;
  };
  learning: {
    min_feedback_for_learning: number;
    low_success_threshold: number;
    high_success_threshold: number;
    auto_deprecate_below: number;
  };
  claude: {
    model: string;
    max_tokens: number;
    temperature: number;
  };
}

export const DEFAULT_DISH_FINDER_CONFIG: DishFinderConfig = {
  puppeteer: {
    headless: true,
    timeout_ms: 30000,
    viewport: { width: 1280, height: 800 },
  },
  extraction: {
    max_venues_per_run: 50,
    rate_limit_ms: 3000, // Be respectful to platforms
    retry_attempts: 2,
    retry_delay_ms: 5000,
  },
  learning: {
    min_feedback_for_learning: 10,
    low_success_threshold: 0.3,
    high_success_threshold: 0.7,
    auto_deprecate_below: 0.1,
  },
  claude: {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8192, // Larger for menu extraction
    temperature: 0.2, // Low for consistent extraction
  },
};

// =============================================================================
// PLANTED PRODUCTS
// =============================================================================

export const PLANTED_PRODUCT_SKUS = [
  'planted.chicken',
  'planted.chicken_tenders',
  'planted.chicken_burger',
  'planted.kebab',
  'planted.schnitzel',
  'planted.pulled',
  'planted.burger',
  'planted.steak',
  'planted.pastrami',
  'planted.duck',
] as const;

export type PlantedProductSku = (typeof PLANTED_PRODUCT_SKUS)[number];

// =============================================================================
// CURRENCY HELPERS
// =============================================================================

export const CURRENCY_BY_COUNTRY: Record<SupportedCountry, string> = {
  CH: 'CHF',
  DE: 'EUR',
  AT: 'EUR',
};

export const CURRENCY_SYMBOLS: Record<string, string> = {
  CHF: 'CHF',
  EUR: '€',
  USD: '$',
  GBP: '£',
};
