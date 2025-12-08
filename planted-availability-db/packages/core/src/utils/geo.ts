import type { GeoPoint } from '../types/venue.js';

const EARTH_RADIUS_KM = 6371;

/**
 * Calculate the distance between two coordinates using the Haversine formula
 * @returns Distance in kilometers
 */
export function calculateDistance(point1: GeoPoint, point2: GeoPoint): number {
  const lat1Rad = toRadians(point1.latitude);
  const lat2Rad = toRadians(point2.latitude);
  const deltaLat = toRadians(point2.latitude - point1.latitude);
  const deltaLng = toRadians(point2.longitude - point1.longitude);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Check if a point is within a given radius of a center point
 */
export function isWithinRadius(
  center: GeoPoint,
  point: GeoPoint,
  radiusKm: number
): boolean {
  return calculateDistance(center, point) <= radiusKm;
}

/**
 * Calculate bounding box for a given center and radius
 * Useful for efficient geo-queries
 */
export function getBoundingBox(
  center: GeoPoint,
  radiusKm: number
): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
  const latDelta = radiusKm / 111.32; // 1 degree latitude = ~111.32 km
  const lngDelta = radiusKm / (111.32 * Math.cos(toRadians(center.latitude)));

  return {
    minLat: center.latitude - latDelta,
    maxLat: center.latitude + latDelta,
    minLng: center.longitude - lngDelta,
    maxLng: center.longitude + lngDelta,
  };
}

/**
 * Sort an array of items with GeoPoints by distance from a center point
 */
export function sortByDistance<T extends { location: GeoPoint }>(
  items: T[],
  center: GeoPoint
): (T & { distance_km: number })[] {
  return items
    .map((item) => ({
      ...item,
      distance_km: calculateDistance(center, item.location),
    }))
    .sort((a, b) => a.distance_km - b.distance_km);
}

/**
 * Create a GeoPoint from latitude and longitude
 */
export function createGeoPoint(latitude: number, longitude: number): GeoPoint {
  if (latitude < -90 || latitude > 90) {
    throw new Error('Latitude must be between -90 and 90');
  }
  if (longitude < -180 || longitude > 180) {
    throw new Error('Longitude must be between -180 and 180');
  }
  return { latitude, longitude };
}
