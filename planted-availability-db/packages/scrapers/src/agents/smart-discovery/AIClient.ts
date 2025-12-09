/**
 * AI Client Interface and Factory
 *
 * Provides a unified interface for AI clients (Claude, Gemini)
 * and a factory to create the appropriate client based on configuration.
 */

import type {
  SearchContext,
  GeneratedQuery,
  ParsedVenue,
  VenueAnalysis,
  ConfidenceFactor,
} from '@pad/core';

// Re-export types used by both clients
export interface ParsedSearchResults {
  venues: ParsedVenue[];
  chains_detected: Array<{
    name: string;
    confidence: number;
    signals: string[];
    should_enumerate: boolean;
  }>;
  quality_assessment: {
    relevance_score: number;
    data_quality: string;
    suggested_refinements: string[];
  };
}

export interface ChainDetectionResult {
  is_chain: boolean;
  chain_name?: string;
  confidence: number;
  signals: string[];
  estimated_locations?: number;
  should_enumerate: boolean;
}

export interface LearningResult {
  strategy_updates: Array<{
    strategy_id: string;
    action: 'boost' | 'penalize' | 'deprecate' | 'evolve';
    new_success_rate?: number;
    evolved_query?: string;
    reason: string;
  }>;
  new_strategies: Array<{
    platform: string;
    country: string;
    query_template: string;
    reasoning: string;
  }>;
  insights: Array<{
    type: string;
    description: string;
    confidence: number;
  }>;
}

export interface ConfidenceScore {
  overall_score: number;
  factors: ConfidenceFactor[];
  recommendation: 'accept' | 'review' | 'reject';
}

/**
 * Unified AI Client interface
 */
export interface AIClient {
  generateQueries(context: SearchContext): Promise<GeneratedQuery[]>;

  parseSearchResults(
    query: string,
    platform: string,
    results: Array<{ title: string; url: string; snippet?: string }>
  ): Promise<ParsedSearchResults>;

  analyzeVenue(
    venueName: string,
    url: string,
    platform: string,
    pageContent: string
  ): Promise<VenueAnalysis>;

  detectChain(
    name: string,
    platform: string,
    searchResults: Array<{ title: string; url: string; snippet?: string }>
  ): Promise<ChainDetectionResult>;

  learnFromFeedback(
    feedbackData: Array<{
      query: string;
      platform: string;
      result_type: string;
      strategy_id: string;
    }>,
    currentStrategies: Array<{
      id: string;
      query_template: string;
      success_rate: number;
      platform: string;
      country: string;
    }>
  ): Promise<LearningResult>;

  scoreConfidence(
    venueData: ParsedVenue,
    query: string,
    strategySuccessRate: number
  ): Promise<ConfidenceScore>;
}

export type AIProvider = 'claude' | 'gemini';

export interface AIClientConfig {
  provider: AIProvider;
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Create an AI client based on configuration
 */
export async function createAIClient(config?: Partial<AIClientConfig>): Promise<AIClient> {
  const provider = config?.provider || detectAvailableProvider();

  if (provider === 'gemini') {
    const { GeminiClient } = await import('./GeminiClient.js');
    return new GeminiClient({
      apiKey: config?.apiKey,
      model: config?.model,
      maxTokens: config?.maxTokens,
      temperature: config?.temperature,
    });
  } else {
    const { ClaudeClient } = await import('./ClaudeClient.js');
    return new ClaudeClient({
      apiKey: config?.apiKey,
      model: config?.model,
      maxTokens: config?.maxTokens,
      temperature: config?.temperature,
    });
  }
}

/**
 * Detect which AI provider is available based on environment variables
 */
export function detectAvailableProvider(): AIProvider {
  // Check for Gemini first (free credits)
  if (process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY) {
    return 'gemini';
  }

  // Fall back to Claude
  if (process.env.ANTHROPIC_API_KEY) {
    return 'claude';
  }

  // Default to Gemini (will fail with helpful error if no key)
  return 'gemini';
}

/**
 * Get the singleton AI client instance
 */
let aiClientInstance: AIClient | null = null;
let currentProvider: AIProvider | null = null;

export async function getAIClient(config?: Partial<AIClientConfig>): Promise<AIClient> {
  const requestedProvider = config?.provider || detectAvailableProvider();

  // Create new instance if provider changed or not initialized
  if (!aiClientInstance || currentProvider !== requestedProvider) {
    aiClientInstance = await createAIClient({ ...config, provider: requestedProvider });
    currentProvider = requestedProvider;
  }

  return aiClientInstance;
}

/**
 * Reset the singleton (useful for testing)
 */
export function resetAIClient(): void {
  aiClientInstance = null;
  currentProvider = null;
}
