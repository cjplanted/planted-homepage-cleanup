/**
 * Claude API Client for Smart Discovery Agent
 *
 * Handles all interactions with the Claude API for the discovery system.
 */

import Anthropic from '@anthropic-ai/sdk';
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
  ConfidenceFactor,
} from '@pad/core';

export interface ClaudeClientConfig {
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
 * Claude API client for the smart discovery agent
 */
export class ClaudeClient {
  private client: Anthropic;
  private model: string;
  private maxTokens: number;
  private temperature: number;

  constructor(config?: ClaudeClientConfig) {
    this.client = new Anthropic({
      apiKey: config?.apiKey || process.env.ANTHROPIC_API_KEY,
    });
    this.model = config?.model || 'claude-sonnet-4-20250514';
    this.maxTokens = config?.maxTokens || 4096;
    this.temperature = config?.temperature || 0.3;
  }

  /**
   * Send a message to Claude and get a response
   */
  private async chat(userMessage: string): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
    });

    // Extract text from response
    const textBlock = response.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    return textBlock.text;
  }

  /**
   * Parse JSON from Claude's response, handling markdown code blocks
   */
  private parseJsonResponse<T>(response: string): T {
    // Remove markdown code blocks if present
    let cleaned = response.trim();

    // Handle ```json ... ``` blocks
    const jsonBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonBlockMatch) {
      cleaned = jsonBlockMatch[1].trim();
    }

    try {
      return JSON.parse(cleaned) as T;
    } catch (error) {
      console.error('Failed to parse Claude response as JSON:', response);
      throw new Error(`Failed to parse Claude response as JSON: ${error}`);
    }
  }

  /**
   * Generate search queries based on context
   */
  async generateQueries(context: SearchContext): Promise<GeneratedQuery[]> {
    const prompt = fillPromptTemplate(GENERATE_QUERIES_PROMPT, {
      platform: context.platform,
      country: context.country,
      city: context.city || 'any',
      product: context.target_product || 'any',
      successful_queries: context.previous_queries || [],
      failed_queries: [],
      known_venues: context.known_venues || [],
    });

    const response = await this.chat(prompt);
    const parsed = this.parseJsonResponse<{ queries: GeneratedQuery[] }>(response);

    return parsed.queries;
  }

  /**
   * Parse search results to identify potential venues
   */
  async parseSearchResults(
    query: string,
    platform: string,
    results: { title: string; url: string; snippet?: string }[]
  ): Promise<ParsedSearchResults> {
    const resultsText = results
      .map((r, i) => `${i + 1}. Title: ${r.title}\n   URL: ${r.url}\n   Snippet: ${r.snippet || 'N/A'}`)
      .join('\n\n');

    const prompt = fillPromptTemplate(PARSE_RESULTS_PROMPT, {
      query,
      platform,
      results: resultsText,
    });

    try {
      const response = await this.chat(prompt);
      const parsed = this.parseJsonResponse<ParsedSearchResults>(response);
      // Ensure required fields exist
      return {
        venues: parsed.venues || [],
        chains_detected: (parsed.chains_detected || []).map(c => ({
          name: c.name,
          confidence: c.confidence || 50,
          signals: c.signals || [],
          should_enumerate: c.should_enumerate || false,
        })),
        quality_assessment: parsed.quality_assessment || {
          relevance_score: 50,
          data_quality: 'unknown',
          suggested_refinements: [],
        },
      };
    } catch {
      return {
        venues: [],
        chains_detected: [],
        quality_assessment: {
          relevance_score: 0,
          data_quality: 'error',
          suggested_refinements: [],
        },
      };
    }
  }

  /**
   * Analyze a venue to confirm Planted products
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
      content: pageContent.slice(0, 10000), // Limit content length
    });

    const response = await this.chat(prompt);
    return this.parseJsonResponse<VenueAnalysis>(response);
  }

  /**
   * Detect if a restaurant is part of a chain
   */
  async detectChain(
    name: string,
    platform: string,
    searchResults: { title: string; url: string; snippet?: string }[]
  ): Promise<ChainDetectionResult> {
    const resultsText = searchResults
      .map((r, i) => `${i + 1}. ${r.title} - ${r.url}`)
      .join('\n');

    const prompt = fillPromptTemplate(DETECT_CHAIN_PROMPT, {
      name,
      platform,
      search_results: resultsText,
    });

    try {
      const response = await this.chat(prompt);
      const parsed = this.parseJsonResponse<ChainDetectionResult>(response);
      return {
        is_chain: parsed.is_chain || false,
        chain_name: parsed.chain_name,
        confidence: parsed.confidence || 0,
        signals: parsed.signals || [],
        estimated_locations: parsed.estimated_locations,
        should_enumerate: parsed.should_enumerate || false,
      };
    } catch {
      return {
        is_chain: false,
        confidence: 0,
        signals: [],
        should_enumerate: false,
      };
    }
  }

  /**
   * Learn from feedback and suggest strategy improvements
   */
  async learnFromFeedback(
    feedbackData: Array<{
      query: string;
      platform: string;
      result_type: string;
      strategy_id: string;
    }>,
    strategies: Array<{
      id: string;
      query_template: string;
      success_rate: number;
      platform: string;
      country: string;
    }>
  ): Promise<LearningResult> {
    const prompt = fillPromptTemplate(LEARN_FROM_FEEDBACK_PROMPT, {
      feedback_data: feedbackData,
      strategies,
    });

    try {
      const response = await this.chat(prompt);
      const parsed = this.parseJsonResponse<LearningResult>(response);
      return {
        strategy_updates: parsed.strategy_updates || [],
        new_strategies: parsed.new_strategies || [],
        insights: parsed.insights || [],
      };
    } catch {
      return {
        strategy_updates: [],
        new_strategies: [],
        insights: [],
      };
    }
  }

  /**
   * Score confidence in a discovered venue
   */
  async scoreConfidence(
    venueData: ParsedVenue,
    query: string,
    strategySuccessRate: number
  ): Promise<ConfidenceScore> {
    const prompt = fillPromptTemplate(CONFIDENCE_SCORING_PROMPT, {
      venue_data: venueData,
      query,
      strategy_success_rate: strategySuccessRate,
      verification_history: [],
    });

    try {
      const response = await this.chat(prompt);
      const parsed = this.parseJsonResponse<ConfidenceScore>(response);
      return {
        overall_score: parsed.overall_score || 50,
        factors: parsed.factors || [],
        recommendation: parsed.recommendation || 'review',
      };
    } catch {
      return {
        overall_score: 50,
        factors: [{ factor: 'default', score: 50, reason: 'Could not analyze' }],
        recommendation: 'review',
      };
    }
  }

  /**
   * Have Claude reason about a decision (for transparency/debugging)
   */
  async explainDecision(decision: {
    type: string;
    input: unknown;
    output: unknown;
  }): Promise<string> {
    const prompt = `Explain the reasoning behind this decision in 2-3 sentences:

Decision type: ${decision.type}
Input: ${JSON.stringify(decision.input, null, 2)}
Output: ${JSON.stringify(decision.output, null, 2)}

Provide a clear, concise explanation of why this decision was made.`;

    return this.chat(prompt);
  }
}

// Default singleton instance
let defaultClient: ClaudeClient | null = null;

export function getClaudeClient(config?: ClaudeClientConfig): ClaudeClient {
  if (!defaultClient) {
    defaultClient = new ClaudeClient(config);
  }
  return defaultClient;
}
