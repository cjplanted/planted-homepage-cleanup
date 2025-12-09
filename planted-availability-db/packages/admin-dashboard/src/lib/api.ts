import { auth } from './firebase';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';

async function getAuthHeaders(): Promise<HeadersInit> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Not authenticated');
  }
  const token = await user.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function fetchWithAuth<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  });

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
    return fetchWithAuth<{ venues: unknown[]; total: number }>(
      `/api/v1/admin/venues${query ? `?${query}` : ''}`
    );
  },

  getById: (id: string) => fetchWithAuth<unknown>(`/api/v1/admin/venues/${id}`),

  create: (data: unknown) =>
    fetchWithAuth<unknown>('/api/v1/admin/venues', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: unknown) =>
    fetchWithAuth<unknown>(`/api/v1/admin/venues/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    fetchWithAuth<void>(`/api/v1/admin/venues/${id}`, {
      method: 'DELETE',
    }),
};

// Dishes API
export const dishesApi = {
  getAll: (params?: { venue_id?: string; limit?: number }) => {
    const query = buildQueryParams(params);
    return fetchWithAuth<{ dishes: unknown[]; total: number }>(
      `/api/v1/admin/dishes${query ? `?${query}` : ''}`
    );
  },

  getById: (id: string) => fetchWithAuth<unknown>(`/api/v1/admin/dishes/${id}`),

  create: (data: unknown) =>
    fetchWithAuth<unknown>('/api/v1/admin/dishes', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: unknown) =>
    fetchWithAuth<unknown>(`/api/v1/admin/dishes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    fetchWithAuth<void>(`/api/v1/admin/dishes/${id}`, {
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
    const searchParams = new URLSearchParams();
    if (params?.scraper_id) searchParams.set('scraper_id', params.scraper_id);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    const query = searchParams.toString();
    return fetchWithAuth<ScraperStatusResponse>(
      `/api/v1/admin/scraper-status${query ? `?${query}` : ''}`
    );
  },

  triggerScraper: () =>
    fetch(`${API_BASE_URL}/api/v1/admin/trigger-scrapers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    }).then(res => res.json()),
};

// Promotions API
export const promotionsApi = {
  getAll: (params?: { venue_id?: string; chain_id?: string; active_only?: boolean; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.venue_id) searchParams.set('venue_id', params.venue_id);
    if (params?.chain_id) searchParams.set('chain_id', params.chain_id);
    if (params?.active_only !== undefined) searchParams.set('active_only', String(params.active_only));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    const query = searchParams.toString();
    return fetchWithAuth<{ promotions: unknown[]; total: number }>(
      `/api/v1/admin/promotions${query ? `?${query}` : ''}`
    );
  },

  create: (data: unknown) =>
    fetchWithAuth<unknown>('/api/v1/admin/promotions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    fetchWithAuth<void>(`/api/v1/admin/promotions/${id}`, {
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
    const searchParams = new URLSearchParams();
    if (params?.type) searchParams.set('type', params.type);
    if (params?.collection) searchParams.set('collection', params.collection);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    const query = searchParams.toString();
    return fetchWithAuth<{ items: FlaggedItem[]; total: number }>(
      `/api/v1/admin/flagged${query ? `?${query}` : ''}`
    );
  },

  approve: (collection: string, id: string) =>
    fetchWithAuth<void>(`/api/v1/admin/${collection}/${id}/verify`, {
      method: 'POST',
    }),

  archive: (collection: string, id: string) =>
    fetchWithAuth<void>(`/api/v1/admin/${collection}/${id}`, {
      method: 'DELETE',
    }),
};

// Webhook staging API
export const webhookApi = {
  getStaging: (params?: { status?: string; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    const query = searchParams.toString();
    return fetchWithAuth<{ items: unknown[]; count: number }>(
      `/api/v1/webhooks/staging${query ? `?${query}` : ''}`
    );
  },

  approve: (id: string) =>
    fetchWithAuth<void>(`/api/v1/webhooks/staging/${id}/approve`, {
      method: 'POST',
    }),

  reject: (id: string, reason?: string) =>
    fetchWithAuth<void>(`/api/v1/webhooks/staging/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
};

// Dashboard stats
export const statsApi = {
  getDashboard: () =>
    fetchWithAuth<{
      totalVenues: number;
      totalDishes: number;
      activeScrapers: number;
      recentChanges: number;
    }>('/api/v1/admin/stats'),
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
    return fetchWithAuth<{ partners: Partner[]; total: number; stats: unknown }>(
      `/adminPartners${query ? `?${query}` : ''}`
    );
  },

  getById: (id: string) => fetchWithAuth<Partner>(`/adminPartners/${id}`),

  create: (data: CreatePartnerInput) =>
    fetchWithAuth<CreatePartnerResponse>('/adminPartners', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<Partner>) =>
    fetchWithAuth<Partner>(`/adminPartners/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  activate: (id: string) =>
    fetchWithAuth<{ message: string; partner: Partner }>(`/adminPartners/${id}/activate`, {
      method: 'POST',
    }),

  suspend: (id: string, reason?: string) =>
    fetchWithAuth<{ message: string; partner: Partner }>(`/adminPartners/${id}/suspend`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  rotateCredentials: (id: string) =>
    fetchWithAuth<{
      message: string;
      api_key: string;
      webhook_secret: string;
      old_credentials_valid_until: string;
      warning: string;
    }>(`/adminPartners/${id}/rotate-credentials`, {
      method: 'POST',
    }),

  updateEmailWhitelist: (id: string, domains: string[]) =>
    fetchWithAuth<{ message: string; domains: string[] }>(`/adminPartners/${id}/email-whitelist`, {
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
    return fetchWithAuth<{ venues: DiscoveredVenueForReview[]; total: number }>(
      `/api/v1/admin/discovered-venues${query ? `?${query}` : ''}`
    );
  },

  getVenueById: (id: string) =>
    fetchWithAuth<DiscoveredVenueForReview>(`/api/v1/admin/discovered-venues/${id}`),

  verifyVenue: (id: string, updates?: Partial<DiscoveredVenueForReview>) =>
    fetchWithAuth<{ success: boolean; message: string }>(`/api/v1/admin/discovered-venues/${id}/verify`, {
      method: 'POST',
      body: JSON.stringify({ updates }),
    }),

  rejectVenue: (id: string, reason: string) =>
    fetchWithAuth<{ success: boolean; message: string }>(`/api/v1/admin/discovered-venues/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  updateAndVerify: (id: string, data: Partial<DiscoveredVenueForReview>) =>
    fetchWithAuth<{ success: boolean; message: string }>(`/api/v1/admin/discovered-venues/${id}/update-and-verify`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  bulkVerify: (ids: string[]) =>
    fetchWithAuth<{ success: boolean; verified: number }>(`/api/v1/admin/discovered-venues/bulk-verify`, {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),

  bulkReject: (ids: string[], reason: string) =>
    fetchWithAuth<{ success: boolean; rejected: number }>(`/api/v1/admin/discovered-venues/bulk-reject`, {
      method: 'POST',
      body: JSON.stringify({ ids, reason }),
    }),

  getStats: () =>
    fetchWithAuth<{
      total_discovered: number;
      total_verified: number;
      total_rejected: number;
      by_country: Record<string, number>;
      by_platform: Record<string, number>;
      by_confidence: { low: number; medium: number; high: number };
    }>('/api/v1/admin/discovered-venues/stats'),
};

// Ingestion Batches API
export const batchesApi = {
  getAll: (params?: { partner_id?: string; status?: string; channel?: string; limit?: number }) => {
    const query = buildQueryParams(params);
    return fetchWithAuth<{ batches: IngestionBatch[]; total: number }>(
      `/adminBatches${query ? `?${query}` : ''}`
    );
  },

  getById: (id: string) => fetchWithAuth<IngestionBatch>(`/adminBatches/${id}`),

  getPendingReview: (limit?: number) => {
    const query = buildQueryParams({ limit });
    return fetchWithAuth<{ batches: IngestionBatch[]; total: number }>(
      `/adminBatches/pending-review${query ? `?${query}` : ''}`
    );
  },

  getStats: (since?: string) => {
    const query = buildQueryParams({ since });
    return fetchWithAuth<{
      total: number;
      byStatus: Record<string, number>;
      byChannel: Record<string, number>;
      avgProcessingTime: number;
    }>(`/adminBatches/stats${query ? `?${query}` : ''}`);
  },
};
