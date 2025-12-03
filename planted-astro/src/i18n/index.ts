// i18n Main Module
import { locales, type LocaleCode, type LanguageCode, defaultLocale } from './config';
import en from './locales/en';
import de from './locales/de';
import fr from './locales/fr';
import it from './locales/it';
import nl from './locales/nl';
import es from './locales/es';

// All translations indexed by language code
const translations: Record<LanguageCode, typeof en> = {
    en,
    de,
    fr,
    it,
    nl,
    es,
};

export type Translations = typeof en;

// Get translations for a locale
export function getTranslations(locale: LocaleCode): Translations {
    const language = locales[locale].language;
    return translations[language] || translations.en;
}

// Get a specific translation by key path
export function t(locale: LocaleCode, path: string): string {
    const trans = getTranslations(locale);
    const keys = path.split('.');
    let result: any = trans;

    for (const key of keys) {
        if (result && typeof result === 'object' && key in result) {
            result = result[key];
        } else {
            console.warn(`Translation not found: ${path} for locale ${locale}`);
            return path;
        }
    }

    return typeof result === 'string' ? result : path;
}

// Re-export config
export * from './config';
