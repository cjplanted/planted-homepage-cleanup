/**
 * Smood Platform Adapter
 *
 * Handles data extraction from Smood (Switzerland).
 * URL format: https://www.smood.ch/en/delivery/{city}/{restaurant-slug}
 */

import type { SupportedCountry } from '@pad/core';
import {
  BasePlatformAdapter,
  type VenuePageData,
  type MenuItem,
  type PlatformSearchResult,
} from './BasePlatformAdapter.js';

export class SmoodAdapter extends BasePlatformAdapter {
  platform = 'smood' as const;
  supportedCountries: SupportedCountry[] = ['CH'];
  baseUrl = 'https://www.smood.ch';

  buildSearchUrl(query: string, _country: SupportedCountry, city?: string): string {
    const encodedQuery = encodeURIComponent(query);
    if (city) {
      return `site:smood.ch ${encodedQuery} ${city}`;
    }
    return `site:smood.ch ${encodedQuery}`;
  }

  buildVenueUrl(venueIdOrSlug: string, _country: SupportedCountry): string {
    // Handle full paths
    if (venueIdOrSlug.startsWith('/')) {
      return `${this.baseUrl}${venueIdOrSlug}`;
    }
    // Handle slug with city: "zurich/restaurant-name"
    if (venueIdOrSlug.includes('/')) {
      return `${this.baseUrl}/en/delivery/${venueIdOrSlug}`;
    }
    // Just restaurant slug - use generic path
    return `${this.baseUrl}/en/delivery/restaurant/${venueIdOrSlug}`;
  }

  extractVenueId(url: string): string | null {
    // Extract from: https://www.smood.ch/en/delivery/zurich/restaurant-slug
    // or: https://www.smood.ch/fr/livraison/zurich/restaurant-slug
    const match = url.match(/smood\.ch\/(?:en|fr|de)\/(?:delivery|livraison|lieferung)\/([^/]+)\/([^/?]+)/);
    if (match) {
      // Return city/restaurant-slug for unique identification
      return `${match[1]}/${match[2]}`;
    }
    // Simpler pattern for just slug
    const simpleMatch = url.match(/smood\.ch\/[^/]+\/[^/]+\/[^/]+\/([^/?]+)/);
    return simpleMatch ? simpleMatch[1] : null;
  }

  parseSearchResults(html: string): PlatformSearchResult[] {
    const results: PlatformSearchResult[] = [];

    // Smood search result patterns
    const patterns = [
      // Restaurant card with link
      /<a[^>]*href="(\/(?:en|fr|de)\/(?:delivery|livraison|lieferung)\/[^"]+)"[^>]*>[\\s\\S]*?<h[23][^>]*>([^<]+)<\/h[23]>/gi,
      // Card with name in span
      /<a[^>]*class="[^"]*restaurant-card[^"]*"[^>]*href="([^"]+)"[^>]*>[\\s\\S]*?<span[^>]*class="[^"]*name[^"]*"[^>]*>([^<]+)/gi,
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

    // Smood embeds data in __NEXT_DATA__ or similar
    const statePatterns = [
      /<script[^>]*id="__NEXT_DATA__"[^>]*>([\\s\\S]*?)<\/script>/,
      /window\.__INITIAL_STATE__\s*=\s*({[\\s\\S]+?});?\s*<\/script>/,
      /"restaurant"\s*:\s*({[\\s\\S]+?})(?=,"\w+":|\s*})/,
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

          // Navigate to restaurant data
          const restaurant =
            parsed.props?.pageProps?.restaurant ||
            parsed.restaurant ||
            parsed;

          if (restaurant.name) {
            data.name = restaurant.name;
          }

          if (restaurant.address) {
            data.address = {
              street: restaurant.address.street || restaurant.address.line,
              city: restaurant.address.city,
              postal_code: restaurant.address.postalCode || restaurant.address.zip,
              country: 'CH',
            };
          }

          if (restaurant.coordinates || restaurant.location) {
            const coords = restaurant.coordinates || restaurant.location;
            data.coordinates = {
              lat: coords.lat || coords.latitude,
              lng: coords.lng || coords.longitude,
              accuracy: 'exact',
            };
          }

          if (restaurant.rating) {
            data.rating = typeof restaurant.rating === 'number'
              ? restaurant.rating
              : restaurant.rating.average;
            data.reviewCount = restaurant.rating.count || restaurant.reviewCount;
          }

          // Extract menu from restaurant data
          const menu = parsed.props?.pageProps?.menu || restaurant.menu;
          if (menu?.categories || menu?.sections) {
            const categories = menu.categories || menu.sections;
            for (const category of categories) {
              const items = category.items || category.products || [];
              for (const item of items) {
                data.menuItems.push({
                  name: item.name || item.title,
                  description: item.description,
                  price: item.price
                    ? typeof item.price === 'number'
                      ? (item.price / 100).toFixed(2)
                      : item.price.toString()
                    : undefined,
                  currency: 'CHF',
                  category: category.name || category.title,
                  imageUrl: item.image?.url || item.imageUrl,
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
        /<h1[^>]*class="[^"]*restaurant-name[^"]*"[^>]*>([^<]+)<\/h1>/i,
        /<h1[^>]*>([^<]+)<\/h1>/i,
        /"name"\s*:\s*"([^"]+)"/,
        /<title>([^<|]+)/i, // Extract from title before pipe
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

    // Smood menu item patterns
    const patterns = [
      // Product card pattern
      /<div[^>]*class="[^"]*product-card[^"]*"[^>]*>[\\s\\S]*?<h[34][^>]*>([^<]+)<\/h[34]>[\\s\\S]*?(?:<p[^>]*class="[^"]*description[^"]*"[^>]*>([^<]*)<\/p>)?[\\s\\S]*?(?:CHF\s*(\d+[.,]\d{2}))?/gi,
      // Menu item with name and price
      /<div[^>]*class="[^"]*menu-item[^"]*"[^>]*>[\\s\\S]*?<span[^>]*class="[^"]*name[^"]*"[^>]*>([^<]+)<\/span>[\\s\\S]*?(?:<span[^>]*class="[^"]*description[^"]*"[^>]*>([^<]*)<\/span>)?[\\s\\S]*?(?:(\d+[.,]\d{2})\s*(?:CHF|Fr\.?))?/gi,
      // Article pattern
      /<article[^>]*class="[^"]*item[^"]*"[^>]*>[\\s\\S]*?<h3[^>]*>([^<]+)<\/h3>[\\s\\S]*?(?:<p[^>]*>([^<]*)<\/p>)?[\\s\\S]*?(?:(\d+[.,]\d{2}))/gi,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        const name = this.cleanText(match[1]);
        const description = match[2] ? this.cleanText(match[2]) : undefined;
        const price = match[3]?.replace(',', '.');

        if (name && name.length > 2) {
          items.push({
            name,
            description,
            price,
            currency: 'CHF',
          });
        }
      }

      if (items.length > 0) break;
    }

    // Fallback: search for planted mentions in raw text
    if (items.length === 0) {
      const plantedPattern = /(?:>|\s)([^<>]{0,50}planted[^<>]{0,50})(?:<|CHF|Fr\.|\d)/gi;
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
