/**
 * Translation Validation Script
 *
 * This script validates that all locale files have the same structure as the English (en.ts) file.
 * Run this script as part of CI/CD or before committing to ensure all translations are complete.
 *
 * Usage: npx ts-node scripts/validate-translations.ts
 */

import en from '../src/i18n/locales/en';
import de from '../src/i18n/locales/de';
import fr from '../src/i18n/locales/fr';
import it from '../src/i18n/locales/it';
import nl from '../src/i18n/locales/nl';
import es from '../src/i18n/locales/es';

type NestedObject = { [key: string]: string | NestedObject };

const locales: Record<string, NestedObject> = { en, de, fr, it, nl, es };

function getKeys(obj: NestedObject, prefix = ''): string[] {
    const keys: string[] = [];
    for (const key in obj) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof obj[key] === 'object' && obj[key] !== null) {
            keys.push(...getKeys(obj[key] as NestedObject, fullKey));
        } else {
            keys.push(fullKey);
        }
    }
    return keys;
}

function validateTranslations(): void {
    const referenceKeys = getKeys(en as unknown as NestedObject);
    const errors: string[] = [];

    console.log(`\n📋 Translation Validation Report`);
    console.log(`${'='.repeat(50)}`);
    console.log(`Reference locale: en (${referenceKeys.length} keys)\n`);

    for (const [localeName, localeData] of Object.entries(locales)) {
        if (localeName === 'en') continue;

        const localeKeys = getKeys(localeData);
        const missingKeys = referenceKeys.filter(key => !localeKeys.includes(key));
        const extraKeys = localeKeys.filter(key => !referenceKeys.includes(key));

        if (missingKeys.length === 0 && extraKeys.length === 0) {
            console.log(`✅ ${localeName.toUpperCase()}: All ${localeKeys.length} keys present`);
        } else {
            if (missingKeys.length > 0) {
                console.log(`❌ ${localeName.toUpperCase()}: Missing ${missingKeys.length} keys:`);
                missingKeys.forEach(key => {
                    console.log(`   - ${key}`);
                    errors.push(`${localeName}: Missing key "${key}"`);
                });
            }
            if (extraKeys.length > 0) {
                console.log(`⚠️  ${localeName.toUpperCase()}: ${extraKeys.length} extra keys (consider removing):`);
                extraKeys.forEach(key => console.log(`   - ${key}`));
            }
        }
    }

    console.log(`\n${'='.repeat(50)}`);

    if (errors.length > 0) {
        console.log(`\n❌ VALIDATION FAILED: ${errors.length} missing translation(s)\n`);
        console.log('Please add the missing translations to ensure all languages are complete.\n');
        process.exit(1);
    } else {
        console.log(`\n✅ VALIDATION PASSED: All translations are complete!\n`);
        process.exit(0);
    }
}

validateTranslations();
