// i18n Configuration for Planted Website
// Supports: Switzerland (de, fr, it), Germany (de), Austria (de), Italy (it), France (fr), Netherlands (nl), UK (en), Spain (es)

export const locales = {
    'ch-de': { country: 'ch', language: 'de', name: 'Schweiz', languageName: 'Deutsch', flag: '🇨🇭' },
    'ch-fr': { country: 'ch', language: 'fr', name: 'Suisse', languageName: 'Français', flag: '🇨🇭' },
    'ch-it': { country: 'ch', language: 'it', name: 'Svizzera', languageName: 'Italiano', flag: '🇨🇭' },
    'de': { country: 'de', language: 'de', name: 'Deutschland', languageName: 'Deutsch', flag: '🇩🇪' },
    'at': { country: 'at', language: 'de', name: 'Österreich', languageName: 'Deutsch', flag: '🇦🇹' },
    'it': { country: 'it', language: 'it', name: 'Italia', languageName: 'Italiano', flag: '🇮🇹' },
    'fr': { country: 'fr', language: 'fr', name: 'France', languageName: 'Français', flag: '🇫🇷' },
    'nl': { country: 'nl', language: 'nl', name: 'Nederland', languageName: 'Nederlands', flag: '🇳🇱' },
    'uk': { country: 'uk', language: 'en', name: 'United Kingdom', languageName: 'English', flag: '🇬🇧' },
    'es': { country: 'es', language: 'es', name: 'España', languageName: 'Español', flag: '🇪🇸' },
} as const;

export type LocaleCode = keyof typeof locales;
export type LanguageCode = 'de' | 'fr' | 'it' | 'en' | 'nl' | 'es';
export type CountryCode = 'ch' | 'de' | 'at' | 'it' | 'fr' | 'nl' | 'uk' | 'es';

export const defaultLocale: LocaleCode = 'ch-de';

// Get all locale codes
export const allLocales = Object.keys(locales) as LocaleCode[];

// Map country codes to their available locale codes
export const countryLocales: Record<CountryCode, LocaleCode[]> = {
    'ch': ['ch-de', 'ch-fr', 'ch-it'],
    'de': ['de'],
    'at': ['at'],
    'it': ['it'],
    'fr': ['fr'],
    'nl': ['nl'],
    'uk': ['uk'],
    'es': ['es'],
};

// Retailers data per country
export const retailers: Record<CountryCode, { name: string; logo: string; url: string; type: 'retail' | 'foodservice' }[]> = {
    'ch': [
        { name: 'Coop', logo: '/images/retailers/coop.svg', url: 'https://www.coop.ch', type: 'retail' },
        { name: 'Migros', logo: '/images/retailers/migros.svg', url: 'https://www.migros.ch', type: 'retail' },
        { name: 'Hiltl', logo: '/images/retailers/hiltl.svg', url: 'https://hiltl.ch', type: 'foodservice' },
        { name: 'NENI', logo: '/images/retailers/neni.svg', url: 'https://www.neni.at', type: 'foodservice' },
    ],
    'de': [
        { name: 'EDEKA', logo: '/images/retailers/edeka.svg', url: 'https://www.edeka.de', type: 'retail' },
        { name: 'REWE', logo: '/images/retailers/rewe.svg', url: 'https://www.rewe.de', type: 'retail' },
    ],
    'at': [
        { name: 'BILLA', logo: '/images/retailers/billa.svg', url: 'https://www.billa.at', type: 'retail' },
        { name: 'BILLA PLUS', logo: '/images/retailers/billa-plus.svg', url: 'https://www.billa.at', type: 'retail' },
        { name: 'Interspar', logo: '/images/retailers/interspar.svg', url: 'https://www.interspar.at', type: 'retail' },
        { name: 'Eurospar', logo: '/images/retailers/eurospar.svg', url: 'https://www.eurospar.at', type: 'retail' },
        { name: 'MPREIS', logo: '/images/retailers/mpreis.svg', url: 'https://www.mpreis.at', type: 'retail' },
    ],
    'it': [
        { name: 'Conad', logo: '/images/retailers/conad.svg', url: 'https://www.conad.it', type: 'retail' },
        { name: 'Esselunga', logo: '/images/retailers/esselunga.svg', url: 'https://www.esselunga.it', type: 'retail' },
        { name: 'Carrefour', logo: '/images/retailers/carrefour.svg', url: 'https://www.carrefour.it', type: 'retail' },
        { name: 'Interspar', logo: '/images/retailers/interspar.svg', url: 'https://www.interspar.it', type: 'retail' },
    ],
    'fr': [
        { name: 'Carrefour', logo: '/images/retailers/carrefour.svg', url: 'https://www.carrefour.fr', type: 'retail' },
        { name: 'Monoprix', logo: '/images/retailers/monoprix.svg', url: 'https://www.monoprix.fr', type: 'retail' },
        { name: 'Casino', logo: '/images/retailers/casino.svg', url: 'https://www.casino.fr', type: 'retail' },
    ],
    'nl': [
        { name: 'Albert Heijn', logo: '/images/retailers/albert-heijn.svg', url: 'https://www.ah.nl', type: 'retail' },
    ],
    'uk': [
        { name: 'Tesco', logo: '/images/retailers/tesco.svg', url: 'https://www.tesco.com', type: 'retail' },
    ],
    'es': [
        { name: 'Carrefour', logo: '/images/retailers/carrefour.svg', url: 'https://www.carrefour.es', type: 'retail' },
    ],
};

// Get locale from URL path
export function getLocaleFromPath(path: string): LocaleCode {
    const segments = path.split('/').filter(Boolean);
    const firstSegment = segments[0];

    if (firstSegment && firstSegment in locales) {
        return firstSegment as LocaleCode;
    }

    return defaultLocale;
}

// Build localized URL
export function localizeUrl(url: string, locale: LocaleCode): string {
    const base = import.meta.env.BASE_URL || '/';
    const cleanUrl = url.replace(base, '').replace(/^\//, '');
    return `${base}${locale}/${cleanUrl}`;
}
