/**
 * Postal Code Lookup Module
 *
 * Provides fast, local postal code geocoding for Switzerland, Germany, and Austria.
 * This eliminates the need for external API calls to Nominatim for most lookups,
 * significantly improving performance (removes 200-500ms latency).
 *
 * Data is imported statically so Astro can bundle and tree-shake it.
 */

// Import postal code data (tree-shaken by Astro's build)
import postalCodesCH from './postal-codes-ch.json';
import postalCodesDE from './postal-codes-de.json';
import postalCodesAT from './postal-codes-at.json';

/**
 * Postal code lookup result
 */
export interface PostalCodeResult {
  lat: number;
  lng: number;
  city: string;
}

/**
 * Consolidated postal code database
 * Maps country code -> ZIP code -> location data
 */
const postalCodes: Record<string, Record<string, PostalCodeResult>> = {
  ch: postalCodesCH as Record<string, PostalCodeResult>,
  de: postalCodesDE as Record<string, PostalCodeResult>,
  at: postalCodesAT as Record<string, PostalCodeResult>,
};

/**
 * Look up postal code coordinates and city name
 *
 * @param zip - Postal code to look up
 * @param country - Country code ('ch', 'de', 'at')
 * @returns Location data or null if not found
 *
 * @example
 * ```ts
 * const result = lookupPostalCode('8000', 'ch');
 * // => { lat: 47.3769, lng: 8.5417, city: 'Zürich' }
 * ```
 */
export function lookupPostalCode(
  zip: string,
  country: 'ch' | 'de' | 'at'
): PostalCodeResult | null {
  const countryData = postalCodes[country.toLowerCase()];
  if (!countryData) {
    return null;
  }

  const data = countryData[zip];
  if (!data) {
    return null;
  }

  return {
    lat: data.lat,
    lng: data.lng,
    city: data.city,
  };
}

/**
 * Get statistics about the postal code database
 * Useful for debugging and monitoring coverage
 */
export function getPostalCodeStats(): Record<string, { count: number }> {
  return {
    ch: { count: Object.keys(postalCodesCH).length },
    de: { count: Object.keys(postalCodesDE).length },
    at: { count: Object.keys(postalCodesAT).length },
  };
}
