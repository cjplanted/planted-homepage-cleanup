/**
 * Dish Finder AI Client
 *
 * Uses Google's Gemini API for dish extraction from delivery platform pages.
 * Handles parsing menu data, identifying Planted dishes, and matching products.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  DISH_FINDER_SYSTEM_PROMPT,
  DISH_EXTRACTION_PROMPT,
  JSON_MENU_EXTRACTION_PROMPT,
  DISH_LEARNING_PROMPT,
  fillPromptTemplate,
  truncateContent,
  cleanHtmlForExtraction,
} from './prompts.js';
import type {
  VenuePage,
  PageExtractionResult,
  ExtractedDishFromPage,
  DishLearningResult,
  DishFeedback,
  DishExtractionStrategy,
} from '@pad/core';

export interface DishFinderAIClientConfig {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

// Known chain products for higher confidence
const VERIFIED_CHAIN_PRODUCTS: Record<string, string[]> = {
  'dean-david': ['planted.chicken'],
  'birdie-birdie': ['planted.chicken', 'planted.chicken_burger'],
  'kaimug': ['planted.chicken'],
  'nooch': ['planted.chicken'],
  'chidoba': ['planted.chicken'],
  'stadtsalat': ['planted.chicken'],
  'doen-doen': ['planted.kebab', 'planted.chicken'],
  'rabowls': ['planted.chicken'],
};

/**
 * AI client for dish extraction operations using Gemini
 */
export class DishFinderAIClient {
  private genAI: GoogleGenerativeAI;
  private model: string;
  private maxTokens: number;
  private temperature: number;

  constructor(config?: DishFinderAIClientConfig) {
    // Check for API key in order of preference: config > GOOGLE_AI_API_KEY > GEMINI_API_KEY
    const apiKey = config?.apiKey || process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY || '';

    if (!apiKey) {
      throw new Error('Gemini API key not configured. Set GOOGLE_AI_API_KEY or GEMINI_API_KEY environment variable.');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    // Default to Gemini 2.5 Flash for improved performance and quality
    // Falls back to 2.0-flash automatically if 2.5 is unavailable
    this.model = config?.model || 'gemini-2.5-flash';
    this.maxTokens = config?.maxTokens || 16384; // Increased for full menu extraction
    this.temperature = config?.temperature || 0.1; // Lower for more consistent output
  }

  /**
   * Send a prompt to Gemini
   * Automatically falls back to gemini-2.0-flash if 2.5-flash is unavailable
   */
  private async chat(systemPrompt: string, userMessage: string): Promise<string> {
    const model = this.genAI.getGenerativeModel({
      model: this.model,
      generationConfig: {
        maxOutputTokens: this.maxTokens,
        temperature: this.temperature,
        responseMimeType: 'application/json',
      },
    });

    // Gemini handles system prompts differently - we prepend it to the user message
    const fullPrompt = `${systemPrompt}\n\n---\n\n${userMessage}`;

    try {
      const result = await model.generateContent(fullPrompt);
      const response = result.response;
      const text = response.text();

      // Log the raw response length for debugging
      console.log(`   Gemini response length: ${text.length} chars`);

      return text;
    } catch (error) {
      // If using 2.5-flash fails, fall back to 2.0-flash
      if (this.model === 'gemini-2.5-flash') {
        console.warn('   Gemini 2.5 Flash failed, falling back to 2.0 Flash...');

        // Persist the fallback to avoid repeated failures
        this.model = 'gemini-2.0-flash';

        const fallbackModel = this.genAI.getGenerativeModel({
          model: this.model,
          generationConfig: {
            maxOutputTokens: this.maxTokens,
            temperature: this.temperature,
            responseMimeType: 'application/json',
          },
        });

        const result = await fallbackModel.generateContent(fullPrompt);
        const response = result.response;
        const text = response.text();

        console.log(`   Gemini 2.0 (fallback) response length: ${text.length} chars`);

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

    // Try to find JSON object in the response
    const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as T;
    }

    return JSON.parse(cleanJson) as T;
  }

  /**
   * Check if JSON data contains actual menu items (not just restaurant metadata)
   */
  private hasMenuData(jsonData: unknown): boolean {
    if (!jsonData || typeof jsonData !== 'object') return false;

    const json = jsonData as Record<string, unknown>;

    // Check for schema.org Restaurant type - this is metadata, not menu
    if (json['@type'] === 'Restaurant') return false;

    // Check for common menu data patterns
    if (json.menu || json.items || json.products || json.menuItems) return true;

    // Check for Uber Eats / Wolt Next.js data patterns
    const props = json.props as Record<string, unknown> | undefined;
    const pageProps = props?.pageProps as Record<string, unknown> | undefined;
    if (pageProps?.menu) return true;
    const store = pageProps?.store as Record<string, unknown> | undefined;
    if (store?.menu) return true;

    // Check for nested menu arrays
    const jsonStr = JSON.stringify(json);
    if (jsonStr.includes('"items"') && jsonStr.length > 5000) return true;

    return false;
  }

  /**
   * Extract dishes from a venue page
   */
  async extractDishes(page: VenuePage): Promise<PageExtractionResult> {
    // Prepare content for extraction
    let content: string;
    let useJsonPrompt = false;

    // Only use JSON if it contains actual menu data, not just restaurant metadata
    if (page.json_data && this.hasMenuData(page.json_data)) {
      // Use JSON extraction prompt
      content = JSON.stringify(page.json_data, null, 2);
      content = truncateContent(content, 15000); // JSON can be larger
      useJsonPrompt = true;
    } else if (page.html) {
      // Clean and truncate HTML
      content = cleanHtmlForExtraction(page.html);
      content = truncateContent(content, 8000);
    } else {
      return {
        dishes: [],
        page_quality: {
          menu_found: false,
          prices_visible: false,
          descriptions_available: false,
          images_available: false,
        },
        extraction_notes: 'No content available',
      };
    }

    // Get known products for this chain
    const knownProducts = page.chain_id && VERIFIED_CHAIN_PRODUCTS[page.chain_id]
      ? VERIFIED_CHAIN_PRODUCTS[page.chain_id].join(', ')
      : 'any planted product';

    // Build prompt
    const prompt = fillPromptTemplate(
      useJsonPrompt ? JSON_MENU_EXTRACTION_PROMPT : DISH_EXTRACTION_PROMPT,
      {
        platform: page.platform,
        country: page.country,
        venue_name: page.venue_name,
        known_products: knownProducts,
        page_content: content,
        json_data: useJsonPrompt ? content : undefined,
      }
    );

    try {
      const response = await this.chat(DISH_FINDER_SYSTEM_PROMPT, prompt);
      return this.parseExtractionResponse(response);
    } catch (error) {
      console.warn('Dish extraction error:', error);
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
   * Parse the extraction response
   */
  private parseExtractionResponse(responseText: string): PageExtractionResult {
    try {
      // Clean the response - remove code blocks if present
      let cleanJson = responseText.trim();
      if (cleanJson.startsWith('```json')) {
        cleanJson = cleanJson.slice(7);
      } else if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.slice(3);
      }
      if (cleanJson.endsWith('```')) {
        cleanJson = cleanJson.slice(0, -3);
      }
      cleanJson = cleanJson.trim();

      // Since we're using responseMimeType: 'application/json', try direct parse first
      let parsed: unknown;
      try {
        parsed = JSON.parse(cleanJson);
      } catch {
        // If direct parse fails, try to extract JSON from the response
        // Find the first [ or { and the last ] or }
        const firstBracket = cleanJson.indexOf('[');
        const firstBrace = cleanJson.indexOf('{');
        const start = Math.min(
          firstBracket >= 0 ? firstBracket : Infinity,
          firstBrace >= 0 ? firstBrace : Infinity
        );

        if (start === Infinity) {
          throw new Error('No JSON found in response');
        }

        // Find matching end bracket (count nesting)
        let depth = 0;
        let end = -1;
        for (let i = start; i < cleanJson.length; i++) {
          const char = cleanJson[i];
          if (char === '[' || char === '{') depth++;
          if (char === ']' || char === '}') depth--;
          if (depth === 0) {
            end = i + 1;
            break;
          }
        }

        if (end === -1) {
          throw new Error('Unclosed JSON in response');
        }

        const jsonStr = cleanJson.substring(start, end);
        parsed = JSON.parse(jsonStr);
      }

      // Handle array format (just dishes)
      if (Array.isArray(parsed)) {
        const dishes = this.normalizeDishes(parsed);
        return {
          dishes,
          page_quality: {
            menu_found: dishes.length > 0,
            prices_visible: dishes.length > 0,
            descriptions_available: dishes.some(d => d.description),
            images_available: dishes.some(d => d.image_url),
          },
        };
      }

      // Handle object format
      const result = parsed as {
        dishes?: unknown[];
        page_quality?: {
          menu_found: boolean;
          prices_visible: boolean;
          descriptions_available: boolean;
          images_available: boolean;
        };
        extraction_notes?: string;
      };

      const dishes = this.normalizeDishes(result.dishes || []);
      return {
        dishes,
        page_quality: result.page_quality || {
          menu_found: dishes.length > 0,
          prices_visible: dishes.length > 0,
          descriptions_available: dishes.some(d => d.description),
          images_available: dishes.some(d => d.image_url),
        },
        extraction_notes: result.extraction_notes,
      };
    } catch (error) {
      console.warn('Failed to parse extraction response:', responseText.substring(0, 500));
      return {
        dishes: [],
        page_quality: {
          menu_found: false,
          prices_visible: false,
          descriptions_available: false,
          images_available: false,
        },
        extraction_notes: `Parse error: ${error}`,
      };
    }
  }

  /**
   * Normalize dish data from various formats
   */
  private normalizeDishes(dishes: unknown[]): ExtractedDishFromPage[] {
    return dishes.map((d: unknown) => {
      const dish = d as Record<string, unknown>;
      return {
        name: (dish.name || dish.dish_name || '') as string,
        description: (dish.description || '') as string,
        category: (dish.category || '') as string,
        image_url: (dish.image_url || dish.imageUrl || '') as string,
        price: String(dish.price || '0'),
        currency: (dish.currency || 'EUR') as string,
        planted_product_guess: (dish.planted_product_guess || dish.planted_product || 'planted.chicken') as string,
        product_confidence: Number(dish.product_confidence || dish.confidence || 80),
        is_vegan: Boolean(dish.is_vegan ?? true),
        dietary_tags: (dish.dietary_tags || []) as string[],
        reasoning: (dish.reasoning || 'Extracted from menu') as string,
      };
    });
  }

  /**
   * Fetch a URL and extract dishes from it
   * This is a convenience method that fetches the page and extracts dishes in one call
   */
  async extractDishesFromUrl(
    url: string,
    context: {
      platform: VenuePage['platform'];
      country: VenuePage['country'];
      venue_name: string;
      venue_id?: string;
      chain_id?: string;
    }
  ): Promise<PageExtractionResult> {
    try {
      // Fetch the URL using native fetch
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
      });

      if (!response.ok) {
        return {
          dishes: [],
          page_quality: {
            menu_found: false,
            prices_visible: false,
            descriptions_available: false,
            images_available: false,
          },
          extraction_notes: `Failed to fetch URL: ${response.status} ${response.statusText}`,
        };
      }

      const html = await response.text();

      // Try to extract JSON data from the page
      let jsonData: unknown = undefined;
      try {
        // Look for Next.js __NEXT_DATA__ script
        const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/);
        if (nextDataMatch) {
          jsonData = JSON.parse(nextDataMatch[1]);
        }
      } catch {
        // Ignore JSON parsing errors
      }

      // Create VenuePage and extract
      const page: VenuePage = {
        url,
        platform: context.platform,
        country: context.country,
        venue_name: context.venue_name,
        venue_id: context.venue_id || url,
        chain_id: context.chain_id,
        html,
        json_data: jsonData,
      };

      return await this.extractDishes(page);
    } catch (error) {
      return {
        dishes: [],
        page_quality: {
          menu_found: false,
          prices_visible: false,
          descriptions_available: false,
          images_available: false,
        },
        extraction_notes: `Error fetching URL: ${error}`,
      };
    }
  }

  /**
   * Learn from feedback to improve strategies
   */
  async learnFromFeedback(
    feedbackData: DishFeedback[],
    strategies: DishExtractionStrategy[]
  ): Promise<DishLearningResult> {
    const feedbackSummary = feedbackData.map((f) => ({
      result_type: f.result_type,
      strategy_id: f.strategy_id,
      details: f.feedback_details,
    }));

    const strategySummary = strategies.map((s) => ({
      id: s.id,
      platform: s.platform,
      success_rate: s.success_rate,
      total_uses: s.total_uses,
    }));

    const prompt = fillPromptTemplate(DISH_LEARNING_PROMPT, {
      days: '7',
      feedback_data: JSON.stringify(feedbackSummary, null, 2),
      strategies: JSON.stringify(strategySummary, null, 2),
    });

    try {
      const response = await this.chat(DISH_FINDER_SYSTEM_PROMPT, prompt);
      return this.parseJsonResponse<DishLearningResult>(response);
    } catch (error) {
      console.warn('Learning error:', error);
      return {
        strategy_updates: [],
        new_strategies: [],
        insights: [],
      };
    }
  }
}

// Singleton instance
let aiClientInstance: DishFinderAIClient | null = null;

export function getDishFinderAIClient(config?: DishFinderAIClientConfig): DishFinderAIClient {
  if (!aiClientInstance) {
    aiClientInstance = new DishFinderAIClient(config);
  }
  return aiClientInstance;
}

export function resetDishFinderAIClient(): void {
  aiClientInstance = null;
}
