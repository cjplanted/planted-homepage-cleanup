import { defineCollection, z } from 'astro:content';

// Products collection
const products = defineCollection({
    type: 'data',
    schema: z.object({
        name: z.string(),
        variant: z.string(),
        slug: z.string(),
        category: z.enum(['chicken', 'steak', 'pulled', 'kebab', 'schnitzel', 'bratwurst', 'duck', 'burger', 'nuggets', 'skewers', 'filetwuerfel', 'other']),
        description: z.string().optional(),
        longDescription: z.string().optional(),
        weight: z.string().optional(),
        color: z.enum(['terracotta', 'yellow', 'purple', 'olive', 'burgundy', 'teal', 'coral', 'navy', 'green', 'orange', 'red']),
        isNew: z.boolean().default(false),
        images: z.object({
            main: z.string(),
            background: z.string().optional(),
            dish: z.string().optional(),
        }),
        features: z.array(z.string()).optional(),
        ingredients: z.string().optional(),
        preparation: z.string().optional(),
        order: z.number().default(0),
        // Nutrition data per 100g
        nutrition: z.object({
            energy: z.string(), // e.g., "718 kJ / 172 kcal"
            fat: z.string(), // e.g., "8.1 g"
            saturates: z.string(), // e.g., "0.7 g"
            carbs: z.string(), // e.g., "4.9 g"
            sugars: z.string(), // e.g., "2.1 g"
            fiber: z.string(), // e.g., "5.7 g"
            protein: z.number(), // e.g., 24 (grams per 100g)
            salt: z.string(), // e.g., "0.8 g"
            vitaminB12: z.string(), // e.g., "1.8 µg"
            vitaminB12Pct: z.number(), // e.g., 72
            iron: z.string(), // e.g., "3.8 mg"
            ironPct: z.number(), // e.g., 27
        }).optional(),
        // Cooking instructions
        cooking: z.object({
            time: z.string(), // e.g., "3-5 min"
            heat: z.string(), // e.g., "High"
            servings: z.string(), // e.g., "3-4"
            steps: z.array(z.object({
                title: z.string(),
                description: z.string(),
            })).optional(),
        }).optional(),
    }),
});

// Recipes collection
const recipes = defineCollection({
    type: 'data',
    schema: z.object({
        title: z.string(),
        slug: z.string(),
        description: z.string().optional(),
        image: z.string(),
        cookTime: z.number(), // in minutes
        servings: z.number().optional(),
        difficulty: z.enum(['Easy', 'Medium', 'Hard']),
        category: z.string().optional(),
        categories: z.array(z.string()).optional(),
        tags: z.array(z.string()).optional(),
        ingredients: z.array(z.string()).optional(),
        instructions: z.array(z.string()).optional(),
        isFeatured: z.boolean().default(false),
        order: z.number().default(0),
    }),
});

// Team members collection
const team = defineCollection({
    type: 'data',
    schema: z.object({
        name: z.string(),
        role: z.string(),
        photo: z.string(),
        order: z.number().default(0),
    }),
});

// Site settings (singleton-style)
const settings = defineCollection({
    type: 'data',
    schema: z.object({
        // Homepage
        heroTitle: z.string().optional(),
        heroSubtitle: z.string().optional(),
        statementTitle: z.string().optional(),
        statementHighlight: z.string().optional(),
        statementSubtitle: z.string().optional(),

        // Impact stats
        impactCO2: z.number().optional(),
        impactWater: z.number().optional(),
        impactAnimals: z.number().optional(),

        // Store locator
        locatorTitle: z.string().optional(),
        locatorSubtitle: z.string().optional(),
        retailers: z.array(z.string()).optional(),

        // Business section
        businessBadge: z.string().optional(),
        businessTitle: z.string().optional(),
        businessSubtitle: z.string().optional(),
        businessStats: z.array(z.object({
            value: z.string(),
            label: z.string(),
        })).optional(),

        // Footer
        footerTagline: z.string().optional(),
        copyright: z.string().optional(),
    }),
});

export const collections = {
    products,
    recipes,
    team,
    settings,
};
