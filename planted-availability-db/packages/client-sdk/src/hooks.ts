import { useState, useEffect, useCallback, useRef } from 'react';
import { PADClient, NearbyQuery, DeliveryQuery, VenueQuery, DishQuery, PADClientConfig } from './client';
import type { VenueWithDistance, Venue, DishWithVenue } from '@pad/core';

// Singleton client instance
let clientInstance: PADClient | null = null;

export function initPADClient(config: PADClientConfig): PADClient {
  clientInstance = new PADClient(config);
  return clientInstance;
}

export function getPADClient(): PADClient {
  if (!clientInstance) {
    throw new Error('PAD client not initialized. Call initPADClient first.');
  }
  return clientInstance;
}

interface QueryState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook to find nearby venues
 */
export function useNearbyVenues(query: NearbyQuery | null) {
  const [state, setState] = useState<QueryState<VenueWithDistance[]>>({
    data: null,
    loading: false,
    error: null,
  });

  const queryRef = useRef(query);
  queryRef.current = query;

  const refetch = useCallback(async () => {
    const currentQuery = queryRef.current;
    if (!currentQuery) return;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const client = getPADClient();
      const venues = await client.findNearby(currentQuery);
      setState({ data: venues, loading: false, error: null });
    } catch (error) {
      setState({
        data: null,
        loading: false,
        error: error instanceof Error ? error : new Error('Unknown error'),
      });
    }
  }, []);

  useEffect(() => {
    if (query) {
      refetch();
    }
  }, [query?.latitude, query?.longitude, query?.radiusKm, query?.type, query?.limit, refetch]);

  return { ...state, refetch };
}

/**
 * Hook to check delivery availability
 */
export function useDeliveryCheck(query: DeliveryQuery | null) {
  const [state, setState] = useState<QueryState<{
    available: boolean;
    options: Array<{
      venue: Pick<Venue, 'id' | 'name' | 'type' | 'address'>;
      dishes: Array<{ id: string; name: string; price?: { amount: number; currency: string }; image_url?: string }>;
      partners: Array<{ partner: string; url: string }>;
    }>;
  }>>({
    data: null,
    loading: false,
    error: null,
  });

  const queryRef = useRef(query);
  queryRef.current = query;

  const refetch = useCallback(async () => {
    const currentQuery = queryRef.current;
    if (!currentQuery) return;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const client = getPADClient();
      const result = await client.checkDelivery(currentQuery);
      setState({ data: result, loading: false, error: null });
    } catch (error) {
      setState({
        data: null,
        loading: false,
        error: error instanceof Error ? error : new Error('Unknown error'),
      });
    }
  }, []);

  useEffect(() => {
    if (query && (query.postalCode || query.address)) {
      refetch();
    }
  }, [query?.postalCode, query?.address, query?.country, query?.limit, refetch]);

  return { ...state, refetch };
}

/**
 * Hook to get venues
 */
export function useVenues(query?: VenueQuery) {
  const [state, setState] = useState<QueryState<{ venues: Venue[]; total: number }>>({
    data: null,
    loading: false,
    error: null,
  });

  const queryRef = useRef(query);
  queryRef.current = query;

  const refetch = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const client = getPADClient();
      const result = await client.getVenues(queryRef.current);
      setState({ data: result, loading: false, error: null });
    } catch (error) {
      setState({
        data: null,
        loading: false,
        error: error instanceof Error ? error : new Error('Unknown error'),
      });
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [query?.country, query?.city, query?.type, query?.limit, query?.offset, refetch]);

  return { ...state, refetch };
}

/**
 * Hook to get a single venue
 */
export function useVenue(id: string | null) {
  const [state, setState] = useState<QueryState<Venue>>({
    data: null,
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!id) return;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    getPADClient()
      .getVenue(id)
      .then((venue) => {
        setState({ data: venue, loading: false, error: null });
      })
      .catch((error) => {
        setState({
          data: null,
          loading: false,
          error: error instanceof Error ? error : new Error('Unknown error'),
        });
      });
  }, [id]);

  return state;
}

/**
 * Hook to get dishes
 */
export function useDishes(query?: DishQuery) {
  const [state, setState] = useState<QueryState<{ dishes: DishWithVenue[]; total: number }>>({
    data: null,
    loading: false,
    error: null,
  });

  const queryRef = useRef(query);
  queryRef.current = query;

  const refetch = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const client = getPADClient();
      const result = await client.getDishes(queryRef.current);
      setState({ data: result, loading: false, error: null });
    } catch (error) {
      setState({
        data: null,
        loading: false,
        error: error instanceof Error ? error : new Error('Unknown error'),
      });
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [query?.venueId, query?.productSku, query?.limit, refetch]);

  return { ...state, refetch };
}

/**
 * Hook to get user's current location
 */
export function useGeolocation() {
  const [state, setState] = useState<{
    latitude: number | null;
    longitude: number | null;
    loading: boolean;
    error: string | null;
  }>({
    latitude: null,
    longitude: null,
    loading: false,
    error: null,
  });

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setState({
        latitude: null,
        longitude: null,
        loading: false,
        error: 'Geolocation is not supported by your browser',
      });
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          loading: false,
          error: null,
        });
      },
      (error) => {
        setState({
          latitude: null,
          longitude: null,
          loading: false,
          error: error.message,
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  }, []);

  return { ...state, requestLocation };
}
