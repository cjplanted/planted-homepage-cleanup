// i18n Configuration for Planted Website
// Supports: Global, Switzerland (de, fr, it, en), Germany (de, en), Austria (de, en),
// Italy (it, en), France (fr, en), Netherlands (nl, en), UK (en), Spain (es, en)

export const locales = {
    // Global / International (fallback for all)
    'global': { country: 'global', language: 'en', name: 'International', languageName: 'English', flag: '🌍' },

    // Switzerland - 4 languages
    'ch-de': { country: 'ch', language: 'de', name: 'Schweiz', languageName: 'Deutsch', flag: '🇨🇭' },
    'ch-fr': { country: 'ch', language: 'fr', name: 'Suisse', languageName: 'Français', flag: '🇨🇭' },
    'ch-it': { country: 'ch', language: 'it', name: 'Svizzera', languageName: 'Italiano', flag: '🇨🇭' },
    'ch-en': { country: 'ch', language: 'en', name: 'Switzerland', languageName: 'English', flag: '🇨🇭' },

    // Germany - 2 languages
    'de': { country: 'de', language: 'de', name: 'Deutschland', languageName: 'Deutsch', flag: '🇩🇪' },
    'de-en': { country: 'de', language: 'en', name: 'Germany', languageName: 'English', flag: '🇩🇪' },

    // Austria - 2 languages
    'at': { country: 'at', language: 'de', name: 'Österreich', languageName: 'Deutsch', flag: '🇦🇹' },
    'at-en': { country: 'at', language: 'en', name: 'Austria', languageName: 'English', flag: '🇦🇹' },

    // Italy - 2 languages
    'it': { country: 'it', language: 'it', name: 'Italia', languageName: 'Italiano', flag: '🇮🇹' },
    'it-en': { country: 'it', language: 'en', name: 'Italy', languageName: 'English', flag: '🇮🇹' },

    // France - 2 languages
    'fr': { country: 'fr', language: 'fr', name: 'France', languageName: 'Français', flag: '🇫🇷' },
    'fr-en': { country: 'fr', language: 'en', name: 'France', languageName: 'English', flag: '🇫🇷' },

    // Netherlands - 2 languages
    'nl': { country: 'nl', language: 'nl', name: 'Nederland', languageName: 'Nederlands', flag: '🇳🇱' },
    'nl-en': { country: 'nl', language: 'en', name: 'Netherlands', languageName: 'English', flag: '🇳🇱' },

    // United Kingdom - English only
    'uk': { country: 'uk', language: 'en', name: 'United Kingdom', languageName: 'English', flag: '🇬🇧' },

    // Spain - 2 languages
    'es': { country: 'es', language: 'es', name: 'España', languageName: 'Español', flag: '🇪🇸' },
    'es-en': { country: 'es', language: 'en', name: 'Spain', languageName: 'English', flag: '🇪🇸' },
} as const;

// Type definitions (must come after locales const)
export type LocaleCode = keyof typeof locales;
export type LanguageCode = 'de' | 'fr' | 'it' | 'en' | 'nl' | 'es';
export type CountryCode = 'global' | 'ch' | 'de' | 'at' | 'it' | 'fr' | 'nl' | 'uk' | 'es';

export const defaultLocale: LocaleCode = 'ch-de';

// Get all locale codes
export const allLocales = Object.keys(locales) as LocaleCode[];

// Map country codes to their available locale codes (ordered by preference)
export const countryLocales: Record<CountryCode, LocaleCode[]> = {
    'global': ['global'],
    'ch': ['ch-de', 'ch-fr', 'ch-it', 'ch-en'],
    'de': ['de', 'de-en'],
    'at': ['at', 'at-en'],
    'it': ['it', 'it-en'],
    'fr': ['fr', 'fr-en'],
    'nl': ['nl', 'nl-en'],
    'uk': ['uk'],
    'es': ['es', 'es-en'],
};

// Country display data for the selector (order matters for display)
export const countries: { code: CountryCode; flag: string; name: string; englishName: string }[] = [
    { code: 'global', flag: '🌍', name: 'International', englishName: 'International' },
    { code: 'ch', flag: '🇨🇭', name: 'Schweiz', englishName: 'Switzerland' },
    { code: 'de', flag: '🇩🇪', name: 'Deutschland', englishName: 'Germany' },
    { code: 'at', flag: '🇦🇹', name: 'Österreich', englishName: 'Austria' },
    { code: 'fr', flag: '🇫🇷', name: 'France', englishName: 'France' },
    { code: 'it', flag: '🇮🇹', name: 'Italia', englishName: 'Italy' },
    { code: 'nl', flag: '🇳🇱', name: 'Nederland', englishName: 'Netherlands' },
    { code: 'uk', flag: '🇬🇧', name: 'United Kingdom', englishName: 'United Kingdom' },
    { code: 'es', flag: '🇪🇸', name: 'España', englishName: 'Spain' },
];

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
// URLs should point directly to Planted product pages where available
export const retailers: Record<CountryCode, { name: string; logo: string; url: string; type: 'retail' | 'foodservice' }[]> = {
    'global': [], // No specific retailers for global/international
    'ch': [
        { name: 'Coop', logo: 'coop', url: 'https://www.coop.ch/en/brands/planted/', type: 'retail' },
        { name: 'Migros', logo: 'migros', url: 'https://www.migros.ch/en/brand/planted', type: 'retail' },
        { name: 'Hiltl', logo: 'hiltl', url: 'https://hiltl.ch', type: 'foodservice' },
        { name: 'NENI', logo: 'neni', url: 'https://www.neni.at', type: 'foodservice' },
    ],
    'de': [
        { name: 'EDEKA', logo: 'edeka', url: 'https://www.edeka.de', type: 'retail' },
        { name: 'REWE', logo: 'rewe', url: 'https://shop.rewe.de/productList?brand=planted.', type: 'retail' },
    ],
    'at': [
        { name: 'BILLA', logo: 'billa', url: 'https://shop.billa.at/suche?q=planted', type: 'retail' },
        { name: 'BILLA PLUS', logo: 'billa-plus', url: 'https://shop.billa.at/suche?q=planted', type: 'retail' },
        { name: 'Interspar', logo: 'interspar', url: 'https://www.interspar.at/search/?q=planted', type: 'retail' },
        { name: 'Eurospar', logo: 'eurospar', url: 'https://www.eurospar.at', type: 'retail' },
        { name: 'MPREIS', logo: 'mpreis', url: 'https://shop.mpreis.at/search?q=planted', type: 'retail' },
    ],
    'it': [
        { name: 'Conad', logo: 'conad', url: 'https://www.conad.it', type: 'retail' },
        { name: 'Esselunga', logo: 'esselunga', url: 'https://www.esselungaacasa.it/search/?text=planted', type: 'retail' },
        { name: 'Carrefour', logo: 'carrefour', url: 'https://www.carrefour.it/s?q=planted', type: 'retail' },
        { name: 'Interspar', logo: 'interspar', url: 'https://www.interspar.it', type: 'retail' },
    ],
    'fr': [
        { name: 'Carrefour', logo: 'carrefour', url: 'https://www.carrefour.fr/s?q=planted', type: 'retail' },
        { name: 'Monoprix', logo: 'monoprix', url: 'https://www.monoprix.fr/search?q=planted', type: 'retail' },
        { name: 'Casino', logo: 'casino', url: 'https://www.casino.fr', type: 'retail' },
    ],
    'nl': [
        { name: 'Albert Heijn', logo: 'albert-heijn', url: 'https://www.ah.nl/producten/merk/planted', type: 'retail' },
        { name: 'Jumbo', logo: 'jumbo', url: 'https://www.jumbo.com/producten/?searchType=keyword&searchTerms=planted', type: 'retail' },
    ],
    'uk': [
        { name: 'Tesco', logo: 'tesco', url: 'https://www.tesco.com/groceries/en-GB/search?query=planted', type: 'retail' },
        { name: 'Sainsbury\'s', logo: 'sainsburys', url: 'https://www.sainsburys.co.uk/gol-ui/SearchDisplayView?searchTerm=planted', type: 'retail' },
    ],
    'es': [
        { name: 'Carrefour', logo: 'carrefour', url: 'https://www.carrefour.es/s?q=planted', type: 'retail' },
        { name: 'El Corte Inglés', logo: 'elcorteingles', url: 'https://www.elcorteingles.es/supermercado/buscar/?term=planted', type: 'retail' },
    ],
};

// Ambassador data per country
// Ambassadors are shown on the home page as testimonials for specific countries
export const ambassadors: Record<CountryCode, {
    name: string;
    title: string;
    titleEn: string;
    quote: string;
    quoteEn: string;
    image: string;
    backgroundImage?: string;
    signature?: string;
    videoUrl?: string;
    videoLabel?: string;
    videoLabelEn?: string;
} | null> = {
    'global': null,
    'ch': {
        name: 'Christian Stucki',
        title: 'Schwingerkönig 2019 & Planted Ambassador',
        titleEn: 'Swiss Wrestling Champion 2019 & Planted Ambassador',
        quote: 'Gesundheit ist mir sehr wichtig. Grossartige pflanzliche Produkte wie die von Planted machen es mir leicht, bewusster zu essen, ohne auf Genuss zu verzichten.',
        quoteEn: 'Health is very important to me. Great plant-based products like those from Planted make it easy to eat more consciously without sacrificing enjoyment.',
        image: '/images/ambassadors/christian-stucki.jpg',
    },
    'de': {
        name: 'Tim Raue',
        title: 'Sternekoch ★★ & Planted Partner',
        titleEn: 'Michelin Star Chef ★★ & Planted Partner',
        quote: 'Besonders schätze ich die Textur der Planted-Produkte, die Faserigkeit ist extrem nah an der von tierischem Fleisch. Sie enthalten keine Zusatzstoffe und die Aromen sind sehr fein.',
        quoteEn: 'I especially appreciate the texture of Planted products, the fibrousness is extremely close to that of animal meat. They also contain no additives and the aromatics are very fine.',
        image: '/images/ambassadors/tim-raue.jpg',
        signature: '/images/ambassadors/tim-raue-signature.svg',
        videoUrl: 'https://www.youtube.com/watch?v=planted-tim-raue',
        videoLabel: 'Video ansehen',
        videoLabelEn: 'Watch video',
    },
    'at': null,
    'it': null,
    'fr': null,
    'nl': null,
    'uk': null,
    'es': null,
};

// Helper to get ambassador for a locale
export function getAmbassadorForLocale(locale: LocaleCode): typeof ambassadors['ch'] {
    const country = locales[locale].country as CountryCode;
    return ambassadors[country];
}

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
    return `${base}/${locale}/${cleanUrl}`;
}
