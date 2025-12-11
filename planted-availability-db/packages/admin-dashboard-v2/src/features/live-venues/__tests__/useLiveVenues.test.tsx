/**
 * useLiveVenues Hook Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLiveVenues } from '../hooks/useLiveVenues';
import { server } from '@/test/mocks/server';
import { http, HttpResponse } from 'msw';

// Mock firebase auth
vi.mock('@/lib/firebase', () => {
  const mockGetIdToken = vi.fn().mockResolvedValue('mock-token');
  return {
    auth: {
      currentUser: {
        getIdToken: mockGetIdToken,
      },
    },
  };
});

// Wrapper component
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useLiveVenues', () => {
  beforeEach(() => {
    server.resetHandlers();
  });

  it('should fetch live venues data', async () => {
    const { result } = renderHook(() => useLiveVenues(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBeDefined();
    expect(result.current.data?.items).toBeDefined();
    expect(result.current.data?.items.length).toBeGreaterThan(0);
  });

  it('should filter by country', async () => {
    const { result } = renderHook(() => useLiveVenues({ country: 'CH' }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // All items should be from CH
    result.current.data?.items.forEach(venue => {
      expect(venue.address.country).toBe('CH');
    });
  });

  it('should filter by status', async () => {
    const { result } = renderHook(() => useLiveVenues({ status: 'active' }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // All items should be active
    result.current.data?.items.forEach(venue => {
      expect(venue.status).toBe('active');
    });
  });

  it('should filter by venue type', async () => {
    const { result } = renderHook(() => useLiveVenues({ venueType: 'restaurant' }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // All items should be restaurants
    result.current.data?.items.forEach(venue => {
      expect(venue.type).toBe('restaurant');
    });
  });

  it('should handle API errors', async () => {
    server.use(
      http.get('*/adminLiveVenues', () => {
        return new HttpResponse(
          JSON.stringify({ error: 'Server error' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      })
    );

    const { result } = renderHook(() => useLiveVenues(), {
      wrapper: createWrapper(),
    });

    // API client has retries, so we need longer timeout
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    }, { timeout: 15000 });
  });

  it('should include stats in response', async () => {
    const { result } = renderHook(() => useLiveVenues(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data?.stats).toBeDefined();
    expect(result.current.data?.stats.total).toBeGreaterThanOrEqual(0);
  });

  it('should include hierarchy in response', async () => {
    const { result } = renderHook(() => useLiveVenues(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data?.hierarchy).toBeDefined();
    expect(Array.isArray(result.current.data?.hierarchy)).toBe(true);
  });
});
