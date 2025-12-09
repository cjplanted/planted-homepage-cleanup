/**
 * Smart Discovery Agent
 *
 * An AI-powered agent that discovers restaurants serving Planted products
 * through web searches on delivery platforms. It learns from feedback
 * to improve its search strategies over time.
 */

import {
  discoveryStrategies,
  discoveryRuns,
  discoveredVenues,
  searchFeedback,
} from '@pad/database';
import type {
  DiscoveryStrategy,
  DiscoveryRun,
  DiscoveryRunConfig,
  DiscoveryRunStats,
  DeliveryPlatform,
  SupportedCountry,
  SearchContext,
  ParsedVenue,
  LearnedPattern,
  DiscoveredDish,
  ExtractedDishFromPage,
} from '@pad/core';
import { type AIClient, type AIProvider, getAIClient } from './AIClient.js';
import { DishFinderAIClient } from '../smart-dish-finder/DishFinderAIClient.js';

export interface DiscoveryAgentConfig {
  maxQueriesPerRun?: number;
  rateLimitMs?: number;
  dryRun?: boolean;
  verbose?: boolean;
  aiProvider?: AIProvider;
  extractDishesInline?: boolean; // Whether to extract dishes during venue discovery
}

export interface WebSearchResult {
  title: string;
  url: string;
  snippet?: string;
  position: number;
}

export interface WebSearchProvider {
  search(query: string): Promise<WebSearchResult[]>;
}

/**
 * Smart Discovery Agent that learns to find Planted restaurants
 */
// Known brand misuse chains - these claim to use "planted" but don't actually use Planted products
const BRAND_MISUSE_CHAINS = [
  'goldies',
  'goldies smashburger',
  'goldies chicken',
];

// Verified partner chains with their known products
const VERIFIED_CHAIN_PRODUCTS: Record<string, string[]> = {
  'birdie birdie': ['planted.chicken_burger', 'planted.chicken_tenders'],
  'dean&david': ['planted.chicken', 'planted.duck'],
  'deanddavid': ['planted.chicken', 'planted.duck'],
  'dean david': ['planted.chicken', 'planted.duck'],
  'beets&roots': ['planted.chicken', 'planted.steak'],
  'beetsandroots': ['planted.chicken', 'planted.steak'],
  'beets and roots': ['planted.chicken', 'planted.steak'],
  'green club': ['planted.chicken', 'planted.kebab', 'planted.pastrami'],
  'nooch': ['planted.chicken'],
  'nooch asian': ['planted.chicken'],
  'rice up': ['planted.chicken'],
  'smash bro': ['planted.chicken'],
  'doen doen': ['planted.kebab', 'planted.chicken'],
};

export class SmartDiscoveryAgent {
  private ai: AIClient | null = null;
  private aiProvider: AIProvider | undefined;
  private searchProvider: WebSearchProvider;
  private config: Required<Omit<DiscoveryAgentConfig, 'aiProvider'>>;
  private currentRun: DiscoveryRun | null = null;
  private stats: DiscoveryRunStats;
  private dishFinder: DishFinderAIClient | null = null;

  constructor(
    searchProvider: WebSearchProvider,
    config?: DiscoveryAgentConfig
  ) {
    this.aiProvider = config?.aiProvider;
    this.searchProvider = searchProvider;
    this.config = {
      maxQueriesPerRun: config?.maxQueriesPerRun || 50,
      rateLimitMs: config?.rateLimitMs || 2000,
      dryRun: config?.dryRun || false,
      verbose: config?.verbose || false,
      extractDishesInline: config?.extractDishesInline ?? true, // Default to inline extraction
    };
    this.stats = this.emptyStats();
  }

  private emptyStats(): DiscoveryRunStats {
    return {
      queries_executed: 0,
      queries_successful: 0,
      queries_failed: 0,
      venues_discovered: 0,
      venues_verified: 0,
      venues_rejected: 0,
      chains_detected: 0,
      new_strategies_created: 0,
    };
  }

  private log(message: string, data?: unknown): void {
    if (this.config.verbose) {
      console.log(`[SmartDiscovery] ${message}`, data ? JSON.stringify(data, null, 2) : '');
    }
  }

  /**
   * Get the AI client (lazy initialization)
   */
  private async getAI(): Promise<AIClient> {
    if (!this.ai) {
      this.ai = await getAIClient({ provider: this.aiProvider });
      this.log(`Using AI provider: ${this.aiProvider || 'auto-detected'}`);
    }
    return this.ai;
  }

  /**
   * Get the dish finder client (lazy initialization)
   */
  private getDishFinder(): DishFinderAIClient {
    if (!this.dishFinder) {
      this.dishFinder = new DishFinderAIClient();
    }
    return this.dishFinder;
  }

  /**
   * Initialize the agent by seeding strategies if needed
   */
  async initialize(): Promise<void> {
    const existingCount = await discoveryStrategies.count();

    if (existingCount === 0) {
      this.log('No strategies found, seeding initial strategies...');
      const { SEED_STRATEGIES } = await import('@pad/core');
      const created = await discoveryStrategies.seedStrategies(SEED_STRATEGIES);
      this.log(`Seeded ${created} strategies`);
    } else {
      this.log(`Found ${existingCount} existing strategies`);
    }
  }

  /**
   * Run a discovery session
   */
  async runDiscovery(config: DiscoveryRunConfig): Promise<DiscoveryRun> {
    this.log('Starting discovery run', config);
    this.stats = this.emptyStats();

    // Create the run record
    this.currentRun = await discoveryRuns.createRun({
      config,
      triggered_by: 'manual',
    });

    try {
      // Start the run
      this.currentRun = await discoveryRuns.startRun(this.currentRun.id);

      // Execute discovery based on mode
      switch (config.mode) {
        case 'explore':
          await this.exploreMode(config);
          break;
        case 'enumerate':
          await this.enumerateMode(config);
          break;
        case 'verify':
          await this.verifyMode(config);
          break;
      }

      // Complete the run
      this.currentRun = await discoveryRuns.completeRun(
        this.currentRun.id,
        this.stats
      );

      this.log('Discovery run completed', this.stats);
      return this.currentRun;
    } catch (error) {
      // Record failure
      const errorMessage = error instanceof Error ? error.message : String(error);
      await discoveryRuns.failRun(this.currentRun.id, {
        timestamp: new Date(),
        phase: 'search',
        message: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Explore mode: Find new restaurants across platforms and countries
   */
  private async exploreMode(config: DiscoveryRunConfig): Promise<void> {
    const { CITIES_BY_COUNTRY } = await import('@pad/core');

    for (const platform of config.platforms) {
      for (const country of config.countries) {
        // Get strategies for this platform/country
        const strategies = await discoveryStrategies.getActiveStrategies(
          platform,
          country,
          { minSuccessRate: 30 }
        );

        this.log(`Found ${strategies.length} strategies for ${platform}/${country}`,
          strategies.map(s => ({ id: s.id, template: s.query_template, rate: s.success_rate })));

        if (strategies.length === 0) {
          this.log(`No strategies for ${platform}/${country}, generating queries with Claude`);
          await this.exploreWithClaude(platform, country);
          continue;
        }

        // Use top strategies
        for (const strategy of strategies.slice(0, 3)) {
          // Get cities for this country
          const cities = CITIES_BY_COUNTRY[country] || [];

          for (const city of cities.slice(0, 5)) {
            if (this.stats.queries_executed >= this.config.maxQueriesPerRun) {
              this.log('Max queries reached');
              return;
            }

            await this.executeStrategy(strategy, { city });
            await this.delay(this.config.rateLimitMs);
          }
        }
      }
    }
  }

  /**
   * Explore using Claude-generated queries when no strategies exist
   */
  private async exploreWithClaude(
    platform: DeliveryPlatform,
    country: SupportedCountry
  ): Promise<void> {
    const { CITIES_BY_COUNTRY } = await import('@pad/core');
    const cities = CITIES_BY_COUNTRY[country] || [];

    for (const city of cities.slice(0, 3)) {
      const context: SearchContext = {
        platform,
        country,
        city,
      };

      const ai = await this.getAI();
      const queries = await ai.generateQueries(context);

      for (const query of queries) {
        if (this.stats.queries_executed >= this.config.maxQueriesPerRun) {
          return;
        }

        await this.executeQuery(query.query, platform, country);
        await this.delay(this.config.rateLimitMs);
      }
    }
  }

  /**
   * Execute a strategy with variable substitution
   */
  private async executeStrategy(
    strategy: DiscoveryStrategy,
    variables: Record<string, string>
  ): Promise<void> {
    let query = strategy.query_template;

    // Replace variables
    for (const [key, value] of Object.entries(variables)) {
      query = query.replace(`{${key}}`, value);
    }

    // Replace platform URL
    const { PLATFORM_URLS } = await import('@pad/core');
    query = query.replace('{platform}', PLATFORM_URLS[strategy.platform]);

    await this.executeQuery(query, strategy.platform, strategy.country, strategy.id);

    // Track strategy usage
    if (this.currentRun) {
      await discoveryRuns.addStrategyUsed(this.currentRun.id, strategy.id);
    }
  }

  /**
   * Execute a single search query
   */
  private async executeQuery(
    query: string,
    platform: DeliveryPlatform,
    country: SupportedCountry,
    strategyId?: string
  ): Promise<void> {
    this.log(`Executing query: ${query}`);
    this.stats.queries_executed++;

    try {
      // Perform web search
      const results = await this.searchProvider.search(query);

      if (results.length === 0) {
        this.stats.queries_failed++;
        await this.recordFeedback(query, platform, country, strategyId, 'no_results');
        return;
      }

      // Parse results with Claude
      const ai = await this.getAI();
      const parsed = await ai.parseSearchResults(query, platform, results);

      // Process discovered venues
      for (const venue of parsed.venues) {
        await this.processDiscoveredVenue(venue, query, platform, country, strategyId);
      }

      // Process detected chains
      for (const chain of parsed.chains_detected) {
        if (chain.should_enumerate) {
          this.stats.chains_detected++;
          this.log(`Chain detected: ${chain.name}`, chain);
          // Queue for enumeration in next run
        }
      }

      this.stats.queries_successful++;
      if (parsed.venues.length > 0) {
        await this.recordFeedback(query, platform, country, strategyId, 'true_positive');

        // Update strategy success
        if (strategyId) {
          await discoveryStrategies.recordUsage(strategyId, {
            success: true,
            was_false_positive: false,
          });
        }
      }
    } catch (error) {
      this.stats.queries_failed++;
      this.log(`Query failed: ${error}`);

      await this.recordFeedback(query, platform, country, strategyId, 'error');

      if (this.currentRun) {
        await discoveryRuns.addError(this.currentRun.id, {
          phase: 'search',
          message: error instanceof Error ? error.message : String(error),
          query,
          platform,
        });
      }
    }
  }

  /**
   * Check if venue name matches a known brand misuse chain
   */
  private isBrandMisuse(venueName: string): boolean {
    const lower = venueName.toLowerCase();
    return BRAND_MISUSE_CHAINS.some(chain => lower.includes(chain));
  }

  /**
   * Get products for a known verified chain
   */
  private getVerifiedChainProducts(venueName: string): string[] | null {
    const lower = venueName.toLowerCase();
    for (const [chainPattern, products] of Object.entries(VERIFIED_CHAIN_PRODUCTS)) {
      if (lower.includes(chainPattern)) {
        return products;
      }
    }
    return null;
  }

  /**
   * Process a venue discovered from search results
   */
  private async processDiscoveredVenue(
    venue: ParsedVenue,
    query: string,
    platform: DeliveryPlatform,
    country: SupportedCountry,
    strategyId?: string
  ): Promise<void> {
    // Check if already discovered
    const existing = await discoveredVenues.findByDeliveryUrl(venue.url);
    if (existing) {
      this.log(`Venue already discovered: ${venue.name}`);
      return;
    }

    // Check for known brand misuse chains - skip these entirely
    if (this.isBrandMisuse(venue.name)) {
      this.log(`Skipping brand misuse venue: ${venue.name}`);
      return;
    }

    // Check for verified chain - use known products
    const knownProducts = this.getVerifiedChainProducts(venue.name);

    // Calculate confidence score
    const ai = await this.getAI();
    const confidence = await ai.scoreConfidence(
      venue,
      query,
      strategyId ? 70 : 50 // Use strategy success rate if available
    );

    // Determine products: known chain > extracted > empty
    let products: string[];
    if (knownProducts) {
      products = knownProducts;
    } else if (venue.planted_mentions.length > 0) {
      products = this.extractProducts(venue.planted_mentions);
    } else {
      products = [];
    }

    // Extract dishes inline if enabled
    let dishes: DiscoveredDish[] = [];
    if (this.config.extractDishesInline) {
      dishes = await this.extractDishesForVenue(venue.url, venue.name, platform, country);
      this.log(`Extracted ${dishes.length} dishes for venue: ${venue.name}`);

      // Update products based on extracted dishes if we didn't have any
      if (products.length === 0 && dishes.length > 0) {
        const dishProducts = [...new Set(dishes.map(d => d.planted_product))];
        products = dishProducts;
      }
    }

    // Create the discovered venue with dishes
    const discoveredVenue = await discoveredVenues.createVenue({
      discovery_run_id: this.currentRun?.id || 'manual',
      name: venue.name,
      is_chain: venue.is_likely_chain || knownProducts !== null,
      chain_confidence: venue.is_likely_chain ? venue.confidence : (knownProducts ? 95 : undefined),
      address: {
        city: venue.city || 'Unknown',
        country,
      },
      delivery_platforms: [
        {
          platform,
          url: venue.url,
          verified: false,
        },
      ],
      planted_products: products,
      dishes,
      confidence_score: knownProducts ? 90 : confidence.overall_score, // Higher confidence for known chains
      confidence_factors: confidence.factors,
      discovered_by_strategy_id: strategyId || 'claude-generated',
      discovered_by_query: query,
    });

    this.stats.venues_discovered++;
    this.log(`Discovered venue: ${venue.name}`, { id: discoveredVenue.id, products, dishCount: dishes.length });
  }

  /**
   * Extract dishes from a venue URL using the DishFinderAIClient
   */
  private async extractDishesForVenue(
    url: string,
    venueName: string,
    platform: DeliveryPlatform,
    country: SupportedCountry
  ): Promise<DiscoveredDish[]> {
    try {
      const dishFinder = this.getDishFinder();
      const result = await dishFinder.extractDishesFromUrl(url, {
        platform,
        country,
        venue_name: venueName,
      });

      // Convert extracted dishes to DiscoveredDish format
      return result.dishes.map((dish: ExtractedDishFromPage) => ({
        name: dish.name,
        description: dish.description,
        price: dish.price,
        currency: dish.currency,
        planted_product: dish.planted_product_guess || 'planted.chicken',
        is_vegan: dish.is_vegan,
        confidence: dish.product_confidence || 50,
      }));
    } catch (error) {
      this.log(`Failed to extract dishes for ${venueName}: ${error}`);
      return [];
    }
  }

  /**
   * Extract Planted product SKUs from text mentions
   * IMPORTANT: Only extracts if the word "planted" specifically appears (not just "plant" or "plant-based")
   */
  private extractProducts(mentions: string[]): string[] {
    const products = new Set<string>();

    for (const mention of mentions) {
      const lower = mention.toLowerCase();

      // CRITICAL: Must contain "planted" (the brand) not just "plant" or "plant-based"
      if (!lower.includes('planted')) {
        continue;
      }

      // Extract specific products
      if (lower.includes('chicken_tenders') || lower.includes('chicken tenders')) {
        products.add('planted.chicken_tenders');
      } else if (lower.includes('chicken_burger') || lower.includes('chicken burger')) {
        products.add('planted.chicken_burger');
      } else if (lower.includes('chicken')) {
        products.add('planted.chicken');
      }
      if (lower.includes('kebab')) products.add('planted.kebab');
      if (lower.includes('schnitzel')) products.add('planted.schnitzel');
      if (lower.includes('pulled')) products.add('planted.pulled');
      if (lower.includes('burger') && !lower.includes('chicken burger') && !lower.includes('chicken_burger')) {
        products.add('planted.burger');
      }
      if (lower.includes('steak')) products.add('planted.steak');
      if (lower.includes('pastrami')) products.add('planted.pastrami');
      if (lower.includes('duck')) products.add('planted.duck');
    }

    return Array.from(products);
  }

  /**
   * Record search feedback for learning
   */
  private async recordFeedback(
    query: string,
    platform: DeliveryPlatform,
    country: SupportedCountry,
    strategyId: string | undefined,
    resultType: 'true_positive' | 'false_positive' | 'no_results' | 'error'
  ): Promise<void> {
    if (this.config.dryRun) return;

    await searchFeedback.recordSearch({
      query,
      platform,
      country,
      strategy_id: strategyId || 'claude-generated',
      result_type: resultType,
    });
  }

  /**
   * Enumerate mode: Find all locations of known chains
   */
  private async enumerateMode(config: DiscoveryRunConfig): Promise<void> {
    if (!config.target_chains || config.target_chains.length === 0) {
      throw new Error('Enumerate mode requires target_chains');
    }

    for (const chainName of config.target_chains) {
      for (const platform of config.platforms) {
        for (const country of config.countries) {
          // Search for the chain
          const query = `site:${platform} "${chainName}" ${country}`;
          await this.executeQuery(query, platform, country);
          await this.delay(this.config.rateLimitMs);
        }
      }
    }
  }

  /**
   * Verify mode: Re-check existing venues
   */
  private async verifyMode(config: DiscoveryRunConfig): Promise<void> {
    const venuesToVerify = config.target_venues
      ? await discoveredVenues.getByIds(config.target_venues)
      : await discoveredVenues.getByStatus('discovered');

    for (const venue of venuesToVerify) {
      // Re-verify each platform link
      for (const link of venue.delivery_platforms) {
        try {
          // In a real implementation, we'd fetch the page and analyze it
          this.log(`Verifying: ${venue.name} on ${link.platform}`);

          // For now, just mark as checked
          // In reality, we'd use the page scraper here
        } catch (error) {
          this.log(`Verification failed for ${venue.name}: ${error}`);
        }
      }
    }
  }

  /**
   * Run the learning process to improve strategies
   */
  async learn(): Promise<LearnedPattern[]> {
    this.log('Starting learning process...');

    // Get recent feedback
    const recentFeedback = await searchFeedback.getForLearning(7);
    if (recentFeedback.length < 10) {
      this.log('Not enough feedback data for learning');
      return [];
    }

    // Get current strategies
    const strategies = await discoveryStrategies.getAll();

    // Ask Claude to analyze and suggest improvements
    const ai = await this.getAI();
    const learningResult = await ai.learnFromFeedback(
      recentFeedback,
      strategies
    );

    const patterns: LearnedPattern[] = [];

    // Apply strategy updates
    for (const update of learningResult.strategy_updates) {
      try {
        switch (update.action) {
          case 'deprecate':
            await discoveryStrategies.deprecate(update.strategy_id, update.reason);
            patterns.push({
              type: 'query_improvement',
              description: `Deprecated strategy: ${update.reason}`,
              confidence: 0.8,
              applied: true,
            });
            break;

          case 'boost':
            // Boost is implicit through success rate tracking
            patterns.push({
              type: 'query_improvement',
              description: `Strategy boosted: ${update.reason}`,
              confidence: 0.8,
              applied: true,
            });
            break;
        }
      } catch (error) {
        this.log(`Failed to apply update: ${error}`);
      }
    }

    // Create new strategies
    for (const newStrategy of learningResult.new_strategies) {
      try {
        await discoveryStrategies.create({
          platform: newStrategy.platform as DeliveryPlatform,
          country: newStrategy.country as SupportedCountry,
          query_template: newStrategy.query_template,
          success_rate: 50, // Start neutral
          total_uses: 0,
          successful_discoveries: 0,
          false_positives: 0,
          tags: ['high-precision'],
          origin: 'agent',
        });

        patterns.push({
          type: 'query_improvement',
          description: `New strategy created: ${newStrategy.reasoning}`,
          confidence: 0.7,
          applied: true,
        });

        this.stats.new_strategies_created++;
      } catch (error) {
        this.log(`Failed to create strategy: ${error}`);
      }
    }

    // Record insights
    for (const insight of learningResult.insights) {
      patterns.push({
        type: insight.type as LearnedPattern['type'],
        description: insight.description,
        confidence: insight.confidence,
        applied: false,
      });
    }

    this.log(`Learning complete. ${patterns.length} patterns identified.`);
    return patterns;
  }

  /**
   * Get statistics about the agent's performance
   */
  async getStats(): Promise<{
    total_strategies: number;
    strategies_by_tier: { high: number; medium: number; low: number; untested: number };
    total_venues_discovered: number;
    venues_by_status: Record<string, number>;
    search_success_rate: number;
  }> {
    const tiers = await discoveryStrategies.getStrategyTiers();
    const venueStats = await discoveredVenues.getStats();
    const feedbackStats = await searchFeedback.getStats();

    return {
      total_strategies:
        tiers.high.length + tiers.medium.length + tiers.low.length + tiers.untested.length,
      strategies_by_tier: {
        high: tiers.high.length,
        medium: tiers.medium.length,
        low: tiers.low.length,
        untested: tiers.untested.length,
      },
      total_venues_discovered: venueStats.total,
      venues_by_status: venueStats.by_status,
      search_success_rate: feedbackStats.overall_success_rate,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
