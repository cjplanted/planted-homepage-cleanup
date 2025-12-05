// Restaurants serving Planted products with delivery options
// Data curated from actual restaurant menus - December 2024

export interface DeliveryPlatform {
    name: 'wolt' | 'lieferando' | 'uber-eats' | 'deliveroo' | 'just-eat' | 'own';
    url: string;
    displayName: string;
}

export interface PlantedDish {
    name: string;
    description: string;
    price?: string;
    product: string; // e.g., 'planted.chicken', 'planted.kebab'
    isVegan?: boolean;
}

export interface DeliveryRestaurant {
    id: string;
    name: string;
    country: 'ch' | 'de' | 'at' | 'nl' | 'uk' | 'fr' | 'it' | 'es';
    city: string;
    cuisine: string;
    dishes: PlantedDish[];
    deliveryPlatforms: DeliveryPlatform[];
    rating?: number;
    image?: string;
}

export const deliveryRestaurants: DeliveryRestaurant[] = [
    // ============================================
    // AUSTRIA
    // ============================================
    {
        id: 'vapiano-vienna',
        name: 'Vapiano',
        country: 'at',
        city: 'Vienna',
        cuisine: 'Italian',
        dishes: [
            {
                name: 'Pasta Planted Chicken Alfredo',
                description: 'Creamy alfredo sauce with planted chicken, mushrooms, and parmesan',
                price: '€15.90',
                product: 'planted.chicken',
                isVegan: true,
            },
            {
                name: 'Pasta Planted Chicken Orange-Chili',
                description: 'Planted chicken with spicy orange-chili sauce, pak choi, and bell peppers',
                price: '€15.90',
                product: 'planted.chicken',
                isVegan: true,
            },
            {
                name: 'Planted Chicken Salad Bowl',
                description: 'Fresh salad with grilled planted chicken, cherry tomatoes, and balsamic',
                price: '€14.50',
                product: 'planted.chicken',
                isVegan: true,
            },
        ],
        deliveryPlatforms: [
            {
                name: 'wolt',
                url: 'https://wolt.com/en/aut/vienna/restaurant/vapiano-shopping-city-sd-vsendorf',
                displayName: 'Wolt',
            },
            {
                name: 'lieferando',
                url: 'https://www.lieferando.at/en/menu/vapiano',
                displayName: 'Lieferando',
            },
        ],
        rating: 4.2,
    },
    {
        id: 'neni-vienna',
        name: 'NENI am Naschmarkt',
        country: 'at',
        city: 'Vienna',
        cuisine: 'Tel Aviv / Mediterranean',
        dishes: [
            {
                name: 'Hummus Bowl with Planted Chicken',
                description: 'Classic hummus, planted chicken, Jerusalem spice, amba, yellow pepper, tahina, warm pita',
                price: '€16.90',
                product: 'planted.chicken',
                isVegan: true,
            },
            {
                name: 'Planted Chicken Shawarma Plate',
                description: 'Spiced planted chicken with pickled vegetables, herb yogurt, and flatbread',
                price: '€18.50',
                product: 'planted.chicken',
                isVegan: true,
            },
        ],
        deliveryPlatforms: [
            {
                name: 'wolt',
                url: 'https://wolt.com/en/aut/vienna/restaurant/neni-am-naschmarkt',
                displayName: 'Wolt',
            },
        ],
        rating: 4.5,
    },

    // ============================================
    // GERMANY
    // ============================================
    {
        id: 'doen-doen-berlin',
        name: 'doen doen planted kebap',
        country: 'de',
        city: 'Berlin',
        cuisine: 'Kebab / Vegan',
        dishes: [
            {
                name: 'Planted Kebap Döner',
                description: 'Vegan döner with planted kebab, fresh salad, red cabbage, tomatoes, cucumbers, grilled vegetables, choice of sauces',
                price: '€8.90',
                product: 'planted.kebab',
                isVegan: true,
            },
            {
                name: 'Planted Kebap Dürüm',
                description: 'Wrap with planted kebab, salad mix, grilled vegetables, herb-yogurt and hot sauce',
                price: '€9.50',
                product: 'planted.kebab',
                isVegan: true,
            },
            {
                name: 'Planted Kebap Teller',
                description: 'Plate with planted kebab, rice, salad, grilled vegetables, and all sauces',
                price: '€12.90',
                product: 'planted.kebab',
                isVegan: true,
            },
        ],
        deliveryPlatforms: [
            {
                name: 'wolt',
                url: 'https://wolt.com/en/deu/berlin/restaurant/doen-doen-planted-kebap-berlin',
                displayName: 'Wolt',
            },
        ],
        rating: 9.2,
    },
    {
        id: 'doen-doen-stuttgart',
        name: 'doen doen planted kebap',
        country: 'de',
        city: 'Stuttgart',
        cuisine: 'Kebab / Vegan',
        dishes: [
            {
                name: 'Planted Kebap Döner',
                description: 'Vegan döner with planted kebab, fresh salad, red cabbage, tomatoes, cucumbers, grilled vegetables',
                price: '€8.90',
                product: 'planted.kebab',
                isVegan: true,
            },
            {
                name: 'Planted Kebap Box',
                description: 'Planted kebab with fries, salad, and signature sauces',
                price: '€11.90',
                product: 'planted.kebab',
                isVegan: true,
            },
        ],
        deliveryPlatforms: [
            {
                name: 'wolt',
                url: 'https://wolt.com/en/deu/stuttgart/restaurant/doen-doen-planted-kebap',
                displayName: 'Wolt',
            },
        ],
        rating: 8.6,
    },
    {
        id: 'peter-pane-berlin',
        name: 'Peter Pane',
        country: 'de',
        city: 'Berlin',
        cuisine: 'Burgers',
        dishes: [
            {
                name: 'Kebab Klaus Burger',
                description: 'Planted kebab, microgreens, lemon thyme sauce, crispy onions on brioche bun',
                price: '€14.90',
                product: 'planted.kebab',
                isVegan: false,
            },
            {
                name: 'Meatless Monday Special',
                description: 'All vegan burgers including planted options for only €9.90 every Monday',
                price: '€9.90',
                product: 'planted.kebab',
                isVegan: true,
            },
        ],
        deliveryPlatforms: [
            {
                name: 'lieferando',
                url: 'https://www.lieferando.de/en/peter-pane-berlin',
                displayName: 'Lieferando',
            },
            {
                name: 'uber-eats',
                url: 'https://www.ubereats.com/de-en/store/peter-pane-burgergrill-&-bar-east-side/eZYUJfP-TsWYlwALitZ3eg',
                displayName: 'Uber Eats',
            },
        ],
        rating: 4.3,
    },
    {
        id: 'dean-david-munich',
        name: 'dean&david',
        country: 'de',
        city: 'Munich',
        cuisine: 'Healthy Bowls & Salads',
        dishes: [
            {
                name: 'Planted Chicken Kebab Bowl',
                description: 'Jasmine rice, grilled planted chicken, cherry tomatoes, cucumber, red cabbage, mint dip, pomegranate seeds, harissa sesame',
                price: '€13.90',
                product: 'planted.chicken',
                isVegan: true,
            },
            {
                name: 'Golden Curry Bowl with Planted Chicken',
                description: 'Jasmine rice, planted chicken, red cabbage, pomegranate, chickpeas with cinnamon, creamy korma sauce',
                price: '€14.50',
                product: 'planted.chicken',
                isVegan: true,
            },
            {
                name: 'Planted Chicken Caesar Salad',
                description: 'Grilled planted chicken, romaine, sun-ripened tomatoes, Italian hard cheese, roasted croutons, Caesar dressing',
                price: '€12.90',
                product: 'planted.chicken',
                isVegan: false,
            },
            {
                name: 'Watermelon Feta Bowl with Planted Chicken',
                description: 'Planted chicken, feta, watermelon, cucumber, marinated onions, chickpeas, mint, lime dressing',
                price: '€14.90',
                product: 'planted.chicken',
                isVegan: false,
            },
        ],
        deliveryPlatforms: [
            {
                name: 'lieferando',
                url: 'https://www.lieferando.de/en/menu/dean-david-muenchen-leopoldstrasse',
                displayName: 'Lieferando',
            },
        ],
        rating: 4.4,
    },
    {
        id: 'hans-im-glueck-munich',
        name: 'Hans im Glück',
        country: 'de',
        city: 'Munich',
        cuisine: 'Burgers',
        dishes: [
            {
                name: 'The Better Bagel with Planted Pastrami',
                description: '100% vegan bagel filled with planted pastrami, pickles, mustard, fresh greens',
                price: '€12.90',
                product: 'planted.pulled',
                isVegan: true,
            },
            {
                name: 'Planted Burger Deluxe',
                description: 'Plant-based patty with cheese, tomato, lettuce, special sauce on pretzel bun',
                price: '€14.50',
                product: 'planted.burger',
                isVegan: false,
            },
        ],
        deliveryPlatforms: [
            {
                name: 'lieferando',
                url: 'https://www.lieferando.de/en/hans-im-glueck-munich',
                displayName: 'Lieferando',
            },
            {
                name: 'uber-eats',
                url: 'https://www.ubereats.com/de-en/store/hans-im-gluck-munchen-isartor/SfFAe9YwRUGI3I89RP--Aw',
                displayName: 'Uber Eats',
            },
        ],
        rating: 4.2,
    },
    {
        id: 'subway-germany',
        name: 'Subway',
        country: 'de',
        city: 'Nationwide',
        cuisine: 'Sandwiches',
        dishes: [
            {
                name: 'Plant-based Chicken Teriyaki Sub',
                description: 'Vegan soy strips in spicy teriyaki marinade with fresh vegetables on your choice of bread',
                price: '€7.49',
                product: 'planted.chicken',
                isVegan: true,
            },
            {
                name: 'Plant-based Teriyaki Salad',
                description: 'Teriyaki planted chicken on fresh salad greens with your choice of dressing',
                price: '€8.99',
                product: 'planted.chicken',
                isVegan: true,
            },
        ],
        deliveryPlatforms: [
            {
                name: 'lieferando',
                url: 'https://www.lieferando.de/subway',
                displayName: 'Lieferando',
            },
            {
                name: 'uber-eats',
                url: 'https://www.ubereats.com/de-en/brand-city/berlin-be/subway',
                displayName: 'Uber Eats',
            },
        ],
        rating: 4.0,
    },

    // ============================================
    // SWITZERLAND
    // ============================================
    {
        id: 'hiltl-zurich',
        name: 'Hiltl',
        country: 'ch',
        city: 'Zurich',
        cuisine: 'Vegetarian / World Cuisine',
        dishes: [
            {
                name: 'Planted Protein Power Bowl',
                description: 'Planted chicken with quinoa, avocado, edamame, roasted vegetables, and tahini dressing',
                price: 'CHF 24.50',
                product: 'planted.chicken',
                isVegan: true,
            },
            {
                name: 'Hiltl Burger with Planted Patty',
                description: 'Plant-based patty on house brioche with caramelized onions, pickles, special sauce',
                price: 'CHF 22.00',
                product: 'planted.burger',
                isVegan: false,
            },
            {
                name: 'Green Thai Curry with Planted Chicken',
                description: 'Aromatic Thai green curry with planted chicken, vegetables, and jasmine rice',
                price: 'CHF 26.00',
                product: 'planted.chicken',
                isVegan: true,
            },
            {
                name: 'Planted Chicken Tikka Masala',
                description: 'Creamy tikka masala with planted chicken, basmati rice, and naan bread',
                price: 'CHF 25.50',
                product: 'planted.chicken',
                isVegan: true,
            },
        ],
        deliveryPlatforms: [
            {
                name: 'uber-eats',
                url: 'https://www.ubereats.com/ch-de/store/hiltl/1mD1LSc4WJKCJBQr5CoxCg',
                displayName: 'Uber Eats',
            },
        ],
        rating: 4.6,
    },

    // ============================================
    // UK
    // ============================================
    {
        id: 'wagamama-uk',
        name: 'Wagamama',
        country: 'uk',
        city: 'Nationwide',
        cuisine: 'Asian Fusion',
        dishes: [
            {
                name: 'Vegan Katsu Curry',
                description: 'Crispy plant-based katsu with sticky rice, pickled vegetables, and katsu curry sauce',
                price: '£13.75',
                product: 'planted.schnitzel',
                isVegan: true,
            },
            {
                name: 'Vegan Firecracker',
                description: 'Spicy stir-fried noodles with plant-based chicken, chili, vegetables, and peanuts',
                price: '£12.95',
                product: 'planted.chicken',
                isVegan: true,
            },
            {
                name: 'Yasai Pad Thai',
                description: 'Rice noodles with tofu, beansprouts, spring onion, and tamarind-lime dressing',
                price: '£12.50',
                product: 'planted.chicken',
                isVegan: true,
            },
        ],
        deliveryPlatforms: [
            {
                name: 'deliveroo',
                url: 'https://deliveroo.co.uk/brands/wagamama',
                displayName: 'Deliveroo',
            },
            {
                name: 'uber-eats',
                url: 'https://www.ubereats.com/gb/brand/wagamama',
                displayName: 'Uber Eats',
            },
            {
                name: 'just-eat',
                url: 'https://www.just-eat.co.uk/takeaway/brands/wagamama',
                displayName: 'Just Eat',
            },
        ],
        rating: 4.3,
    },
];

// Helper functions
export function getRestaurantsByCountry(country: DeliveryRestaurant['country']): DeliveryRestaurant[] {
    return deliveryRestaurants.filter(r => r.country === country);
}

export function getRestaurantsByCity(city: string): DeliveryRestaurant[] {
    return deliveryRestaurants.filter(r =>
        r.city.toLowerCase() === city.toLowerCase() ||
        r.city === 'Nationwide'
    );
}

// Map country codes to delivery platforms commonly used
export const countryPlatforms: Record<string, string[]> = {
    'de': ['Wolt', 'Lieferando', 'Uber Eats'],
    'at': ['Wolt', 'Lieferando', 'Uber Eats'],
    'ch': ['Uber Eats', 'Just Eat'],
    'uk': ['Deliveroo', 'Uber Eats', 'Just Eat'],
    'nl': ['Thuisbezorgd', 'Uber Eats'],
    'fr': ['Uber Eats', 'Deliveroo'],
    'it': ['Glovo', 'Uber Eats', 'Deliveroo'],
    'es': ['Glovo', 'Uber Eats', 'Just Eat'],
};

// Platform colors for styling
export const platformColors: Record<string, string> = {
    'wolt': '#00C2E8',
    'lieferando': '#FF8000',
    'uber-eats': '#06C167',
    'deliveroo': '#00CCBC',
    'just-eat': '#FF5A00',
    'own': '#333333',
};
