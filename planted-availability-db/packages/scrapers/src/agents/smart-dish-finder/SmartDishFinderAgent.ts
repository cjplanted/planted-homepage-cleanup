/**
 * Smart Dish Finder Agent
 *
 * An AI-powered agent that extracts dish information from delivery platform
 * pages. It learns from feedback to improve extraction accuracy over time.
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  dishExtractionStrategies,
  dishExtractionRuns,
  discoveredDishes,
  dishFeedback,
  discoveredVenues,
} from '@pad/database';
import type {
  DishExtractionRun,
  DishExtractionRunConfig,
  DishExtractionRunStats,
  DishExtractionStrategy,
  ExtractedDish,
  CreateExtractedDishInput,
  VenuePage,
  PageExtractionResult,
  ExtractedDishFromPage,
  PriceEntry,
  DishLearningResult,
  DishFinderConfig,
  DeliveryPlatform,
  SupportedCountry,
  ConfidenceFactor,
  PlantedProductSku,
  DishFeedback,
} from '@pad/core';
import {
  DISH_SEED_STRATEGIES,
  CURRENCY_BY_COUNTRY,
  PLANTED_PRODUCT_SKUS,
} from '@pad/core';
import { PuppeteerFetcher, getPuppeteerFetcher, closePuppeteerFetcher } from './PuppeteerFetcher.js';
import {
  DISH_FINDER_SYSTEM_PROMPT,
  DISH_EXTRACTION_PROMPT,
  DISH_LEARNING_PROMPT,
  JSON_MENU_EXTRACTION_PROMPT,
  fillPromptTemplate,
  truncateContent,
  cleanHtmlForExtraction,
} from './prompts.js';

export interface DishFinderAgentConfig {
  maxVenuesPerRun?: number;
  rateLimitMs?: number;
  dryRun?: boolean;
  verbose?: boolean;
}

interface VenueToProcess {
  id: string;
  name: string;
  chain_id?: string;
  chain_name?: string;
  delivery_urls: Array<{
    platform: DeliveryPlatform;
    url: string;
    country: SupportedCountry;
  }>;
}

// Known chain products for higher confidence
const VERIFIED_CHAIN_PRODUCTS: Record<string, PlantedProductSku[]> = {
  'dean-david': ['planted.chicken'],
  'birdie-birdie': ['planted.chicken', 'planted.chicken_burger'],
  'kaimug': ['planted.chicken'],
  'nooch': ['planted.chicken'],
  'chidoba': ['planted.chicken'],
  'stadtsalat': ['planted.chicken'],
  'doen-doen': ['planted.kebab', 'planted.chicken'],
  'rabowls': ['planted.chicken'],
};

export class SmartDishFinderAgent {
  private anthropic: Anthropic;
  private fetcher: PuppeteerFetcher;
  private config: Required<DishFinderAgentConfig>;
  private fullConfig: DishFinderConfig;
  private currentRun: DishExtractionRun | null = null;
  private stats: DishExtractionRunStats;

  constructor(config?: DishFinderAgentConfig) {
    this.anthropic = new Anthropic();
    this.fetcher = getPuppeteerFetcher();

    const { DEFAULT_DISH_FINDER_CONFIG } = require('@pad/core');
    this.fullConfig = DEFAULT_DISH_FINDER_CONFIG;

    this.config = {
      maxVenuesPerRun: config?.maxVenuesPerRun || this.fullConfig.extraction.max_venues_per_run,
      rateLimitMs: config?.rateLimitMs || this.fullConfig.extraction.rate_limit_ms,
      dryRun: config?.dryRun || false,
      verbose: config?.verbose || false,
    };

    this.stats = this.emptyStats();
  }

  private emptyStats(): DishExtractionRunStats {
    return {
      venues_processed: 0,
      venues_successful: 0,
      venues_failed: 0,
      dishes_extracted: 0,
      dishes_updated: 0,
      dishes_verified: 0,
      prices_found: 0,
      images_found: 0,
      errors: 0,
    };
  }

  private log(message: string, data?: unknown): void {
    if (this.config.verbose) {
      console.log(`[DishFinder] ${message}`, data ? JSON.stringify(data, null, 2) : '');
    }
  }

  /**
   * Initialize the agent by seeding strategies if needed
   */
  async initialize(): Promise<void> {
    await this.fetcher.init();

    const existingCount = await dishExtractionStrategies.count();

    if (existingCount === 0) {
      this.log('No strategies found, seeding initial strategies...');
      const created = await dishExtractionStrategies.seedStrategies(DISH_SEED_STRATEGIES);
      this.log(`Seeded ${created} strategies`);
    } else {
      this.log(`Found ${existingCount} existing strategies`);
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await closePuppeteerFetcher();
  }

  /**
   * Run dish extraction
   */
  async runExtraction(config: DishExtractionRunConfig): Promise<DishExtractionRun> {
    this.log('Starting dish extraction run', config);
    this.stats = this.emptyStats();

    // Create the run record
    this.currentRun = await dishExtractionRuns.createRun({
      config,
      triggered_by: 'manual',
    });

    try {
      // Start the run
      this.currentRun = await dishExtractionRuns.startRun(this.currentRun!.id);

      // Initialize fetcher
      await this.fetcher.init();

      // Execute based on mode
      switch (config.mode) {
        case 'enrich':
          await this.enrichMode(config);
          break;
        case 'refresh':
          await this.refreshMode(config);
          break;
        case 'verify':
          await this.verifyMode(config);
          break;
      }

      // Complete the run
      this.currentRun = await dishExtractionRuns.completeRun(
        this.currentRun!.id,
        this.stats
      );

      this.log('Dish extraction run completed', this.stats);
      return this.currentRun!;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await dishExtractionRuns.failRun(this.currentRun!.id, {
        timestamp: new Date(),
        phase: 'extract',
        message: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Enrich mode: Add dishes to venues without dish data
   */
  private async enrichMode(config: DishExtractionRunConfig): Promise<void> {
    const venues = await this.getVenuesToProcess(config);

    this.log(`Found ${venues.length} venues to process`);

    for (const venue of venues.slice(0, config.max_venues || this.config.maxVenuesPerRun)) {
      try {
        await this.processVenue(venue);
        this.stats.venues_successful++;
      } catch (error) {
        this.log(`Error processing venue ${venue.name}: ${error}`);
        this.stats.venues_failed++;

        if (this.currentRun) {
          await dishExtractionRuns.addError(this.currentRun.id, {
            phase: 'extract',
            message: error instanceof Error ? error.message : String(error),
            venue_id: venue.id,
          });
        }
      }

      this.stats.venues_processed++;

      // Rate limiting
      await this.delay(this.config.rateLimitMs);
    }
  }

  /**
   * Refresh mode: Update prices for existing dishes
   */
  private async refreshMode(config: DishExtractionRunConfig): Promise<void> {
    // Get dishes that need refreshing
    const staleDishes = await discoveredDishes.getStaleDishes(7, config.max_venues || 50);

    this.log(`Found ${staleDishes.length} stale dishes to refresh`);

    // Group by venue
    const dishesbyVenue = new Map<string, ExtractedDish[]>();
    for (const dish of staleDishes) {
      const venueId = dish.venue_id;
      if (!dishesbyVenue.has(venueId)) {
        dishesbyVenue.set(venueId, []);
      }
      dishesbyVenue.get(venueId)!.push(dish);
    }

    // Process each venue
    for (const [venueId, venueDishes] of dishesbyVenue) {
      try {
        // Get venue info
        const existingVenue = await discoveredVenues.getById(venueId);
        if (!existingVenue) continue;

        const venue: VenueToProcess = {
          id: venueId,
          name: existingVenue.name,
          chain_id: existingVenue.chain_id,
          chain_name: existingVenue.chain_name,
          delivery_urls: existingVenue.delivery_platforms.map((p) => ({
            platform: p.platform,
            url: p.url,
            country: existingVenue.address.country,
          })),
        };

        // Re-extract dishes
        await this.processVenue(venue);

        // Mark dishes as refreshed
        this.stats.dishes_updated += venueDishes.length;

        this.stats.venues_successful++;
      } catch (error) {
        this.log(`Error refreshing venue ${venueId}: ${error}`);
        this.stats.venues_failed++;
      }

      this.stats.venues_processed++;
      await this.delay(this.config.rateLimitMs);
    }
  }

  /**
   * Verify mode: Check if dishes still exist
   */
  private async verifyMode(config: DishExtractionRunConfig): Promise<void> {
    const dishesToVerify = config.target_venues
      ? await discoveredDishes.query({ venue_id: config.target_venues[0] })
      : await discoveredDishes.getByStatus('verified', config.max_venues || 50);

    this.log(`Found ${dishesToVerify.length} dishes to verify`);

    for (const dish of dishesToVerify) {
      try {
        // Fetch the source URL
        const result = await this.fetcher.fetchPage(
          dish.source_url,
          {
            venue_id: dish.venue_id,
            venue_name: dish.venue_name,
            chain_id: dish.chain_id,
          }
        );

        if (result.success && result.page) {
          // Check if dish still exists on page
          const content = result.page.html || '';
          const dishExists = content.toLowerCase().includes(dish.name.toLowerCase());

          if (dishExists) {
            this.stats.dishes_verified++;
            await discoveredDishes.update(dish.id, { updated_at: new Date() });
          } else {
            // Mark as stale
            await discoveredDishes.markStale(dish.id);
          }
        } else {
          await discoveredDishes.markStale(dish.id);
        }
      } catch (error) {
        this.log(`Error verifying dish ${dish.name}: ${error}`);
      }

      await this.delay(500); // Lighter rate limit for verification
    }
  }

  /**
   * Get venues to process based on config
   */
  private async getVenuesToProcess(config: DishExtractionRunConfig): Promise<VenueToProcess[]> {
    const venues: VenueToProcess[] = [];

    // If specific venues requested
    if (config.target_venues && config.target_venues.length > 0) {
      for (const venueId of config.target_venues) {
        const venue = await discoveredVenues.getById(venueId);
        if (venue) {
          venues.push({
            id: venue.id,
            name: venue.name,
            chain_id: venue.chain_id,
            chain_name: venue.chain_name,
            delivery_urls: venue.delivery_platforms
              .filter((p) => !config.platforms || config.platforms.includes(p.platform))
              .map((p) => ({
                platform: p.platform,
                url: p.url,
                country: venue.address.country,
              })),
          });
        }
      }
      return venues;
    }

    // If specific chains requested
    if (config.target_chains && config.target_chains.length > 0) {
      for (const chainId of config.target_chains) {
        const chainVenues = await discoveredVenues.getChainLocations(chainId);

        // Filter to verified venues
        const verifiedVenues = chainVenues.filter((v) => v.status === 'verified');

        for (const venue of verifiedVenues) {
          venues.push({
            id: venue.id,
            name: venue.name,
            chain_id: venue.chain_id,
            chain_name: venue.chain_name,
            delivery_urls: venue.delivery_platforms
              .filter((dp) => !config.platforms || config.platforms.includes(dp.platform))
              .filter(() => !config.countries || config.countries.includes(venue.address.country))
              .map((dp) => ({
                platform: dp.platform,
                url: dp.url,
                country: venue.address.country,
              })),
          });
        }
      }
      return venues;
    }

    // Default: get verified venues without dishes
    const verifiedVenues = await discoveredVenues.getByStatus('verified');

    for (const venue of verifiedVenues) {
      // Check if venue already has dishes
      const existingDishes = await discoveredDishes.getByVenue(venue.id);
      if (existingDishes.length > 0) continue;

      // Filter by config
      const relevantPlatforms = venue.delivery_platforms
        .filter((dp) => !config.platforms || config.platforms.includes(dp.platform))
        .filter(() => !config.countries || config.countries.includes(venue.address.country));

      if (relevantPlatforms.length > 0) {
        venues.push({
          id: venue.id,
          name: venue.name,
          chain_id: venue.chain_id,
          chain_name: venue.chain_name,
          delivery_urls: relevantPlatforms.map((dp) => ({
            platform: dp.platform,
            url: dp.url,
            country: venue.address.country,
          })),
        });
      }
    }

    return venues;
  }

  /**
   * Process a single venue
   */
  private async processVenue(venue: VenueToProcess): Promise<void> {
    this.log(`Processing venue: ${venue.name}`);

    const allExtractedDishes: ExtractedDishFromPage[] = [];
    const pricesByDish = new Map<string, PriceEntry[]>();

    // Fetch and extract from each platform
    for (const { platform, url, country } of venue.delivery_urls) {
      try {
        // Get strategy for this platform
        const strategy = await dishExtractionStrategies.getStrategy(platform, venue.chain_id);

        // Fetch the page
        const result = await this.fetcher.fetchPage(url, {
          venue_id: venue.id,
          venue_name: venue.name,
          chain_id: venue.chain_id,
        });

        if (!result.success || !result.page) {
          this.log(`Failed to fetch ${url}: ${result.error}`);
          continue;
        }

        // Extract dishes
        const extracted = await this.extractDishes(result.page, strategy);

        // Track strategy usage
        if (strategy && this.currentRun) {
          await dishExtractionRuns.addStrategyUsed(this.currentRun.id, strategy.id);
          await dishExtractionStrategies.recordUsage(strategy.id, {
            success: extracted.dishes.length > 0,
            dishes_found: extracted.dishes.length,
          });
        }

        // Collect prices
        for (const dish of extracted.dishes) {
          allExtractedDishes.push(dish);

          const priceEntry: PriceEntry = {
            country,
            platform,
            price: parseFloat(dish.price) || 0,
            currency: dish.currency || CURRENCY_BY_COUNTRY[country],
            formatted: this.formatPrice(dish.price, dish.currency || CURRENCY_BY_COUNTRY[country]),
            last_seen: new Date(),
          };

          const key = dish.name.toLowerCase();
          if (!pricesByDish.has(key)) {
            pricesByDish.set(key, []);
          }
          pricesByDish.get(key)!.push(priceEntry);
        }
      } catch (error) {
        this.log(`Error extracting from ${platform}: ${error}`);
      }
    }

    // Deduplicate and store dishes
    await this.storeDishes(venue, allExtractedDishes, pricesByDish);
  }

  /**
   * Extract dishes from a page
   */
  private async extractDishes(
    page: VenuePage,
    _strategy: DishExtractionStrategy | null
  ): Promise<PageExtractionResult> {
    // Prepare content for Claude
    let content: string;

    if (page.json_data) {
      // Use JSON extraction prompt
      content = JSON.stringify(page.json_data, null, 2);
    } else if (page.html) {
      // Clean and truncate HTML
      content = cleanHtmlForExtraction(page.html);
      content = truncateContent(content, 6000);
    } else {
      return {
        dishes: [],
        page_quality: {
          menu_found: false,
          prices_visible: false,
          descriptions_available: false,
          images_available: false,
        },
      };
    }

    // Get known products for this chain
    const knownProducts = page.chain_id && VERIFIED_CHAIN_PRODUCTS[page.chain_id]
      ? VERIFIED_CHAIN_PRODUCTS[page.chain_id].join(', ')
      : 'unknown';

    // Build prompt
    const prompt = fillPromptTemplate(
      page.json_data ? JSON_MENU_EXTRACTION_PROMPT : DISH_EXTRACTION_PROMPT,
      {
        platform: page.platform,
        country: page.country,
        venue_name: page.venue_name,
        known_products: knownProducts,
        page_content: content,
        json_data: page.json_data ? content : undefined,
      }
    );

    try {
      const response = await this.anthropic.messages.create({
        model: this.fullConfig.claude.model,
        max_tokens: this.fullConfig.claude.max_tokens,
        temperature: this.fullConfig.claude.temperature,
        system: DISH_FINDER_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      });

      // Parse response
      const responseText = response.content[0].type === 'text'
        ? response.content[0].text
        : '';

      return this.parseExtractionResponse(responseText);
    } catch (error) {
      this.log(`Claude extraction error: ${error}`);
      return {
        dishes: [],
        page_quality: {
          menu_found: false,
          prices_visible: false,
          descriptions_available: false,
          images_available: false,
        },
        extraction_notes: `Error: ${error}`,
      };
    }
  }

  /**
   * Parse Claude's extraction response
   */
  private parseExtractionResponse(responseText: string): PageExtractionResult {
    try {
      // Find JSON in response (handle markdown code blocks)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return {
          dishes: [],
          page_quality: {
            menu_found: false,
            prices_visible: false,
            descriptions_available: false,
            images_available: false,
          },
        };
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        dishes: parsed.dishes || [],
        page_quality: parsed.page_quality || {
          menu_found: false,
          prices_visible: false,
          descriptions_available: false,
          images_available: false,
        },
        extraction_notes: parsed.extraction_notes,
      };
    } catch (error) {
      this.log(`Failed to parse extraction response: ${error}`);
      return {
        dishes: [],
        page_quality: {
          menu_found: false,
          prices_visible: false,
          descriptions_available: false,
          images_available: false,
        },
      };
    }
  }

  /**
   * Store extracted dishes
   */
  private async storeDishes(
    venue: VenueToProcess,
    dishes: ExtractedDishFromPage[],
    pricesByDish: Map<string, PriceEntry[]>
  ): Promise<void> {
    // Deduplicate by name
    const uniqueDishes = new Map<string, ExtractedDishFromPage>();
    for (const dish of dishes) {
      const key = dish.name.toLowerCase();
      const existing = uniqueDishes.get(key);

      // Keep the one with higher confidence
      if (!existing || dish.product_confidence > existing.product_confidence) {
        uniqueDishes.set(key, dish);
      }
    }

    this.log(`Storing ${uniqueDishes.size} unique dishes for ${venue.name}`);

    for (const [key, dish] of uniqueDishes) {
      // Check if dish already exists
      const existing = await discoveredDishes.findByNameAndVenue(dish.name, venue.id);

      // Get prices for this dish
      const prices = pricesByDish.get(key) || [];

      // Calculate price_by_country
      const priceByCountry: Partial<Record<SupportedCountry, string>> = {};
      for (const country of ['CH', 'DE', 'AT'] as SupportedCountry[]) {
        const countryPrices = prices.filter((p) => p.country === country);
        if (countryPrices.length > 0) {
          // Sort by last_seen, pick most recent
          countryPrices.sort((a, b) => b.last_seen.getTime() - a.last_seen.getTime());
          priceByCountry[country] = countryPrices[0].formatted;
        }
      }

      // Validate product
      const validProduct = this.validateProduct(dish.planted_product_guess);

      // Calculate confidence
      const confidence = await this.calculateConfidence(dish, venue);

      if (existing) {
        // Update existing dish
        await discoveredDishes.update(existing.id, {
          description: dish.description || existing.description,
          category: dish.category || existing.category,
          image_url: dish.image_url || existing.image_url,
          prices: [...existing.prices, ...prices],
          price_by_country: { ...existing.price_by_country, ...priceByCountry },
          confidence_score: confidence.score,
          confidence_factors: confidence.factors,
          updated_at: new Date(),
        });

        this.stats.dishes_updated++;
      } else {
        // Create new dish
        const newDish: CreateExtractedDishInput = {
          extraction_run_id: this.currentRun?.id || 'manual',
          venue_id: venue.id,
          venue_name: venue.name,
          chain_id: venue.chain_id,
          chain_name: venue.chain_name,
          name: dish.name,
          description: dish.description,
          category: dish.category,
          image_url: dish.image_url,
          planted_product: validProduct,
          product_confidence: dish.product_confidence,
          product_match_reason: dish.reasoning,
          prices,
          price_by_country: priceByCountry,
          is_vegan: dish.is_vegan,
          dietary_tags: dish.dietary_tags || [],
          confidence_score: confidence.score,
          confidence_factors: confidence.factors,
          discovered_by_strategy_id: 'claude-extraction',
          source_url: venue.delivery_urls[0]?.url || '',
        };

        if (!this.config.dryRun) {
          await discoveredDishes.createDish(newDish);
        }

        this.stats.dishes_extracted++;
      }

      // Track prices and images
      if (prices.length > 0) this.stats.prices_found++;
      if (dish.image_url) this.stats.images_found++;
    }
  }

  /**
   * Validate and normalize product SKU
   */
  private validateProduct(guess: string): PlantedProductSku {
    const normalized = guess.toLowerCase().replace(/\s+/g, '_');

    // Check if it's a valid product
    for (const product of PLANTED_PRODUCT_SKUS) {
      if (normalized === product || normalized.includes(product.replace('planted.', ''))) {
        return product;
      }
    }

    // Default to planted.chicken (most common)
    return 'planted.chicken';
  }

  /**
   * Calculate confidence score for a dish
   */
  private async calculateConfidence(
    dish: ExtractedDishFromPage,
    venue: VenueToProcess
  ): Promise<{ score: number; factors: ConfidenceFactor[] }> {
    const factors: ConfidenceFactor[] = [];

    // Name clarity
    const nameHasPlanted = dish.name.toLowerCase().includes('planted');
    factors.push({
      factor: 'name_clarity',
      score: nameHasPlanted ? 90 : 50,
      reason: nameHasPlanted
        ? "Dish name contains 'planted'"
        : 'Planted brand not in dish name',
    });

    // Description evidence
    const descHasPlanted = (dish.description || '').toLowerCase().includes('planted');
    factors.push({
      factor: 'description_evidence',
      score: descHasPlanted ? 85 : (dish.description ? 40 : 20),
      reason: descHasPlanted
        ? "Description mentions 'planted'"
        : dish.description ? 'Description exists but no planted mention' : 'No description available',
    });

    // Price validity
    const price = parseFloat(dish.price);
    const priceValid = price > 5 && price < 50;
    factors.push({
      factor: 'price_validity',
      score: priceValid ? 90 : 40,
      reason: priceValid
        ? `Price ${dish.price} is within reasonable range`
        : `Price ${dish.price} seems unusual`,
    });

    // Chain knowledge
    const knownChain = venue.chain_id && VERIFIED_CHAIN_PRODUCTS[venue.chain_id];
    factors.push({
      factor: 'chain_knowledge',
      score: knownChain ? 95 : 60,
      reason: knownChain
        ? `Known chain partner: ${venue.chain_name || venue.chain_id}`
        : 'Not a known chain partner',
    });

    // Product match confidence
    factors.push({
      factor: 'product_match',
      score: dish.product_confidence,
      reason: dish.reasoning || 'AI-based product matching',
    });

    // Calculate overall score (weighted average)
    const weights = {
      name_clarity: 0.25,
      description_evidence: 0.2,
      price_validity: 0.15,
      chain_knowledge: 0.2,
      product_match: 0.2,
    };

    let totalScore = 0;
    for (const factor of factors) {
      const weight = weights[factor.factor as keyof typeof weights] || 0.1;
      totalScore += factor.score * weight;
    }

    return {
      score: Math.round(totalScore),
      factors,
    };
  }

  /**
   * Format price with currency
   */
  private formatPrice(price: string, currency: string): string {
    const numPrice = parseFloat(price);
    if (isNaN(numPrice)) return price;

    if (currency === 'CHF') {
      return `CHF ${numPrice.toFixed(2)}`;
    } else if (currency === 'EUR') {
      return `€${numPrice.toFixed(2)}`;
    } else if (currency === 'GBP') {
      return `£${numPrice.toFixed(2)}`;
    }

    return `${currency} ${numPrice.toFixed(2)}`;
  }

  /**
   * Run the learning process
   */
  async learn(): Promise<DishLearningResult> {
    this.log('Starting learning process...');

    // Get recent feedback
    const recentFeedback = await dishFeedback.getForLearning(7);
    if (recentFeedback.length < 10) {
      this.log('Not enough feedback data for learning');
      return {
        strategy_updates: [],
        new_strategies: [],
        insights: [],
      };
    }

    // Get current strategies
    const strategies = await dishExtractionStrategies.getAll();

    // Prepare feedback summary
    const feedbackSummary = recentFeedback.map((f: DishFeedback) => ({
      result_type: f.result_type,
      strategy_id: f.strategy_id,
      details: f.feedback_details,
    }));

    // Ask Claude to analyze
    const prompt = fillPromptTemplate(DISH_LEARNING_PROMPT, {
      days: '7',
      feedback_data: JSON.stringify(feedbackSummary, null, 2),
      strategies: JSON.stringify(strategies.map((s: DishExtractionStrategy) => ({
        id: s.id,
        platform: s.platform,
        success_rate: s.success_rate,
        total_uses: s.total_uses,
      })), null, 2),
    });

    try {
      const response = await this.anthropic.messages.create({
        model: this.fullConfig.claude.model,
        max_tokens: 2048,
        temperature: 0.3,
        system: DISH_FINDER_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      });

      const responseText = response.content[0].type === 'text'
        ? response.content[0].text
        : '';

      // Parse and return learning result
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as DishLearningResult;
      }
    } catch (error) {
      this.log(`Learning error: ${error}`);
    }

    return {
      strategy_updates: [],
      new_strategies: [],
      insights: [],
    };
  }

  /**
   * Get statistics
   */
  async getStats(): Promise<{
    total_strategies: number;
    total_dishes: number;
    dishes_by_status: Record<string, number>;
    dishes_by_product: Record<string, number>;
    average_confidence: number;
  }> {
    const [strategyTiers, dishStats] = await Promise.all([
      dishExtractionStrategies.getStrategyTiers(),
      discoveredDishes.getStats(),
    ]);

    return {
      total_strategies:
        strategyTiers.high.length +
        strategyTiers.medium.length +
        strategyTiers.low.length +
        strategyTiers.untested.length,
      total_dishes: dishStats.total,
      dishes_by_status: dishStats.by_status,
      dishes_by_product: dishStats.by_product,
      average_confidence: dishStats.average_confidence,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
