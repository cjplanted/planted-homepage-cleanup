/**
 * Scraper Configuration - ULTRA CONSERVATIVE
 *
 * These settings are designed to be extremely gentle on target sites.
 * We prioritize being a good citizen over speed.
 */

export interface RateLimitConfig {
  /** Minimum delay between requests in ms */
  minDelayMs: number;
  /** Maximum delay between requests in ms (random jitter) */
  maxDelayMs: number;
  /** Maximum requests per minute */
  maxRequestsPerMinute: number;
  /** Maximum requests per hour */
  maxRequestsPerHour: number;
  /** Maximum requests per day */
  maxRequestsPerDay: number;
  /** Delay between batches in ms */
  batchDelayMs: number;
  /** Maximum items per batch */
  batchSize: number;
}

export interface ScraperScheduleConfig {
  /** Cron expression for when to run */
  schedule: string;
  /** Timezone for schedule */
  timezone: string;
  /** Maximum venues to check per run */
  maxVenuesPerRun: number;
  /** Whether scraper is enabled */
  enabled: boolean;
}

/**
 * ULTRA CONSERVATIVE rate limits
 *
 * These are designed to be extremely slow and gentle:
 * - 1 request every 30-60 seconds
 * - Max 2 requests per minute
 * - Max 20 requests per hour
 * - Max 100 requests per day
 */
export const ULTRA_CONSERVATIVE_LIMITS: RateLimitConfig = {
  minDelayMs: 30000,        // 30 seconds minimum between requests
  maxDelayMs: 60000,        // Up to 60 seconds (random jitter)
  maxRequestsPerMinute: 2,  // Max 2 per minute
  maxRequestsPerHour: 20,   // Max 20 per hour
  maxRequestsPerDay: 100,   // Max 100 per day total
  batchDelayMs: 300000,     // 5 minute pause between batches
  batchSize: 5,             // Only 5 items per batch
};

/**
 * Per-scraper configuration
 *
 * ALL scrapers start DISABLED by default.
 * Enable one at a time and monitor for issues.
 */
export const SCRAPER_CONFIGS: Record<string, {
  rateLimits: RateLimitConfig;
  schedule: ScraperScheduleConfig;
  notes: string;
}> = {
  // ===== RETAIL SCRAPERS =====
  'planted-salesforce': {
    rateLimits: ULTRA_CONSERVATIVE_LIMITS,
    schedule: {
      schedule: '0 3 * * 0',      // Weekly: Sunday 3 AM
      timezone: 'Europe/Zurich',
      maxVenuesPerRun: 50,        // Only check 50 venues
      enabled: true,              // This one is safe - it's Planted's own API
    },
    notes: 'Planted official location API - safe to run',
  },

  'coop': {
    rateLimits: ULTRA_CONSERVATIVE_LIMITS,
    schedule: {
      schedule: '0 4 1 * *',      // Monthly: 1st of month, 4 AM
      timezone: 'Europe/Zurich',
      maxVenuesPerRun: 10,
      enabled: false,             // DISABLED - needs proxy
    },
    notes: 'Coop Switzerland - requires proxy, has DataDome protection',
  },

  'migros': {
    rateLimits: ULTRA_CONSERVATIVE_LIMITS,
    schedule: {
      schedule: '0 4 8 * *',      // Monthly: 8th of month, 4 AM
      timezone: 'Europe/Zurich',
      maxVenuesPerRun: 10,
      enabled: false,
    },
    notes: 'Migros Switzerland - requires proxy',
  },

  'rewe': {
    rateLimits: ULTRA_CONSERVATIVE_LIMITS,
    schedule: {
      schedule: '0 4 15 * *',     // Monthly: 15th of month, 4 AM
      timezone: 'Europe/Zurich',
      maxVenuesPerRun: 10,
      enabled: false,
    },
    notes: 'REWE Germany - requires proxy',
  },

  'billa': {
    rateLimits: ULTRA_CONSERVATIVE_LIMITS,
    schedule: {
      schedule: '0 4 22 * *',     // Monthly: 22nd of month, 4 AM
      timezone: 'Europe/Zurich',
      maxVenuesPerRun: 10,
      enabled: false,
    },
    notes: 'Billa Austria - requires proxy',
  },

  // ===== DELIVERY PLATFORM SCRAPERS =====
  'wolt': {
    rateLimits: {
      ...ULTRA_CONSERVATIVE_LIMITS,
      minDelayMs: 60000,          // Even slower: 1 minute between requests
      maxDelayMs: 120000,
      maxRequestsPerHour: 10,
      maxRequestsPerDay: 50,
    },
    schedule: {
      schedule: '0 5 * * 0',      // Weekly: Sunday 5 AM
      timezone: 'Europe/Zurich',
      maxVenuesPerRun: 5,
      enabled: false,
    },
    notes: 'Wolt - API rate limited, needs careful handling',
  },

  'uber-eats': {
    rateLimits: {
      ...ULTRA_CONSERVATIVE_LIMITS,
      minDelayMs: 60000,
      maxDelayMs: 120000,
      maxRequestsPerHour: 10,
      maxRequestsPerDay: 50,
    },
    schedule: {
      schedule: '0 5 * * 1',      // Weekly: Monday 5 AM
      timezone: 'Europe/Zurich',
      maxVenuesPerRun: 5,
      enabled: false,
    },
    notes: 'Uber Eats - very strict rate limiting',
  },

  'lieferando': {
    rateLimits: ULTRA_CONSERVATIVE_LIMITS,
    schedule: {
      schedule: '0 5 * * 2',      // Weekly: Tuesday 5 AM
      timezone: 'Europe/Zurich',
      maxVenuesPerRun: 5,
      enabled: false,
    },
    notes: 'Lieferando/Just Eat - requires proxy',
  },

  'deliveroo': {
    rateLimits: ULTRA_CONSERVATIVE_LIMITS,
    schedule: {
      schedule: '0 5 * * 3',      // Weekly: Wednesday 5 AM
      timezone: 'Europe/Zurich',
      maxVenuesPerRun: 5,
      enabled: false,
    },
    notes: 'Deliveroo UK/FR - requires proxy',
  },
};

/**
 * Global scraper settings
 */
export const GLOBAL_CONFIG = {
  /** Whether to run any scrapers at all */
  scrapersEnabled: true,

  /** Only run scrapers that are explicitly enabled */
  requireExplicitEnable: true,

  /** Maximum total requests across all scrapers per day */
  globalMaxRequestsPerDay: 200,

  /** Proxy configuration (empty = no proxy = most scrapers won't work) */
  proxy: {
    enabled: false,
    provider: null as 'scraperapi' | 'brightdata' | 'oxylabs' | null,
    apiKey: process.env.SCRAPER_PROXY_API_KEY || '',
  },

  /** Notification settings */
  notifications: {
    slackWebhookUrl: process.env.SLACK_WEBHOOK_URL || '',
    notifyOnFailure: true,
    notifyOnSuccess: false, // Don't spam on success
    notifyOnRateLimit: true,
  },

  /** Safety limits */
  safety: {
    /** Stop all scrapers if error rate exceeds this % */
    maxErrorRatePercent: 20,
    /** Pause scraper for this many hours after hitting rate limit */
    rateLimitPauseHours: 24,
    /** Maximum consecutive failures before disabling scraper */
    maxConsecutiveFailures: 3,
  },
};

/**
 * Helper to get delay with jitter
 */
export function getRandomDelay(config: RateLimitConfig): number {
  return config.minDelayMs + Math.random() * (config.maxDelayMs - config.minDelayMs);
}

/**
 * Helper to check if we're within rate limits
 */
export function isWithinRateLimits(
  config: RateLimitConfig,
  requestsThisMinute: number,
  requestsThisHour: number,
  requestsThisDay: number
): boolean {
  return (
    requestsThisMinute < config.maxRequestsPerMinute &&
    requestsThisHour < config.maxRequestsPerHour &&
    requestsThisDay < config.maxRequestsPerDay
  );
}

/**
 * Get enabled scrapers only
 */
export function getEnabledScrapers(): string[] {
  return Object.entries(SCRAPER_CONFIGS)
    .filter(([_, config]) => config.schedule.enabled)
    .map(([id]) => id);
}

/**
 * Log configuration summary
 */
export function logConfigSummary(): void {
  console.log('=== Scraper Configuration Summary ===');
  console.log(`Global scraping enabled: ${GLOBAL_CONFIG.scrapersEnabled}`);
  console.log(`Proxy enabled: ${GLOBAL_CONFIG.proxy.enabled}`);
  console.log(`Global daily limit: ${GLOBAL_CONFIG.globalMaxRequestsPerDay} requests`);
  console.log('');
  console.log('Enabled scrapers:');

  const enabled = getEnabledScrapers();
  if (enabled.length === 0) {
    console.log('  (none)');
  } else {
    enabled.forEach(id => {
      const config = SCRAPER_CONFIGS[id];
      console.log(`  - ${id}: ${config.schedule.schedule} (max ${config.schedule.maxVenuesPerRun} venues)`);
    });
  }

  console.log('');
  console.log('Disabled scrapers:');
  Object.entries(SCRAPER_CONFIGS)
    .filter(([_, config]) => !config.schedule.enabled)
    .forEach(([id, config]) => {
      console.log(`  - ${id}: ${config.notes}`);
    });
}
