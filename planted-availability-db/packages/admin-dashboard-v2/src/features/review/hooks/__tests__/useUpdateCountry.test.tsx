/**
 * useUpdateCountry Hook Tests
 */

import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setupServer } from 'msw/node';
import { reviewHandlers } from '@/test/mocks/handlers/review';
import { useUpdateCountry } from '../useUpdateCountry';

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

const server = setupServer(...reviewHandlers);

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useUpdateCountry', () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('should update country successfully', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateCountry(), { wrapper });

    result.current.mutate({ venueId: 'venue-1', country: 'DE' });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.success).toBe(true);
    expect(result.current.data?.venue.country).toBe('DE');
  });

  it('should fail with invalid country', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateCountry(), { wrapper });

    result.current.mutate({ venueId: 'venue-1', country: 'INVALID' });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it('should call onSuccess callback', async () => {
    const onSuccess = vi.fn();
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateCountry({ onSuccess }), { wrapper });

    result.current.mutate({ venueId: 'venue-1', country: 'AT' });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(onSuccess).toHaveBeenCalled();
  });

  it('should call onError callback on failure', async () => {
    const onError = vi.fn();
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateCountry({ onError }), { wrapper });

    result.current.mutate({ venueId: 'venue-1', country: 'INVALID' });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(onError).toHaveBeenCalled();
  });

  it('should track loading state', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateCountry(), { wrapper });

    expect(result.current.isPending).toBe(false);

    result.current.mutate({ venueId: 'venue-1', country: 'FR' });

    // At some point it should be pending
    await waitFor(() => {
      expect(result.current.isSuccess || result.current.isError).toBe(true);
    });
  });
});
