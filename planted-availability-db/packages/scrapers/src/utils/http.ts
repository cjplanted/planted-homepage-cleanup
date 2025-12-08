import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import pRetry from 'p-retry';

export interface HttpClientOptions {
  baseURL?: string;
  timeout?: number;
  headers?: Record<string, string>;
  retries?: number;
  retryDelay?: number;
}

const DEFAULT_OPTIONS: HttpClientOptions = {
  timeout: 30000,
  retries: 3,
  retryDelay: 1000,
};

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

  return pRetry(
    async () => {
      const response: AxiosResponse<T> = await client.get(url, options);
      return response.data;
    },
    {
      retries,
      minTimeout: retryDelay,
      maxTimeout: retryDelay * 4,
      onFailedAttempt: (error) => {
        console.warn(
          `Attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`
        );
      },
    }
  );
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
