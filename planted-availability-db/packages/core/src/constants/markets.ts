export interface MarketConfig {
  code: string;
  name: string;
  defaultCurrency: string;
  defaultLocale: string;
  timezone: string;
  priority: number; // Lower is higher priority (P0 = 0)
}

export const MARKETS: Record<string, MarketConfig> = {
  CH: {
    code: 'CH',
    name: 'Switzerland',
    defaultCurrency: 'CHF',
    defaultLocale: 'de-CH',
    timezone: 'Europe/Zurich',
    priority: 0,
  },
  DE: {
    code: 'DE',
    name: 'Germany',
    defaultCurrency: 'EUR',
    defaultLocale: 'de-DE',
    timezone: 'Europe/Berlin',
    priority: 0,
  },
  AT: {
    code: 'AT',
    name: 'Austria',
    defaultCurrency: 'EUR',
    defaultLocale: 'de-AT',
    timezone: 'Europe/Vienna',
    priority: 1,
  },
  FR: {
    code: 'FR',
    name: 'France',
    defaultCurrency: 'EUR',
    defaultLocale: 'fr-FR',
    timezone: 'Europe/Paris',
    priority: 1,
  },
  UK: {
    code: 'UK',
    name: 'United Kingdom',
    defaultCurrency: 'GBP',
    defaultLocale: 'en-GB',
    timezone: 'Europe/London',
    priority: 1,
  },
  NL: {
    code: 'NL',
    name: 'Netherlands',
    defaultCurrency: 'EUR',
    defaultLocale: 'nl-NL',
    timezone: 'Europe/Amsterdam',
    priority: 2,
  },
  IT: {
    code: 'IT',
    name: 'Italy',
    defaultCurrency: 'EUR',
    defaultLocale: 'it-IT',
    timezone: 'Europe/Rome',
    priority: 2,
  },
  ES: {
    code: 'ES',
    name: 'Spain',
    defaultCurrency: 'EUR',
    defaultLocale: 'es-ES',
    timezone: 'Europe/Madrid',
    priority: 2,
  },
};

export const SUPPORTED_MARKETS = Object.keys(MARKETS);

export function getMarketConfig(countryCode: string): MarketConfig | undefined {
  return MARKETS[countryCode];
}

export function isMarketSupported(countryCode: string): boolean {
  return countryCode in MARKETS;
}

export function getMarketsByPriority(priority: number): MarketConfig[] {
  return Object.values(MARKETS).filter((m) => m.priority === priority);
}
