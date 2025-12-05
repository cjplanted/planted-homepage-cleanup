// Sanity CMS Integration for Translations
// This module fetches translations from Sanity and merges with local fallbacks

import { sanityClient } from '../../sanity/client';
import { translationsQuery, allTranslationsQuery } from '../../sanity/queries';
import { locales, type LocaleCode, type LanguageCode } from './config';
import en from './locales/en';
import de from './locales/de';
import fr from './locales/fr';
import it from './locales/it';
import nl from './locales/nl';
import es from './locales/es';

// Local translations as fallback
const localTranslations: Record<LanguageCode, typeof en> = {
    en,
    de,
    fr,
    it,
    nl,
    es,
};

export type Translations = typeof en;

// Cache for Sanity translations
let sanityTranslationsCache: Map<string, Translations> | null = null;

// Deep merge helper - Sanity values override local values
function deepMerge(local: any, sanity: any): any {
    if (!sanity) return local;
    if (!local) return sanity;
    if (typeof local !== 'object' || typeof sanity !== 'object') {
        return sanity !== undefined && sanity !== null ? sanity : local;
    }

    const result: any = { ...local };
    for (const key of Object.keys(sanity)) {
        if (sanity[key] !== undefined && sanity[key] !== null) {
            result[key] = deepMerge(local[key], sanity[key]);
        }
    }
    return result;
}

// Fetch translations from Sanity for a specific locale
export async function fetchSanityTranslations(locale: LocaleCode): Promise<Translations | null> {
    try {
        const sanityProjectId = import.meta.env.PUBLIC_SANITY_PROJECT_ID;

        // Skip if Sanity is not configured
        if (!sanityProjectId || sanityProjectId === 'YOUR_PROJECT_ID') {
            return null;
        }

        const result = await sanityClient.fetch(translationsQuery, { locale });
        return result || null;
    } catch (error) {
        console.warn(`Failed to fetch Sanity translations for ${locale}:`, error);
        return null;
    }
}

// Fetch all translations from Sanity (for build-time caching)
export async function fetchAllSanityTranslations(): Promise<Map<string, Translations>> {
    const cache = new Map<string, Translations>();

    try {
        const sanityProjectId = import.meta.env.PUBLIC_SANITY_PROJECT_ID;

        // Skip if Sanity is not configured
        if (!sanityProjectId || sanityProjectId === 'YOUR_PROJECT_ID') {
            return cache;
        }

        const results = await sanityClient.fetch(allTranslationsQuery);

        if (Array.isArray(results)) {
            for (const item of results) {
                if (item.locale) {
                    cache.set(item.locale, item);
                }
            }
        }
    } catch (error) {
        console.warn('Failed to fetch all Sanity translations:', error);
    }

    return cache;
}

// Initialize cache at build time
export async function initSanityTranslationsCache(): Promise<void> {
    sanityTranslationsCache = await fetchAllSanityTranslations();
}

// Get translations with Sanity override
export async function getTranslationsWithSanity(locale: LocaleCode): Promise<Translations> {
    const language = locales[locale].language;
    const localTrans = localTranslations[language] || localTranslations.en;

    // Try to get from cache first
    let sanityTrans: Translations | null = null;

    if (sanityTranslationsCache) {
        sanityTrans = sanityTranslationsCache.get(locale) || null;
    } else {
        sanityTrans = await fetchSanityTranslations(locale);
    }

    // Merge Sanity translations over local translations
    if (sanityTrans) {
        return deepMerge(localTrans, sanityTrans) as Translations;
    }

    return localTrans;
}

// Synchronous version using cached translations (for use in components)
export function getTranslationsSync(locale: LocaleCode): Translations {
    const language = locales[locale].language;
    const localTrans = localTranslations[language] || localTranslations.en;

    // Try to get from cache
    if (sanityTranslationsCache) {
        const sanityTrans = sanityTranslationsCache.get(locale);
        if (sanityTrans) {
            return deepMerge(localTrans, sanityTrans) as Translations;
        }
    }

    return localTrans;
}
