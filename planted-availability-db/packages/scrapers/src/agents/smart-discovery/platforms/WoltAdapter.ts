/**
 * Wolt Platform Adapter
 *
 * Handles data extraction from Wolt.
 * URL format: https://wolt.com/{country}/{city}/restaurant/{restaurant-slug}
 * Countries: DE, AT
 */

import type { SupportedCountry } from '@pad/core';
import {
  BasePlatformAdapter,
  type VenuePageData,
  type MenuItem,
  type PlatformSearchResult,
} from './BasePlatformAdapter.js';

export class WoltAdapter extends BasePlatformAdapter {
  platform = 'wolt' as const;
  supportedCountries: SupportedCountry[] = ['DE', 'AT'];
  baseUrl = 'https://wolt.com';

  private getCountryPath(country: SupportedCountry): string {
    switch (country) {
      case 'DE':
        return 'de';
      case 'AT':
        return 'at';
      default:
        return 'de';
    }
  }

  buildSearchUrl(query: string, country: SupportedCountry, city?: string): string {
    const countryPath = this.getCountryPath(country);
    const encodedQuery = encodeURIComponent(query);
    if (city) {
      return `site:wolt.com/${countryPath} ${encodedQuery} ${city}`;
    }
    return `site:wolt.com/${countryPath} ${encodedQuery}`;
  }

  buildVenueUrl(venueIdOrSlug: string, country: SupportedCountry): string {
    const countryPath = this.getCountryPath(country);
    // Handle full paths
    if (venueIdOrSlug.startsWith('/')) {
      return `${this.baseUrl}${venueIdOrSlug}`;
    }
    // Handle slug with city: "berlin/restaurant-name"
    if (venueIdOrSlug.includes('/')) {
      return `${this.baseUrl}/${countryPath}/${venueIdOrSlug}`;
    }
    // Just restaurant slug - need city context
    return `${this.baseUrl}/${countryPath}/restaurant/${venueIdOrSlug}`;
  }

  extractVenueId(url: string): string | null {
    // Extract from: https://wolt.com/de/deu/berlin/restaurant/restaurant-slug
    // or: https://wolt.com/de/berlin/restaurant/restaurant-slug
    const match = url.match(/wolt\.com\/\w{2}\/(?:\w{3}\/)?([^/]+)\/restaurant\/([^/?]+)/);
    if (match) {
      // Return city/restaurant-slug for unique identification
      return `${match[1]}/${match[2]}`;
    }
    // Simpler pattern
    const simpleMatch = url.match(/wolt\.com\/[^/]+\/[^/]+\/restaurant\/([^/?]+)/);
    return simpleMatch ? simpleMatch[1] : null;
  }

  parseSearchResults(html: string): PlatformSearchResult[] {
    const results: PlatformSearchResult[] = [];

    // Wolt search result patterns
    const patterns = [
      // Restaurant card with link
      /<a[^>]*href="(\/\w{2}\/[^"]*\/restaurant\/[^"]+)"[^>]*>[\\s\\S]*?<h3[^>]*>([^<]+)<\/h3>/gi,
      // Data attribute pattern
      /<a[^>]*data-test-id="VenueCard"[^>]*href="([^"]+)"[^>]*>[\\s\\S]*?([^<]{2,50})<\/(?:h3|span)/gi,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        const urlPath = match[1];
        const url = urlPath.startsWith('http') ? urlPath : `${this.baseUrl}${urlPath}`;
        const name = this.cleanText(match[2]);
        const venueId = this.extractVenueId(url);

        if (venueId && name && !results.some((r) => r.venueId === venueId)) {
          results.push({
            name,
            url,
            venueId,
          });
        }
      }

      if (results.length > 0) break;
    }

    return results;
  }

  parseVenuePage(html: string): VenuePageData {
    const data: VenuePageData = {
      name: '',
      menuItems: [],
      rawHtml: html,
    };

    // Wolt uses React with hydration data
    // Look for __NEXT_DATA__ or window.__PRELOADED_STATE__
    const statePatterns = [
      /<script[^>]*id="__NEXT_DATA__"[^>]*>([\\s\\S]*?)<\/script>/,
      /window\.__PRELOADED_STATE__\s*=\s*({[\\s\\S]+?});?\s*<\/script>/,
      /"venue"\s*:\s*({[\\s\\S]+?})(?=,"\w+":|\s*})/,
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

          // Navigate to venue data
          const venue =
            parsed.props?.pageProps?.venue ||
            parsed.venue ||
            parsed;

          if (venue.name) {
            data.name = venue.name;
          }

          if (venue.address) {
            data.address = {
              street: venue.address.street || venue.address.line1,
              city: venue.address.city,
              postal_code: venue.address.postalCode || venue.address.zip,
              country: this.getCountryFromUrl(html) || 'DE',
            };
          }

          if (venue.location) {
            data.coordinates = {
              lat: venue.location.coordinates?.[1] || venue.location.lat,
              lng: venue.location.coordinates?.[0] || venue.location.lng,
              accuracy: 'exact',
            };
          }

          if (venue.rating) {
            data.rating = venue.rating.score || venue.rating;
            data.reviewCount = venue.rating.count;
          }

          // Extract menu from venue data
          const menu = parsed.props?.pageProps?.menu || venue.menu;
          if (menu?.categories) {
            for (const category of menu.categories) {
              for (const item of category.items || []) {
                data.menuItems.push({
                  name: item.name,
                  description: item.description,
                  price: item.baseprice
                    ? (item.baseprice / 100).toFixed(2)
                    : item.price?.toString(),
                  currency: 'EUR',
                  category: category.name,
                  imageUrl: item.image?.url,
                });
              }
            }
          }

          break;
        } catch {
          // Continue to next pattern
        }
      }
    }

    // HTML fallback for name
    if (!data.name) {
      const namePatterns = [
        /<h1[^>]*data-test-id="venue-name"[^>]*>([^<]+)<\/h1>/i,
        /<h1[^>]*>([^<]+)<\/h1>/i,
        /"name"\s*:\s*"([^"]+)"/,
      ];

      for (const pattern of namePatterns) {
        const match = html.match(pattern);
        if (match) {
          data.name = this.cleanText(match[1]);
          break;
        }
      }
    }

    // Extract menu items from HTML if not found in JSON
    if (data.menuItems.length === 0) {
      data.menuItems = this.extractMenuItemsFromHtml(html);
    }

    return data;
  }

  private extractMenuItemsFromHtml(html: string): MenuItem[] {
    const items: MenuItem[] = [];

    // Wolt menu item patterns
    const patterns = [
      // Product card pattern
      /<div[^>]*data-test-id="MenuItem"[^>]*>[\\s\\S]*?<h3[^>]*>([^<]+)<\/h3>[\\s\\S]*?(?:<p[^>]*>([^<]*)<\/p>)?[\\s\\S]*?(?:€\s*(\d+[.,]\d{2}))?/gi,
      // Alternative pattern
      /<article[^>]*class="[^"]*product[^"]*"[^>]*>[\\s\\S]*?<span[^>]*class="[^"]*name[^"]*"[^>]*>([^<]+)<\/span>[\\s\\S]*?(?:<span[^>]*class="[^"]*description[^"]*"[^>]*>([^<]*)<\/span>)?[\\s\\S]*?(?:(\d+[.,]\d{2})\s*€)?/gi,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        const name = this.cleanText(match[1]);
        const description = match[2] ? this.cleanText(match[2]) : undefined;
        const price = match[3]?.replace(',', '.');

        items.push({
          name,
          description,
          price,
          currency: 'EUR',
        });
      }

      if (items.length > 0) break;
    }

    // Fallback: search for planted mentions
    if (items.length === 0) {
      const plantedPattern = /(?:>|\s)([^<>]{0,50}planted[^<>]{0,50})(?:<|€|\d)/gi;
      let match;
      while ((match = plantedPattern.exec(html)) !== null) {
        const text = this.cleanText(match[1]);
        if (text.length > 5 && text.length < 150) {
          items.push({
            name: text,
            description: 'Contains Planted product',
          });
        }
      }
    }

    return items;
  }
}
