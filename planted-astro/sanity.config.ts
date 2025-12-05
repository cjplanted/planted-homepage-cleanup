import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import { schemaTypes } from './sanity/schemas';

// Sanity project configuration
const projectId = 'xc3k92zt';
const dataset = 'production';

export default defineConfig({
    name: 'planted-website',
    title: 'Planted Website',

    projectId,
    dataset,

    plugins: [
        structureTool({
            structure: (S) =>
                S.list()
                    .title('Content')
                    .items([
                        S.listItem()
                            .title('Translations')
                            .child(
                                S.list()
                                    .title('Translations by Locale')
                                    .items([
                                        // Swiss locales
                                        S.listItem()
                                            .title('🇨🇭 Switzerland')
                                            .child(
                                                S.list()
                                                    .title('Swiss Languages')
                                                    .items([
                                                        createLocaleItem(S, 'ch-de', '🇨🇭 German'),
                                                        createLocaleItem(S, 'ch-fr', '🇨🇭 French'),
                                                        createLocaleItem(S, 'ch-it', '🇨🇭 Italian'),
                                                        createLocaleItem(S, 'ch-en', '🇨🇭 English'),
                                                    ])
                                            ),
                                        // Germany
                                        S.listItem()
                                            .title('🇩🇪 Germany')
                                            .child(
                                                S.list()
                                                    .title('German Languages')
                                                    .items([
                                                        createLocaleItem(S, 'de', '🇩🇪 German'),
                                                        createLocaleItem(S, 'de-en', '🇩🇪 English'),
                                                    ])
                                            ),
                                        // Austria
                                        S.listItem()
                                            .title('🇦🇹 Austria')
                                            .child(
                                                S.list()
                                                    .title('Austrian Languages')
                                                    .items([
                                                        createLocaleItem(S, 'at', '🇦🇹 German'),
                                                        createLocaleItem(S, 'at-en', '🇦🇹 English'),
                                                    ])
                                            ),
                                        // Italy
                                        S.listItem()
                                            .title('🇮🇹 Italy')
                                            .child(
                                                S.list()
                                                    .title('Italian Languages')
                                                    .items([
                                                        createLocaleItem(S, 'it', '🇮🇹 Italian'),
                                                        createLocaleItem(S, 'it-en', '🇮🇹 English'),
                                                    ])
                                            ),
                                        // France
                                        S.listItem()
                                            .title('🇫🇷 France')
                                            .child(
                                                S.list()
                                                    .title('French Languages')
                                                    .items([
                                                        createLocaleItem(S, 'fr', '🇫🇷 French'),
                                                        createLocaleItem(S, 'fr-en', '🇫🇷 English'),
                                                    ])
                                            ),
                                        // Netherlands
                                        S.listItem()
                                            .title('🇳🇱 Netherlands')
                                            .child(
                                                S.list()
                                                    .title('Dutch Languages')
                                                    .items([
                                                        createLocaleItem(S, 'nl', '🇳🇱 Dutch'),
                                                        createLocaleItem(S, 'nl-en', '🇳🇱 English'),
                                                    ])
                                            ),
                                        // UK
                                        createLocaleItem(S, 'uk', '🇬🇧 United Kingdom'),
                                        // Spain
                                        S.listItem()
                                            .title('🇪🇸 Spain')
                                            .child(
                                                S.list()
                                                    .title('Spanish Languages')
                                                    .items([
                                                        createLocaleItem(S, 'es', '🇪🇸 Spanish'),
                                                        createLocaleItem(S, 'es-en', '🇪🇸 English'),
                                                    ])
                                            ),
                                        // Global
                                        createLocaleItem(S, 'global', '🌍 Global (English)'),
                                    ])
                            ),
                        S.divider(),
                        ...S.documentTypeListItems().filter(
                            (listItem) => !['siteTranslations'].includes(listItem.getId() || '')
                        ),
                    ]),
        }),
    ],

    schema: {
        types: schemaTypes,
    },
});

// Helper function to create locale menu items
function createLocaleItem(S: any, locale: string, title: string) {
    return S.listItem()
        .title(title)
        .child(
            S.document()
                .schemaType('siteTranslations')
                .documentId(`translations-${locale}`)
                .title(`${title} Translations`)
        );
}
