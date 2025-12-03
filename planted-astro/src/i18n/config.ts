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

// Type definitions (must come after locales const)
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

// Product name translations by language (only stores differences from base name)
// Base names (English/German): planted.chicken, planted.pulled, planted.schnitzel, etc.
const productNameTranslations: Record<LanguageCode, Record<string, string>> = {
    'en': {
        'planted.bratwurst': 'planted.sausage',
        'planted.filetwürfel': 'planted.fillet cubes',
    },
    'de': {
        // German uses the base names (no changes needed)
    },
    'fr': {
        'planted.chicken': 'planted.émincé',
        'planted.pulled': 'planted.effiloché',
        'planted.schnitzel': 'planted.escalope',
        'planted.bratwurst': 'planted.saucisse',
        'planted.duck': 'planted.canard',
        'planted.skewers': 'planted.brochettes',
        'planted.filetwürfel': 'planted.filet',
    },
    'it': {
        'planted.chicken': 'planted.bocconcini',
        'planted.pulled': 'planted.straccetti',
        'planted.schnitzel': 'planted.scaloppina',
        'planted.bratwurst': 'planted.salsiccia',
        'planted.duck': 'planted.anatra',
        'planted.skewers': 'planted.spiedini',
        'planted.filetwürfel': 'planted.filetto',
    },
    'nl': {
        'planted.bratwurst': 'planted.braadworst',
        'planted.duck': 'planted.eend',
        'planted.skewers': 'planted.spiesjes',
        'planted.filetwürfel': 'planted.filetblokjes',
    },
    'es': {
        'planted.chicken': 'planted.pollo',
        'planted.pulled': 'planted.deshilachado',
        'planted.schnitzel': 'planted.escalope',
        'planted.bratwurst': 'planted.salchicha',
        'planted.steak': 'planted.filete',
        'planted.duck': 'planted.pato',
        'planted.burger': 'planted.hamburguesa',
        'planted.skewers': 'planted.brochetas',
        'planted.filetwürfel': 'planted.tacos de filete',
    },
};

// Helper function to get localized product name
export function getLocalizedProductName(baseName: string, locale: LocaleCode): string {
    const language = locales[locale].language as LanguageCode;
    const translations = productNameTranslations[language];
    return translations?.[baseName] || baseName;
}

// Retailers data per country with logos and URLs
export const retailers: Record<CountryCode, { name: string; logo: string; url: string; type: 'retail' | 'foodservice' }[]> = {
    'ch': [
        { name: 'Coop', logo: 'coop', url: 'https://www.coop.ch', type: 'retail' },
        { name: 'Migros', logo: 'migros', url: 'https://www.migros.ch', type: 'retail' },
        { name: 'Hiltl', logo: 'hiltl', url: 'https://hiltl.ch', type: 'foodservice' },
        { name: 'NENI', logo: 'neni', url: 'https://www.neni.at', type: 'foodservice' },
    ],
    'de': [
        { name: 'EDEKA', logo: 'edeka', url: 'https://www.edeka.de', type: 'retail' },
        { name: 'REWE', logo: 'rewe', url: 'https://www.rewe.de', type: 'retail' },
    ],
    'at': [
        { name: 'BILLA', logo: 'billa', url: 'https://www.billa.at', type: 'retail' },
        { name: 'BILLA PLUS', logo: 'billa-plus', url: 'https://www.billa.at', type: 'retail' },
        { name: 'Interspar', logo: 'interspar', url: 'https://www.interspar.at', type: 'retail' },
        { name: 'Eurospar', logo: 'eurospar', url: 'https://www.eurospar.at', type: 'retail' },
        { name: 'MPREIS', logo: 'mpreis', url: 'https://www.mpreis.at', type: 'retail' },
    ],
    'it': [
        { name: 'Conad', logo: 'conad', url: 'https://www.conad.it', type: 'retail' },
        { name: 'Esselunga', logo: 'esselunga', url: 'https://www.esselunga.it', type: 'retail' },
        { name: 'Carrefour', logo: 'carrefour', url: 'https://www.carrefour.it', type: 'retail' },
        { name: 'Interspar', logo: 'interspar', url: 'https://www.interspar.it', type: 'retail' },
    ],
    'fr': [
        { name: 'Carrefour', logo: 'carrefour', url: 'https://www.carrefour.fr', type: 'retail' },
        { name: 'Monoprix', logo: 'monoprix', url: 'https://www.monoprix.fr', type: 'retail' },
        { name: 'Casino', logo: 'casino', url: 'https://www.casino.fr', type: 'retail' },
    ],
    'nl': [
        { name: 'Albert Heijn', logo: 'albert-heijn', url: 'https://www.ah.nl', type: 'retail' },
        { name: 'Jumbo', logo: 'jumbo', url: 'https://www.jumbo.com', type: 'retail' },
    ],
    'uk': [
        { name: 'Tesco', logo: 'tesco', url: 'https://www.tesco.com', type: 'retail' },
        { name: 'Sainsbury\'s', logo: 'sainsburys', url: 'https://www.sainsburys.co.uk', type: 'retail' },
    ],
    'es': [
        { name: 'Carrefour', logo: 'carrefour', url: 'https://www.carrefour.es', type: 'retail' },
        { name: 'El Corte Inglés', logo: 'elcorteingles', url: 'https://www.elcorteingles.es', type: 'retail' },
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
