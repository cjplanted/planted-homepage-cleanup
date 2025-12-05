import { defineType, defineField } from 'sanity';

export const siteTranslations = defineType({
    name: 'siteTranslations',
    title: 'Site Translations',
    type: 'document',
    groups: [
        { name: 'navigation', title: 'Navigation' },
        { name: 'home', title: 'Home Page' },
        { name: 'products', title: 'Products' },
        { name: 'recipes', title: 'Recipes' },
        { name: 'about', title: 'About' },
        { name: 'footer', title: 'Footer' },
        { name: 'common', title: 'Common' },
        { name: 'sustainability', title: 'Sustainability' },
        { name: 'gastronomy', title: 'Gastronomy' },
        { name: 'news', title: 'News' },
        { name: 'ourStory', title: 'Our Story' },
        { name: 'storeLocator', title: 'Store Locator' },
        { name: 'cookieConsent', title: 'Cookie Consent' },
        { name: 'newsletter', title: 'Newsletter' },
        { name: 'faq', title: 'FAQ' },
        { name: 'press', title: 'Press' },
        { name: 'legal', title: 'Legal' },
    ],
    fields: [
        // Locale identifier
        defineField({
            name: 'locale',
            title: 'Locale',
            type: 'string',
            validation: (Rule) => Rule.required(),
            options: {
                list: [
                    { title: '🇨🇭 Switzerland (German)', value: 'ch-de' },
                    { title: '🇨🇭 Switzerland (French)', value: 'ch-fr' },
                    { title: '🇨🇭 Switzerland (Italian)', value: 'ch-it' },
                    { title: '🇨🇭 Switzerland (English)', value: 'ch-en' },
                    { title: '🇩🇪 Germany (German)', value: 'de' },
                    { title: '🇩🇪 Germany (English)', value: 'de-en' },
                    { title: '🇦🇹 Austria (German)', value: 'at' },
                    { title: '🇦🇹 Austria (English)', value: 'at-en' },
                    { title: '🇮🇹 Italy (Italian)', value: 'it' },
                    { title: '🇮🇹 Italy (English)', value: 'it-en' },
                    { title: '🇫🇷 France (French)', value: 'fr' },
                    { title: '🇫🇷 France (English)', value: 'fr-en' },
                    { title: '🇳🇱 Netherlands (Dutch)', value: 'nl' },
                    { title: '🇳🇱 Netherlands (English)', value: 'nl-en' },
                    { title: '🇬🇧 United Kingdom', value: 'uk' },
                    { title: '🇪🇸 Spain (Spanish)', value: 'es' },
                    { title: '🇪🇸 Spain (English)', value: 'es-en' },
                    { title: '🌍 Global (English)', value: 'global' },
                ],
            },
        }),

        // ========== NAVIGATION ==========
        defineField({
            name: 'nav',
            title: 'Navigation',
            type: 'object',
            group: 'navigation',
            fields: [
                { name: 'products', title: 'Products', type: 'string' },
                { name: 'recipes', title: 'Recipes', type: 'string' },
                { name: 'about', title: 'About', type: 'string' },
                { name: 'findUs', title: 'Find Us', type: 'string' },
                { name: 'selectCountry', title: 'Select Country', type: 'string' },
                { name: 'sustainability', title: 'Sustainability', type: 'string' },
                { name: 'gastronomy', title: 'Gastronomy', type: 'string' },
                { name: 'news', title: 'News', type: 'string' },
                { name: 'ourStory', title: 'Our Story', type: 'string' },
            ],
        }),

        // ========== HOME PAGE ==========
        defineField({
            name: 'home',
            title: 'Home Page',
            type: 'object',
            group: 'home',
            fields: [
                {
                    name: 'hero',
                    title: 'Hero Section',
                    type: 'object',
                    fields: [
                        { name: 'title', title: 'Title', type: 'string' },
                        { name: 'subtitle', title: 'Subtitle', type: 'string' },
                        { name: 'cta', title: 'CTA Button', type: 'string' },
                        { name: 'badge', title: 'Badge', type: 'string' },
                    ],
                },
                {
                    name: 'sticker',
                    title: 'Sticker',
                    type: 'object',
                    fields: [
                        { name: 'text', title: 'Text', type: 'string' },
                        { name: 'label', title: 'Label', type: 'string' },
                    ],
                },
                {
                    name: 'trust',
                    title: 'Trust Badges',
                    type: 'object',
                    fields: [
                        { name: 'swissMade', title: 'Swiss Made', type: 'string' },
                        { name: 'restaurants', title: 'Restaurants', type: 'string' },
                        { name: 'countries', title: 'Countries', type: 'string' },
                    ],
                },
                {
                    name: 'mission',
                    title: 'Mission Section',
                    type: 'object',
                    fields: [
                        { name: 'title', title: 'Title', type: 'string' },
                        { name: 'highlight', title: 'Highlight', type: 'string' },
                        { name: 'text', title: 'Text', type: 'string' },
                    ],
                },
                {
                    name: 'products',
                    title: 'Products Section',
                    type: 'object',
                    fields: [
                        { name: 'title', title: 'Title', type: 'string' },
                        { name: 'subtitle', title: 'Subtitle', type: 'string' },
                        { name: 'viewAll', title: 'View All', type: 'string' },
                        { name: 'highlights', title: 'Highlights', type: 'string' },
                        { name: 'allProducts', title: 'All Products', type: 'string' },
                    ],
                },
                {
                    name: 'recipes',
                    title: 'Recipes Section',
                    type: 'object',
                    fields: [
                        { name: 'title', title: 'Title', type: 'string' },
                        { name: 'subtitle', title: 'Subtitle', type: 'string' },
                        { name: 'viewAll', title: 'View All', type: 'string' },
                        { name: 'getCooking', title: 'Get Cooking', type: 'string' },
                        { name: 'allRecipes', title: 'All Recipes', type: 'string' },
                    ],
                },
                {
                    name: 'whereToFind',
                    title: 'Where to Find Section',
                    type: 'object',
                    fields: [
                        { name: 'title', title: 'Title', type: 'string' },
                        { name: 'subtitle', title: 'Subtitle', type: 'string' },
                        { name: 'retailers', title: 'Retailers', type: 'string' },
                        { name: 'foodservice', title: 'Foodservice', type: 'string' },
                    ],
                },
                {
                    name: 'locator',
                    title: 'Locator Section',
                    type: 'object',
                    fields: [
                        { name: 'title', title: 'Title', type: 'string' },
                        { name: 'subtitle', title: 'Subtitle', type: 'string' },
                        { name: 'placeholder', title: 'Placeholder', type: 'string' },
                        { name: 'button', title: 'Button', type: 'string' },
                    ],
                },
                {
                    name: 'impact',
                    title: 'Impact Section',
                    type: 'object',
                    fields: [
                        { name: 'badge', title: 'Badge', type: 'string' },
                        { name: 'lessCO2', title: 'Less CO2', type: 'string' },
                        { name: 'lessWater', title: 'Less Water', type: 'string' },
                        { name: 'animalsHarmed', title: 'Animals Harmed', type: 'string' },
                        { name: 'vsCow', title: 'vs Cow', type: 'string' },
                        { name: 'ever', title: 'Ever', type: 'string' },
                        { name: 'tagline', title: 'Tagline', type: 'string' },
                        { name: 'source', title: 'Source', type: 'string' },
                        { name: 'seeHow', title: 'See How', type: 'string' },
                    ],
                },
                {
                    name: 'business',
                    title: 'Business Section',
                    type: 'object',
                    fields: [
                        { name: 'badge', title: 'Badge', type: 'string' },
                        { name: 'getSamples', title: 'Get Samples', type: 'string' },
                    ],
                },
            ],
        }),

        // ========== PRODUCTS PAGE ==========
        defineField({
            name: 'products',
            title: 'Products Page',
            type: 'object',
            group: 'products',
            fields: [
                { name: 'pageTitle', title: 'Page Title', type: 'string' },
                { name: 'pageSubtitle', title: 'Page Subtitle', type: 'string' },
                { name: 'filterAll', title: 'Filter All', type: 'string' },
                { name: 'proteinPer100g', title: 'Protein per 100g', type: 'string' },
                { name: 'whatsInside', title: 'What\'s Inside', type: 'string' },
                { name: 'thatsIt', title: 'That\'s It', type: 'string' },
                { name: 'nutritionTitle', title: 'Nutrition Title', type: 'string' },
                { name: 'cookingTitle', title: 'Cooking Title', type: 'string' },
                { name: 'makeTitle', title: 'Make Title', type: 'string' },
                { name: 'tryIt', title: 'Try It', type: 'string' },
                {
                    name: 'nutrition',
                    title: 'Nutrition Labels',
                    type: 'object',
                    fields: [
                        { name: 'per100g', title: 'Per 100g', type: 'string' },
                        { name: 'energy', title: 'Energy', type: 'string' },
                        { name: 'fat', title: 'Fat', type: 'string' },
                        { name: 'saturates', title: 'Saturates', type: 'string' },
                        { name: 'carbs', title: 'Carbohydrates', type: 'string' },
                        { name: 'sugars', title: 'Sugars', type: 'string' },
                        { name: 'fiber', title: 'Fiber', type: 'string' },
                        { name: 'protein', title: 'Protein', type: 'string' },
                        { name: 'salt', title: 'Salt', type: 'string' },
                        { name: 'vitaminB12', title: 'Vitamin B12', type: 'string' },
                        { name: 'iron', title: 'Iron', type: 'string' },
                        { name: 'animals', title: 'Animals', type: 'string' },
                        { name: 'dailyIntake', title: 'Daily Intake', type: 'string' },
                    ],
                },
                {
                    name: 'cooking',
                    title: 'Cooking Instructions',
                    type: 'object',
                    fields: [
                        { name: 'cookTime', title: 'Cook Time', type: 'string' },
                        { name: 'heat', title: 'Heat', type: 'string' },
                        { name: 'servings', title: 'Servings', type: 'string' },
                        { name: 'step1Title', title: 'Step 1 Title', type: 'string' },
                        { name: 'step1Desc', title: 'Step 1 Description', type: 'string' },
                        { name: 'step2Title', title: 'Step 2 Title', type: 'string' },
                        { name: 'step2Desc', title: 'Step 2 Description', type: 'string' },
                        { name: 'step3Title', title: 'Step 3 Title', type: 'string' },
                        { name: 'step3Desc', title: 'Step 3 Description', type: 'string' },
                    ],
                },
                {
                    name: 'badges',
                    title: 'Product Badges',
                    type: 'object',
                    fields: [
                        { name: 'bCorp', title: 'B Corp', type: 'string' },
                        { name: 'swissMade', title: 'Swiss Made', type: 'string' },
                        { name: 'plantBased', title: 'Plant Based', type: 'string' },
                    ],
                },
                {
                    name: 'features',
                    title: 'Product Features',
                    type: 'object',
                    fields: [
                        { name: 'plantBased', title: 'Plant Based', type: 'string' },
                        { name: 'highProtein', title: 'High Protein', type: 'string' },
                        { name: 'richIron', title: 'Rich in Iron', type: 'string' },
                        { name: 'vitaminB12', title: 'Vitamin B12', type: 'string' },
                    ],
                },
                {
                    name: 'cta',
                    title: 'CTA Section',
                    type: 'object',
                    fields: [
                        { name: 'title', title: 'Title', type: 'string' },
                        { name: 'subtitle', title: 'Subtitle', type: 'string' },
                        { name: 'button', title: 'Button', type: 'string' },
                    ],
                },
            ],
        }),

        // ========== RECIPES PAGE ==========
        defineField({
            name: 'recipes',
            title: 'Recipes Page',
            type: 'object',
            group: 'recipes',
            fields: [
                { name: 'pageTitle', title: 'Page Title', type: 'string' },
                { name: 'pageSubtitle', title: 'Page Subtitle', type: 'string' },
                { name: 'allRecipes', title: 'All Recipes', type: 'string' },
                { name: 'filterAll', title: 'Filter All', type: 'string' },
                { name: 'time', title: 'Time', type: 'string' },
                { name: 'servings', title: 'Servings', type: 'string' },
                { name: 'duration', title: 'Duration', type: 'string' },
                { name: 'level', title: 'Level', type: 'string' },
                { name: 'viewRecipe', title: 'View Recipe', type: 'string' },
                { name: 'ingredients', title: 'Ingredients', type: 'string' },
                { name: 'instructions', title: 'Instructions', type: 'string' },
                { name: 'forServings', title: 'For Servings', type: 'string' },
                { name: 'moreRecipes', title: 'More Recipes', type: 'string' },
                {
                    name: 'filters',
                    title: 'Recipe Filters',
                    type: 'object',
                    fields: [
                        { name: 'steak', title: 'Steak', type: 'string' },
                        { name: 'chicken', title: 'Chicken', type: 'string' },
                        { name: 'pulled', title: 'Pulled', type: 'string' },
                        { name: 'kebab', title: 'Kebab', type: 'string' },
                        { name: 'schnitzel', title: 'Schnitzel', type: 'string' },
                        { name: 'bratwurst', title: 'Bratwurst', type: 'string' },
                        { name: 'duck', title: 'Duck', type: 'string' },
                        { name: 'skewers', title: 'Skewers', type: 'string' },
                        { name: 'crispyStrips', title: 'Crispy Strips', type: 'string' },
                        { name: 'nuggets', title: 'Nuggets', type: 'string' },
                    ],
                },
                {
                    name: 'difficulty',
                    title: 'Difficulty Levels',
                    type: 'object',
                    fields: [
                        { name: 'easy', title: 'Easy', type: 'string' },
                        { name: 'medium', title: 'Medium', type: 'string' },
                        { name: 'hard', title: 'Hard', type: 'string' },
                    ],
                },
                {
                    name: 'eco',
                    title: 'Eco Section',
                    type: 'object',
                    fields: [
                        { name: 'title', title: 'Title', type: 'string' },
                        { name: 'description', title: 'Description', type: 'string' },
                        { name: 'lessCO2', title: 'Less CO2', type: 'string' },
                        { name: 'lessWater', title: 'Less Water', type: 'string' },
                    ],
                },
                {
                    name: 'tips',
                    title: 'Chef Tips',
                    type: 'object',
                    fields: [
                        { name: 'title', title: 'Title', type: 'string' },
                        { name: 'tip1', title: 'Tip 1', type: 'string' },
                        { name: 'tip2', title: 'Tip 2', type: 'string' },
                        { name: 'tip3', title: 'Tip 3', type: 'string' },
                    ],
                },
                {
                    name: 'cta',
                    title: 'CTA Section',
                    type: 'object',
                    fields: [
                        { name: 'title', title: 'Title', type: 'string' },
                        { name: 'subtitle', title: 'Subtitle', type: 'string' },
                    ],
                },
            ],
        }),

        // ========== FOOTER ==========
        defineField({
            name: 'footer',
            title: 'Footer',
            type: 'object',
            group: 'footer',
            fields: [
                { name: 'company', title: 'Company', type: 'string' },
                { name: 'about', title: 'About', type: 'string' },
                { name: 'careers', title: 'Careers', type: 'string' },
                { name: 'press', title: 'Press', type: 'string' },
                { name: 'contact', title: 'Contact', type: 'string' },
                { name: 'products', title: 'Products', type: 'string' },
                { name: 'recipes', title: 'Recipes', type: 'string' },
                { name: 'legal', title: 'Legal', type: 'string' },
                { name: 'privacy', title: 'Privacy', type: 'string' },
                { name: 'terms', title: 'Terms', type: 'string' },
                { name: 'imprint', title: 'Imprint', type: 'string' },
                { name: 'copyright', title: 'Copyright', type: 'string' },
                { name: 'tagline', title: 'Tagline', type: 'string' },
                {
                    name: 'newsletter',
                    title: 'Newsletter',
                    type: 'object',
                    fields: [
                        { name: 'title', title: 'Title', type: 'string' },
                        { name: 'subtitle', title: 'Subtitle', type: 'string' },
                        { name: 'placeholder', title: 'Placeholder', type: 'string' },
                        { name: 'button', title: 'Button', type: 'string' },
                    ],
                },
            ],
        }),

        // ========== COMMON ==========
        defineField({
            name: 'common',
            title: 'Common',
            type: 'object',
            group: 'common',
            fields: [
                { name: 'loading', title: 'Loading', type: 'string' },
                { name: 'error', title: 'Error', type: 'string' },
                { name: 'retry', title: 'Retry', type: 'string' },
                { name: 'close', title: 'Close', type: 'string' },
                { name: 'menu', title: 'Menu', type: 'string' },
                { name: 'search', title: 'Search', type: 'string' },
                { name: 'new', title: 'New', type: 'string' },
                { name: 'backToHome', title: 'Back to Home', type: 'string' },
                { name: 'learnMore', title: 'Learn More', type: 'string' },
                { name: 'seeAll', title: 'See All', type: 'string' },
                { name: 'scroll', title: 'Scroll', type: 'string' },
                { name: 'readMore', title: 'Read More', type: 'string' },
                { name: 'viewAll', title: 'View All', type: 'string' },
            ],
        }),

        // ========== SUSTAINABILITY ==========
        defineField({
            name: 'sustainability',
            title: 'Sustainability',
            type: 'object',
            group: 'sustainability',
            fields: [
                { name: 'pageTitle', title: 'Page Title', type: 'string' },
                {
                    name: 'hero',
                    title: 'Hero',
                    type: 'object',
                    fields: [
                        { name: 'title', title: 'Title', type: 'string' },
                        { name: 'subtitle', title: 'Subtitle', type: 'string' },
                    ],
                },
                { name: 'comparison', title: 'Comparison Text', type: 'string' },
                {
                    name: 'cta',
                    title: 'CTA',
                    type: 'object',
                    fields: [
                        { name: 'explore', title: 'Explore', type: 'string' },
                        { name: 'find', title: 'Find', type: 'string' },
                    ],
                },
            ],
        }),

        // ========== GASTRONOMY ==========
        defineField({
            name: 'gastronomy',
            title: 'Gastronomy',
            type: 'object',
            group: 'gastronomy',
            fields: [
                { name: 'pageTitle', title: 'Page Title', type: 'string' },
                { name: 'badge', title: 'Badge', type: 'string' },
                {
                    name: 'hero',
                    title: 'Hero',
                    type: 'object',
                    fields: [
                        { name: 'title', title: 'Title', type: 'string' },
                        { name: 'subtitle', title: 'Subtitle', type: 'string' },
                    ],
                },
                {
                    name: 'stats',
                    title: 'Stats',
                    type: 'object',
                    fields: [
                        { name: 'restaurants', title: 'Restaurants', type: 'string' },
                        { name: 'restaurantsLabel', title: 'Restaurants Label', type: 'string' },
                        { name: 'countries', title: 'Countries', type: 'string' },
                        { name: 'countriesLabel', title: 'Countries Label', type: 'string' },
                    ],
                },
                { name: 'trusted', title: 'Trusted', type: 'string' },
                { name: 'builtFor', title: 'Built For', type: 'string' },
                {
                    name: 'cta',
                    title: 'CTA',
                    type: 'object',
                    fields: [
                        { name: 'samples', title: 'Samples', type: 'string' },
                        { name: 'contact', title: 'Contact', type: 'string' },
                    ],
                },
            ],
        }),

        // ========== NEWS ==========
        defineField({
            name: 'news',
            title: 'News',
            type: 'object',
            group: 'news',
            fields: [
                { name: 'pageTitle', title: 'Page Title', type: 'string' },
                {
                    name: 'hero',
                    title: 'Hero',
                    type: 'object',
                    fields: [
                        { name: 'title', title: 'Title', type: 'string' },
                        { name: 'whatsGrowing', title: 'What\'s Growing', type: 'string' },
                        { name: 'subtitle', title: 'Subtitle', type: 'string' },
                    ],
                },
                {
                    name: 'filters',
                    title: 'Filters',
                    type: 'object',
                    fields: [
                        { name: 'all', title: 'All', type: 'string' },
                        { name: 'products', title: 'Products', type: 'string' },
                        { name: 'partnerships', title: 'Partnerships', type: 'string' },
                        { name: 'sustainability', title: 'Sustainability', type: 'string' },
                        { name: 'company', title: 'Company', type: 'string' },
                    ],
                },
                { name: 'allNews', title: 'All News', type: 'string' },
            ],
        }),

        // ========== OUR STORY ==========
        defineField({
            name: 'ourStory',
            title: 'Our Story',
            type: 'object',
            group: 'ourStory',
            fields: [
                { name: 'pageTitle', title: 'Page Title', type: 'string' },
                {
                    name: 'hero',
                    title: 'Hero',
                    type: 'object',
                    fields: [
                        { name: 'title', title: 'Title', type: 'string' },
                        { name: 'subtitle', title: 'Subtitle', type: 'string' },
                    ],
                },
                {
                    name: 'values',
                    title: 'Values',
                    type: 'object',
                    fields: [
                        { name: 'title', title: 'Title', type: 'string' },
                        { name: 'planetFirst', title: 'Planet First', type: 'string' },
                        { name: 'planetFirstDesc', title: 'Planet First Description', type: 'string' },
                        { name: 'tasteOverEverything', title: 'Taste Over Everything', type: 'string' },
                        { name: 'tasteOverEverythingDesc', title: 'Taste Description', type: 'string' },
                        { name: 'scienceDriven', title: 'Science Driven', type: 'string' },
                        { name: 'scienceDrivenDesc', title: 'Science Description', type: 'string' },
                        { name: 'noWeirdStuff', title: 'No Weird Stuff', type: 'string' },
                        { name: 'noWeirdStuffDesc', title: 'No Weird Stuff Description', type: 'string' },
                    ],
                },
                {
                    name: 'timeline',
                    title: 'Timeline',
                    type: 'object',
                    fields: [{ name: 'title', title: 'Title', type: 'string' }],
                },
                {
                    name: 'cta',
                    title: 'CTA',
                    type: 'object',
                    fields: [
                        { name: 'ready', title: 'Ready', type: 'string' },
                        { name: 'find', title: 'Find', type: 'string' },
                    ],
                },
            ],
        }),

        // ========== STORE LOCATOR ==========
        defineField({
            name: 'storeLocator',
            title: 'Store Locator',
            type: 'object',
            group: 'storeLocator',
            fields: [
                { name: 'title', title: 'Title', type: 'string' },
                { name: 'subtitle', title: 'Subtitle', type: 'string' },
                { name: 'detecting', title: 'Detecting', type: 'string' },
                { name: 'showingResults', title: 'Showing Results', type: 'string' },
                { name: 'change', title: 'Change', type: 'string' },
                {
                    name: 'tabs',
                    title: 'Tabs',
                    type: 'object',
                    fields: [
                        { name: 'stores', title: 'Stores', type: 'string' },
                        { name: 'restaurants', title: 'Restaurants', type: 'string' },
                    ],
                },
                {
                    name: 'noResults',
                    title: 'No Results',
                    type: 'object',
                    fields: [
                        { name: 'retail', title: 'Retail', type: 'string' },
                        { name: 'foodservice', title: 'Foodservice', type: 'string' },
                    ],
                },
                { name: 'foodserviceIntro', title: 'Foodservice Intro', type: 'string' },
                { name: 'availableProducts', title: 'Available Products', type: 'string' },
                {
                    name: 'online',
                    title: 'Online',
                    type: 'object',
                    fields: [
                        { name: 'badge', title: 'Badge', type: 'string' },
                        { name: 'text', title: 'Text', type: 'string' },
                        { name: 'button', title: 'Button', type: 'string' },
                    ],
                },
            ],
        }),

        // ========== COOKIE CONSENT ==========
        defineField({
            name: 'cookieConsent',
            title: 'Cookie Consent',
            type: 'object',
            group: 'cookieConsent',
            fields: [
                { name: 'title', title: 'Title', type: 'string' },
                { name: 'description', title: 'Description', type: 'string' },
                { name: 'acceptAll', title: 'Accept All', type: 'string' },
                { name: 'necessaryOnly', title: 'Necessary Only', type: 'string' },
                { name: 'settings', title: 'Settings', type: 'string' },
                {
                    name: 'categories',
                    title: 'Categories',
                    type: 'object',
                    fields: [
                        { name: 'necessary', title: 'Necessary', type: 'string' },
                        { name: 'necessaryDesc', title: 'Necessary Description', type: 'string' },
                        { name: 'analytics', title: 'Analytics', type: 'string' },
                        { name: 'analyticsDesc', title: 'Analytics Description', type: 'string' },
                        { name: 'marketing', title: 'Marketing', type: 'string' },
                        { name: 'marketingDesc', title: 'Marketing Description', type: 'string' },
                    ],
                },
            ],
        }),

        // ========== NEWSLETTER ==========
        defineField({
            name: 'newsletter',
            title: 'Newsletter',
            type: 'object',
            group: 'newsletter',
            fields: [
                { name: 'title', title: 'Title', type: 'string' },
                { name: 'subtitle', title: 'Subtitle', type: 'string' },
                { name: 'description', title: 'Description', type: 'string' },
                { name: 'placeholder', title: 'Placeholder', type: 'string' },
                { name: 'button', title: 'Button', type: 'string' },
                { name: 'consent', title: 'Consent', type: 'string' },
                { name: 'success', title: 'Success', type: 'string' },
            ],
        }),

        // ========== FAQ ==========
        defineField({
            name: 'faq',
            title: 'FAQ',
            type: 'object',
            group: 'faq',
            fields: [
                { name: 'pageTitle', title: 'Page Title', type: 'string' },
                {
                    name: 'hero',
                    title: 'Hero',
                    type: 'object',
                    fields: [
                        { name: 'badge', title: 'Badge', type: 'string' },
                        { name: 'title', title: 'Title', type: 'string' },
                        { name: 'subtitle', title: 'Subtitle', type: 'string' },
                    ],
                },
                {
                    name: 'categories',
                    title: 'Categories',
                    type: 'object',
                    fields: [
                        { name: 'general', title: 'General', type: 'string' },
                        { name: 'ingredients', title: 'Ingredients', type: 'string' },
                        { name: 'sustainability', title: 'Sustainability', type: 'string' },
                        { name: 'gastronomy', title: 'Gastronomy', type: 'string' },
                    ],
                },
                {
                    name: 'contact',
                    title: 'Contact',
                    type: 'object',
                    fields: [
                        { name: 'title', title: 'Title', type: 'string' },
                        { name: 'subtitle', title: 'Subtitle', type: 'string' },
                        { name: 'button', title: 'Button', type: 'string' },
                        { name: 'business', title: 'Business', type: 'string' },
                    ],
                },
            ],
        }),

        // ========== PRESS ==========
        defineField({
            name: 'press',
            title: 'Press',
            type: 'object',
            group: 'press',
            fields: [
                { name: 'pageTitle', title: 'Page Title', type: 'string' },
                {
                    name: 'hero',
                    title: 'Hero',
                    type: 'object',
                    fields: [
                        { name: 'badge', title: 'Badge', type: 'string' },
                        { name: 'title', title: 'Title', type: 'string' },
                        { name: 'subtitle', title: 'Subtitle', type: 'string' },
                    ],
                },
                {
                    name: 'contact',
                    title: 'Contact',
                    type: 'object',
                    fields: [
                        { name: 'title', title: 'Title', type: 'string' },
                        { name: 'subtitle', title: 'Subtitle', type: 'string' },
                    ],
                },
                {
                    name: 'facts',
                    title: 'Facts',
                    type: 'object',
                    fields: [{ name: 'title', title: 'Title', type: 'string' }],
                },
                {
                    name: 'resources',
                    title: 'Resources',
                    type: 'object',
                    fields: [
                        { name: 'title', title: 'Title', type: 'string' },
                        { name: 'subtitle', title: 'Subtitle', type: 'string' },
                        { name: 'logos', title: 'Logos', type: 'string' },
                        { name: 'logosDesc', title: 'Logos Description', type: 'string' },
                        { name: 'brand', title: 'Brand', type: 'string' },
                        { name: 'brandDesc', title: 'Brand Description', type: 'string' },
                        { name: 'images', title: 'Images', type: 'string' },
                        { name: 'imagesDesc', title: 'Images Description', type: 'string' },
                        { name: 'video', title: 'Video', type: 'string' },
                        { name: 'videoDesc', title: 'Video Description', type: 'string' },
                        { name: 'bios', title: 'Bios', type: 'string' },
                        { name: 'biosDesc', title: 'Bios Description', type: 'string' },
                        { name: 'data', title: 'Data', type: 'string' },
                        { name: 'dataDesc', title: 'Data Description', type: 'string' },
                        { name: 'contact', title: 'Contact', type: 'string' },
                    ],
                },
                {
                    name: 'news',
                    title: 'News',
                    type: 'object',
                    fields: [
                        { name: 'title', title: 'Title', type: 'string' },
                        { name: 'subtitle', title: 'Subtitle', type: 'string' },
                        { name: 'viewAll', title: 'View All', type: 'string' },
                    ],
                },
                {
                    name: 'about',
                    title: 'About',
                    type: 'object',
                    fields: [
                        { name: 'title', title: 'Title', type: 'string' },
                        { name: 'boilerplate', title: 'Boilerplate', type: 'string' },
                    ],
                },
                {
                    name: 'social',
                    title: 'Social',
                    type: 'object',
                    fields: [{ name: 'title', title: 'Title', type: 'string' }],
                },
            ],
        }),

        // ========== LEGAL ==========
        defineField({
            name: 'legal',
            title: 'Legal',
            type: 'object',
            group: 'legal',
            fields: [
                {
                    name: 'privacy',
                    title: 'Privacy',
                    type: 'object',
                    fields: [
                        { name: 'title', title: 'Title', type: 'string' },
                        { name: 'lastUpdated', title: 'Last Updated', type: 'string' },
                    ],
                },
                {
                    name: 'terms',
                    title: 'Terms',
                    type: 'object',
                    fields: [
                        { name: 'title', title: 'Title', type: 'string' },
                        { name: 'lastUpdated', title: 'Last Updated', type: 'string' },
                    ],
                },
                {
                    name: 'imprint',
                    title: 'Imprint',
                    type: 'object',
                    fields: [
                        { name: 'title', title: 'Title', type: 'string' },
                        { name: 'subtitle', title: 'Subtitle', type: 'string' },
                        { name: 'company', title: 'Company', type: 'string' },
                        { name: 'registration', title: 'Registration', type: 'string' },
                        { name: 'contact', title: 'Contact', type: 'string' },
                        { name: 'management', title: 'Management', type: 'string' },
                        { name: 'contentResponsibility', title: 'Content Responsibility', type: 'string' },
                        { name: 'disclaimer', title: 'Disclaimer', type: 'string' },
                        { name: 'copyright', title: 'Copyright', type: 'string' },
                        { name: 'disputes', title: 'Disputes', type: 'string' },
                    ],
                },
            ],
        }),

        // ========== COUNTRIES ==========
        defineField({
            name: 'countries',
            title: 'Countries',
            type: 'object',
            group: 'common',
            fields: [
                { name: 'switzerland', title: 'Switzerland', type: 'string' },
                { name: 'germany', title: 'Germany', type: 'string' },
                { name: 'austria', title: 'Austria', type: 'string' },
                { name: 'italy', title: 'Italy', type: 'string' },
                { name: 'france', title: 'France', type: 'string' },
                { name: 'netherlands', title: 'Netherlands', type: 'string' },
                { name: 'unitedKingdom', title: 'United Kingdom', type: 'string' },
                { name: 'spain', title: 'Spain', type: 'string' },
            ],
        }),

        // ========== 404 PAGE ==========
        defineField({
            name: 'notFound',
            title: '404 Page',
            type: 'object',
            group: 'common',
            fields: [
                { name: 'title', title: 'Title', type: 'string' },
                { name: 'message', title: 'Message', type: 'string' },
                { name: 'cta', title: 'CTA', type: 'string' },
            ],
        }),

        // ========== META/SEO ==========
        defineField({
            name: 'meta',
            title: 'Meta/SEO',
            type: 'object',
            group: 'common',
            fields: [
                { name: 'defaultDescription', title: 'Default Description', type: 'string' },
                { name: 'titleSuffix', title: 'Title Suffix', type: 'string' },
            ],
        }),
    ],

    preview: {
        select: {
            locale: 'locale',
        },
        prepare({ locale }) {
            const localeNames: Record<string, string> = {
                'ch-de': '🇨🇭 Switzerland (German)',
                'ch-fr': '🇨🇭 Switzerland (French)',
                'ch-it': '🇨🇭 Switzerland (Italian)',
                'ch-en': '🇨🇭 Switzerland (English)',
                'de': '🇩🇪 Germany (German)',
                'de-en': '🇩🇪 Germany (English)',
                'at': '🇦🇹 Austria (German)',
                'at-en': '🇦🇹 Austria (English)',
                'it': '🇮🇹 Italy (Italian)',
                'it-en': '🇮🇹 Italy (English)',
                'fr': '🇫🇷 France (French)',
                'fr-en': '🇫🇷 France (English)',
                'nl': '🇳🇱 Netherlands (Dutch)',
                'nl-en': '🇳🇱 Netherlands (English)',
                'uk': '🇬🇧 United Kingdom',
                'es': '🇪🇸 Spain (Spanish)',
                'es-en': '🇪🇸 Spain (English)',
                'global': '🌍 Global (English)',
            };
            return {
                title: localeNames[locale] || locale,
            };
        },
    },
});
