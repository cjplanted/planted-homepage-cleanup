/**
 * Scraping Feature Types
 *
 * Type definitions for scraping operations, runs, and progress tracking.
 */

export type ScraperType = 'discovery' | 'extraction';

export type ScraperStatus = 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';

export type DiscoveryMode = 'explore' | 'enumerate' | 'verify';

export type ExtractionMode = 'enrich' | 'refresh' | 'verify';

export type ExtractionTarget = 'all' | 'chain' | 'venue';

export type Country = 'CH' | 'DE' | 'AT';

export type Platform = 'uber-eats' | 'wolt' | 'lieferando' | 'deliveroo';

/**
 * Discovery Configuration
 */
export interface DiscoveryConfig {
  countries: Country[];
  platforms: Platform[];
  mode: DiscoveryMode;
  chainId?: string;
  maxQueries: number;
  dryRun: boolean;
}

/**
 * Extraction Configuration
 */
export interface ExtractionConfig {
  target: ExtractionTarget;
  chainId?: string;
  venueId?: string;
  maxVenues: number;
  mode: ExtractionMode;
}

/**
 * Scraper Run Progress
 */
export interface ScraperProgress {
  runId: string;
  type: ScraperType;
  status: ScraperStatus;
  startedAt: string;
  completedAt?: string;
  progress: {
    current: number;
    total: number;
    percentage: number;
  };
  stats: {
    found: number;
    processed: number;
    errors: number;
  };
  cost: {
    search: number;
    ai: number;
    total: number;
  };
  eta?: number; // seconds
  logs: ScraperLog[];
  error?: string;
}

/**
 * Scraper Log Entry
 */
export interface ScraperLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  data?: unknown;
}

/**
 * Scraper Metadata
 */
export interface ScraperMetadata {
  type: ScraperType;
  name: string;
  description: string;
  lastRun?: {
    timestamp: string;
    status: ScraperStatus;
    duration: number;
  };
  capabilities: {
    countries: Country[];
    platforms: Platform[];
    modes: string[];
  };
}

/**
 * Budget Status
 */
export interface BudgetStatus {
  daily: {
    limit: number;
    used: number;
    percentage: number;
  };
  monthly: {
    limit: number;
    used: number;
    percentage: number;
  };
  breakdown: {
    search: {
      free: {
        limit: number;
        used: number;
      };
      paid: {
        cost: number;
        count: number;
      };
    };
    ai: {
      cost: number;
      calls: number;
    };
  };
  throttled: boolean;
  throttleReason?: string;
}

/**
 * Pipeline Stage Status
 */
export interface PipelineStage {
  stage: 'scraping' | 'extraction' | 'review' | 'website';
  status: 'idle' | 'running' | 'queued' | 'completed';
  count?: number;
  activeCount?: number;
}

/**
 * Dashboard Stats
 */
export interface DashboardStats {
  today: {
    discovered: number;
    approved: number;
    rejected: number;
    costs: number;
  };
  pipeline: PipelineStage[];
  runningOperations: ScraperProgress[];
  recentActivity: ActivityEvent[];
}

/**
 * Activity Event
 */
export interface ActivityEvent {
  id: string;
  timestamp: string;
  type: 'discovery_started' | 'discovery_completed' | 'extraction_started' | 'extraction_completed' | 'venue_approved' | 'venue_rejected';
  message: string;
  metadata?: unknown;
}

/**
 * API Response Types
 */
export interface StartScraperResponse {
  runId: string;
  status: ScraperStatus;
  message: string;
}

export interface CancelScraperResponse {
  success: boolean;
  message: string;
}

export interface AvailableScrapersResponse {
  discovery: {
    countries: string[];
    platforms: string[];
    modes: Array<{ id: string; name: string; description: string; estimatedQueries?: number; estimatedDuration?: string; requiresChainId?: boolean }>;
    defaultMaxQueries: number;
  };
  extraction: {
    modes: Array<{ id: string; name: string; description: string; estimatedAICalls?: number; estimatedDuration?: string }>;
    targets: Array<{ id: string; name: string; description: string; requiresChainId?: boolean; requiresVenueId?: boolean }>;
    defaultMaxVenues: number;
  };
  recentRuns: Array<{
    id: string;
    scraperId: string;
    status: string;
    startedAt: string;
    completedAt?: string;
    progress?: { current: number; total: number; percentage: number };
    stats?: Record<string, number>;
    costs?: Record<string, number>;
    config?: Record<string, unknown>;
  }>;
  runningScrapers: Array<{
    id: string;
    scraperId: string;
    status: string;
    startedAt: string;
    progress?: { current: number; total: number; percentage: number };
    config?: Record<string, unknown>;
  }>;
  statistics: {
    totalRecentRuns: number;
    currentlyRunning: number;
    recentSuccessRate: number | null;
  };
}

export interface RecentRunsResponse {
  runs: ScraperProgress[];
  total: number;
}
