import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import pRetry from 'p-retry';
import {
  recordPlatformEvent,
  isPlatformHealthy,
  type DeliveryPlatformName,
} from '../services/PlatformHealthMonitor.js';

export interface HttpClientOptions {
  baseURL?: string;
  timeout?: number;
  headers?: Record<string, string>;
  retries?: number;
  retryDelay?: number;
  maxRetryDelay?: number;
  platform?: DeliveryPlatformName; // Track requests by platform
  country?: string;
}

const DEFAULT_OPTIONS: HttpClientOptions = {
  timeout: 30000,
  retries: 3,
  retryDelay: 1000,
  maxRetryDelay: 30000,
};

// HTTP status codes that are retryable
const RETRYABLE_STATUS_CODES = [
  408, // Request Timeout
  429, // Too Many Requests
  500, // Internal Server Error
  502, // Bad Gateway
  503, // Service Unavailable
  504, // Gateway Timeout
];

// Error codes that are retryable
const RETRYABLE_ERROR_CODES = [
  'ECONNRESET',
  'ETIMEDOUT',
  'ECONNABORTED',
  'ENOTFOUND',
  'EAI_AGAIN',
];

/**
 * Check if an error is retryable
 */
function isRetryableError(error: unknown): boolean {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError;

    // Check status code
    if (axiosError.response?.status && RETRYABLE_STATUS_CODES.includes(axiosError.response.status)) {
      return true;
    }

    // Check error code
    if (axiosError.code && RETRYABLE_ERROR_CODES.includes(axiosError.code)) {
      return true;
    }
  }

  // Check for timeout errors
  if (error instanceof Error && error.message.includes('timeout')) {
    return true;
  }

  return false;
}

export function createHttpClient(options: HttpClientOptions = {}): AxiosInstance {
  const config: AxiosRequestConfig = {
    baseURL: options.baseURL,
    timeout: options.timeout ?? DEFAULT_OPTIONS.timeout,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      ...options.headers,
    },
  };

  return axios.create(config);
}

export async function fetchWithRetry<T = unknown>(
  url: string,
  options: HttpClientOptions & AxiosRequestConfig = {}
): Promise<T> {
  const client = createHttpClient(options);
  const retries = options.retries ?? DEFAULT_OPTIONS.retries!;
  const retryDelay = options.retryDelay ?? DEFAULT_OPTIONS.retryDelay!;
  const { platform, country } = options;

  // Check platform health before making request
  if (platform && !isPlatformHealthy(platform)) {
    console.warn(`Platform ${platform} is unhealthy, skipping request to ${url}`);
    throw new Error(`Platform ${platform} is temporarily unavailable`);
  }

  const startTime = Date.now();
  const maxRetryDelay = options.maxRetryDelay ?? DEFAULT_OPTIONS.maxRetryDelay!;

  try {
    const result = await pRetry(
      async () => {
        const response: AxiosResponse<T> = await client.get(url, options);
        return response.data;
      },
      {
        retries,
        minTimeout: retryDelay,
        maxTimeout: maxRetryDelay,
        factor: 2, // Exponential backoff factor
        randomize: true, // Add jitter to prevent thundering herd
        onFailedAttempt: (error) => {
          const retriable = isRetryableError(error);
          console.warn(
            `Attempt ${error.attemptNumber} failed (${retriable ? 'retryable' : 'non-retryable'}). ${error.retriesLeft} retries left.`,
            error.message
          );

          // Don't retry non-retryable errors
          if (!retriable && error.retriesLeft > 0) {
            throw error; // Stop retrying
          }
        },
      }
    );

    // Record success
    if (platform) {
      await recordPlatformEvent({
        platform,
        success: true,
        response_time_ms: Date.now() - startTime,
        url,
        country,
      });
    }

    return result;
  } catch (error) {
    // Record failure
    if (platform) {
      await recordPlatformEvent({
        platform,
        success: false,
        response_time_ms: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        url,
        country,
      });
    }
    throw error;
  }
}

export async function fetchJSON<T = unknown>(
  url: string,
  options: HttpClientOptions = {}
): Promise<T> {
  return fetchWithRetry<T>(url, {
    ...options,
    headers: {
      ...options.headers,
      Accept: 'application/json',
    },
  });
}

export async function fetchHTML(
  url: string,
  options: HttpClientOptions = {}
): Promise<string> {
  return fetchWithRetry<string>(url, {
    ...options,
    headers: {
      ...options.headers,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });
}
