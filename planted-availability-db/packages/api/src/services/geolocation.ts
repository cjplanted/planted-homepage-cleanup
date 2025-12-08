/**
 * IP Geolocation Service
 *
 * Provides IP-to-location lookup using MaxMind GeoLite2 (free).
 *
 * Setup:
 * 1. Create MaxMind account at maxmind.com
 * 2. Download GeoLite2-City database
 * 3. Place mmdb file in data/ directory or set MAXMIND_DB_PATH
 *
 * Alternative: Use ipinfo.io API (1000 requests/day free)
 */

import { Reader, City } from '@maxmind/geoip2-node';
import * as fs from 'fs';
import * as path from 'path';

export interface GeoLocation {
  city: string | null;
  region: string | null;
  country: string;
  countryCode: string;
  lat: number;
  lng: number;
  timezone: string | null;
  accuracy_radius_km: number;
}

export interface GeolocationConfig {
  maxmindDbPath?: string;
  ipinfoToken?: string;
  fallbackLocation?: {
    lat: number;
    lng: number;
    country: string;
  };
}

const DEFAULT_FALLBACK = {
  lat: 47.3769, // Zurich
  lng: 8.5417,
  country: 'CH',
};

export class GeolocationService {
  private reader: Reader | null = null;
  private ipinfoToken: string | null = null;
  private fallback: { lat: number; lng: number; country: string };
  private initialized = false;

  constructor(config: GeolocationConfig = {}) {
    this.ipinfoToken = config.ipinfoToken || process.env.IPINFO_TOKEN || null;
    this.fallback = config.fallbackLocation || DEFAULT_FALLBACK;

    // Try to load MaxMind database
    const dbPath = config.maxmindDbPath ||
                   process.env.MAXMIND_DB_PATH ||
                   path.join(process.cwd(), 'data', 'GeoLite2-City.mmdb');

    if (fs.existsSync(dbPath)) {
      try {
        this.reader = Reader.openBuffer(fs.readFileSync(dbPath));
        this.initialized = true;
        console.log('MaxMind GeoLite2 database loaded');
      } catch (error) {
        console.warn('Failed to load MaxMind database:', error);
      }
    } else {
      console.warn(`MaxMind database not found at ${dbPath}`);
    }
  }

  /**
   * Get location from IP address
   */
  async lookup(ip: string): Promise<GeoLocation> {
    // Skip private/local IPs
    if (this.isPrivateIP(ip)) {
      return this.getFallbackLocation();
    }

    // Try MaxMind first
    if (this.reader) {
      try {
        const result = this.reader.city(ip);
        return this.formatMaxMindResult(result);
      } catch (error) {
        console.warn(`MaxMind lookup failed for ${ip}:`, error);
      }
    }

    // Fallback to ipinfo.io API
    if (this.ipinfoToken) {
      try {
        return await this.lookupIPInfo(ip);
      } catch (error) {
        console.warn(`IPInfo lookup failed for ${ip}:`, error);
      }
    }

    // Return fallback location
    return this.getFallbackLocation();
  }

  /**
   * Format MaxMind result to our GeoLocation format
   */
  private formatMaxMindResult(result: City): GeoLocation {
    return {
      city: result.city?.names?.en || null,
      region: result.subdivisions?.[0]?.names?.en || null,
      country: result.country?.names?.en || 'Unknown',
      countryCode: result.country?.isoCode || 'XX',
      lat: result.location?.latitude || this.fallback.lat,
      lng: result.location?.longitude || this.fallback.lng,
      timezone: result.location?.timeZone || null,
      accuracy_radius_km: result.location?.accuracyRadius || 50,
    };
  }

  /**
   * Lookup using ipinfo.io API
   */
  private async lookupIPInfo(ip: string): Promise<GeoLocation> {
    const response = await fetch(
      `https://ipinfo.io/${ip}?token=${this.ipinfoToken}`
    );

    if (!response.ok) {
      throw new Error(`IPInfo API error: ${response.status}`);
    }

    const data = await response.json();
    const [lat, lng] = (data.loc || '0,0').split(',').map(Number);

    return {
      city: data.city || null,
      region: data.region || null,
      country: data.country ? this.getCountryName(data.country) : 'Unknown',
      countryCode: data.country || 'XX',
      lat,
      lng,
      timezone: data.timezone || null,
      accuracy_radius_km: 10, // IPInfo is generally accurate to city level
    };
  }

  /**
   * Check if IP is private/local
   */
  private isPrivateIP(ip: string): boolean {
    // IPv4 private ranges
    if (ip.startsWith('10.') ||
        ip.startsWith('172.16.') || ip.startsWith('172.17.') ||
        ip.startsWith('172.18.') || ip.startsWith('172.19.') ||
        ip.startsWith('172.20.') || ip.startsWith('172.21.') ||
        ip.startsWith('172.22.') || ip.startsWith('172.23.') ||
        ip.startsWith('172.24.') || ip.startsWith('172.25.') ||
        ip.startsWith('172.26.') || ip.startsWith('172.27.') ||
        ip.startsWith('172.28.') || ip.startsWith('172.29.') ||
        ip.startsWith('172.30.') || ip.startsWith('172.31.') ||
        ip.startsWith('192.168.') ||
        ip === '127.0.0.1' ||
        ip === '::1' ||
        ip === 'localhost') {
      return true;
    }
    return false;
  }

  /**
   * Get fallback location
   */
  private getFallbackLocation(): GeoLocation {
    return {
      city: null,
      region: null,
      country: this.getCountryName(this.fallback.country),
      countryCode: this.fallback.country,
      lat: this.fallback.lat,
      lng: this.fallback.lng,
      timezone: null,
      accuracy_radius_km: 100,
    };
  }

  /**
   * Convert country code to name
   */
  private getCountryName(code: string): string {
    const countries: Record<string, string> = {
      'CH': 'Switzerland',
      'DE': 'Germany',
      'AT': 'Austria',
      'FR': 'France',
      'IT': 'Italy',
      'ES': 'Spain',
      'NL': 'Netherlands',
      'UK': 'United Kingdom',
      'GB': 'United Kingdom',
      'BE': 'Belgium',
      'US': 'United States',
    };
    return countries[code] || code;
  }

  /**
   * Check if service is properly initialized
   */
  isAvailable(): boolean {
    return this.initialized || !!this.ipinfoToken;
  }
}

// Singleton instance
let geolocationService: GeolocationService | null = null;

/**
 * Get or create geolocation service
 */
export function getGeolocationService(): GeolocationService {
  if (!geolocationService) {
    geolocationService = new GeolocationService();
  }
  return geolocationService;
}

/**
 * Extract client IP from request
 */
export function getClientIP(request: {
  headers: { get(name: string): string | null };
  socket?: { remoteAddress?: string };
}): string {
  // Check X-Forwarded-For header (from proxy/load balancer)
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  // Check X-Real-IP header
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  // Check CF-Connecting-IP (Cloudflare)
  const cfIP = request.headers.get('cf-connecting-ip');
  if (cfIP) {
    return cfIP;
  }

  // Fallback to socket address
  return request.socket?.remoteAddress || '127.0.0.1';
}
