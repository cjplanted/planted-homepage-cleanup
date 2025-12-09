/**
 * Web Search Providers for Smart Discovery Agent
 *
 * Provides different implementations for web searching:
 * - Google Custom Search API with credential pool (production)
 * - SerpAPI (alternative)
 * - Mock provider (testing)
 */

import type { WebSearchResult, WebSearchProvider } from './SmartDiscoveryAgent.js';
import { SearchEnginePool, getSearchEnginePool, type SearchCredential } from './SearchEnginePool.js';

/**
 * Google Custom Search API provider with credential pool support
 *
 * Supports multiple credentials to work around the 100 queries/day free limit.
 * Automatically rotates between credentials when one is exhausted.
 *
 * Configuration options:
 * 1. JSON array: GOOGLE_SEARCH_CREDENTIALS='[{"apiKey":"...","searchEngineId":"..."},...]'
 * 2. Numbered vars: GOOGLE_SEARCH_API_KEY_1, GOOGLE_SEARCH_ENGINE_ID_1, etc.
 * 3. Single credential (backwards compatible): GOOGLE_SEARCH_API_KEY, GOOGLE_SEARCH_ENGINE_ID
 */
export class GoogleSearchProvider implements WebSearchProvider {
  private pool: SearchEnginePool;
  private baseUrl = 'https://www.googleapis.com/customsearch/v1';
  private currentCredential: SearchCredential | null = null;
  private verbose: boolean;

  constructor(config?: {
    pool?: SearchEnginePool;
    verbose?: boolean;
  }) {
    this.pool = config?.pool || getSearchEnginePool();
    this.verbose = config?.verbose ?? true;

    if (!this.pool.hasCredentials()) {
      console.warn('Google Search API credentials not configured');
    }
  }

  private log(message: string): void {
    if (this.verbose) {
      console.log(message);
    }
  }

  async search(query: string): Promise<WebSearchResult[]> {
    // Get an available credential from the pool
    const credential = await this.pool.getAvailableCredential();

    if (!credential) {
      // All credentials exhausted
      const stats = await this.pool.getStats();
      throw new Error(
        `All Google Search API credentials exhausted for today. ` +
        `Used ${stats.totalQueriesUsedToday}/${stats.totalQueriesAvailableToday} queries across ${stats.activeCredentials} credentials. ` +
        `Quota resets at midnight UTC.`
      );
    }

    // Track which credential we're using
    if (this.currentCredential?.id !== credential.id) {
      this.log(`[GoogleSearch] Switching to credential: ${credential.name || credential.id}`);
      this.currentCredential = credential;
    }

    const params = new URLSearchParams({
      key: credential.apiKey,
      cx: credential.searchEngineId,
      q: query,
      num: '10',
    });

    const response = await fetch(`${this.baseUrl}?${params}`);

    if (response.ok) {
      // Record successful usage
      await this.pool.recordUsage(credential.id);

      const data = await response.json() as { items?: Array<{ title: string; link: string; snippet?: string }> };

      if (!data.items) {
        return [];
      }

      return data.items.map((item, index: number) => ({
        title: item.title,
        url: item.link,
        snippet: item.snippet,
        position: index + 1,
      }));
    }

    // Handle rate limiting (429) - mark this credential as exhausted and try next
    if (response.status === 429) {
      this.log(`[GoogleSearch] Credential ${credential.name || credential.id} hit rate limit (429)`);
      await this.pool.markExhausted(credential.id);

      // Try again with a different credential
      const stats = await this.pool.getStats();
      if (stats.queriesRemaining > 0) {
        this.log(`[GoogleSearch] Rotating to next credential (${stats.queriesRemaining} queries remaining in pool)`);
        return this.search(query); // Recursive call with new credential
      }

      throw new Error(
        `All Google Search API credentials exhausted. ` +
        `Used ${stats.totalQueriesUsedToday}/${stats.totalQueriesAvailableToday} queries. ` +
        `Quota resets at midnight UTC.`
      );
    }

    // For other errors, throw
    throw new Error(`Google Search failed: ${response.status} ${response.statusText}`);
  }

  /**
   * Get current pool statistics
   */
  async getPoolStats() {
    return this.pool.getStats();
  }

  /**
   * Get detailed usage for all credentials
   */
  async getDetailedUsage() {
    return this.pool.getDetailedUsage();
  }
}

/**
 * SerpAPI provider (alternative to Google)
 *
 * Requires:
 * - SERPAPI_KEY
 */
export class SerpAPIProvider implements WebSearchProvider {
  private apiKey: string;
  private baseUrl = 'https://serpapi.com/search';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.SERPAPI_KEY || '';
  }

  async search(query: string): Promise<WebSearchResult[]> {
    if (!this.apiKey) {
      throw new Error('SerpAPI not configured');
    }

    const params = new URLSearchParams({
      api_key: this.apiKey,
      q: query,
      engine: 'google',
      num: '10',
    });

    const response = await fetch(`${this.baseUrl}?${params}`);
    if (!response.ok) {
      throw new Error(`SerpAPI failed: ${response.status}`);
    }

    const data = await response.json() as { organic_results?: Array<{ title: string; link: string; snippet?: string; position: number }> };

    if (!data.organic_results) {
      return [];
    }

    return data.organic_results.map((item) => ({
      title: item.title,
      url: item.link,
      snippet: item.snippet,
      position: item.position,
    }));
  }
}

/**
 * Mock provider for testing
 */
export class MockSearchProvider implements WebSearchProvider {
  private mockResults: Map<string, WebSearchResult[]> = new Map();

  /**
   * Add mock results for a query
   */
  addMockResults(query: string, results: WebSearchResult[]): void {
    this.mockResults.set(query.toLowerCase(), results);
  }

  /**
   * Add mock results for queries matching a pattern
   */
  addMockPattern(pattern: RegExp, results: WebSearchResult[]): void {
    // Store pattern-based results with special key
    this.mockResults.set(`pattern:${pattern.source}`, results);
  }

  async search(query: string): Promise<WebSearchResult[]> {
    // Check exact match first
    const exactMatch = this.mockResults.get(query.toLowerCase());
    if (exactMatch) {
      return exactMatch;
    }

    // Check pattern matches
    for (const [key, results] of this.mockResults.entries()) {
      if (key.startsWith('pattern:')) {
        const pattern = new RegExp(key.replace('pattern:', ''), 'i');
        if (pattern.test(query)) {
          return results;
        }
      }
    }

    // Return empty by default
    return [];
  }

  /**
   * Create a provider with realistic mock data for testing
   */
  static withTestData(): MockSearchProvider {
    const provider = new MockSearchProvider();

    // Add some realistic test data
    provider.addMockPattern(/planted.*chicken.*zürich/i, [
      {
        title: 'Hiltl - Zürich | Uber Eats',
        url: 'https://www.ubereats.com/ch/store/hiltl',
        snippet: 'Order planted.chicken dishes from Hiltl in Zürich. Vegetarian restaurant with plant-based options.',
        position: 1,
      },
      {
        title: 'Nooch Asian Kitchen - Zürich | Uber Eats',
        url: 'https://www.ubereats.com/ch/store/nooch-asian-kitchen',
        snippet: 'Asian cuisine with planted chicken options. Fried rice with planted.chicken available.',
        position: 2,
      },
    ]);

    provider.addMockPattern(/planted.*berlin/i, [
      {
        title: 'dean&david Berlin Mitte | Lieferando',
        url: 'https://www.lieferando.de/en/menu/dean-david-berlin-mitte',
        snippet: 'Healthy bowls and salads with planted.chicken. Order now on Lieferando.',
        position: 1,
      },
      {
        title: 'Birdie Birdie Chicken Berlin | Wolt',
        url: 'https://wolt.com/en/deu/berlin/restaurant/birdie-birdie',
        snippet: 'Planted chicken burgers and wraps. Vegan chicken restaurant.',
        position: 2,
      },
      {
        title: 'doen doen planted kebap | Wolt',
        url: 'https://wolt.com/en/deu/berlin/restaurant/doen-doen',
        snippet: '100% vegan döner with planted.kebab. Best vegan kebab in Berlin.',
        position: 3,
      },
    ]);

    provider.addMockPattern(/brezelkönig/i, [
      {
        title: 'Brezelkönig Zürich | Just Eat',
        url: 'https://www.just-eat.ch/en/menu/brezelkoenig-zuerich',
        snippet: 'Pretzels and baguettes. Try our Baguette Planted Chicken Curry!',
        position: 1,
      },
      {
        title: 'Brezelkönig Basel | Just Eat',
        url: 'https://www.just-eat.ch/en/menu/brezelkoenig-basel',
        snippet: 'Fresh pretzels daily. Plant-based options available.',
        position: 2,
      },
    ]);

    return provider;
  }
}

/**
 * Factory function to get the appropriate search provider
 */
export function getSearchProvider(type?: 'google' | 'serpapi' | 'mock'): WebSearchProvider {
  switch (type) {
    case 'google':
      return new GoogleSearchProvider();
    case 'serpapi':
      return new SerpAPIProvider();
    case 'mock':
      return MockSearchProvider.withTestData();
    default:
      // Auto-detect based on available credentials
      if (process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_ENGINE_ID) {
        return new GoogleSearchProvider();
      }
      if (process.env.SERPAPI_KEY) {
        return new SerpAPIProvider();
      }
      // Fall back to mock for development
      console.warn('No search API configured, using mock provider');
      return MockSearchProvider.withTestData();
  }
}
