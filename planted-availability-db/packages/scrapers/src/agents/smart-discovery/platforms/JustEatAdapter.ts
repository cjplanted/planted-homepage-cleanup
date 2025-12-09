/**
 * Just Eat (eat.ch) Platform Adapter
 *
 * Handles data extraction from Just Eat Switzerland.
 * URL format: https://www.just-eat.ch/en/menu/{restaurant-slug}
 */

import type { SupportedCountry } from '@pad/core';
import {
  BasePlatformAdapter,
  type VenuePageData,
  type MenuItem,
  type PlatformSearchResult,
} from './BasePlatformAdapter.js';

export class JustEatAdapter extends BasePlatformAdapter {
  platform = 'just-eat' as const;
  supportedCountries: SupportedCountry[] = ['CH'];
  baseUrl = 'https://www.just-eat.ch';

  buildSearchUrl(query: string, _country: SupportedCountry, city?: string): string {
    // Just Eat doesn't have a public search API, use site: search
    const encodedQuery = encodeURIComponent(query);
    if (city) {
      return `site:just-eat.ch ${encodedQuery} ${city}`;
    }
    return `site:just-eat.ch ${encodedQuery}`;
  }

  buildVenueUrl(venueIdOrSlug: string, _country: SupportedCountry): string {
    // Handle both full slugs and simple IDs
    const slug = venueIdOrSlug.startsWith('/')
      ? venueIdOrSlug
      : `/en/menu/${venueIdOrSlug}`;
    return `${this.baseUrl}${slug}`;
  }

  extractVenueId(url: string): string | null {
    // Extract from: https://www.just-eat.ch/en/menu/restaurant-slug
    const match = url.match(/just-eat\.ch\/(?:en\/)?menu\/([^/?]+)/);
    return match ? match[1] : null;
  }

  parseSearchResults(html: string): PlatformSearchResult[] {
    const results: PlatformSearchResult[] = [];

    // Just Eat search results typically contain restaurant cards
    // Pattern for restaurant links in search results
    const restaurantPattern = /<a[^>]*href="(\/(?:en\/)?menu\/[^"]+)"[^>]*>[\s\S]*?<h2[^>]*>([^<]+)<\/h2>/gi;

    let match;
    while ((match = restaurantPattern.exec(html)) !== null) {
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

    // Extract restaurant name
    // Just Eat uses various patterns for restaurant name
    const namePatterns = [
      /<h1[^>]*class="[^"]*restaurant-name[^"]*"[^>]*>([^<]+)<\/h1>/i,
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

    // Extract address
    const addressMatch = html.match(/"address"\s*:\s*\{([^}]+)\}/);
    if (addressMatch) {
      try {
        const addressJson = `{${addressMatch[1]}}`;
        const parsed = JSON.parse(addressJson);
        data.address = {
          street: parsed.streetAddress,
          city: parsed.addressLocality,
          postal_code: parsed.postalCode,
          country: 'CH',
        };
      } catch {
        // Try simpler extraction
        const streetMatch = html.match(/"streetAddress"\s*:\s*"([^"]+)"/);
        const cityMatch = html.match(/"addressLocality"\s*:\s*"([^"]+)"/);
        if (streetMatch || cityMatch) {
          data.address = {
            street: streetMatch?.[1],
            city: cityMatch?.[1] || 'Unknown',
            country: 'CH',
          };
        }
      }
    }

    // Extract coordinates
    const latMatch = html.match(/"latitude"\s*:\s*"?(-?\d+\.?\d*)"/);
    const lngMatch = html.match(/"longitude"\s*:\s*"?(-?\d+\.?\d*)"/);
    if (latMatch && lngMatch) {
      data.coordinates = {
        lat: parseFloat(latMatch[1]),
        lng: parseFloat(lngMatch[1]),
        accuracy: 'exact',
      };
    }

    // Extract rating
    const ratingMatch = html.match(/"ratingValue"\s*:\s*"?(\d+\.?\d*)"/);
    if (ratingMatch) {
      data.rating = parseFloat(ratingMatch[1]);
    }

    const reviewCountMatch = html.match(/"ratingCount"\s*:\s*"?(\d+)"/);
    if (reviewCountMatch) {
      data.reviewCount = parseInt(reviewCountMatch[1], 10);
    }

    // Extract menu items
    data.menuItems = this.extractMenuItems(html);

    return data;
  }

  private extractMenuItems(html: string): MenuItem[] {
    const items: MenuItem[] = [];

    // Try to extract from JSON-LD first
    const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
    if (jsonLdMatch) {
      for (const match of jsonLdMatch) {
        try {
          const jsonContent = match.replace(/<script[^>]*>|<\/script>/gi, '');
          const data = JSON.parse(jsonContent);

          if (data['@type'] === 'Menu' && data.hasMenuSection) {
            for (const section of data.hasMenuSection) {
              const category = section.name;
              if (section.hasMenuItem) {
                for (const item of section.hasMenuItem) {
                  items.push({
                    name: item.name,
                    description: item.description,
                    price: item.offers?.price?.toString(),
                    currency: item.offers?.priceCurrency || 'CHF',
                    category,
                  });
                }
              }
            }
          }
        } catch {
          // JSON parsing failed, continue to HTML extraction
        }
      }
    }

    // If no JSON-LD, try HTML extraction
    if (items.length === 0) {
      // Just Eat menu item patterns
      const menuItemPattern = /<div[^>]*class="[^"]*menu-item[^"]*"[^>]*>[\s\S]*?<h3[^>]*>([^<]+)<\/h3>[\s\S]*?(?:<p[^>]*class="[^"]*description[^"]*"[^>]*>([^<]*)<\/p>)?[\s\S]*?(?:<span[^>]*class="[^"]*price[^"]*"[^>]*>([^<]+)<\/span>)?/gi;

      let match;
      while ((match = menuItemPattern.exec(html)) !== null) {
        const name = this.cleanText(match[1]);
        const description = match[2] ? this.cleanText(match[2]) : undefined;
        const priceText = match[3] ? this.cleanText(match[3]) : undefined;

        const priceInfo = priceText ? this.extractPrice(priceText) : null;

        items.push({
          name,
          description,
          price: priceInfo?.price,
          currency: priceInfo?.currency || 'CHF',
        });
      }
    }

    // Also search for planted-specific items in the raw HTML
    if (items.length === 0) {
      // Fallback: look for any text containing "planted"
      const plantedMentions = html.match(/[^<>]{0,100}planted[^<>]{0,100}/gi);
      if (plantedMentions) {
        for (const mention of plantedMentions) {
          // Try to extract a dish name from context
          const cleanedMention = this.cleanText(mention);
          if (cleanedMention.length > 10 && cleanedMention.length < 200) {
            items.push({
              name: cleanedMention,
              description: 'Contains Planted product',
            });
          }
        }
      }
    }

    return items;
  }
}
