/**
 * Gemini API Client for Smart Discovery Agent
 *
 * Handles all interactions with Google's Gemini API for the discovery system.
 * Drop-in replacement for ClaudeClient.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  SYSTEM_PROMPT,
  GENERATE_QUERIES_PROMPT,
  PARSE_RESULTS_PROMPT,
  ANALYZE_VENUE_PROMPT,
  DETECT_CHAIN_PROMPT,
  LEARN_FROM_FEEDBACK_PROMPT,
  CONFIDENCE_SCORING_PROMPT,
  fillPromptTemplate,
} from './prompts.js';
import type {
  SearchContext,
  GeneratedQuery,
  ParsedVenue,
  VenueAnalysis,
  StrategyUpdate,
  ConfidenceFactor,
} from '@pad/core';

export interface GeminiClientConfig {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

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
  strategy_updates: StrategyUpdate[];
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
 * Gemini client for AI-powered discovery operations
 */
export class GeminiClient {
  private genAI: GoogleGenerativeAI;
  private model: string;
  private maxTokens: number;
  private temperature: number;

  constructor(config?: GeminiClientConfig) {
    // Check for API key in order of preference: config > GOOGLE_AI_API_KEY > GEMINI_API_KEY
    const apiKey = config?.apiKey || process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY || '';

    if (!apiKey) {
      throw new Error('Gemini API key not configured. Set GOOGLE_AI_API_KEY or GEMINI_API_KEY environment variable.');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    // Default to Gemini 2.5 Flash for improved performance and quality
    // Falls back to 2.0-flash automatically if 2.5 is unavailable
    this.model = config?.model || 'gemini-2.5-flash';
    this.maxTokens = config?.maxTokens || 4096;
    this.temperature = config?.temperature || 0.3;
  }

  /**
   * Send a chat message to Gemini
   * Automatically falls back to gemini-2.0-flash if 2.5-flash is unavailable
   */
  private async chat(systemPrompt: string, userMessage: string): Promise<string> {
    const model = this.genAI.getGenerativeModel({
      model: this.model,
      generationConfig: {
        maxOutputTokens: this.maxTokens,
        temperature: this.temperature,
      },
    });

    // Gemini handles system prompts differently - we prepend it to the user message
    const fullPrompt = `${systemPrompt}\n\n---\n\n${userMessage}`;

    try {
      const result = await model.generateContent(fullPrompt);
      const response = result.response;
      const text = response.text();

      return text;
    } catch (error) {
      // If using 2.5-flash fails, fall back to 2.0-flash
      if (this.model === 'gemini-2.5-flash') {
        console.warn('Gemini 2.5 Flash failed, falling back to 2.0 Flash...');

        // Persist the fallback to avoid repeated failures
        this.model = 'gemini-2.0-flash';

        const fallbackModel = this.genAI.getGenerativeModel({
          model: this.model,
          generationConfig: {
            maxOutputTokens: this.maxTokens,
            temperature: this.temperature,
          },
        });

        const result = await fallbackModel.generateContent(fullPrompt);
        const response = result.response;
        const text = response.text();

        return text;
      }

      // Re-throw if not a 2.5 fallback scenario
      throw error;
    }
  }

  /**
   * Parse JSON from response, handling markdown code blocks
   */
  private parseJsonResponse<T>(text: string): T {
    // Remove markdown code blocks if present
    let cleanJson = text.trim();
    if (cleanJson.startsWith('```json')) {
      cleanJson = cleanJson.slice(7);
    } else if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.slice(3);
    }
    if (cleanJson.endsWith('```')) {
      cleanJson = cleanJson.slice(0, -3);
    }
    cleanJson = cleanJson.trim();

    return JSON.parse(cleanJson) as T;
  }

  /**
   * Generate search queries for a given context
   */
  async generateQueries(context: SearchContext): Promise<GeneratedQuery[]> {
    const prompt = fillPromptTemplate(GENERATE_QUERIES_PROMPT, {
      platform: context.platform,
      country: context.country,
      city: context.city || 'any city',
      product: context.target_product || 'any planted product',
      previous_queries: context.previous_queries?.join('\n') || 'none',
    });

    const response = await this.chat(SYSTEM_PROMPT, prompt);

    try {
      const parsed = this.parseJsonResponse<{ queries: GeneratedQuery[] }>(response);
      return parsed.queries || [];
    } catch {
      console.warn('Failed to parse query generation response:', response);
      return [];
    }
  }

  /**
   * Parse search results to extract venues
   */
  async parseSearchResults(
    query: string,
    platform: string,
    results: Array<{ title: string; url: string; snippet?: string }>
  ): Promise<ParsedSearchResults> {
    const prompt = fillPromptTemplate(PARSE_RESULTS_PROMPT, {
      query,
      platform,
      results: JSON.stringify(results, null, 2),
    });

    const response = await this.chat(SYSTEM_PROMPT, prompt);

    try {
      return this.parseJsonResponse<ParsedSearchResults>(response);
    } catch {
      console.warn('Failed to parse search results response:', response);
      return {
        venues: [],
        chains_detected: [],
        quality_assessment: {
          relevance_score: 0,
          data_quality: 'unknown',
          suggested_refinements: [],
        },
      };
    }
  }

  /**
   * Analyze a venue page for Planted products
   */
  async analyzeVenue(
    venueName: string,
    url: string,
    platform: string,
    pageContent: string
  ): Promise<VenueAnalysis> {
    const prompt = fillPromptTemplate(ANALYZE_VENUE_PROMPT, {
      venue_name: venueName,
      url,
      platform,
      page_content: pageContent.slice(0, 10000), // Limit content size
    });

    const response = await this.chat(SYSTEM_PROMPT, prompt);

    try {
      return this.parseJsonResponse<VenueAnalysis>(response);
    } catch {
      console.warn('Failed to parse venue analysis response:', response);
      return {
        serves_planted: false,
        confidence: 0,
        planted_products: [],
        dishes: [],
        is_chain: false,
        chain_signals: [],
        reasoning: 'Failed to analyze venue',
      };
    }
  }

  /**
   * Detect if a restaurant is part of a chain
   */
  async detectChain(
    name: string,
    platform: string,
    searchResults: Array<{ title: string; url: string; snippet?: string }>
  ): Promise<ChainDetectionResult> {
    const prompt = fillPromptTemplate(DETECT_CHAIN_PROMPT, {
      name,
      platform,
      search_results: JSON.stringify(searchResults, null, 2),
    });

    const response = await this.chat(SYSTEM_PROMPT, prompt);

    try {
      return this.parseJsonResponse<ChainDetectionResult>(response);
    } catch {
      console.warn('Failed to parse chain detection response:', response);
      return {
        is_chain: false,
        confidence: 0,
        signals: [],
        should_enumerate: false,
      };
    }
  }

  /**
   * Learn from feedback to improve strategies
   */
  async learnFromFeedback(
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
  ): Promise<LearningResult> {
    const prompt = fillPromptTemplate(LEARN_FROM_FEEDBACK_PROMPT, {
      feedback: JSON.stringify(feedbackData, null, 2),
      strategies: JSON.stringify(currentStrategies, null, 2),
    });

    const response = await this.chat(SYSTEM_PROMPT, prompt);

    try {
      return this.parseJsonResponse<LearningResult>(response);
    } catch {
      console.warn('Failed to parse learning response:', response);
      return {
        strategy_updates: [],
        new_strategies: [],
        insights: [],
      };
    }
  }

  /**
   * Score confidence for a discovered venue
   */
  async scoreConfidence(
    venueData: ParsedVenue,
    query: string,
    strategySuccessRate: number
  ): Promise<ConfidenceScore> {
    const prompt = fillPromptTemplate(CONFIDENCE_SCORING_PROMPT, {
      venue: JSON.stringify(venueData, null, 2),
      query,
      strategy_success_rate: strategySuccessRate.toString(),
    });

    const response = await this.chat(SYSTEM_PROMPT, prompt);

    try {
      return this.parseJsonResponse<ConfidenceScore>(response);
    } catch {
      console.warn('Failed to parse confidence score response:', response);
      // Return a conservative default
      return {
        overall_score: 50,
        factors: [
          {
            factor: 'default',
            score: 50,
            reason: 'Could not analyze - using default score',
          },
        ],
        recommendation: 'review',
      };
    }
  }
}

// Singleton instance
let geminiClientInstance: GeminiClient | null = null;

export function getGeminiClient(config?: GeminiClientConfig): GeminiClient {
  if (!geminiClientInstance) {
    geminiClientInstance = new GeminiClient(config);
  }
  return geminiClientInstance;
}

// Reset singleton (useful for testing)
export function resetGeminiClient(): void {
  geminiClientInstance = null;
}
