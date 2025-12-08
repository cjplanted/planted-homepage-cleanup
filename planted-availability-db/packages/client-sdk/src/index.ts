// Client
export { PADClient, PADError } from './client';
export type {
  PADClientConfig,
  NearbyQuery,
  DeliveryQuery,
  VenueQuery,
  DishQuery,
} from './client';

// React hooks
export {
  initPADClient,
  getPADClient,
  useNearbyVenues,
  useDeliveryCheck,
  useVenues,
  useVenue,
  useDishes,
  useGeolocation,
} from './hooks';

// Re-export types from core
export type {
  Venue,
  VenueType,
  VenueWithDistance,
  Dish,
  DishWithVenue,
  Address,
  GeoPoint,
  OpeningHours,
  Price,
} from '@pad/core';
