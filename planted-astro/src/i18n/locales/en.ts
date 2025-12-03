// English translations
export default {
    // Navigation
    nav: {
        products: 'Products',
        recipes: 'Recipes',
        about: 'About',
        findUs: 'Find Us',
        selectCountry: 'Select Country',
    },

    // Home page
    home: {
        hero: {
            title: 'The Future of Meat',
            subtitle: 'Plant-based. Swiss-made. Incredibly delicious.',
            cta: 'Explore Products',
        },
        mission: {
            title: 'Our Mission',
            text: 'We\'re on a mission to make the food system more sustainable. By creating plant-based meat that actually tastes like meat, we\'re giving everyone the chance to make better choices—without compromise.',
        },
        products: {
            title: 'Our Products',
            subtitle: 'From chicken to pulled pork, we\'ve got you covered.',
            viewAll: 'View All Products',
        },
        recipes: {
            title: 'Get Inspired',
            subtitle: 'Discover delicious recipes created with planted.',
            viewAll: 'View All Recipes',
        },
        whereToFind: {
            title: 'Where to Find Us',
            subtitle: 'planted is available at these retailers and restaurants.',
            retailers: 'Retailers',
            foodservice: 'Foodservice',
        },
        locator: {
            title: 'Find planted Near You',
            subtitle: 'Enter your location to find the nearest store.',
            placeholder: 'Enter your postcode or city',
            button: 'Search',
        },
    },

    // Products page
    products: {
        pageTitle: 'Our Products',
        pageSubtitle: 'Plant-based meat that actually tastes like meat. No compromises.',
        filterAll: 'All',
        proteinPer100g: 'Protein per 100g',
        whatsInside: 'What\'s inside',
        thatsIt: 'That\'s it. {count} ingredients.',
        nutritionTitle: 'Nutritional values',
        cookingTitle: 'Cook it your way',
        makeTitle: 'Make something',
        tryIt: 'Try it.',
        nutrition: {
            per100g: 'Per 100g',
            energy: 'Energy',
            fat: 'Fat',
            saturates: 'of which saturates',
            carbs: 'Carbohydrates',
            sugars: 'of which sugars',
            fiber: 'Fiber',
            protein: 'Protein',
            salt: 'Salt',
            vitaminB12: 'Vitamin B12',
            iron: 'Iron',
            animals: 'Animals',
            dailyIntake: 'of daily reference intake',
        },
        cooking: {
            cookTime: 'Cook time',
            heat: 'Heat',
            servings: 'Servings',
            step1Title: 'Season',
            step1Desc: 'Your blank canvas. Go wild or keep it simple with salt & pepper.',
            step2Title: 'Heat',
            step2Desc: 'Oil in pan. Get it hot. High heat is your friend.',
            step3Title: 'Cook',
            step3Desc: 'Golden on all sides. A few minutes each side. Done.',
        },
        badges: {
            bCorp: 'B Corp Certified',
            swissMade: 'Made in Switzerland',
            plantBased: '100% Plant-Based',
        },
        features: {
            plantBased: '100% Plant-Based',
            highProtein: 'High Protein',
            richIron: 'Rich in Iron',
            vitaminB12: 'Vitamin B12 Source',
        },
        cta: {
            title: 'Ready to try?',
            subtitle: 'Find planted at your favourite store. We\'re basically everywhere now.',
            button: 'Find Near You',
        },
    },

    // Recipes page
    recipes: {
        pageTitle: 'Recipes',
        pageSubtitle: 'Delicious ideas to inspire your next meal.',
        allRecipes: 'All Recipes',
        filterAll: 'All',
        difficulty: {
            easy: 'Easy',
            medium: 'Medium',
            hard: 'Hard',
        },
        time: 'min',
        servings: 'servings',
        viewRecipe: 'View Recipe',
        ingredients: 'Ingredients',
        instructions: 'Instructions',
        forServings: 'For {count} servings',
        moreRecipes: 'More Recipes to Try',
        eco: {
            title: 'Better for the Planet',
            description: 'By choosing planted, this recipe uses up to 97% less CO2 than traditional meat dishes.',
            lessCO2: 'Less CO2',
            lessWater: 'Less Water',
        },
        tips: {
            title: 'Chef Tips',
            tip1: 'Don\'t overcook! Plant-based proteins cook faster than traditional meat.',
            tip2: 'Season generously and let the flavors develop while cooking.',
            tip3: 'Bring planted products to room temperature before cooking for best results.',
        },
        cta: {
            title: 'Ready to cook?',
            subtitle: 'Find planted products at your nearest store and start cooking today.',
        },
    },

    // About page
    about: {
        pageTitle: 'About planted',
        mission: {
            title: 'Our Mission',
            text: 'We believe that delicious food and a healthy planet can go hand in hand. That\'s why we create plant-based meat that doesn\'t compromise on taste, texture, or nutrition.',
        },
        story: {
            title: 'Our Story',
            text: 'Founded in 2019 in Zurich, Switzerland, planted was born from a simple idea: what if we could create meat from plants that was so good, you wouldn\'t miss the original?',
        },
        values: {
            title: 'Our Values',
            sustainability: 'Sustainability',
            sustainabilityText: 'Every choice we make considers the impact on our planet.',
            innovation: 'Innovation',
            innovationText: 'We push the boundaries of food technology.',
            transparency: 'Transparency',
            transparencyText: 'We believe in honest, clear communication about our products.',
            taste: 'Taste',
            tasteText: 'We never compromise on flavor and texture.',
        },
    },

    // Footer
    footer: {
        company: 'Company',
        about: 'About Us',
        careers: 'Careers',
        press: 'Press',
        contact: 'Contact',
        products: 'Products',
        recipes: 'Recipes',
        legal: 'Legal',
        privacy: 'Privacy Policy',
        terms: 'Terms of Service',
        imprint: 'Imprint',
        newsletter: {
            title: 'Stay in the loop',
            subtitle: 'Get the latest news, recipes, and offers.',
            placeholder: 'Your email',
            button: 'Subscribe',
        },
        copyright: '© 2024 planted. All rights reserved.',
        tagline: 'Plant-based. Swiss-made.',
    },

    // Common
    common: {
        loading: 'Loading...',
        error: 'Something went wrong',
        retry: 'Try again',
        close: 'Close',
        menu: 'Menu',
        search: 'Search',
        new: 'New',
        backToHome: 'Back to Home',
        learnMore: 'Learn More',
        seeAll: 'See All',
        scroll: 'Scroll',
    },
} as const;
