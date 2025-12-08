import type { Price } from '../types/dish.js';

/**
 * Currency configuration with locale and symbol info
 */
export const CURRENCY_CONFIG: Record<
  string,
  { locale: string; symbol: string; decimals: number }
> = {
  CHF: { locale: 'de-CH', symbol: 'CHF', decimals: 2 },
  EUR: { locale: 'de-DE', symbol: '€', decimals: 2 },
  GBP: { locale: 'en-GB', symbol: '£', decimals: 2 },
  USD: { locale: 'en-US', symbol: '$', decimals: 2 },
};

/**
 * Format a price for display
 */
export function formatPrice(price: Price): string {
  const config = CURRENCY_CONFIG[price.currency] || {
    locale: 'en-US',
    symbol: price.currency,
    decimals: 2,
  };

  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: price.currency,
    minimumFractionDigits: config.decimals,
    maximumFractionDigits: config.decimals,
  }).format(price.amount);
}

/**
 * Get default currency for a country
 */
export function getDefaultCurrency(countryCode: string): string {
  const COUNTRY_CURRENCIES: Record<string, string> = {
    CH: 'CHF',
    DE: 'EUR',
    AT: 'EUR',
    FR: 'EUR',
    IT: 'EUR',
    ES: 'EUR',
    NL: 'EUR',
    UK: 'GBP',
    GB: 'GBP',
    US: 'USD',
  };
  return COUNTRY_CURRENCIES[countryCode] || 'EUR';
}

/**
 * Create a Price object
 */
export function createPrice(amount: number, currency: string): Price {
  return { amount, currency };
}

/**
 * Compare two prices (returns true if price1 < price2)
 * Note: This only works for same-currency comparisons
 */
export function isPriceLower(price1: Price, price2: Price): boolean {
  if (price1.currency !== price2.currency) {
    throw new Error('Cannot compare prices in different currencies');
  }
  return price1.amount < price2.amount;
}

/**
 * Calculate discount percentage between original and sale price
 */
export function calculateDiscountPercent(
  originalPrice: Price,
  salePrice: Price
): number {
  if (originalPrice.currency !== salePrice.currency) {
    throw new Error('Cannot calculate discount between different currencies');
  }
  if (originalPrice.amount === 0) return 0;
  return Math.round(
    ((originalPrice.amount - salePrice.amount) / originalPrice.amount) * 100
  );
}
