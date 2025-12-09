/**
 * Query Prioritizer for Smart Discovery Agent
 *
 * Allocates query budget across different priority tiers to maximize ROI:
 * - 40% (800 queries) - Known chain enumeration (highest ROI)
 * - 30% (600 queries) - High-success strategies (>50% success rate)
 * - 20% (400 queries) - City exploration (uncovered cities)
 * - 10% (200 queries) - Experimental queries
 */

import {
  discoveryStrategies,
  discoveredVenues,
  chains,
} from '@pad/database';
import type {
  DiscoveryStrategy,
  DeliveryPlatform,
  SupportedCountry,
} from '@pad/core';

// =============================================================================
// TYPES
// =============================================================================

export interface QueryPlan {
  chainEnumeration: ChainEnumerationQuery[];
  highYieldStrategies: HighYieldQuery[];
  cityExploration: CityExplorationQuery[];
  experimental: string[];
  totalQueries: number;
  budgetAllocation: BudgetAllocation;
}

export interface ChainEnumerationQuery {
  chain: string;
  cities: string[];
  platforms: DeliveryPlatform[];
  priority: number;
  estimatedQueries: number;
}

export interface HighYieldQuery {
  strategyId: string;
  strategy: DiscoveryStrategy;
  cities: string[];
  estimatedQueries: number;
  successRate: number;
}

export interface CityExplorationQuery {
  city: string;
  country: SupportedCountry;
  platforms: DeliveryPlatform[];
  estimatedQueries: number;
  coverageGap: number; // 0-100, higher = less covered
}

export interface BudgetAllocation {
  total: number;
  chainEnumeration: {
    allocated: number;
    percentage: number;
    actual: number;
  };
  highYieldStrategies: {
    allocated: number;
    percentage: number;
    actual: number;
  };
  cityExploration: {
    allocated: number;
    percentage: number;
    actual: number;
  };
  experimental: {
    allocated: number;
    percentage: number;
    actual: number;
  };
}

export interface ChainMetadata {
  chainName: string;
  chainId?: string;
  countries: SupportedCountry[];
  knownCities: string[];
  knownPlatforms: DeliveryPlatform[];
  estimatedTotalLocations: number;
  currentlyCovered: number;
  priority: number; // Higher = more important to discover
}

// =============================================================================
// CONSTANTS
// =============================================================================

const BUDGET_ALLOCATION_PERCENTAGES = {
  CHAIN_ENUMERATION: 0.40, // 40%
  HIGH_YIELD: 0.30, // 30%
  CITY_EXPLORATION: 0.20, // 20%
  EXPERIMENTAL: 0.10, // 10%
} as const;

const HIGH_YIELD_MIN_SUCCESS_RATE = 50; // Strategies with >50% success rate
const MIN_STRATEGY_USES_FOR_HIGH_YIELD = 5; // Need at least 5 uses for statistical significance

// Known chain patterns - these chains are verified Planted partners
const VERIFIED_CHAIN_NAMES = [
  'dean&david',
  'deanddavid',
  'dean david',
  'Birdie Birdie',
  'doen doen',
  'råbowls',
  'KAIMUG',
  'Brezelkönig',
  'Hiltl',
  'tibits',
  'Yardbird',
  'Nooch',
  'Nooch Asian Kitchen',
  'Hans im Glück',
  'Vapiano',
  'Subway',
  'Cotidiano',
  'beets&roots',
  'Green Club',
  'Rice Up',
  'Smash Bro',
] as const;

// Platform availability by country
const PLATFORMS_BY_COUNTRY: Record<SupportedCountry, DeliveryPlatform[]> = {
  CH: ['uber-eats', 'just-eat', 'smood'],
  DE: ['uber-eats', 'lieferando', 'wolt'],
  AT: ['uber-eats', 'lieferando', 'wolt'],
};

// =============================================================================
// QUERY PRIORITIZER CLASS
// =============================================================================

export class QueryPrioritizer {
  /**
   * Allocate query budget across different priority tiers
   */
  async allocateQueryBudget(totalBudget: number): Promise<QueryPlan> {
    // Calculate budget allocations
    const budgetAllocation: BudgetAllocation = {
      total: totalBudget,
      chainEnumeration: {
        allocated: Math.floor(totalBudget * BUDGET_ALLOCATION_PERCENTAGES.CHAIN_ENUMERATION),
        percentage: BUDGET_ALLOCATION_PERCENTAGES.CHAIN_ENUMERATION * 100,
        actual: 0,
      },
      highYieldStrategies: {
        allocated: Math.floor(totalBudget * BUDGET_ALLOCATION_PERCENTAGES.HIGH_YIELD),
        percentage: BUDGET_ALLOCATION_PERCENTAGES.HIGH_YIELD * 100,
        actual: 0,
      },
      cityExploration: {
        allocated: Math.floor(totalBudget * BUDGET_ALLOCATION_PERCENTAGES.CITY_EXPLORATION),
        percentage: BUDGET_ALLOCATION_PERCENTAGES.CITY_EXPLORATION * 100,
        actual: 0,
      },
      experimental: {
        allocated: Math.floor(totalBudget * BUDGET_ALLOCATION_PERCENTAGES.EXPERIMENTAL),
        percentage: BUDGET_ALLOCATION_PERCENTAGES.EXPERIMENTAL * 100,
        actual: 0,
      },
    };

    // 1. Chain Enumeration (40% of budget)
    const chainEnumeration = await this.planChainEnumeration(
      budgetAllocation.chainEnumeration.allocated
    );
    budgetAllocation.chainEnumeration.actual = this.countQueries(chainEnumeration);

    // 2. High-Yield Strategies (30% of budget)
    const highYieldStrategies = await this.planHighYieldStrategies(
      budgetAllocation.highYieldStrategies.allocated
    );
    budgetAllocation.highYieldStrategies.actual = this.countQueries(highYieldStrategies);

    // 3. City Exploration (20% of budget)
    const cityExploration = await this.planCityExploration(
      budgetAllocation.cityExploration.allocated
    );
    budgetAllocation.cityExploration.actual = this.countQueries(cityExploration);

    // 4. Experimental (10% of budget)
    const experimental = await this.planExperimentalQueries(
      budgetAllocation.experimental.allocated
    );
    budgetAllocation.experimental.actual = experimental.length;

    const totalQueries =
      budgetAllocation.chainEnumeration.actual +
      budgetAllocation.highYieldStrategies.actual +
      budgetAllocation.cityExploration.actual +
      budgetAllocation.experimental.actual;

    return {
      chainEnumeration,
      highYieldStrategies,
      cityExploration,
      experimental,
      totalQueries,
      budgetAllocation,
    };
  }

  /**
   * Get verified chains that need more discovery work
   */
  async getVerifiedChainsNeedingDiscovery(): Promise<string[]> {
    const chainsNeedingWork: string[] = [];

    // Check each verified chain
    for (const chainName of VERIFIED_CHAIN_NAMES) {
      const metadata = await this.getChainMetadata(chainName);

      // If we have less than 80% coverage, add to list
      const coveragePercent = metadata.estimatedTotalLocations > 0
        ? (metadata.currentlyCovered / metadata.estimatedTotalLocations) * 100
        : 0;

      if (coveragePercent < 80) {
        chainsNeedingWork.push(chainName);
      }
    }

    return chainsNeedingWork;
  }

  /**
   * Get strategies with high success rates (>minRate)
   */
  async getStrategiesBySuccessRate(minRate: number): Promise<DiscoveryStrategy[]> {
    const allStrategies = await discoveryStrategies.getAll();

    return allStrategies
      .filter((s) =>
        !s.deprecated_at &&
        s.total_uses >= MIN_STRATEGY_USES_FOR_HIGH_YIELD &&
        s.success_rate >= minRate
      )
      .sort((a, b) => b.success_rate - a.success_rate);
  }

  /**
   * Get cities that haven't been well covered yet
   */
  async getUncoveredCities(country: SupportedCountry): Promise<string[]> {
    const { CITIES_BY_COUNTRY } = await import('@pad/core');
    const allCities = CITIES_BY_COUNTRY[country] || [];
    const allVenues = await discoveredVenues.getByCountry(country);

    // Count venues per city
    const cityCoverage = new Map<string, number>();
    for (const city of allCities) {
      cityCoverage.set(city, 0);
    }

    for (const venue of allVenues) {
      const city = venue.address.city;
      if (cityCoverage.has(city)) {
        cityCoverage.set(city, (cityCoverage.get(city) || 0) + 1);
      }
    }

    // Return cities with low coverage (fewer than 5 venues)
    const uncovered = Array.from(cityCoverage.entries())
      .filter(([_, count]) => count < 5)
      .map(([city]) => city)
      .sort((a, b) => {
        const aCount = cityCoverage.get(a) || 0;
        const bCount = cityCoverage.get(b) || 0;
        return aCount - bCount; // Least covered first
      });

    return uncovered;
  }

  // =============================================================================
  // PRIVATE METHODS - PLANNING
  // =============================================================================

  /**
   * Plan chain enumeration queries (highest ROI)
   */
  private async planChainEnumeration(budget: number): Promise<ChainEnumerationQuery[]> {
    const chainsNeedingWork = await this.getVerifiedChainsNeedingDiscovery();
    const queries: ChainEnumerationQuery[] = [];
    let queriesUsed = 0;

    for (const chainName of chainsNeedingWork) {
      if (queriesUsed >= budget) break;

      const metadata = await this.getChainMetadata(chainName);

      // For each country this chain operates in
      for (const country of metadata.countries) {
        if (queriesUsed >= budget) break;

        const { CITIES_BY_COUNTRY } = await import('@pad/core');
        const cities = CITIES_BY_COUNTRY[country] || [];
        const platforms = PLATFORMS_BY_COUNTRY[country] || [];

        // Estimate queries: platforms × top cities
        const topCities = cities.slice(0, 5); // Focus on top 5 cities per country
        const estimatedQueries = platforms.length * topCities.length;

        if (queriesUsed + estimatedQueries <= budget) {
          queries.push({
            chain: chainName,
            cities: topCities,
            platforms,
            priority: metadata.priority,
            estimatedQueries,
          });
          queriesUsed += estimatedQueries;
        }
      }
    }

    // Sort by priority (highest first)
    return queries.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Plan high-yield strategy queries
   */
  private async planHighYieldStrategies(budget: number): Promise<HighYieldQuery[]> {
    const highYieldStrategies = await this.getStrategiesBySuccessRate(HIGH_YIELD_MIN_SUCCESS_RATE);
    const queries: HighYieldQuery[] = [];
    let queriesUsed = 0;

    for (const strategy of highYieldStrategies) {
      if (queriesUsed >= budget) break;

      // Get cities for this country
      const { CITIES_BY_COUNTRY } = await import('@pad/core');
      const allCities = CITIES_BY_COUNTRY[strategy.country] || [];

      // For high-yield strategies, test on top 10 cities
      const cities = allCities.slice(0, 10);
      const estimatedQueries = cities.length;

      if (queriesUsed + estimatedQueries <= budget) {
        queries.push({
          strategyId: strategy.id,
          strategy,
          cities,
          estimatedQueries,
          successRate: strategy.success_rate,
        });
        queriesUsed += estimatedQueries;
      }
    }

    // Already sorted by success rate from getStrategiesBySuccessRate
    return queries;
  }

  /**
   * Plan city exploration queries for uncovered cities
   */
  private async planCityExploration(budget: number): Promise<CityExplorationQuery[]> {
    const queries: CityExplorationQuery[] = [];
    let queriesUsed = 0;

    const countries: SupportedCountry[] = ['CH', 'DE', 'AT'];

    for (const country of countries) {
      if (queriesUsed >= budget) break;

      const uncoveredCities = await this.getUncoveredCities(country);
      const platforms = PLATFORMS_BY_COUNTRY[country] || [];

      for (const city of uncoveredCities) {
        if (queriesUsed >= budget) break;

        // Use 2-3 strategies per city (different search angles)
        const strategiesPerCity = 3;
        const estimatedQueries = strategiesPerCity;

        // Calculate coverage gap (0-100, higher = less covered)
        const venuesInCity = await this.getVenueCountInCity(city, country);
        const coverageGap = Math.max(0, 100 - (venuesInCity * 20)); // 5+ venues = 100% covered

        if (queriesUsed + estimatedQueries <= budget) {
          queries.push({
            city,
            country,
            platforms,
            estimatedQueries,
            coverageGap,
          });
          queriesUsed += estimatedQueries;
        }
      }
    }

    // Sort by coverage gap (highest first = least covered)
    return queries.sort((a, b) => b.coverageGap - a.coverageGap);
  }

  /**
   * Plan experimental queries to test new patterns
   */
  private async planExperimentalQueries(budget: number): Promise<string[]> {
    void budget; // Budget used to limit patterns below

    // Experimental query patterns to test
    const experimentalPatterns = [
      // Product-specific searches
      'planted.kebab vegan delivery zurich',
      'planted.chicken burger delivery berlin',
      'planted.schnitzel delivery munich',
      'planted.duck asian delivery hamburg',

      // Cross-platform searches
      'planted protein delivery switzerland',
      'planted vegan meat delivery germany',
      'erbsenprotein planted delivery',

      // Chain discovery patterns
      'planted partner restaurant kette deutschland',
      'planted restaurant locations schweiz',
      'where to buy planted chicken restaurant',

      // New platform angles
      'deliveroo planted chicken london',
      'foodora planted delivery',
      'gorillas planted products',

      // Local/regional patterns
      'planted restaurant zürich oerlikon',
      'planted berlin prenzlauer berg',
      'planted hamburg altona',
      'planted münchen schwabing',

      // Menu/dish focused
      'menu with planted chicken',
      'restaurant serving planted products',
      'vegan chicken planted restaurant',
      'planted protein bowl delivery',
    ];

    // Take up to budget amount from experimental patterns
    return experimentalPatterns.slice(0, budget);
  }

  // =============================================================================
  // PRIVATE METHODS - METADATA & HELPERS
  // =============================================================================

  /**
   * Get metadata about a chain (coverage, locations, etc.)
   */
  private async getChainMetadata(chainName: string): Promise<ChainMetadata> {
    // Try to find chain in database
    const chainRecord = await chains.findByName(chainName);

    // Get discovered venues for this chain
    const normalizedName = chainName.toLowerCase();
    const allVenues = await discoveredVenues.getAll();
    const chainVenues = allVenues.filter((v) =>
      v.name.toLowerCase().includes(normalizedName) ||
      v.chain_name?.toLowerCase().includes(normalizedName)
    );

    // Extract unique cities and platforms
    const citySet = new Set(chainVenues.map((v) => v.address.city));
    const knownCities = Array.from(citySet);

    const platformSet = new Set(
      chainVenues.flatMap((v) => v.delivery_platforms.map((p) => p.platform))
    );
    const knownPlatforms = Array.from(platformSet) as DeliveryPlatform[];

    // Determine countries
    const countrySet = new Set(chainVenues.map((v) => v.address.country));
    const countries = Array.from(countrySet) as SupportedCountry[];
    if (countries.length === 0) {
      // Default to all countries if unknown
      countries.push('CH', 'DE', 'AT');
    }

    // Estimate total locations based on chain size patterns
    let estimatedTotalLocations = chainVenues.length * 2; // Assume we've found ~50%

    // Adjust estimates for known large chains
    if (['dean&david', 'Subway', 'Vapiano', 'Hans im Glück'].some(c => chainName.includes(c))) {
      estimatedTotalLocations = Math.max(estimatedTotalLocations, 50);
    }

    // Calculate priority (higher = more important)
    const priority = this.calculateChainPriority(chainVenues.length, estimatedTotalLocations, countries);

    return {
      chainName,
      chainId: chainRecord?.id,
      countries,
      knownCities,
      knownPlatforms,
      estimatedTotalLocations,
      currentlyCovered: chainVenues.length,
      priority,
    };
  }

  /**
   * Calculate chain priority score (0-100)
   */
  private calculateChainPriority(
    currentCoverage: number,
    estimatedTotal: number,
    countries: SupportedCountry[]
  ): number {
    let priority = 50; // Base priority

    // More countries = higher priority (chains with wider reach)
    priority += countries.length * 10;

    // Larger chains = higher priority (more value to discover)
    if (estimatedTotal >= 50) priority += 20;
    else if (estimatedTotal >= 20) priority += 10;

    // Low current coverage = higher priority (more to discover)
    const coveragePercent = estimatedTotal > 0 ? (currentCoverage / estimatedTotal) * 100 : 0;
    if (coveragePercent < 20) priority += 20;
    else if (coveragePercent < 50) priority += 10;

    return Math.min(100, priority);
  }

  /**
   * Get venue count in a specific city
   */
  private async getVenueCountInCity(city: string, country: SupportedCountry): Promise<number> {
    const venues = await discoveredVenues.getByCountry(country);
    return venues.filter((v) => v.address.city === city).length;
  }

  /**
   * Count total queries in a query group
   */
  private countQueries(queries: ChainEnumerationQuery[] | HighYieldQuery[] | CityExplorationQuery[]): number {
    return queries.reduce((sum, q) => sum + q.estimatedQueries, 0);
  }

  // =============================================================================
  // PUBLIC UTILITY METHODS
  // =============================================================================

  /**
   * Get summary statistics about the current discovery state
   */
  async getDiscoveryStats(): Promise<{
    totalVenues: number;
    totalChains: number;
    venuesByCountry: Record<SupportedCountry, number>;
    venuesByPlatform: Record<string, number>;
    topStrategies: Array<{ id: string; successRate: number; uses: number }>;
    uncoveredCitiesCount: number;
  }> {
    const allVenues = await discoveredVenues.getAll();
    const allStrategies = await discoveryStrategies.getAll();

    const venuesByCountry: Record<SupportedCountry, number> = {
      CH: 0,
      DE: 0,
      AT: 0,
    };

    const venuesByPlatform: Record<string, number> = {};

    for (const venue of allVenues) {
      venuesByCountry[venue.address.country]++;
      for (const platform of venue.delivery_platforms) {
        venuesByPlatform[platform.platform] = (venuesByPlatform[platform.platform] || 0) + 1;
      }
    }

    // Count unique chains
    const uniqueChains = new Set(
      allVenues
        .filter((v) => v.is_chain && v.chain_name)
        .map((v) => v.chain_name!.toLowerCase())
    );

    // Get top strategies
    const topStrategies = allStrategies
      .filter((s) => !s.deprecated_at && s.total_uses >= 5)
      .sort((a, b) => b.success_rate - a.success_rate)
      .slice(0, 10)
      .map((s) => ({
        id: s.id,
        successRate: s.success_rate,
        uses: s.total_uses,
      }));

    // Count uncovered cities
    let uncoveredCitiesCount = 0;
    for (const country of ['CH', 'DE', 'AT'] as SupportedCountry[]) {
      const uncovered = await this.getUncoveredCities(country);
      uncoveredCitiesCount += uncovered.length;
    }

    return {
      totalVenues: allVenues.length,
      totalChains: uniqueChains.size,
      venuesByCountry,
      venuesByPlatform,
      topStrategies,
      uncoveredCitiesCount,
    };
  }

  /**
   * Generate a human-readable summary of a query plan
   */
  summarizePlan(plan: QueryPlan): string {
    const lines = [
      '=== QUERY PRIORITIZATION PLAN ===',
      '',
      `Total Budget: ${plan.totalQueries} queries (target: ${plan.budgetAllocation.total})`,
      '',
      `1. CHAIN ENUMERATION (${plan.budgetAllocation.chainEnumeration.percentage}% budget, ${plan.budgetAllocation.chainEnumeration.actual} queries):`,
      `   - ${plan.chainEnumeration.length} chains to enumerate`,
      `   - Top chains: ${plan.chainEnumeration.slice(0, 3).map(c => c.chain).join(', ')}`,
      '',
      `2. HIGH-YIELD STRATEGIES (${plan.budgetAllocation.highYieldStrategies.percentage}% budget, ${plan.budgetAllocation.highYieldStrategies.actual} queries):`,
      `   - ${plan.highYieldStrategies.length} strategies with >${HIGH_YIELD_MIN_SUCCESS_RATE}% success rate`,
      `   - Top success rates: ${plan.highYieldStrategies.slice(0, 3).map(s => `${s.successRate}%`).join(', ')}`,
      '',
      `3. CITY EXPLORATION (${plan.budgetAllocation.cityExploration.percentage}% budget, ${plan.budgetAllocation.cityExploration.actual} queries):`,
      `   - ${plan.cityExploration.length} under-covered cities`,
      `   - Top gaps: ${plan.cityExploration.slice(0, 3).map(c => `${c.city} (${c.country})`).join(', ')}`,
      '',
      `4. EXPERIMENTAL (${plan.budgetAllocation.experimental.percentage}% budget, ${plan.budgetAllocation.experimental.actual} queries):`,
      `   - ${plan.experimental.length} experimental queries`,
      `   - Testing new patterns and approaches`,
      '',
      '=================================',
    ];

    return lines.join('\n');
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

let prioritizerInstance: QueryPrioritizer | null = null;

/**
 * Get singleton instance of QueryPrioritizer
 */
export function getQueryPrioritizer(): QueryPrioritizer {
  if (!prioritizerInstance) {
    prioritizerInstance = new QueryPrioritizer();
  }
  return prioritizerInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetQueryPrioritizer(): void {
  prioritizerInstance = null;
}
