import { auth } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';

// Wait for auth state to be ready
function getCurrentUser(): Promise<User | null> {
  return new Promise((resolve) => {
    // If already have a user, return immediately
    if (auth.currentUser) {
      resolve(auth.currentUser);
      return;
    }
    // Otherwise wait for auth state change
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

interface AuthHeaders {
  'Content-Type': string;
  Authorization: string;
}

async function getAuthHeaders(): Promise<AuthHeaders> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Not authenticated');
  }
  // Force refresh token to get latest custom claims
  const token = await user.getIdToken(true);
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function fetchFunction<T>(
  functionName: string,
  path: string = '',
  options: RequestInit = {}
): Promise<T> {
  console.log('[API] Fetching:', functionName, path);
  const headers = await getAuthHeaders();
  const url = `${API_BASE_URL}/${functionName}${path}`;
  console.log('[API] URL:', url);
  console.log('[API] Has auth:', !!headers.Authorization);
  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  });
  console.log('[API] Response status:', response.status);

  if (!response.ok) {
    // Try to parse error response as JSON
    let errorMessage = `Request failed: ${response.status} ${response.statusText}`;
    try {
      const errorData = await response.json();
      if (errorData.message) {
        errorMessage = errorData.message;
      } else if (errorData.error) {
        errorMessage = errorData.error;
      }
    } catch {
      // Response wasn't JSON, use the status message
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

// Helper to build query params safely (handles numbers, booleans, etc.)
function buildQueryParams(params?: Record<string, unknown>): string {
  if (!params) return '';
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.set(key, String(value));
    }
  });
  return searchParams.toString();
}

// Venues API
export const venuesApi = {
  getAll: (params?: { limit?: number; offset?: number }) => {
    const query = buildQueryParams(params);
    return fetchFunction<{ venues: unknown[]; total: number }>(
      'adminVenues',
      query ? `?${query}` : ''
    );
  },

  getById: (id: string) => fetchFunction<unknown>('adminVenues', `/${id}`),

  create: (data: unknown) =>
    fetchFunction<unknown>('adminVenues', '', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: unknown) =>
    fetchFunction<unknown>('adminVenues', `/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    fetchFunction<void>('adminVenues', `/${id}`, {
      method: 'DELETE',
    }),
};

// Dishes API
export const dishesApi = {
  getAll: (params?: { venue_id?: string; limit?: number }) => {
    const query = buildQueryParams(params);
    return fetchFunction<{ dishes: unknown[]; total: number }>(
      'adminDishes',
      query ? `?${query}` : ''
    );
  },

  getById: (id: string) => fetchFunction<unknown>('adminDishes', `/${id}`),

  create: (data: unknown) =>
    fetchFunction<unknown>('adminDishes', '', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: unknown) =>
    fetchFunction<unknown>('adminDishes', `/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    fetchFunction<void>('adminDishes', `/${id}`, {
      method: 'DELETE',
    }),
};

// Scrapers API
export interface ScraperRun {
  id: string;
  scraper_id: string;
  started_at: string;
  completed_at?: string;
  status: 'running' | 'completed' | 'failed' | 'partial';
  stats: {
    venues_checked: number;
    venues_updated: number;
    dishes_found: number;
    dishes_updated: number;
    errors: number;
  };
  errors?: Array<{
    venue_id?: string;
    message: string;
    timestamp: string;
  }>;
}

export interface ScraperStatusResponse {
  runs: ScraperRun[];
  currently_running: ScraperRun[];
  summary: {
    total_runs_24h: number;
    successful_24h: number;
    failed_24h: number;
    success_rate_24h: number | null;
  };
}

export const scrapersApi = {
  getStatus: (params?: { scraper_id?: string; status?: string; limit?: number }) => {
    const query = buildQueryParams(params);
    return fetchFunction<ScraperStatusResponse>(
      'adminScraperStatus',
      query ? `?${query}` : ''
    );
  },

  triggerScraper: () =>
    fetchFunction<unknown>('triggerScrapersManually', '', {
      method: 'POST',
      body: '{}',
    }),
};

// Promotions API
export const promotionsApi = {
  getAll: (params?: { venue_id?: string; chain_id?: string; active_only?: boolean; limit?: number }) => {
    const query = buildQueryParams(params);
    return fetchFunction<{ promotions: unknown[]; total: number }>(
      'adminPromotions',
      query ? `?${query}` : ''
    );
  },

  create: (data: unknown) =>
    fetchFunction<unknown>('adminPromotions', '', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    fetchFunction<void>('adminPromotions', `/${id}`, {
      method: 'DELETE',
    }),
};

// Moderation API (flagged items)
export interface FlaggedItem {
  id: string;
  type: 'venue' | 'dish';
  reason: string;
  data: unknown;
  last_verified: string;
  status: string;
}

export const moderationApi = {
  getFlagged: (params?: { type?: 'stale' | 'conflict' | 'error' | 'all'; collection?: string; limit?: number }) => {
    const query = buildQueryParams(params);
    return fetchFunction<{ items: FlaggedItem[]; total: number }>(
      'adminFlagged',
      query ? `?${query}` : ''
    );
  },

  approve: (collection: string, id: string) =>
    fetchFunction<void>(`admin${collection.charAt(0).toUpperCase() + collection.slice(1)}`, `/${id}/verify`, {
      method: 'POST',
    }),

  archive: (collection: string, id: string) =>
    fetchFunction<void>(`admin${collection.charAt(0).toUpperCase() + collection.slice(1)}`, `/${id}`, {
      method: 'DELETE',
    }),
};

// Webhook staging API
export const webhookApi = {
  getStaging: (params?: { status?: string; limit?: number }) => {
    const query = buildQueryParams(params);
    return fetchFunction<{ items: unknown[]; count: number }>(
      'webhookStaging',
      query ? `?${query}` : ''
    );
  },

  approve: (id: string) =>
    fetchFunction<void>('webhookApprove', `/${id}`, {
      method: 'POST',
    }),

  reject: (id: string, reason?: string) =>
    fetchFunction<void>('webhookReject', `/${id}`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
};

// Dashboard stats
export const statsApi = {
  getDashboard: () =>
    fetchFunction<{
      totalVenues: number;
      totalDishes: number;
      activeScrapers: number;
      recentChanges: number;
    }>('adminVenues', '/stats'),
};

// Partners API
export interface Partner {
  id: string;
  name: string;
  type: 'chain' | 'independent' | 'distributor' | 'aggregator';
  status: 'onboarding' | 'active' | 'suspended' | 'inactive';
  contact: {
    primary_name: string;
    primary_email: string;
    technical_email?: string;
    phone?: string;
  };
  config: {
    data_format: 'planted_standard' | 'custom';
    transformer_id?: string;
    auto_approve_threshold: number;
    requires_manual_review: boolean;
    allowed_entity_types: ('venue' | 'dish' | 'promotion' | 'availability')[];
    markets: string[];
    callback_url?: string;
  };
  quality_metrics: {
    total_submissions: number;
    accepted_submissions: number;
    rejected_submissions: number;
    average_confidence_score: number;
    last_submission_at?: string;
    data_quality_score: number;
  };
  rate_limits: {
    requests_per_hour: number;
    requests_per_day: number;
  };
  onboarded_at?: string;
  created_at: string;
  updated_at: string;
}

export interface IngestionBatch {
  id: string;
  partner_id: string;
  source: {
    channel: 'webhook' | 'email' | 'file_upload' | 'agent' | 'manual';
    idempotency_key?: string;
    file_name?: string;
  };
  status: string;
  stats: {
    records_received: number;
    records_valid: number;
    records_invalid: number;
    records_staged: number;
    records_approved: number;
    records_rejected: number;
  };
  received_at: string;
  created_at: string;
}

export interface CreatePartnerInput {
  name: string;
  type: Partner['type'];
  contact: Partner['contact'];
  config: Partial<Partner['config']>;
  rate_limits?: Partner['rate_limits'];
}

export interface CreatePartnerResponse {
  message: string;
  partner: Partner;
  credentials: {
    api_key: string;
    webhook_secret: string;
    warning: string;
  };
  integration_docs: {
    webhook_url: string;
    signature_header: string;
    timestamp_header: string;
    example: string;
  };
}

export const partnersApi = {
  getAll: (params?: { status?: string; type?: string; limit?: number; offset?: number }) => {
    const query = buildQueryParams(params);
    return fetchFunction<{ partners: Partner[]; total: number; stats: unknown }>(
      'adminPartners',
      query ? `?${query}` : ''
    );
  },

  getById: (id: string) => fetchFunction<Partner>('adminPartners', `/${id}`),

  create: (data: CreatePartnerInput) =>
    fetchFunction<CreatePartnerResponse>('adminPartners', '', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<Partner>) =>
    fetchFunction<Partner>('adminPartners', `/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  activate: (id: string) =>
    fetchFunction<{ message: string; partner: Partner }>('adminPartners', `/${id}/activate`, {
      method: 'POST',
    }),

  suspend: (id: string, reason?: string) =>
    fetchFunction<{ message: string; partner: Partner }>('adminPartners', `/${id}/suspend`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  rotateCredentials: (id: string) =>
    fetchFunction<{
      message: string;
      api_key: string;
      webhook_secret: string;
      old_credentials_valid_until: string;
      warning: string;
    }>('adminPartners', `/${id}/rotate-credentials`, {
      method: 'POST',
    }),

  updateEmailWhitelist: (id: string, domains: string[]) =>
    fetchFunction<{ message: string; domains: string[] }>('adminPartners', `/${id}/email-whitelist`, {
      method: 'POST',
      body: JSON.stringify({ domains }),
    }),
};

// Discovery Review API
export interface DiscoveredVenueForReview {
  id: string;
  name: string;
  is_chain: boolean;
  chain_id?: string;
  chain_name?: string;
  chain_confidence?: number;
  address: {
    street?: string;
    city: string;
    postal_code?: string;
    country: string;
  };
  coordinates?: { lat: number; lng: number };
  delivery_platforms: {
    platform: string;
    url: string;
    rating?: number;
    review_count?: number;
  }[];
  planted_products: string[];
  dishes: {
    name: string;
    price?: string;
    product: string;
    description?: string;
    confidence?: number;
  }[];
  confidence_score: number;
  confidence_factors: {
    factor: string;
    score: number;
    reason: string;
  }[];
  status: 'discovered' | 'verified' | 'rejected' | 'promoted' | 'stale';
  rejection_reason?: string;
  discovered_by_strategy_id: string;
  discovered_by_query: string;
  created_at: string;
  verified_at?: string;
}

export interface DiscoveryReviewParams {
  status?: string;
  country?: string;
  platform?: string;
  chain_id?: string;
  min_confidence?: number;
  max_confidence?: number;
  limit?: number;
  offset?: number;
}

export const discoveryReviewApi = {
  getVenues: (params?: DiscoveryReviewParams) => {
    const query = buildQueryParams(params as Record<string, unknown> | undefined);
    return fetchFunction<{ venues: DiscoveredVenueForReview[]; total: number }>(
      'adminDiscoveredVenues',
      query ? `?${query}` : ''
    );
  },

  getVenueById: (id: string) =>
    fetchFunction<DiscoveredVenueForReview>('adminDiscoveredVenues', `/${id}`),

  verifyVenue: (id: string, updates?: Partial<DiscoveredVenueForReview>) =>
    fetchFunction<{ success: boolean; message: string }>('adminDiscoveredVenues', `/${id}/verify`, {
      method: 'POST',
      body: JSON.stringify({ updates }),
    }),

  rejectVenue: (id: string, reason: string) =>
    fetchFunction<{ success: boolean; message: string }>('adminDiscoveredVenues', `/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  updateAndVerify: (id: string, data: Partial<DiscoveredVenueForReview>) =>
    fetchFunction<{ success: boolean; message: string }>('adminDiscoveredVenues', `/${id}/update-and-verify`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  bulkVerify: (ids: string[]) =>
    fetchFunction<{ success: boolean; verified: number }>('adminDiscoveredVenues', '/bulk-verify', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),

  bulkReject: (ids: string[], reason: string) =>
    fetchFunction<{ success: boolean; rejected: number }>('adminDiscoveredVenues', '/bulk-reject', {
      method: 'POST',
      body: JSON.stringify({ ids, reason }),
    }),

  getStats: () =>
    fetchFunction<{
      total_discovered: number;
      total_verified: number;
      total_rejected: number;
      by_country: Record<string, number>;
      by_platform: Record<string, number>;
      by_confidence: { low: number; medium: number; high: number };
    }>('adminDiscoveredVenues', '/stats'),
};

// Ingestion Batches API
export const batchesApi = {
  getAll: (params?: { partner_id?: string; status?: string; channel?: string; limit?: number }) => {
    const query = buildQueryParams(params);
    return fetchFunction<{ batches: IngestionBatch[]; total: number }>(
      'adminBatches',
      query ? `?${query}` : ''
    );
  },

  getById: (id: string) => fetchFunction<IngestionBatch>('adminBatches', `/${id}`),

  getPendingReview: (limit?: number) => {
    const query = buildQueryParams({ limit });
    return fetchFunction<{ batches: IngestionBatch[]; total: number }>(
      'adminBatches',
      `/pending-review${query ? `?${query}` : ''}`
    );
  },

  getStats: (since?: string) => {
    const query = buildQueryParams({ since });
    return fetchFunction<{
      total: number;
      byStatus: Record<string, number>;
      byChannel: Record<string, number>;
      avgProcessingTime: number;
    }>('adminBatches', `/stats${query ? `?${query}` : ''}`);
  },
};
