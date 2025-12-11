/**
 * Review API Client
 *
 * Typed API functions for the Review Queue feature.
 */

import { apiClient } from '@/lib/api/client';
import { API_ENDPOINTS } from '@/lib/api/endpoints';
import {
  ReviewQueueResponse,
  ReviewQueueFilters,
  ReviewVenue,
  ReviewDish,
  HierarchyNode,
  ReviewStats,
  FeedbackRequest,
} from '../types';

/**
 * Backend response types (what the API actually returns)
 */
interface BackendReviewVenue {
  id: string;
  name: string;
  chainId?: string;
  chainName?: string;
  address: {
    street?: string;
    city: string;
    postalCode?: string;
    country: string;
  };
  confidenceScore: number;
  status: string;
  createdAt: string;
  dishes: BackendReviewDish[];
  deliveryPlatforms?: Array<{
    platform: string;
    url: string;
    active: boolean;
  }>;
}

interface BackendReviewDish {
  id: string;
  name: string;
  description?: string;
  product: string;
  confidence: number;
  price?: string;
  imageUrl?: string;
  status: string;
}

/**
 * Backend HierarchyNode format (now matches frontend)
 */
interface BackendHierarchyNode {
  id: string;
  type: 'country' | 'venueType' | 'chain' | 'venue';
  label: string;
  count: number;
  children?: BackendHierarchyNode[];
  venue?: BackendReviewVenue;
}

interface BackendStats {
  pending: number;
  verified: number;
  rejected: number;
  promoted?: number;
  stale?: number;
  byCountry: Record<string, number>;
  byConfidence?: {
    low: number;
    medium: number;
    high: number;
  };
  total: number;
}

interface BackendResponse {
  items: BackendReviewVenue[];
  hierarchy: BackendHierarchyNode[];
  stats: BackendStats;
  pagination: {
    cursor?: string;
    hasMore: boolean;
    total: number;
    pageSize: number;
  };
}

/**
 * Transform backend venue to frontend venue
 */
function transformVenue(backendVenue: BackendReviewVenue): ReviewVenue {
  const primaryPlatform = backendVenue.deliveryPlatforms?.[0];
  return {
    id: backendVenue.id,
    name: backendVenue.name,
    chain: backendVenue.chainName,
    venueType: 'restaurant', // Default, backend doesn't provide this
    address: backendVenue.address.street || backendVenue.address.city,
    city: backendVenue.address.city,
    country: backendVenue.address.country,
    countryCode: backendVenue.address.country,
    platform: (primaryPlatform?.platform as ReviewVenue['platform']) || 'other',
    platformUrl: primaryPlatform?.url || '',
    confidence: backendVenue.confidenceScore / 100, // Normalize to 0-1
    confidenceFactors: [],
    dishes: backendVenue.dishes.map(transformDish),
    status: backendVenue.status === 'discovered' ? 'pending' : backendVenue.status as 'pending' | 'verified' | 'rejected',
    scrapedAt: backendVenue.createdAt,
    deliveryPlatforms: backendVenue.deliveryPlatforms || [],
  };
}

/**
 * Transform backend dish to frontend dish
 */
function transformDish(backendDish: BackendReviewDish): ReviewDish {
  return {
    id: backendDish.id,
    name: backendDish.name,
    description: backendDish.description,
    price: parseFloat(backendDish.price || '0') || 0,
    currency: 'CHF', // Default
    imageUrl: backendDish.imageUrl,
    productMatch: (backendDish.product || 'planted.other') as ReviewDish['productMatch'],
    confidence: backendDish.confidence / 100, // Normalize to 0-1
  };
}

/**
 * Transform backend hierarchy node to frontend HierarchyNode format
 * The backend now returns HierarchyNode[] directly, but venue objects need transformation
 */
function transformHierarchyNode(node: BackendHierarchyNode, itemsMap: Map<string, ReviewVenue>): HierarchyNode {
  const result: HierarchyNode = {
    id: node.id,
    type: node.type,
    label: node.label,
    count: node.count,
  };

  // If this is a venue node, attach the transformed venue
  if (node.type === 'venue' && node.venue) {
    result.venue = itemsMap.get(node.venue.id);
  }

  // Recursively transform children
  if (node.children && node.children.length > 0) {
    result.children = node.children.map(child => transformHierarchyNode(child, itemsMap));
  }

  return result;
}

/**
 * Transform backend hierarchy to frontend HierarchyNode format
 */
function transformHierarchy(backendHierarchy: BackendHierarchyNode[], items: ReviewVenue[]): HierarchyNode[] {
  // Create a map for quick venue lookup
  const itemsMap = new Map<string, ReviewVenue>(items.map(item => [item.id, item]));

  return backendHierarchy.map(node => transformHierarchyNode(node, itemsMap));
}

/**
 * Transform backend stats to frontend stats
 */
function transformStats(backendStats: BackendStats): ReviewStats {
  return {
    pending: backendStats.pending,
    verified: backendStats.verified,
    rejected: backendStats.rejected,
    total: backendStats.total,
    averageConfidence: 0.75, // Default since backend doesn't provide this
    byCountry: backendStats.byCountry,
    byVenueType: {}, // Backend doesn't provide this
    byPlatform: {}, // Backend doesn't provide this
  };
}

/**
 * Build query string from filters
 */
function buildQueryString(filters: ReviewQueueFilters): string {
  const params = new URLSearchParams();

  if (filters.country) params.append('country', filters.country);
  // Map frontend 'pending' status to backend 'discovered' status
  if (filters.status) {
    params.append('status', filters.status === 'pending' ? 'discovered' : filters.status);
  }
  if (filters.minConfidence !== undefined) params.append('minConfidence', filters.minConfidence.toString());
  if (filters.search) params.append('search', filters.search);
  if (filters.pageSize !== undefined) params.append('limit', filters.pageSize.toString());

  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
}

/**
 * Get Review Queue
 */
export async function getReviewQueue(filters: ReviewQueueFilters = {}): Promise<ReviewQueueResponse> {
  const queryString = buildQueryString(filters);
  const backendResponse = await apiClient.get<BackendResponse>(`${API_ENDPOINTS.REVIEW_QUEUE}${queryString}`);

  // Transform backend response to frontend format
  const items = backendResponse.items.map(transformVenue);
  const hierarchy = transformHierarchy(backendResponse.hierarchy, items);
  const stats = transformStats(backendResponse.stats);

  return {
    items,
    hierarchy,
    stats,
    pagination: {
      page: filters.page || 1,
      pageSize: backendResponse.pagination.pageSize,
      total: backendResponse.pagination.total,
      totalPages: Math.ceil(backendResponse.pagination.total / backendResponse.pagination.pageSize),
      hasMore: backendResponse.pagination.hasMore,
    },
  };
}

/**
 * Backend response for approve/partial approve/reject
 */
interface BackendApprovalResponse {
  success: boolean;
  message: string;
  venue: {
    id: string;
    name: string;
    status: string;
    verifiedAt?: string;
    rejectionReason?: string;
  };
}

/**
 * Helper to create a minimal ReviewVenue from backend response
 */
function createMinimalVenue(venue: BackendApprovalResponse['venue'], status: ReviewVenue['status']): ReviewVenue {
  return {
    id: venue.id,
    name: venue.name,
    status,
    chain: undefined,
    venueType: 'restaurant',
    address: '',
    city: '',
    country: '',
    countryCode: '',
    platform: 'other',
    platformUrl: '',
    confidence: 0,
    confidenceFactors: [],
    dishes: [],
    scrapedAt: new Date().toISOString(),
    reviewedAt: venue.verifiedAt,
    rejectionReason: venue.rejectionReason,
  };
}

/**
 * Approve Venue (Full)
 */
export async function approveVenue(venueId: string): Promise<ReviewVenue> {
  const response = await apiClient.post<BackendApprovalResponse>(API_ENDPOINTS.APPROVE_VENUE, { venueId });
  return createMinimalVenue(response.venue, 'verified');
}

/**
 * Partial Approve Venue (with feedback)
 */
export async function partialApproveVenue(
  venueId: string,
  feedback: string,
  dishIds?: string[]
): Promise<ReviewVenue> {
  // Parse feedback to extract tags (format from UI: "tag1, tag2\n\nfeedback text")
  const parts = feedback.split('\n\n');
  const feedbackTags = parts.length > 1 ? parts[0].split(', ').filter(Boolean) : [];
  const feedbackText = parts.length > 1 ? parts.slice(1).join('\n\n') : feedback;

  const response = await apiClient.post<BackendApprovalResponse>(API_ENDPOINTS.PARTIAL_APPROVE_VENUE, {
    venueId,
    feedback: feedbackText,
    feedbackTags,
    dishIds,
  });

  return createMinimalVenue(response.venue, 'verified');
}

/**
 * Reject Venue
 */
export async function rejectVenue(venueId: string, reason: string): Promise<ReviewVenue> {
  const response = await apiClient.post<BackendApprovalResponse>(API_ENDPOINTS.REJECT_VENUE, {
    venueId,
    reason,
  });
  return createMinimalVenue(response.venue, 'rejected');
}

/**
 * Bulk Approve Venues
 */
export async function bulkApproveVenues(venueIds: string[]): Promise<{ success: number; failed: number }> {
  return apiClient.post<{ success: number; failed: number }>(API_ENDPOINTS.BULK_APPROVE, {
    venueIds,
  });
}

/**
 * Bulk Reject Venues
 */
export async function bulkRejectVenues(
  venueIds: string[],
  reason: string
): Promise<{ success: number; failed: number }> {
  return apiClient.post<{ success: number; failed: number }>(API_ENDPOINTS.BULK_REJECT, {
    venueIds,
    reason,
  });
}

/**
 * Submit AI Feedback
 */
export async function submitFeedback(request: FeedbackRequest): Promise<void> {
  return apiClient.post<void>(API_ENDPOINTS.FEEDBACK_SUBMIT, request);
}

/**
 * Get Venue by ID
 * Note: This uses the review queue endpoint with a filter
 */
export async function getVenueById(venueId: string): Promise<ReviewVenue> {
  const response = await apiClient.get<ReviewQueueResponse>(
    `${API_ENDPOINTS.REVIEW_QUEUE}?venueId=${encodeURIComponent(venueId)}`
  );
  if (response.items && response.items.length > 0) {
    return response.items[0];
  }
  throw new Error('Venue not found');
}

/**
 * Chain Management
 */
export interface Chain {
  id: string;
  name: string;
  type: string;
  markets: string[];
}

export async function getChains(): Promise<Chain[]> {
  const response = await apiClient.get<{ chains: Chain[]; total: number }>(API_ENDPOINTS.LIST_CHAINS);
  return response.chains || [];
}

export async function assignChain(params: {
  venueIds: string[];
  chainId?: string;
  newChainName?: string;
}): Promise<{ chainId: string; chainName: string; updatedCount: number }> {
  return apiClient.post(API_ENDPOINTS.ASSIGN_CHAIN, params);
}

/**
 * Update Venue Country
 */
export async function updateVenueCountry(
  venueId: string,
  country: string
): Promise<{ success: boolean; venue: { id: string; name: string; previousCountry: string; country: string } }> {
  return apiClient.post(API_ENDPOINTS.UPDATE_VENUE_COUNTRY, { venueId, country });
}
