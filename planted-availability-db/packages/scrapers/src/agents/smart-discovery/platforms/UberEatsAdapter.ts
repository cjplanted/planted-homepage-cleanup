/**
 * Uber Eats Platform Adapter
 *
 * Handles data extraction from Uber Eats.
 * URL formats:
 * - CH: https://www.ubereats.com/ch/store/{restaurant-slug}/{store-id}
 * - DE: https://www.ubereats.com/de/store/{restaurant-slug}/{store-id}
 * - AT: https://www.ubereats.com/at/store/{restaurant-slug}/{store-id}
 */

import type { SupportedCountry } from '@pad/core';
import {
  BasePlatformAdapter,
  type VenuePageData,
  type MenuItem,
  type PlatformSearchResult,
} from './BasePlatformAdapter.js';

export class UberEatsAdapter extends BasePlatformAdapter {
  platform = 'uber-eats' as const;
  supportedCountries: SupportedCountry[] = ['CH', 'DE', 'AT'];
  baseUrl = 'https://www.ubereats.com';

  private getCountryPath(country: SupportedCountry): string {
    return country.toLowerCase();
  }

  buildSearchUrl(query: string, country: SupportedCountry, city?: string): string {
    const countryPath = this.getCountryPath(country);
    const encodedQuery = encodeURIComponent(query);
    if (city) {
      return `site:ubereats.com/${countryPath} ${encodedQuery} ${city}`;
    }
    return `site:ubereats.com/${countryPath} ${encodedQuery}`;
  }

  buildVenueUrl(venueIdOrSlug: string, country: SupportedCountry): string {
    const countryPath = this.getCountryPath(country);
    // Handle both full paths and just IDs
    if (venueIdOrSlug.startsWith('/')) {
      return `${this.baseUrl}${venueIdOrSlug}`;
    }
    return `${this.baseUrl}/${countryPath}/store/${venueIdOrSlug}`;
  }

  extractVenueId(url: string): string | null {
    // Extract from: https://www.ubereats.com/ch/store/restaurant-name/abc123
    const match = url.match(/ubereats\.com\/\w{2}\/store\/([^/?]+)/);
    return match ? match[1] : null;
  }

  parseSearchResults(html: string): PlatformSearchResult[] {
    const results: PlatformSearchResult[] = [];

    // Uber Eats store links pattern
    const storePattern = /<a[^>]*href="(\/\w{2}\/store\/[^"]+)"[^>]*>[\s\S]*?(?:<h3[^>]*>|<span[^>]*class="[^"]*store-name[^"]*"[^>]*>)([^<]+)/gi;

    let match;
    while ((match = storePattern.exec(html)) !== null) {
      const url = `${this.baseUrl}${match[1]}`;
      const name = this.cleanText(match[2]);
      const venueId = this.extractVenueId(url);

      if (venueId) {
        results.push({
          name,
          url,
          venueId,
        });
      }
    }

    return results;
  }

  parseVenuePage(html: string): VenuePageData {
    const data: VenuePageData = {
      name: '',
      menuItems: [],
      rawHtml: html,
    };

    // Uber Eats heavily uses JavaScript/React, so we look for embedded JSON data
    // Try to find the __REDUX_STATE__ or similar data blob
    const statePatterns = [
      /window\.__REDUX_STATE__\s*=\s*({[\s\S]+?});?\s*<\/script>/,
      /"storeInfo"\s*:\s*({[^}]+})/,
      /"store"\s*:\s*({[\s\S]+?})(?=,"|}\s*})/,
    ];

    for (const pattern of statePatterns) {
      const match = html.match(pattern);
      if (match) {
        try {
          const jsonStr = match[1]
            .replace(/undefined/g, 'null')
            .replace(/\\x([0-9A-Fa-f]{2})/g, (_, hex) =>
              String.fromCharCode(parseInt(hex, 16))
            );
          const parsed = JSON.parse(jsonStr);

          // Extract store info
          const storeInfo = parsed.storeInfo || parsed.store || parsed;
          if (storeInfo.title || storeInfo.name) {
            data.name = storeInfo.title || storeInfo.name;
          }

          if (storeInfo.location) {
            data.address = {
              street: storeInfo.location.address,
              city: storeInfo.location.city,
              postal_code: storeInfo.location.postalCode,
              country: this.getCountryFromUrl(html) || 'CH',
            };

            if (storeInfo.location.latitude && storeInfo.location.longitude) {
              data.coordinates = {
                latitude: storeInfo.location.latitude,
                longitude: storeInfo.location.longitude,
                accuracy: 'exact',
              };
            }
          }

          if (storeInfo.rating) {
            data.rating = storeInfo.rating.ratingValue;
            data.reviewCount = storeInfo.rating.reviewCount;
          }

          break;
        } catch {
          // Continue to next pattern
        }
      }
    }

    // Extract name from HTML if not found in JSON
    if (!data.name) {
      const namePatterns = [
        /<h1[^>]*>([^<]+)<\/h1>/i,
        /"name"\s*:\s*"([^"]+)"/,
        /data-testid="store-title"[^>]*>([^<]+)</i,
      ];

      for (const pattern of namePatterns) {
        const match = html.match(pattern);
        if (match) {
          data.name = this.cleanText(match[1]);
          break;
        }
      }
    }

    // Extract menu items
    data.menuItems = this.extractMenuItems(html);

    return data;
  }

  private extractMenuItems(html: string): MenuItem[] {
    const items: MenuItem[] = [];

    // Try to extract from embedded JSON menu data
    const menuPatterns = [
      /"menuItems"\s*:\s*\[([\s\S]+?)\]/,
      /"sections"\s*:\s*\[([\s\S]+?)\]/,
    ];

    for (const pattern of menuPatterns) {
      const match = html.match(pattern);
      if (match) {
        try {
          const itemsArray = JSON.parse(`[${match[1]}]`);
          for (const item of itemsArray) {
            if (item.title || item.name) {
              items.push({
                name: item.title || item.name,
                description: item.description || item.itemDescription,
                price: item.price?.toString() || item.priceString,
                currency: 'CHF', // Will be overwritten based on country
                category: item.category || item.sectionTitle,
              });
            }
          }
        } catch {
          // Continue
        }
      }
    }

    // HTML fallback - look for menu item elements
    if (items.length === 0) {
      const itemPattern = /data-testid="menu-item"[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>[\s\S]*?(?:<span[^>]*class="[^"]*description[^"]*"[^>]*>([^<]*)<\/span>)?[\s\S]*?(?:CHF|€)\s*(\d+[.,]\d{2})/gi;

      let match;
      while ((match = itemPattern.exec(html)) !== null) {
        items.push({
          name: this.cleanText(match[1]),
          description: match[2] ? this.cleanText(match[2]) : undefined,
          price: match[3]?.replace(',', '.'),
          currency: html.includes('€') ? 'EUR' : 'CHF',
        });
      }
    }

    // Search for planted mentions in raw text as fallback
    if (items.length === 0) {
      const plantedPattern = /(?:<[^>]+>)?([^<]*planted[^<]*)(?:<[^>]+>)?/gi;
      let match;
      while ((match = plantedPattern.exec(html)) !== null) {
        const text = this.cleanText(match[1]);
        if (text.length > 5 && text.length < 200) {
          items.push({
            name: text,
            description: 'Planted product detected',
          });
        }
      }
    }

    return items;
  }
}
