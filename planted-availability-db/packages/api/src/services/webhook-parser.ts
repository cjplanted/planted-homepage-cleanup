/**
 * Webhook & Email Parser Service
 *
 * Parses incoming data from partners, email forwards, and webhooks.
 * Can use Claude API for natural language parsing of unstructured data.
 */

import type { Venue, Dish, Promotion } from '@pad/core';

export interface ParsedVenueData {
  name: string;
  type?: 'retail' | 'restaurant' | 'delivery_kitchen';
  address?: {
    street?: string;
    city?: string;
    postal_code?: string;
    country?: string;
  };
  chain_name?: string;
}

export interface ParsedDishData {
  name: string;
  description?: string;
  price?: {
    amount: number;
    currency: string;
  };
  planted_products?: string[];
  venue_hint?: string; // Venue name or identifier
}

export interface ParsedPromotionData {
  title: string;
  discount?: {
    type: 'percent' | 'fixed';
    value: number;
  };
  valid_from?: string;
  valid_until?: string;
  venue_hint?: string;
  chain_hint?: string;
  products?: string[];
}

export interface WebhookPayload {
  type: 'venue_update' | 'menu_update' | 'promotion' | 'availability';
  partner_id: string;
  data: Record<string, unknown>;
}

export interface EmailPayload {
  from: string;
  subject: string;
  body: string;
  attachments?: Array<{
    filename: string;
    content_type: string;
    data: string; // base64
  }>;
}

export interface ParseResult<T> {
  success: boolean;
  data?: T;
  confidence: number; // 0-1
  warnings?: string[];
  errors?: string[];
}

/**
 * Parse structured webhook payload from partners
 */
export function parseWebhookPayload(payload: WebhookPayload): ParseResult<{
  venues?: ParsedVenueData[];
  dishes?: ParsedDishData[];
  promotions?: ParsedPromotionData[];
}> {
  const result: ParseResult<{
    venues?: ParsedVenueData[];
    dishes?: ParsedDishData[];
    promotions?: ParsedPromotionData[];
  }> = {
    success: true,
    data: {},
    confidence: 1.0,
    warnings: [],
  };

  try {
    switch (payload.type) {
      case 'venue_update':
        result.data!.venues = parseVenueData(payload.data);
        break;

      case 'menu_update':
        result.data!.dishes = parseDishData(payload.data);
        break;

      case 'promotion':
        result.data!.promotions = parsePromotionData(payload.data);
        break;

      case 'availability':
        // Handle availability updates (stock changes, etc.)
        result.warnings?.push('Availability updates not fully implemented');
        break;

      default:
        result.success = false;
        result.errors = [`Unknown payload type: ${payload.type}`];
    }
  } catch (error) {
    result.success = false;
    result.errors = [error instanceof Error ? error.message : 'Unknown error'];
    result.confidence = 0;
  }

  return result;
}

/**
 * Parse venue data from webhook
 */
function parseVenueData(data: Record<string, unknown>): ParsedVenueData[] {
  const venues: ParsedVenueData[] = [];

  // Handle array of venues
  const venueArray = Array.isArray(data.venues)
    ? data.venues
    : data.venue
      ? [data.venue]
      : [data];

  for (const v of venueArray) {
    if (typeof v !== 'object' || v === null) continue;

    const venue = v as Record<string, unknown>;
    const parsed: ParsedVenueData = {
      name: String(venue.name || venue.venue_name || ''),
    };

    if (venue.type) {
      const typeStr = String(venue.type).toLowerCase();
      if (['retail', 'restaurant', 'delivery_kitchen'].includes(typeStr)) {
        parsed.type = typeStr as ParsedVenueData['type'];
      }
    }

    if (venue.address && typeof venue.address === 'object') {
      const addr = venue.address as Record<string, unknown>;
      parsed.address = {
        street: addr.street ? String(addr.street) : undefined,
        city: addr.city ? String(addr.city) : undefined,
        postal_code: addr.postal_code || addr.zip ? String(addr.postal_code || addr.zip) : undefined,
        country: addr.country ? String(addr.country) : undefined,
      };
    }

    if (venue.chain || venue.chain_name) {
      parsed.chain_name = String(venue.chain || venue.chain_name);
    }

    if (parsed.name) {
      venues.push(parsed);
    }
  }

  return venues;
}

/**
 * Parse dish/menu data from webhook
 */
function parseDishData(data: Record<string, unknown>): ParsedDishData[] {
  const dishes: ParsedDishData[] = [];

  // Handle array of dishes
  const dishArray = Array.isArray(data.dishes)
    ? data.dishes
    : Array.isArray(data.menu)
      ? data.menu
      : data.dish
        ? [data.dish]
        : [data];

  for (const d of dishArray) {
    if (typeof d !== 'object' || d === null) continue;

    const dish = d as Record<string, unknown>;
    const parsed: ParsedDishData = {
      name: String(dish.name || dish.dish_name || ''),
    };

    if (dish.description) {
      parsed.description = String(dish.description);
    }

    if (dish.price !== undefined) {
      const priceVal = typeof dish.price === 'object'
        ? dish.price as Record<string, unknown>
        : { amount: dish.price, currency: dish.currency || 'EUR' };

      parsed.price = {
        amount: Number(priceVal.amount) || 0,
        currency: String(priceVal.currency || 'EUR'),
      };
    }

    if (dish.planted_products || dish.products) {
      const products = dish.planted_products || dish.products;
      parsed.planted_products = Array.isArray(products)
        ? products.map(String)
        : [String(products)];
    }

    if (dish.venue || dish.venue_name || dish.restaurant) {
      parsed.venue_hint = String(dish.venue || dish.venue_name || dish.restaurant);
    }

    if (parsed.name) {
      dishes.push(parsed);
    }
  }

  return dishes;
}

/**
 * Parse promotion data from webhook
 */
function parsePromotionData(data: Record<string, unknown>): ParsedPromotionData[] {
  const promotions: ParsedPromotionData[] = [];

  const promoArray = Array.isArray(data.promotions)
    ? data.promotions
    : data.promotion
      ? [data.promotion]
      : [data];

  for (const p of promoArray) {
    if (typeof p !== 'object' || p === null) continue;

    const promo = p as Record<string, unknown>;
    const parsed: ParsedPromotionData = {
      title: String(promo.title || promo.name || ''),
    };

    if (promo.discount !== undefined) {
      if (typeof promo.discount === 'object') {
        const disc = promo.discount as Record<string, unknown>;
        parsed.discount = {
          type: String(disc.type || 'percent') as 'percent' | 'fixed',
          value: Number(disc.value) || 0,
        };
      } else {
        // Assume percentage if just a number
        parsed.discount = {
          type: 'percent',
          value: Number(promo.discount) || 0,
        };
      }
    }

    if (promo.valid_from || promo.start_date) {
      parsed.valid_from = String(promo.valid_from || promo.start_date);
    }

    if (promo.valid_until || promo.end_date) {
      parsed.valid_until = String(promo.valid_until || promo.end_date);
    }

    if (promo.venue || promo.venue_name) {
      parsed.venue_hint = String(promo.venue || promo.venue_name);
    }

    if (promo.chain || promo.chain_name) {
      parsed.chain_hint = String(promo.chain || promo.chain_name);
    }

    if (promo.products) {
      parsed.products = Array.isArray(promo.products)
        ? promo.products.map(String)
        : [String(promo.products)];
    }

    if (parsed.title) {
      promotions.push(parsed);
    }
  }

  return promotions;
}

/**
 * Parse natural language text (email body, etc.)
 * Uses pattern matching for common formats.
 * For complex parsing, integrate with Claude API.
 */
export function parseNaturalLanguage(text: string): ParseResult<{
  venues?: ParsedVenueData[];
  dishes?: ParsedDishData[];
  promotions?: ParsedPromotionData[];
}> {
  const result: ParseResult<{
    venues?: ParsedVenueData[];
    dishes?: ParsedDishData[];
    promotions?: ParsedPromotionData[];
  }> = {
    success: true,
    data: {
      venues: [],
      dishes: [],
      promotions: [],
    },
    confidence: 0.5, // Lower confidence for NL parsing
    warnings: [],
  };

  // Extract potential dish mentions
  const dishPatterns = [
    /planted\s+(chicken|kebab|pulled|steak|schnitzel|bratwurst|burger|nuggets)/gi,
    /([A-Z][a-zA-Z\s]+)\s+(?:with|featuring|using)\s+planted/gi,
  ];

  for (const pattern of dishPatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      result.data!.dishes!.push({
        name: match[0].trim(),
      });
    }
  }

  // Extract price mentions
  const pricePattern = /(?:CHF|EUR|€|£)\s*(\d+[.,]\d{2})/gi;
  const priceMatches = [...text.matchAll(pricePattern)];
  if (priceMatches.length > 0 && result.data!.dishes!.length > 0) {
    const price = parseFloat(priceMatches[0][1].replace(',', '.'));
    result.data!.dishes![0].price = {
      amount: price,
      currency: priceMatches[0][0].includes('CHF') ? 'CHF' :
                priceMatches[0][0].includes('£') ? 'GBP' : 'EUR',
    };
  }

  // Extract date mentions for promotions
  const datePattern = /(?:from|starting|begins?)\s+(\d{1,2}[./]\d{1,2}[./]\d{2,4})/gi;
  const dateMatches = [...text.matchAll(datePattern)];

  // Check for promotion keywords
  const promotionKeywords = ['discount', 'sale', 'promotion', 'special', 'offer', '%off', '% off'];
  const hasPromotion = promotionKeywords.some(kw => text.toLowerCase().includes(kw));

  if (hasPromotion) {
    const discountMatch = text.match(/(\d+)\s*%/);
    result.data!.promotions!.push({
      title: 'Promotion detected',
      discount: discountMatch ? {
        type: 'percent',
        value: parseInt(discountMatch[1]),
      } : undefined,
      valid_from: dateMatches[0]?.[1],
    });
    result.confidence = 0.6;
  }

  // Add warning if parsing was limited
  if (result.data!.dishes!.length === 0 &&
      result.data!.promotions!.length === 0) {
    result.warnings?.push('No structured data extracted. Consider using Claude API for complex parsing.');
    result.confidence = 0.2;
  }

  return result;
}

/**
 * Validate partner authentication
 */
export function validatePartnerAuth(
  partnerId: string,
  partnerSecret: string,
  knownPartners: Map<string, string>
): boolean {
  const expectedSecret = knownPartners.get(partnerId);
  if (!expectedSecret) return false;

  // Constant-time comparison to prevent timing attacks
  if (expectedSecret.length !== partnerSecret.length) return false;

  let result = 0;
  for (let i = 0; i < expectedSecret.length; i++) {
    result |= expectedSecret.charCodeAt(i) ^ partnerSecret.charCodeAt(i);
  }
  return result === 0;
}
