/**
 * Smart Discovery Agent Module
 *
 * AI-powered restaurant discovery system that learns from feedback.
 */

export { SmartDiscoveryAgent } from './SmartDiscoveryAgent.js';
export type { DiscoveryAgentConfig, WebSearchProvider, WebSearchResult } from './SmartDiscoveryAgent.js';

export { ClaudeClient, getClaudeClient } from './ClaudeClient.js';
export type { ClaudeClientConfig } from './ClaudeClient.js';

export { GeminiClient, getGeminiClient, resetGeminiClient } from './GeminiClient.js';
export type { GeminiClientConfig } from './GeminiClient.js';

export { createAIClient, getAIClient, resetAIClient, detectAvailableProvider } from './AIClient.js';
export type { AIClient, AIProvider, AIClientConfig, ParsedSearchResults, ChainDetectionResult, LearningResult, ConfidenceScore } from './AIClient.js';

export {
  GoogleSearchProvider,
  SerpAPIProvider,
  MockSearchProvider,
  getSearchProvider,
} from './WebSearchProvider.js';

export {
  SearchEnginePool,
  getSearchEnginePool,
} from './SearchEnginePool.js';
export type {
  SearchCredential,
  CredentialUsage,
  PoolStats,
} from './SearchEnginePool.js';

export {
  QueryCache,
  getQueryCache,
} from './QueryCache.js';
export type {
  QueryCacheEntry,
  QueryCacheStats,
} from './QueryCache.js';

export {
  QueryPrioritizer,
  getQueryPrioritizer,
  resetQueryPrioritizer,
} from './QueryPrioritizer.js';
export type {
  QueryPlan,
  ChainEnumerationQuery,
  HighYieldQuery,
  CityExplorationQuery,
  BudgetAllocation,
  ChainMetadata,
} from './QueryPrioritizer.js';

export * from './prompts.js';

// Platform adapters
export {
  BasePlatformAdapter,
  JustEatAdapter,
  UberEatsAdapter,
  LieferandoAdapter,
  WoltAdapter,
  SmoodAdapter,
  platformAdapters,
  getAdapter,
  getAdaptersForCountry,
  getSupportedPlatforms,
} from './platforms/index.js';

export type {
  VenuePageData,
  MenuItem,
  PlantedMenuItem,
  PlatformSearchResult,
} from './platforms/index.js';
