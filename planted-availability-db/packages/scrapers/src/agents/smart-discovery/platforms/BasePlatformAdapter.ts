/**
 * Base Platform Adapter
 *
 * Abstract base class for delivery platform adapters.
 * Each adapter knows how to extract data from a specific platform.
 */

import type {
  DeliveryPlatform,
  SupportedCountry,
  DiscoveredDish,
  DiscoveredVenueAddress,
  DiscoveredVenueCoordinates,
} from '@pad/core';

export interface VenuePageData {
  name: string;
  address?: DiscoveredVenueAddress;
  coordinates?: DiscoveredVenueCoordinates;
  rating?: number;
  reviewCount?: number;
  cuisineTypes?: string[];
  priceRange?: string;
  deliveryFee?: string;
  deliveryTime?: string;
  isOpen?: boolean;
  menuItems: MenuItem[];
  rawHtml?: string;
}

export interface MenuItem {
  name: string;
  description?: string;
  price?: string;
  currency?: string;
  category?: string;
  imageUrl?: string;
  isAvailable?: boolean;
}

export interface PlantedMenuItem extends MenuItem {
  plantedProduct: string;
  isVegan: boolean;
  confidence: number;
}

export interface PlatformSearchResult {
  name: string;
  url: string;
  venueId: string;
  city?: string;
  rating?: number;
  cuisineType?: string;
  snippet?: string;
}

/**
 * Abstract base class for platform adapters
 */
export abstract class BasePlatformAdapter {
  abstract platform: DeliveryPlatform;
  abstract supportedCountries: SupportedCountry[];
  abstract baseUrl: string;

  /**
   * Check if this adapter supports a country
   */
  supportsCountry(country: SupportedCountry): boolean {
    return this.supportedCountries.includes(country);
  }

  /**
   * Build search URL for the platform
   */
  abstract buildSearchUrl(query: string, country: SupportedCountry, city?: string): string;

  /**
   * Build venue page URL from venue ID or slug
   */
  abstract buildVenueUrl(venueIdOrSlug: string, country: SupportedCountry): string;

  /**
   * Extract venue ID from a full URL
   */
  abstract extractVenueId(url: string): string | null;

  /**
   * Parse search results page HTML
   */
  abstract parseSearchResults(html: string): PlatformSearchResult[];

  /**
   * Parse venue page HTML to extract data
   */
  abstract parseVenuePage(html: string): VenuePageData;

  /**
   * Find Planted products in menu items
   */
  findPlantedItems(menuItems: MenuItem[]): PlantedMenuItem[] {
    const plantedItems: PlantedMenuItem[] = [];

    const plantedPatterns = [
      { pattern: /planted\.?chicken/i, product: 'planted.chicken' },
      { pattern: /planted\.?kebab/i, product: 'planted.kebab' },
      { pattern: /planted\.?schnitzel/i, product: 'planted.schnitzel' },
      { pattern: /planted\.?pulled/i, product: 'planted.pulled' },
      { pattern: /planted\.?burger/i, product: 'planted.burger' },
      // German variations
      { pattern: /planted\s+h[aä]hnchen/i, product: 'planted.chicken' },
      { pattern: /planted\s+h[uü]hn/i, product: 'planted.chicken' },
      // Generic planted mention (lower confidence)
      { pattern: /\bplanted\b/i, product: 'planted.chicken' },
    ];

    for (const item of menuItems) {
      const textToSearch = `${item.name} ${item.description || ''}`.toLowerCase();

      for (const { pattern, product } of plantedPatterns) {
        if (pattern.test(textToSearch)) {
          // Determine confidence based on pattern specificity
          let confidence = 90;
          if (pattern.source === '\\bplanted\\b') {
            confidence = 60; // Generic mention
          }

          // Check for vegan indicators
          const isVegan = /vegan|pflanzlich|plant.?based/i.test(textToSearch);

          plantedItems.push({
            ...item,
            plantedProduct: product,
            isVegan,
            confidence,
          });
          break; // Only match once per item
        }
      }
    }

    return plantedItems;
  }

  /**
   * Convert menu items to DiscoveredDish format
   */
  toDiscoveredDishes(plantedItems: PlantedMenuItem[]): DiscoveredDish[] {
    return plantedItems.map((item) => ({
      name: item.name,
      description: item.description,
      price: item.price,
      currency: item.currency,
      planted_product: item.plantedProduct,
      is_vegan: item.isVegan,
      confidence: item.confidence,
    }));
  }

  /**
   * Helper to clean text (remove extra whitespace, etc.)
   */
  protected cleanText(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }

  /**
   * Helper to extract price from text
   */
  protected extractPrice(text: string): { price: string; currency: string } | null {
    // Match various price formats
    const patterns = [
      /(?:CHF|Fr\.?)\s*(\d+[.,]\d{2})/i, // CHF 12.90 or Fr. 12.90
      /€\s*(\d+[.,]\d{2})/,              // €12.90
      /(\d+[.,]\d{2})\s*€/,              // 12.90€
      /(\d+[.,]\d{2})\s*(?:CHF|Fr\.?)/i, // 12.90 CHF
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const price = match[1].replace(',', '.');
        const currency = text.includes('€') ? 'EUR' : 'CHF';
        return { price, currency };
      }
    }

    return null;
  }

  /**
   * Helper to determine country from URL
   */
  protected getCountryFromUrl(url: string): SupportedCountry | null {
    if (url.includes('/ch/') || url.includes('.ch/')) return 'CH';
    if (url.includes('/de/') || url.includes('.de/')) return 'DE';
    if (url.includes('/at/') || url.includes('.at/')) return 'AT';
    return null;
  }
}
