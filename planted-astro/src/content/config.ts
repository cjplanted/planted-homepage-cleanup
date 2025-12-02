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
    }),
});

// Recipes collection
const recipes = defineCollection({
    type: 'data',
    schema: z.object({
        title: z.string(),
        description: z.string().optional(),
        image: z.string(),
        cookTime: z.number(), // in minutes
        difficulty: z.enum(['Easy', 'Medium', 'Hard']),
        categories: z.array(z.string()),
        tags: z.array(z.string()),
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
