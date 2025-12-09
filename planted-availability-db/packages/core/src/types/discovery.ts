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
  | 'smood';

export type SupportedCountry = 'CH' | 'DE' | 'AT';

export const PLATFORM_COUNTRIES: Record<DeliveryPlatform, SupportedCountry[]> = {
  'uber-eats': ['CH', 'DE', 'AT'],
  'just-eat': ['CH'],
  'lieferando': ['DE', 'AT'],
  'wolt': ['DE', 'AT'],
  'smood': ['CH'],
};

export const PLATFORM_URLS: Record<DeliveryPlatform, string> = {
  'uber-eats': 'ubereats.com',
  'just-eat': 'just-eat.ch',
  'lieferando': 'lieferando.de',
  'wolt': 'wolt.com',
  'smood': 'smood.ch',
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

export interface DiscoveredVenueAddress {
  street?: string;
  city: string;
  postal_code?: string;
  country: SupportedCountry;
  full_address?: string;
}

export interface DiscoveredVenueCoordinates {
  lat: number;
  lng: number;
  accuracy?: 'exact' | 'approximate' | 'city-center';
}

export interface DiscoveredDeliveryLink {
  platform: DeliveryPlatform;
  url: string;
  venue_id_on_platform?: string;
  verified: boolean;
  last_verified?: Date;
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
    'uber-eats': { enabled: true, countries: ['CH', 'DE', 'AT'] },
    'just-eat': { enabled: true, countries: ['CH'] },
    'lieferando': { enabled: true, countries: ['DE', 'AT'] },
    'wolt': { enabled: true, countries: ['DE', 'AT'] },
    'smood': { enabled: true, countries: ['CH'] },
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
];

// =============================================================================
// CITIES BY COUNTRY
// =============================================================================

export const CITIES_BY_COUNTRY: Record<SupportedCountry, string[]> = {
  CH: [
    'Zürich', 'Basel', 'Bern', 'Genf', 'Lausanne', 'Luzern',
    'St. Gallen', 'Winterthur', 'Lugano', 'Biel', 'Thun', 'Fribourg',
  ],
  DE: [
    // Major cities
    'Berlin', 'München', 'Hamburg', 'Frankfurt', 'Köln', 'Stuttgart',
    'Düsseldorf', 'Leipzig', 'Nürnberg', 'Dresden', 'Hannover', 'Bremen',
    // Mid-sized cities
    'Essen', 'Dortmund', 'Duisburg', 'Bochum', 'Wuppertal', 'Bielefeld',
    'Bonn', 'Münster', 'Mannheim', 'Karlsruhe', 'Augsburg', 'Wiesbaden',
    'Gelsenkirchen', 'Mönchengladbach', 'Braunschweig', 'Kiel', 'Chemnitz',
    'Aachen', 'Halle', 'Magdeburg', 'Freiburg', 'Krefeld', 'Mainz',
    // Smaller cities
    'Lübeck', 'Erfurt', 'Rostock', 'Kassel', 'Hagen', 'Saarbrücken',
    'Hamm', 'Potsdam', 'Ludwigshafen', 'Oldenburg', 'Osnabrück', 'Leverkusen',
    'Heidelberg', 'Darmstadt', 'Solingen', 'Regensburg', 'Paderborn', 'Ingolstadt',
    'Würzburg', 'Ulm', 'Wolfsburg', 'Göttingen', 'Offenbach', 'Reutlingen',
    'Koblenz', 'Bremerhaven', 'Trier', 'Jena', 'Erlangen', 'Konstanz',
  ],
  AT: [
    'Wien', 'Graz', 'Salzburg', 'Linz', 'Innsbruck', 'Klagenfurt',
  ],
};
