import { auth } from '@/lib/firebase';
import { buildApiUrl } from './endpoints';

/**
 * API Client Configuration
 */
const REQUEST_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

/**
 * API Error Class
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Network Error Class
 */
export class NetworkError extends Error {
  constructor(message: string, public originalError?: unknown) {
    super(message);
    this.name = 'NetworkError';
  }
}

/**
 * Request Options
 */
interface RequestOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  requiresAuth?: boolean;
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 */
function getRetryDelay(attempt: number): number {
  return INITIAL_RETRY_DELAY * Math.pow(2, attempt);
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof ApiError) {
    // Retry on server errors (5xx) and rate limiting (429)
    return (
      (error.status !== undefined && error.status >= 500) ||
      error.status === 429
    );
  }
  // Retry on network errors
  return error instanceof NetworkError;
}

/**
 * Check if user is online
 */
function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * Get Firebase Auth Token
 */
async function getAuthToken(): Promise<string | null> {
  try {
    const user = auth.currentUser;
    if (!user) {
      return null;
    }
    return await user.getIdToken(/* forceRefresh */ false);
  } catch (error) {
    console.error('Failed to get auth token:', error);
    return null;
  }
}

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);

    // Handle abort
    if ((error as Error).name === 'AbortError') {
      throw new NetworkError('Request timeout');
    }

    throw error;
  }
}

/**
 * Core API Request Function with Retry Logic
 */
async function apiRequestWithRetry(
  endpoint: string,
  options: RequestOptions = {},
  attempt = 0
): Promise<Response> {
  // Check if online
  if (!isOnline()) {
    throw new NetworkError('No internet connection');
  }

  const {
    timeout = REQUEST_TIMEOUT,
    retries = MAX_RETRIES,
    requiresAuth = true,
    headers = {},
    ...fetchOptions
  } = options;

  try {
    // Get auth token if required
    let authHeaders: HeadersInit = {};
    if (requiresAuth) {
      const token = await getAuthToken();
      if (token) {
        authHeaders = { Authorization: `Bearer ${token}` };
      } else {
        throw new ApiError('Not authenticated', 401, 'UNAUTHORIZED');
      }
    }

    // Build full URL
    const url = buildApiUrl(endpoint);

    // Make request with timeout
    const response = await fetchWithTimeout(
      url,
      {
        ...fetchOptions,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
          ...authHeaders,
        },
      },
      timeout
    );

    // Handle non-ok responses
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiError(
        errorData.message || errorData.error || `Request failed with status ${response.status}`,
        response.status,
        errorData.code,
        errorData
      );
    }

    return response;
  } catch (error) {
    // If retryable and retries remaining, retry with backoff
    if (isRetryableError(error) && attempt < retries) {
      const delay = getRetryDelay(attempt);
      console.warn(
        `Request failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${delay}ms...`,
        error
      );
      await sleep(delay);
      return apiRequestWithRetry(endpoint, options, attempt + 1);
    }

    // Convert unknown errors to NetworkError
    if (!(error instanceof ApiError) && !(error instanceof NetworkError)) {
      throw new NetworkError(
        'Network request failed',
        error
      );
    }

    throw error;
  }
}

/**
 * GET Request
 */
export async function get<T>(
  endpoint: string,
  options: Omit<RequestOptions, 'method' | 'body'> = {}
): Promise<T> {
  const response = await apiRequestWithRetry(endpoint, {
    ...options,
    method: 'GET',
  });
  return response.json();
}

/**
 * POST Request
 */
export async function post<T>(
  endpoint: string,
  data?: unknown,
  options: Omit<RequestOptions, 'method'> = {}
): Promise<T> {
  const response = await apiRequestWithRetry(endpoint, {
    ...options,
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  });
  return response.json();
}

/**
 * PUT Request
 */
export async function put<T>(
  endpoint: string,
  data?: unknown,
  options: Omit<RequestOptions, 'method'> = {}
): Promise<T> {
  const response = await apiRequestWithRetry(endpoint, {
    ...options,
    method: 'PUT',
    body: data ? JSON.stringify(data) : undefined,
  });
  return response.json();
}

/**
 * PATCH Request
 */
export async function patch<T>(
  endpoint: string,
  data?: unknown,
  options: Omit<RequestOptions, 'method'> = {}
): Promise<T> {
  const response = await apiRequestWithRetry(endpoint, {
    ...options,
    method: 'PATCH',
    body: data ? JSON.stringify(data) : undefined,
  });
  return response.json();
}

/**
 * DELETE Request
 */
export async function del<T>(
  endpoint: string,
  options: Omit<RequestOptions, 'method' | 'body'> = {}
): Promise<T> {
  const response = await apiRequestWithRetry(endpoint, {
    ...options,
    method: 'DELETE',
  });
  return response.json();
}

/**
 * Export API client object
 */
export const apiClient = {
  get,
  post,
  put,
  patch,
  delete: del,
};
