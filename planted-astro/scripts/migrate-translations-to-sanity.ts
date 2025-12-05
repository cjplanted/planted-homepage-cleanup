/**
 * Migration Script: Export existing translations to Sanity
 *
 * This script reads all local translation files and creates Sanity documents.
 *
 * Usage:
 * 1. First, create a Sanity project at https://www.sanity.io/manage
 * 2. Get your project ID and create a write token
 * 3. Set environment variables:
 *    - SANITY_PROJECT_ID=your-project-id
 *    - SANITY_DATASET=production
 *    - SANITY_WRITE_TOKEN=your-write-token
 * 4. Run: npx tsx scripts/migrate-translations-to-sanity.ts
 */

import { createClient } from '@sanity/client';

// Import all translations
import en from '../src/i18n/locales/en';
import de from '../src/i18n/locales/de';
import fr from '../src/i18n/locales/fr';
import it from '../src/i18n/locales/it';
import nl from '../src/i18n/locales/nl';
import es from '../src/i18n/locales/es';

// Locale to language mapping
const localeLanguageMap: Record<string, keyof typeof languageTranslations> = {
    'ch-de': 'de',
    'ch-fr': 'fr',
    'ch-it': 'it',
    'ch-en': 'en',
    'de': 'de',
    'de-en': 'en',
    'at': 'de',
    'at-en': 'en',
    'it': 'it',
    'it-en': 'en',
    'fr': 'fr',
    'fr-en': 'en',
    'nl': 'nl',
    'nl-en': 'en',
    'uk': 'en',
    'es': 'es',
    'es-en': 'en',
    'global': 'en',
};

const languageTranslations = { en, de, fr, it, nl, es };

// All locales
const allLocales = [
    'ch-de', 'ch-fr', 'ch-it', 'ch-en',
    'de', 'de-en',
    'at', 'at-en',
    'it', 'it-en',
    'fr', 'fr-en',
    'nl', 'nl-en',
    'uk',
    'es', 'es-en',
    'global',
];

async function migrate() {
    const projectId = process.env.SANITY_PROJECT_ID;
    const dataset = process.env.SANITY_DATASET || 'production';
    const token = process.env.SANITY_WRITE_TOKEN;

    if (!projectId || !token) {
        console.error('Missing required environment variables:');
        console.error('  SANITY_PROJECT_ID - Your Sanity project ID');
        console.error('  SANITY_WRITE_TOKEN - A write token from Sanity');
        console.error('');
        console.error('Get these from: https://www.sanity.io/manage');
        process.exit(1);
    }

    const client = createClient({
        projectId,
        dataset,
        token,
        apiVersion: '2024-01-01',
        useCdn: false,
    });

    console.log('Starting migration...');
    console.log(`Project ID: ${projectId}`);
    console.log(`Dataset: ${dataset}`);
    console.log('');

    for (const locale of allLocales) {
        const language = localeLanguageMap[locale];
        const translations = languageTranslations[language];

        console.log(`Creating translations for ${locale} (${language})...`);

        const document = {
            _id: `translations-${locale}`,
            _type: 'siteTranslations',
            locale: locale,
            nav: translations.nav,
            home: translations.home,
            products: translations.products,
            recipes: translations.recipes,
            footer: translations.footer,
            common: translations.common,
            sustainability: translations.sustainability,
            gastronomy: translations.gastronomy,
            news: translations.news,
            ourStory: translations.ourStory,
            storeLocator: translations.storeLocator,
            cookieConsent: translations.cookieConsent,
            newsletter: translations.newsletter,
            faq: translations.faq,
            press: translations.press,
            legal: translations.legal,
            countries: translations.countries,
            notFound: translations.notFound,
            meta: translations.meta,
        };

        try {
            await client.createOrReplace(document);
            console.log(`  ✓ Created ${locale}`);
        } catch (error) {
            console.error(`  ✗ Failed to create ${locale}:`, error);
        }
    }

    console.log('');
    console.log('Migration complete!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Visit your Sanity Studio to view and edit translations');
    console.log('2. Run: npm run sanity:dev');
    console.log('3. Edit translations in the Sanity Studio UI');
}

migrate().catch(console.error);
