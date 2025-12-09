import { useQuery } from '@tanstack/react-query';

export interface PlatformHealth {
  platform: string;
  status: 'operational' | 'degraded' | 'down';
  lastSuccessfulScrape?: string;
  lastFailedScrape?: string;
  errorRate: number;
  avgResponseTime?: number;
  recentErrors: {
    message: string;
    timestamp: string;
    venue_id?: string;
  }[];
}

export interface CircuitBreaker {
  platform: string;
  state: 'closed' | 'open' | 'half_open';
  failureCount: number;
  lastFailure?: string;
  nextRetry?: string;
  totalRequests: number;
  successRate: number;
}

export interface PlatformHealthResponse {
  platforms: PlatformHealth[];
  circuitBreakers: CircuitBreaker[];
  timestamp: string;
}

async function fetchPlatformHealth(): Promise<PlatformHealthResponse> {
  // This would be replaced with actual API call
  // For now, return mock data
  const mockData: PlatformHealthResponse = {
    platforms: [
      {
        platform: 'Uber Eats',
        status: 'operational',
        lastSuccessfulScrape: new Date(Date.now() - 15 * 60000).toISOString(),
        errorRate: 0.02,
        avgResponseTime: 1200,
        recentErrors: [],
      },
      {
        platform: 'Lieferando',
        status: 'degraded',
        lastSuccessfulScrape: new Date(Date.now() - 45 * 60000).toISOString(),
        lastFailedScrape: new Date(Date.now() - 5 * 60000).toISOString(),
        errorRate: 0.15,
        avgResponseTime: 3500,
        recentErrors: [
          {
            message: 'Rate limit exceeded',
            timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
          },
        ],
      },
      {
        platform: 'Wolt',
        status: 'operational',
        lastSuccessfulScrape: new Date(Date.now() - 10 * 60000).toISOString(),
        errorRate: 0.01,
        avgResponseTime: 950,
        recentErrors: [],
      },
    ],
    circuitBreakers: [
      {
        platform: 'Uber Eats',
        state: 'closed',
        failureCount: 0,
        totalRequests: 1250,
        successRate: 0.98,
      },
      {
        platform: 'Lieferando',
        state: 'half_open',
        failureCount: 3,
        lastFailure: new Date(Date.now() - 5 * 60000).toISOString(),
        nextRetry: new Date(Date.now() + 5 * 60000).toISOString(),
        totalRequests: 850,
        successRate: 0.85,
      },
      {
        platform: 'Wolt',
        state: 'closed',
        failureCount: 0,
        totalRequests: 920,
        successRate: 0.99,
      },
    ],
    timestamp: new Date().toISOString(),
  };

  return mockData;
}

export interface UsePlatformHealthReturn {
  platforms: PlatformHealth[];
  circuitBreakers: CircuitBreaker[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export function usePlatformHealth(): UsePlatformHealthReturn {
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['platform-health'],
    queryFn: fetchPlatformHealth,
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 15000, // Consider data stale after 15 seconds
  });

  return {
    platforms: data?.platforms || [],
    circuitBreakers: data?.circuitBreakers || [],
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
  };
}
