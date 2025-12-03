// Product translations index
import en from './en';
import de from './de';
import fr from './fr';
import it from './it';
import nl from './nl';
import es from './es';
import type { LanguageCode } from '../config';

export type ProductTranslation = {
    description: string;
    longDescription: string;
    ingredients: string;
    preparation: string;
    features: string[];
    cookingSteps: { title: string; description: string }[];
};

export type ProductTranslations = Record<string, ProductTranslation>;

const productTranslations: Record<LanguageCode, ProductTranslations> = {
    en,
    de,
    fr,
    it,
    nl,
    es,
};

export function getProductTranslation(slug: string, language: LanguageCode): ProductTranslation | undefined {
    return productTranslations[language]?.[slug];
}

export function getProductTranslations(language: LanguageCode): ProductTranslations {
    return productTranslations[language] || productTranslations.en;
}

export default productTranslations;
