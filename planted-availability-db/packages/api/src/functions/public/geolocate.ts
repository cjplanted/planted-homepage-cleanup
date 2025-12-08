/**
 * Geolocation API Endpoint
 *
 * Returns location data based on client IP address.
 * Uses MaxMind GeoLite2 or ipinfo.io fallback.
 */

import type { Request, Response } from 'express';
import { getGeolocationService, getClientIP } from '../../services/geolocation.js';

export interface GeolocateResponse {
  city: string | null;
  region: string | null;
  country: string;
  countryCode: string;
  lat: number;
  lng: number;
  timezone: string | null;
  accuracy_radius_km: number;
}

/**
 * GET /api/v1/geolocate
 *
 * Returns the approximate location of the client based on IP address.
 * Can be used for initial map centering and country-specific content.
 */
export async function geolocateHandler(req: Request, res: Response): Promise<void> {
  try {
    const geoService = getGeolocationService();

    // Get client IP from request
    const clientIP = getClientIP({
      headers: {
        get: (name: string) => req.headers[name.toLowerCase()] as string | null,
      },
      socket: req.socket,
    });

    // Lookup location
    const location = await geoService.lookup(clientIP);

    const response: GeolocateResponse = {
      city: location.city,
      region: location.region,
      country: location.country,
      countryCode: location.countryCode,
      lat: location.lat,
      lng: location.lng,
      timezone: location.timezone,
      accuracy_radius_km: location.accuracy_radius_km,
    };

    // Cache for 1 hour (IP-based location doesn't change frequently)
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    res.status(200).json(response);
  } catch (error) {
    console.error('Geolocation error:', error);

    // Return fallback location (Zurich) on error
    res.status(200).json({
      city: null,
      region: null,
      country: 'Switzerland',
      countryCode: 'CH',
      lat: 47.3769,
      lng: 8.5417,
      timezone: 'Europe/Zurich',
      accuracy_radius_km: 100,
    });
  }
}
