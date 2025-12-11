/**
 * Smart Discovery Agent Types
 *
 * Types for the AI-powered restaurant discovery system that learns
 * from feedback to improve search strategies over time.
 */

// =============================================================================
// PLATFORMS & COUNTRIES
// =============================================================================

export type DeliveryPlatform =
  | 'uber-eats'
  | 'just-eat'
  | 'lieferando'
  | 'wolt'
  | 'smood'
  | 'deliveroo'
  | 'glovo';

export type SupportedCountry = 'CH' | 'DE' | 'AT' | 'NL' | 'UK' | 'FR' | 'ES' | 'IT' | 'BE' | 'PL';

export const SUPPORTED_COUNTRIES: readonly SupportedCountry[] = ['CH', 'DE', 'AT', 'NL', 'UK', 'FR', 'ES', 'IT', 'BE', 'PL'] as const;

export const PLATFORM_COUNTRIES: Record<DeliveryPlatform, SupportedCountry[]> = {
  'uber-eats': ['CH', 'DE', 'AT', 'NL', 'UK', 'FR', 'ES', 'IT', 'BE', 'PL'],
  'just-eat': ['CH', 'NL', 'UK', 'FR', 'ES', 'IT', 'BE', 'PL'],
  'lieferando': ['DE', 'AT', 'NL', 'BE', 'PL'],
  'wolt': ['DE', 'AT', 'PL'],
  'smood': ['CH'],
  'deliveroo': ['UK', 'FR', 'ES', 'IT', 'BE', 'NL'],
  'glovo': ['ES', 'IT', 'PL'],
};

export const PLATFORM_URLS: Record<DeliveryPlatform, string> = {
  'uber-eats': 'ubereats.com',
  'just-eat': 'just-eat.ch', // Base URL, varies by country
  'lieferando': 'lieferando.de', // Also lieferando.at, thuisbezorgd.nl
  'wolt': 'wolt.com',
  'smood': 'smood.ch',
  'deliveroo': 'deliveroo.co.uk', // Also deliveroo.fr, deliveroo.es, deliveroo.it
  'glovo': 'glovoapp.com',
};

// Country-specific platform URLs for accurate scraping
export const PLATFORM_URLS_BY_COUNTRY: Record<SupportedCountry, Partial<Record<DeliveryPlatform, string>>> = {
  CH: {
    'uber-eats': 'ubereats.com/ch',
    'just-eat': 'just-eat.ch',
    'smood': 'smood.ch',
  },
  DE: {
    'uber-eats': 'ubereats.com/de',
    'lieferando': 'lieferando.de',
    'wolt': 'wolt.com/de',
  },
  AT: {
    'uber-eats': 'ubereats.com/at',
    'lieferando': 'lieferando.at',
    'wolt': 'wolt.com/at',
  },
  NL: {
    'uber-eats': 'ubereats.com/nl',
    'just-eat': 'thuisbezorgd.nl',
    'lieferando': 'thuisbezorgd.nl',
    'deliveroo': 'deliveroo.nl',
  },
  UK: {
    'uber-eats': 'ubereats.com/gb',
    'just-eat': 'just-eat.co.uk',
    'deliveroo': 'deliveroo.co.uk',
  },
  FR: {
    'uber-eats': 'ubereats.com/fr',
    'just-eat': 'just-eat.fr',
    'deliveroo': 'deliveroo.fr',
  },
  ES: {
    'uber-eats': 'ubereats.com/es',
    'just-eat': 'just-eat.es',
    'deliveroo': 'deliveroo.es',
    'glovo': 'glovoapp.com/es',
  },
  IT: {
    'uber-eats': 'ubereats.com/it',
    'just-eat': 'justeat.it',
    'deliveroo': 'deliveroo.it',
    'glovo': 'glovoapp.com/it',
  },
  BE: {
    'uber-eats': 'ubereats.com/be',
    'just-eat': 'takeaway.com/be',
    'lieferando': 'takeaway.com/be',
    'deliveroo': 'deliveroo.be',
  },
  PL: {
    'uber-eats': 'ubereats.com/pl',
    'just-eat': 'pyszne.pl',
    'lieferando': 'pyszne.pl',
    'wolt': 'wolt.com/pl',
    'glovo': 'glovoapp.com/pl',
  },
};

// =============================================================================
// DISCOVERY STRATEGIES
// =============================================================================

export type StrategyOrigin = 'seed' | 'agent' | 'manual' | 'evolved';

export type StrategyTag =
  | 'chain-discovery'
  | 'single-venue'
  | 'city-specific'
  | 'product-specific'
  | 'high-precision'
  | 'broad-search'
  | 'verification';

export interface DiscoveryStrategy {
  id: string;
  platform: DeliveryPlatform;
  country: SupportedCountry;

  // The query template with placeholders: {city}, {product}, {chain}
  query_template: string;

  // Performance metrics
  success_rate: number; // 0-100
  total_uses: number;
  successful_discoveries: number;
  false_positives: number;

  // Metadata
  tags: StrategyTag[];
  origin: StrategyOrigin;
  parent_strategy_id?: string; // If evolved from another strategy

  // Timestamps
  created_at: Date;
  last_used?: Date;
  deprecated_at?: Date;
  deprecation_reason?: string;
}

export type CreateStrategyInput = Omit<
  DiscoveryStrategy,
  'id' | 'success_rate' | 'total_uses' | 'successful_discoveries' | 'false_positives' | 'created_at'
>;

// =============================================================================
// DISCOVERY RUNS
// =============================================================================

export type DiscoveryMode = 'explore' | 'enumerate' | 'verify';
export type DiscoveryRunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface DiscoveryRunConfig {
  platforms: DeliveryPlatform[];
  countries: SupportedCountry[];
  mode: DiscoveryMode;
  max_queries?: number;
  target_chains?: string[]; // For enumerate mode
  target_venues?: string[]; // For verify mode
}

export interface DiscoveryRunStats {
  queries_executed: number;
  queries_successful: number;
  queries_failed: number;
  venues_discovered: number;
  venues_verified: number;
  venues_rejected: number;
  chains_detected: number;
  new_strategies_created: number;
  dishes_extracted: number;
  dish_extraction_failures: number;
}

export interface DiscoveryRun {
  id: string;
  status: DiscoveryRunStatus;
  config: DiscoveryRunConfig;
  stats: DiscoveryRunStats;

  // Tracking
  strategies_used: string[]; // Strategy IDs
  learned_patterns: LearnedPattern[];
  errors: DiscoveryError[];

  // Timestamps
  created_at: Date;
  started_at?: Date;
  completed_at?: Date;

  // Trigger info
  triggered_by: 'scheduled' | 'manual' | 'webhook';
  triggered_by_user?: string;
}

export interface DiscoveryError {
  timestamp: Date;
  phase: 'search' | 'parse' | 'verify' | 'store';
  message: string;
  query?: string;
  platform?: string;
  stack?: string;
}

export interface LearnedPattern {
  type: 'query_improvement' | 'platform_insight' | 'chain_signal' | 'false_positive_pattern';
  description: string;
  confidence: number;
  applied: boolean;
}

export type CreateDiscoveryRunInput = Omit<
  DiscoveryRun,
  'id' | 'status' | 'stats' | 'strategies_used' | 'learned_patterns' | 'errors' | 'created_at'
>;

// =============================================================================
// DISCOVERED VENUES
// =============================================================================

export type DiscoveredVenueStatus =
  | 'discovered'    // Just found, not yet verified
  | 'verified'      // Confirmed to serve Planted
  | 'rejected'      // False positive
  | 'promoted'      // Moved to production venues collection
  | 'stale';        // Needs re-verification

export type VenueFlagType = 'dish_extraction' | 're_verification';
export type VenueFlagPriority = 'urgent' | 'high' | 'normal';

// Aligned with production Address type (venue.ts)
// Only difference: street/postal_code optional during discovery
export interface DiscoveredVenueAddress {
  street?: string;
  city: string;
  postal_code?: string;
  country: SupportedCountry;
  full_address?: string; // Raw address for geocoding fallback
}

// Use same field names as production GeoPoint for easier promotion
// latitude/longitude instead of lat/lng
export interface DiscoveredVenueCoordinates {
  latitude: number;  // Aligned with GeoPoint
  longitude: number; // Aligned with GeoPoint
  accuracy?: 'exact' | 'approximate' | 'city-center';
}

// Aligned with production DeliveryPlatformLink (venue.ts)
// Adds discovery-specific fields (rating, review_count)
export interface DiscoveredDeliveryLink {
  platform: DeliveryPlatform;
  url: string;
  venue_id_on_platform?: string;
  active: boolean; // Aligned with DeliveryPlatformLink
  verified: boolean; // Discovery-specific: has this link been manually verified?
  last_verified?: Date;
  // Discovery-specific metadata from platform
  rating?: number;
  review_count?: number;
}

export interface DiscoveredDish {
  name: string;
  description?: string;
  price?: string;
  currency?: string;
  planted_product: string; // e.g., 'planted.chicken'
  is_vegan?: boolean;
  confidence: number; // 0-100
}

export interface ConfidenceFactor {
  factor: string;
  score: number; // 0-100
  reason: string;
}

export interface DiscoveredVenue {
  id: string;
  discovery_run_id: string;

  // Basic info
  name: string;
  chain_id?: string;
  chain_name?: string;
  is_chain: boolean;
  chain_confidence?: number;

  // Location
  address: DiscoveredVenueAddress;
  coordinates?: DiscoveredVenueCoordinates;

  // Delivery info
  delivery_platforms: DiscoveredDeliveryLink[];

  // Planted products
  planted_products: string[];
  dishes: DiscoveredDish[];

  // Confidence scoring
  confidence_score: number; // 0-100 overall
  confidence_factors: ConfidenceFactor[];

  // Status
  status: DiscoveredVenueStatus;
  rejection_reason?: string;
  production_venue_id?: string; // If promoted

  // Flagging for scraper priority
  flag_type?: VenueFlagType | null;
  flag_priority?: VenueFlagPriority;
  flag_reason?: string;
  flagged_at?: Date;
  flagged_by?: string;

  // Timestamps
  created_at: Date;
  verified_at?: Date;
  promoted_at?: Date;

  // Source tracking
  discovered_by_strategy_id: string;
  discovered_by_query: string;
}

export type CreateDiscoveredVenueInput = Omit<
  DiscoveredVenue,
  'id' | 'status' | 'created_at'
>;

// =============================================================================
// SEARCH FEEDBACK
// =============================================================================

export type FeedbackResultType =
  | 'true_positive'   // Found a real Planted venue
  | 'false_positive'  // Not actually a Planted venue
  | 'no_results'      // Query returned nothing
  | 'error';          // Query failed

export interface SearchFeedbackDetails {
  was_useful: boolean;
  venue_was_correct?: boolean;
  products_were_correct?: boolean;
  address_was_correct?: boolean;
  notes?: string;
}

export interface SearchFeedback {
  id: string;
  query: string;
  platform: DeliveryPlatform;
  country: SupportedCountry;
  strategy_id: string;

  // Result
  result_type: FeedbackResultType;
  discovered_venue_id?: string;

  // Feedback
  feedback?: SearchFeedbackDetails;
  reviewed_by?: string;

  // Timestamps
  created_at: Date;
  reviewed_at?: Date;
}

export type CreateSearchFeedbackInput = Omit<
  SearchFeedback,
  'id' | 'created_at'
>;

// =============================================================================
// CLAUDE AGENT TYPES
// =============================================================================

export interface SearchContext {
  platform: DeliveryPlatform;
  country: SupportedCountry;
  city?: string;
  target_product?: string;
  target_chain?: string;
  previous_queries?: string[];
  known_venues?: string[];
}

export interface GeneratedQuery {
  query: string;
  strategy_id?: string;
  expected_result_type: 'venue_list' | 'venue_detail' | 'chain_locations';
  reasoning: string;
}

export interface RawSearchResult {
  title: string;
  url: string;
  snippet?: string;
  position: number;
}

export interface ParsedVenue {
  name: string;
  url: string;
  platform: DeliveryPlatform;
  city?: string;
  address?: string;
  is_likely_chain: boolean;
  chain_signals: string[];
  planted_mentions: string[];
  confidence: number;
}

export interface VenueAnalysis {
  serves_planted: boolean;
  confidence: number;
  planted_products: string[];
  dishes: DiscoveredDish[];
  is_chain: boolean;
  chain_signals: string[];
  reasoning: string;
}

export interface StrategyUpdate {
  strategy_id: string;
  action: 'boost' | 'penalize' | 'deprecate' | 'evolve';
  new_success_rate?: number;
  evolved_query?: string;
  reason: string;
}

export interface AgentDecision {
  type: 'search' | 'parse' | 'verify' | 'learn';
  input: unknown;
  output: unknown;
  reasoning: string;
  confidence: number;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

export interface DiscoveryConfig {
  claude: {
    model: string;
    max_tokens: number;
    temperature: number;
  };
  search: {
    max_queries_per_run: number;
    max_results_per_query: number;
    rate_limit_ms: number;
  };
  learning: {
    min_feedback_for_learning: number;
    strategy_expiry_days: number;
    low_success_threshold: number;
    high_success_threshold: number;
    auto_deprecate_below: number;
  };
  platforms: Record<DeliveryPlatform, {
    enabled: boolean;
    countries: SupportedCountry[];
    rate_limit_ms?: number;
  }>;
}

export const DEFAULT_DISCOVERY_CONFIG: DiscoveryConfig = {
  claude: {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    temperature: 0.3,
  },
  search: {
    max_queries_per_run: 50,
    max_results_per_query: 20,
    rate_limit_ms: 2000,
  },
  learning: {
    min_feedback_for_learning: 10,
    strategy_expiry_days: 30,
    low_success_threshold: 0.3,
    high_success_threshold: 0.7,
    auto_deprecate_below: 0.1,
  },
  platforms: {
    'uber-eats': { enabled: true, countries: ['CH', 'DE', 'AT', 'NL', 'UK', 'FR', 'ES', 'IT', 'BE', 'PL'] },
    'just-eat': { enabled: true, countries: ['CH', 'NL', 'UK', 'FR', 'ES', 'IT', 'BE', 'PL'] },
    'lieferando': { enabled: true, countries: ['DE', 'AT', 'NL', 'BE', 'PL'] },
    'wolt': { enabled: true, countries: ['DE', 'AT', 'PL'] },
    'smood': { enabled: true, countries: ['CH'] },
    'deliveroo': { enabled: true, countries: ['UK', 'FR', 'ES', 'IT', 'BE', 'NL'] },
    'glovo': { enabled: true, countries: ['ES', 'IT', 'PL'] },
  },
};

// =============================================================================
// SEED STRATEGIES
// =============================================================================

export const SEED_STRATEGIES: Omit<DiscoveryStrategy, 'id' | 'created_at'>[] = [
  // Switzerland - Just Eat
  {
    platform: 'just-eat',
    country: 'CH',
    query_template: 'site:just-eat.ch planted chicken {city}',
    success_rate: 70,
    total_uses: 0,
    successful_discoveries: 0,
    false_positives: 0,
    tags: ['city-specific', 'product-specific'],
    origin: 'seed',
  },
  {
    platform: 'just-eat',
    country: 'CH',
    query_template: 'site:just-eat.ch "planted.chicken" {city}',
    success_rate: 80,
    total_uses: 0,
    successful_discoveries: 0,
    false_positives: 0,
    tags: ['city-specific', 'high-precision'],
    origin: 'seed',
  },
  {
    platform: 'just-eat',
    country: 'CH',
    query_template: 'site:just-eat.ch "{chain}" alle standorte',
    success_rate: 75,
    total_uses: 0,
    successful_discoveries: 0,
    false_positives: 0,
    tags: ['chain-discovery'],
    origin: 'seed',
  },

  // Switzerland - Uber Eats
  {
    platform: 'uber-eats',
    country: 'CH',
    query_template: 'site:ubereats.com/ch planted chicken {city}',
    success_rate: 70,
    total_uses: 0,
    successful_discoveries: 0,
    false_positives: 0,
    tags: ['city-specific', 'product-specific'],
    origin: 'seed',
  },

  // Switzerland - Smood
  {
    platform: 'smood',
    country: 'CH',
    query_template: 'site:smood.ch planted {city}',
    success_rate: 65,
    total_uses: 0,
    successful_discoveries: 0,
    false_positives: 0,
    tags: ['city-specific', 'broad-search'],
    origin: 'seed',
  },

  // Germany - Uber Eats
  {
    platform: 'uber-eats',
    country: 'DE',
    query_template: 'site:ubereats.com/de planted chicken {city}',
    success_rate: 70,
    total_uses: 0,
    successful_discoveries: 0,
    false_positives: 0,
    tags: ['city-specific', 'product-specific'],
    origin: 'seed',
  },
  {
    platform: 'uber-eats',
    country: 'DE',
    query_template: 'site:ubereats.com/de "planted.chicken" {city}',
    success_rate: 80,
    total_uses: 0,
    successful_discoveries: 0,
    false_positives: 0,
    tags: ['city-specific', 'high-precision'],
    origin: 'seed',
  },

  // Germany - Lieferando
  {
    platform: 'lieferando',
    country: 'DE',
    query_template: 'site:lieferando.de planted chicken {city}',
    success_rate: 70,
    total_uses: 0,
    successful_discoveries: 0,
    false_positives: 0,
    tags: ['city-specific', 'product-specific'],
    origin: 'seed',
  },
  {
    platform: 'lieferando',
    country: 'DE',
    query_template: 'site:lieferando.de "planted.chicken" {city}',
    success_rate: 80,
    total_uses: 0,
    successful_discoveries: 0,
    false_positives: 0,
    tags: ['city-specific', 'high-precision'],
    origin: 'seed',
  },
  {
    platform: 'lieferando',
    country: 'DE',
    query_template: 'site:lieferando.de planted kebab vegan {city}',
    success_rate: 65,
    total_uses: 0,
    successful_discoveries: 0,
    false_positives: 0,
    tags: ['city-specific', 'product-specific'],
    origin: 'seed',
  },

  // Germany - Wolt
  {
    platform: 'wolt',
    country: 'DE',
    query_template: 'site:wolt.com/de planted chicken {city}',
    success_rate: 70,
    total_uses: 0,
    successful_discoveries: 0,
    false_positives: 0,
    tags: ['city-specific', 'product-specific'],
    origin: 'seed',
  },
  {
    platform: 'wolt',
    country: 'DE',
    query_template: 'site:wolt.com/de "planted.chicken" {city}',
    success_rate: 80,
    total_uses: 0,
    successful_discoveries: 0,
    false_positives: 0,
    tags: ['city-specific', 'high-precision'],
    origin: 'seed',
  },

  // Austria - Uber Eats
  {
    platform: 'uber-eats',
    country: 'AT',
    query_template: 'site:ubereats.com/at planted chicken {city}',
    success_rate: 70,
    total_uses: 0,
    successful_discoveries: 0,
    false_positives: 0,
    tags: ['city-specific', 'product-specific'],
    origin: 'seed',
  },

  // Austria - Lieferando
  {
    platform: 'lieferando',
    country: 'AT',
    query_template: 'site:lieferando.at planted chicken {city}',
    success_rate: 70,
    total_uses: 0,
    successful_discoveries: 0,
    false_positives: 0,
    tags: ['city-specific', 'product-specific'],
    origin: 'seed',
  },
  {
    platform: 'lieferando',
    country: 'AT',
    query_template: 'site:lieferando.at "planted.chicken" {city}',
    success_rate: 80,
    total_uses: 0,
    successful_discoveries: 0,
    false_positives: 0,
    tags: ['city-specific', 'high-precision'],
    origin: 'seed',
  },

  // Austria - Wolt
  {
    platform: 'wolt',
    country: 'AT',
    query_template: 'site:wolt.com/at planted chicken {city}',
    success_rate: 70,
    total_uses: 0,
    successful_discoveries: 0,
    false_positives: 0,
    tags: ['city-specific', 'product-specific'],
    origin: 'seed',
  },

  // Chain enumeration (all platforms)
  {
    platform: 'uber-eats',
    country: 'CH',
    query_template: '"{chain}" ubereats.com standorte filialen',
    success_rate: 60,
    total_uses: 0,
    successful_discoveries: 0,
    false_positives: 0,
    tags: ['chain-discovery'],
    origin: 'seed',
  },
  {
    platform: 'lieferando',
    country: 'DE',
    query_template: '"{chain}" lieferando alle restaurants',
    success_rate: 60,
    total_uses: 0,
    successful_discoveries: 0,
    false_positives: 0,
    tags: ['chain-discovery'],
    origin: 'seed',
  },

  // =========================================================================
  // NEW PLATFORMS AND COUNTRIES
  // =========================================================================

  // Netherlands - Thuisbezorgd (Just Eat brand)
  {
    platform: 'just-eat',
    country: 'NL',
    query_template: 'site:thuisbezorgd.nl planted chicken {city}',
    success_rate: 70,
    total_uses: 0,
    successful_discoveries: 0,
    false_positives: 0,
    tags: ['city-specific', 'product-specific'],
    origin: 'seed',
  },
  {
    platform: 'just-eat',
    country: 'NL',
    query_template: 'site:thuisbezorgd.nl "planted" {city}',
    success_rate: 75,
    total_uses: 0,
    successful_discoveries: 0,
    false_positives: 0,
    tags: ['city-specific', 'high-precision'],
    origin: 'seed',
  },

  // Netherlands - Uber Eats
  {
    platform: 'uber-eats',
    country: 'NL',
    query_template: 'site:ubereats.com/nl planted chicken {city}',
    success_rate: 70,
    total_uses: 0,
    successful_discoveries: 0,
    false_positives: 0,
    tags: ['city-specific', 'product-specific'],
    origin: 'seed',
  },

  // Netherlands - Deliveroo
  {
    platform: 'deliveroo',
    country: 'NL',
    query_template: 'site:deliveroo.nl planted {city}',
    success_rate: 70,
    total_uses: 0,
    successful_discoveries: 0,
    false_positives: 0,
    tags: ['city-specific', 'product-specific'],
    origin: 'seed',
  },

  // UK - Deliveroo
  {
    platform: 'deliveroo',
    country: 'UK',
    query_template: 'site:deliveroo.co.uk planted chicken {city}',
    success_rate: 70,
    total_uses: 0,
    successful_discoveries: 0,
    false_positives: 0,
    tags: ['city-specific', 'product-specific'],
    origin: 'seed',
  },
  {
    platform: 'deliveroo',
    country: 'UK',
    query_template: 'site:deliveroo.co.uk "planted" vegan {city}',
    success_rate: 75,
    total_uses: 0,
    successful_discoveries: 0,
    false_positives: 0,
    tags: ['city-specific', 'high-precision'],
    origin: 'seed',
  },

  // UK - Just Eat
  {
    platform: 'just-eat',
    country: 'UK',
    query_template: 'site:just-eat.co.uk planted chicken {city}',
    success_rate: 70,
    total_uses: 0,
    successful_discoveries: 0,
    false_positives: 0,
    tags: ['city-specific', 'product-specific'],
    origin: 'seed',
  },

  // UK - Uber Eats
  {
    platform: 'uber-eats',
    country: 'UK',
    query_template: 'site:ubereats.com/gb planted chicken {city}',
    success_rate: 70,
    total_uses: 0,
    successful_discoveries: 0,
    false_positives: 0,
    tags: ['city-specific', 'product-specific'],
    origin: 'seed',
  },

  // France - Deliveroo
  {
    platform: 'deliveroo',
    country: 'FR',
    query_template: 'site:deliveroo.fr planted chicken {city}',
    success_rate: 70,
    total_uses: 0,
    successful_discoveries: 0,
    false_positives: 0,
    tags: ['city-specific', 'product-specific'],
    origin: 'seed',
  },
  {
    platform: 'deliveroo',
    country: 'FR',
    query_template: 'site:deliveroo.fr "planted" vegan {city}',
    success_rate: 75,
    total_uses: 0,
    successful_discoveries: 0,
    false_positives: 0,
    tags: ['city-specific', 'high-precision'],
    origin: 'seed',
  },

  // France - Uber Eats
  {
    platform: 'uber-eats',
    country: 'FR',
    query_template: 'site:ubereats.com/fr planted poulet {city}',
    success_rate: 70,
    total_uses: 0,
    successful_discoveries: 0,
    false_positives: 0,
    tags: ['city-specific', 'product-specific'],
    origin: 'seed',
  },

  // Spain - Glovo
  {
    platform: 'glovo',
    country: 'ES',
    query_template: 'site:glovoapp.com/es planted chicken {city}',
    success_rate: 70,
    total_uses: 0,
    successful_discoveries: 0,
    false_positives: 0,
    tags: ['city-specific', 'product-specific'],
    origin: 'seed',
  },
  {
    platform: 'glovo',
    country: 'ES',
    query_template: 'site:glovoapp.com/es "planted" vegano {city}',
    success_rate: 75,
    total_uses: 0,
    successful_discoveries: 0,
    false_positives: 0,
    tags: ['city-specific', 'high-precision'],
    origin: 'seed',
  },

  // Spain - Deliveroo
  {
    platform: 'deliveroo',
    country: 'ES',
    query_template: 'site:deliveroo.es planted chicken {city}',
    success_rate: 70,
    total_uses: 0,
    successful_discoveries: 0,
    false_positives: 0,
    tags: ['city-specific', 'product-specific'],
    origin: 'seed',
  },

  // Spain - Uber Eats
  {
    platform: 'uber-eats',
    country: 'ES',
    query_template: 'site:ubereats.com/es planted pollo {city}',
    success_rate: 70,
    total_uses: 0,
    successful_discoveries: 0,
    false_positives: 0,
    tags: ['city-specific', 'product-specific'],
    origin: 'seed',
  },

  // Italy - Glovo
  {
    platform: 'glovo',
    country: 'IT',
    query_template: 'site:glovoapp.com/it planted chicken {city}',
    success_rate: 70,
    total_uses: 0,
    successful_discoveries: 0,
    false_positives: 0,
    tags: ['city-specific', 'product-specific'],
    origin: 'seed',
  },

  // Italy - Deliveroo
  {
    platform: 'deliveroo',
    country: 'IT',
    query_template: 'site:deliveroo.it planted chicken {city}',
    success_rate: 70,
    total_uses: 0,
    successful_discoveries: 0,
    false_positives: 0,
    tags: ['city-specific', 'product-specific'],
    origin: 'seed',
  },

  // Italy - Just Eat
  {
    platform: 'just-eat',
    country: 'IT',
    query_template: 'site:justeat.it planted pollo {city}',
    success_rate: 70,
    total_uses: 0,
    successful_discoveries: 0,
    false_positives: 0,
    tags: ['city-specific', 'product-specific'],
    origin: 'seed',
  },

  // Italy - Uber Eats
  {
    platform: 'uber-eats',
    country: 'IT',
    query_template: 'site:ubereats.com/it planted chicken {city}',
    success_rate: 70,
    total_uses: 0,
    successful_discoveries: 0,
    false_positives: 0,
    tags: ['city-specific', 'product-specific'],
    origin: 'seed',
  },

  // Belgium - Deliveroo
  {
    platform: 'deliveroo',
    country: 'BE',
    query_template: 'site:deliveroo.be planted chicken {city}',
    success_rate: 70,
    total_uses: 0,
    successful_discoveries: 0,
    false_positives: 0,
    tags: ['city-specific', 'product-specific'],
    origin: 'seed',
  },

  // Belgium - Uber Eats
  {
    platform: 'uber-eats',
    country: 'BE',
    query_template: 'site:ubereats.com/be planted chicken {city}',
    success_rate: 70,
    total_uses: 0,
    successful_discoveries: 0,
    false_positives: 0,
    tags: ['city-specific', 'product-specific'],
    origin: 'seed',
  },

  // Belgium - Takeaway (Lieferando brand)
  {
    platform: 'lieferando',
    country: 'BE',
    query_template: 'site:takeaway.com/be planted chicken {city}',
    success_rate: 70,
    total_uses: 0,
    successful_discoveries: 0,
    false_positives: 0,
    tags: ['city-specific', 'product-specific'],
    origin: 'seed',
  },

  // Poland - Glovo
  {
    platform: 'glovo',
    country: 'PL',
    query_template: 'site:glovoapp.com/pl planted chicken {city}',
    success_rate: 70,
    total_uses: 0,
    successful_discoveries: 0,
    false_positives: 0,
    tags: ['city-specific', 'product-specific'],
    origin: 'seed',
  },

  // Poland - Wolt
  {
    platform: 'wolt',
    country: 'PL',
    query_template: 'site:wolt.com/pl planted chicken {city}',
    success_rate: 70,
    total_uses: 0,
    successful_discoveries: 0,
    false_positives: 0,
    tags: ['city-specific', 'product-specific'],
    origin: 'seed',
  },

  // Poland - Pyszne (Just Eat brand)
  {
    platform: 'just-eat',
    country: 'PL',
    query_template: 'site:pyszne.pl planted chicken {city}',
    success_rate: 70,
    total_uses: 0,
    successful_discoveries: 0,
    false_positives: 0,
    tags: ['city-specific', 'product-specific'],
    origin: 'seed',
  },

  // Poland - Uber Eats
  {
    platform: 'uber-eats',
    country: 'PL',
    query_template: 'site:ubereats.com/pl planted chicken {city}',
    success_rate: 70,
    total_uses: 0,
    successful_discoveries: 0,
    false_positives: 0,
    tags: ['city-specific', 'product-specific'],
    origin: 'seed',
  },
];

// =============================================================================
// CITIES BY COUNTRY
// =============================================================================

export const CITIES_BY_COUNTRY: Record<SupportedCountry, string[]> = {
  CH: [
    // Major cities
    'Zürich', 'Basel', 'Bern', 'Genf', 'Lausanne', 'Luzern',
    'St. Gallen', 'Winterthur', 'Lugano', 'Biel', 'Thun', 'Fribourg',
    // Additional cities
    'Chur', 'Schaffhausen', 'Neuchâtel', 'Sion', 'Zug', 'Uster',
    'Köniz', 'Rapperswil', 'Yverdon', 'Montreux', 'Aarau', 'Baden',
    'Wettingen', 'Dietikon', 'Olten', 'Solothurn', 'Bellinzona', 'Locarno',
  ],
  DE: [
    // === TIER 1: Major cities (pop > 500k) ===
    'Berlin', 'Hamburg', 'München', 'Köln', 'Frankfurt am Main', 'Stuttgart',
    'Düsseldorf', 'Leipzig', 'Dortmund', 'Essen', 'Bremen', 'Dresden',
    'Hannover', 'Nürnberg', 'Duisburg',
    // === TIER 2: Large cities (pop 200k-500k) ===
    'Bochum', 'Wuppertal', 'Bielefeld', 'Bonn', 'Münster', 'Mannheim',
    'Karlsruhe', 'Augsburg', 'Wiesbaden', 'Mönchengladbach', 'Gelsenkirchen',
    'Aachen', 'Braunschweig', 'Kiel', 'Chemnitz', 'Halle', 'Magdeburg',
    'Freiburg im Breisgau', 'Krefeld', 'Mainz', 'Lübeck', 'Erfurt', 'Rostock',
    'Kassel', 'Hagen', 'Saarbrücken', 'Hamm', 'Potsdam', 'Ludwigshafen',
    'Oldenburg', 'Osnabrück', 'Leverkusen', 'Heidelberg', 'Darmstadt',
    'Solingen', 'Regensburg', 'Herne', 'Paderborn', 'Neuss',
    // === TIER 3: Medium cities (pop 100k-200k) ===
    'Ingolstadt', 'Würzburg', 'Ulm', 'Wolfsburg', 'Göttingen', 'Offenbach',
    'Reutlingen', 'Koblenz', 'Bremerhaven', 'Trier', 'Jena', 'Erlangen',
    'Remscheid', 'Moers', 'Siegen', 'Hildesheim', 'Salzgitter', 'Cottbus',
    'Kaiserslautern', 'Gütersloh', 'Schwerin', 'Witten', 'Gera', 'Iserlohn',
    'Zwickau', 'Düren', 'Ratingen', 'Esslingen', 'Hanau', 'Ludwigsburg',
    'Flensburg', 'Marl', 'Lünen', 'Wilhelmshaven', 'Velbert', 'Minden',
    'Konstanz', 'Neumünster', 'Norderstedt', 'Detmold', 'Viersen', 'Dorsten',
    'Marburg', 'Arnsberg', 'Lüdenscheid', 'Gladbeck', 'Troisdorf', 'Kerpen',
    'Castrop-Rauxel', 'Rheine', 'Recklinghausen', 'Bergisch Gladbach', 'Bottrop',
    // === TIER 4: Smaller cities with delivery coverage (pop 50k-100k) ===
    'Gießen', 'Fulda', 'Weimar', 'Langen', 'Friedrichshafen', 'Stralsund',
    'Greifswald', 'Brandenburg', 'Bayreuth', 'Celle', 'Aschaffenburg',
    'Bamberg', 'Landshut', 'Passau', 'Rosenheim', 'Kempten', 'Neu-Ulm',
    'Schweinfurt', 'Ravensburg', 'Sindelfingen', 'Böblingen', 'Pforzheim',
    'Villingen-Schwenningen', 'Offenburg', 'Tübingen', 'Heidenheim', 'Rastatt',
    'Lörrach', 'Baden-Baden', 'Göppingen', 'Waiblingen', 'Schwäbisch Gmünd',
    'Heilbronn', 'Neckarsulm', 'Bietigheim-Bissingen', 'Leonberg', 'Weinheim',
    'Speyer', 'Frankenthal', 'Neustadt an der Weinstraße', 'Landau', 'Pirmasens',
    'Idar-Oberstein', 'Bad Kreuznach', 'Neuwied', 'Andernach', 'Bad Homburg',
    'Oberursel', 'Friedberg', 'Bad Vilbel', 'Wetzlar', 'Limburg', 'Bensheim',
    'Viernheim', 'Rüsselsheim', 'Dreieich', 'Rodgau', 'Dietzenbach', 'Heusenstamm',
  ],
  AT: [
    // Major cities
    'Wien', 'Graz', 'Linz', 'Salzburg', 'Innsbruck', 'Klagenfurt',
    // Additional cities
    'Villach', 'Wels', 'St. Pölten', 'Dornbirn', 'Wiener Neustadt', 'Steyr',
    'Feldkirch', 'Bregenz', 'Leonding', 'Klosterneuburg', 'Baden', 'Wolfsberg',
    'Leoben', 'Krems', 'Traun', 'Amstetten', 'Lustenau', 'Kapfenberg',
  ],
  NL: [
    // Randstad region
    'Amsterdam', 'Rotterdam', 'Den Haag', 'Utrecht',
    // Major cities
    'Eindhoven', 'Groningen', 'Tilburg', 'Almere', 'Breda', 'Nijmegen',
    // Medium cities
    'Apeldoorn', 'Haarlem', 'Arnhem', 'Enschede', 'Amersfoort', 'Zaanstad',
    'Haarlemmermeer', 's-Hertogenbosch', 'Zoetermeer', 'Zwolle', 'Maastricht',
    'Leiden', 'Dordrecht', 'Ede', 'Delft', 'Deventer', 'Alkmaar', 'Helmond',
    'Hilversum', 'Leeuwarden', 'Venlo', 'Heerlen', 'Roosendaal', 'Oss',
  ],
  UK: [
    // Major cities
    'London', 'Birmingham', 'Manchester', 'Leeds', 'Glasgow', 'Liverpool',
    'Newcastle', 'Sheffield', 'Bristol', 'Edinburgh', 'Leicester', 'Nottingham',
    // Large cities
    'Cardiff', 'Belfast', 'Southampton', 'Brighton', 'Plymouth', 'Reading',
    'Wolverhampton', 'Derby', 'Swansea', 'Coventry', 'Hull', 'Bradford',
    // Medium cities
    'Stoke-on-Trent', 'Preston', 'Sunderland', 'Luton', 'Oxford', 'Cambridge',
    'Milton Keynes', 'Middlesbrough', 'Bolton', 'Blackpool', 'Bournemouth',
    'Slough', 'Peterborough', 'Ipswich', 'Colchester', 'Huddersfield', 'York',
    'Warrington', 'Dundee', 'Aberdeen', 'Blackburn', 'Stockport', 'Newport',
    'Gloucester', 'Exeter', 'Norwich', 'Portsmouth', 'Worcester', 'Bath',
    'Chester', 'Northampton', 'Cheltenham', 'Eastbourne', 'Worthing', 'Crawley',
  ],
  FR: [
    // Major cities
    'Paris', 'Marseille', 'Lyon', 'Toulouse', 'Nice', 'Nantes',
    'Strasbourg', 'Montpellier', 'Bordeaux', 'Lille', 'Rennes', 'Reims',
    // Large cities
    'Le Havre', 'Saint-Étienne', 'Toulon', 'Grenoble', 'Dijon', 'Angers',
    'Nîmes', 'Villeurbanne', 'Le Mans', 'Aix-en-Provence', 'Clermont-Ferrand',
    'Brest', 'Tours', 'Amiens', 'Limoges', 'Annecy', 'Perpignan',
    // Medium cities
    'Besançon', 'Metz', 'Orléans', 'Rouen', 'Mulhouse', 'Caen', 'Nancy',
    'Saint-Denis', 'Argenteuil', 'Montreuil', 'Roubaix', 'Tourcoing', 'Avignon',
    'Dunkerque', 'Poitiers', 'Versailles', 'Courbevoie', 'Créteil', 'Pau',
    'La Rochelle', 'Calais', 'Antibes', 'Cannes', 'Saint-Nazaire', 'Colmar',
  ],
  ES: [
    // Major cities
    'Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Zaragoza', 'Málaga',
    'Murcia', 'Palma de Mallorca', 'Las Palmas', 'Bilbao',
    // Large cities
    'Alicante', 'Córdoba', 'Valladolid', 'Vigo', 'Gijón', 'Hospitalet',
    'A Coruña', 'Granada', 'Vitoria-Gasteiz', 'Elche', 'Oviedo', 'Badalona',
    // Medium cities
    'Santa Cruz de Tenerife', 'Cartagena', 'Terrassa', 'Jerez de la Frontera',
    'Sabadell', 'Móstoles', 'Alcalá de Henares', 'Pamplona', 'Fuenlabrada',
    'Almería', 'Leganés', 'San Sebastián', 'Santander', 'Burgos', 'Castellón',
    'Getafe', 'Albacete', 'Alcorcón', 'Logroño', 'San Cristóbal de La Laguna',
    'Badajoz', 'Salamanca', 'Huelva', 'Lleida', 'Marbella', 'Tarragona',
    'León', 'Cádiz', 'Dos Hermanas', 'Torrejón de Ardoz', 'Parla', 'Mataró',
  ],
  IT: [
    // Major cities
    'Roma', 'Milano', 'Napoli', 'Torino', 'Palermo', 'Genova',
    'Bologna', 'Firenze', 'Bari', 'Catania', 'Venezia', 'Verona',
    // Large cities
    'Messina', 'Padova', 'Trieste', 'Brescia', 'Parma', 'Taranto',
    'Prato', 'Modena', 'Reggio Calabria', 'Reggio Emilia', 'Perugia',
    // Medium cities
    'Ravenna', 'Livorno', 'Cagliari', 'Foggia', 'Rimini', 'Salerno',
    'Ferrara', 'Sassari', 'Latina', 'Giugliano', 'Monza', 'Siracusa',
    'Pescara', 'Bergamo', 'Forlì', 'Trento', 'Vicenza', 'Terni', 'Bolzano',
    'Novara', 'Piacenza', 'Ancona', 'Andria', 'Arezzo', 'Udine', 'Cesena',
    'Lecce', 'Pesaro', 'Barletta', 'Alessandria', 'La Spezia', 'Catanzaro',
  ],
  BE: [
    // Major cities
    'Bruxelles', 'Antwerpen', 'Gent', 'Charleroi', 'Liège', 'Brugge',
    // Medium cities
    'Namur', 'Leuven', 'Mons', 'Aalst', 'Mechelen', 'La Louvière',
    'Kortrijk', 'Hasselt', 'Sint-Niklaas', 'Ostende', 'Tournai', 'Genk',
    'Seraing', 'Roeselare', 'Verviers', 'Mouscron', 'Dendermonde', 'Beringen',
  ],
  PL: [
    // Major cities
    'Warszawa', 'Kraków', 'Łódź', 'Wrocław', 'Poznań', 'Gdańsk',
    'Szczecin', 'Bydgoszcz', 'Lublin', 'Białystok', 'Katowice',
    // Large cities
    'Gdynia', 'Częstochowa', 'Radom', 'Sosnowiec', 'Toruń', 'Kielce',
    'Rzeszów', 'Gliwice', 'Zabrze', 'Olsztyn', 'Bielsko-Biała', 'Bytom',
    // Medium cities
    'Zielona Góra', 'Rybnik', 'Ruda Śląska', 'Opole', 'Tychy', 'Gorzów',
    'Dąbrowa Górnicza', 'Płock', 'Elbląg', 'Wałbrzych', 'Włocławek', 'Tarnów',
    'Chorzów', 'Koszalin', 'Kalisz', 'Legnica', 'Grudziądz', 'Jaworzno',
    'Słupsk', 'Jastrzębie-Zdrój', 'Nowy Sącz', 'Jelenia Góra', 'Siedlce',
  ],
};
