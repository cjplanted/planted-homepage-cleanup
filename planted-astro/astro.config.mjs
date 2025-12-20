// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://cjplanted.github.io',
  base: '/planted-homepage-cleanup',
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/api/'),
      i18n: {
        defaultLocale: 'ch-de',
        locales: {
          'ch-de': 'de-CH',
          'ch-fr': 'fr-CH',
          'ch-it': 'it-CH',
          'de': 'de-DE',
          'at': 'de-AT',
          'fr': 'fr-FR',
          'it': 'it-IT',
          'nl': 'nl-NL',
          'uk': 'en-GB',
          'es': 'es-ES',
        },
      },
    }),
  ],
});
