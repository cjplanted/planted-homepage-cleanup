import { groq } from '@sanity/client';

// Fetch translations for a specific locale
export const translationsQuery = groq`
    *[_type == "siteTranslations" && locale == $locale][0] {
        locale,
        nav,
        home,
        products,
        recipes,
        footer,
        common,
        sustainability,
        gastronomy,
        news,
        ourStory,
        storeLocator,
        cookieConsent,
        newsletter,
        faq,
        press,
        legal,
        countries,
        notFound,
        meta
    }
`;

// Fetch all translations (for build-time static generation)
export const allTranslationsQuery = groq`
    *[_type == "siteTranslations"] {
        locale,
        nav,
        home,
        products,
        recipes,
        footer,
        common,
        sustainability,
        gastronomy,
        news,
        ourStory,
        storeLocator,
        cookieConsent,
        newsletter,
        faq,
        press,
        legal,
        countries,
        notFound,
        meta
    }
`;
