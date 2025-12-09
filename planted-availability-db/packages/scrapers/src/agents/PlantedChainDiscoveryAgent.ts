/**
 * Planted Chain Discovery Agent
 *
 * An intelligent agent that uses web search with reasoning to:
 * 1. Find Planted restaurant partners on delivery platforms
 * 2. Identify if a restaurant is part of a chain
 * 3. Enumerate all locations of discovered chains
 * 4. Extract delivery platform availability for each location
 *
 * Uses a tree-search approach:
 * - Level 1: Search for "planted chicken" on delivery platforms
 * - Level 2: For each result, check if it's a chain (multiple locations)
 * - Level 3: For chains, search for all locations on each delivery platform
 */

export interface ChainLocation {
  name: string;
  address: string;
  city: string;
  country: string;
  postalCode?: string;
  lat?: number;
  lng?: number;
  deliveryPlatforms: DeliveryPlatformInfo[];
  plantedDishes: PlantedDish[];
  verified: boolean;
  verifiedAt?: string;
}

export interface DeliveryPlatformInfo {
  platform: 'uber_eats' | 'wolt' | 'lieferando' | 'deliveroo' | 'just_eat' | 'smood';
  url: string;
  rating?: number;
  reviewCount?: number;
}

export interface PlantedDish {
  name: string;
  description?: string;
  price?: string;
  currency?: string;
  plantedProduct: string; // e.g., "planted.chicken", "planted.kebab"
}

export interface DiscoveredChain {
  name: string;
  type: 'chain' | 'single_location';
  totalLocations: number;
  countries: string[];
  cities: string[];
  plantedProducts: string[];
  locations: ChainLocation[];
  website?: string;
  storeLocatorUrl?: string;
  notes?: string;
}

export interface SearchTask {
  type: 'initial_search' | 'chain_enumeration' | 'location_verification';
  query: string;
  platform?: string;
  chainName?: string;
  priority: number;
  depth: number;
}

export interface AgentConfig {
  maxDepth: number;
  maxTasksPerLevel: number;
  platforms: string[];
  countries: string[];
  searchPatterns: string[];
}

/**
 * Search patterns optimized for finding Planted restaurants on delivery platforms
 */
export const SEARCH_PATTERNS = {
  // Initial discovery patterns
  initial: [
    '"{platform}" "planted" chicken restaurant',
    '"{platform}" "planted.chicken" menu',
    '"{platform}" planted kebab vegan',
    '"{platform}" planted burger delivery',
  ],

  // Chain enumeration patterns - find all locations
  chainLocations: [
    '"{chainName}" locations {country}',
    '"{chainName}" all restaurants {country}',
    '"{chainName}" {platform} {city}',
    '"{chainName}" store locator',
  ],

  // Platform-specific patterns
  platformSpecific: {
    uber_eats: [
      'site:ubereats.com "{chainName}"',
      'ubereats.com/store/{chainName}',
    ],
    wolt: [
      'site:wolt.com "{chainName}"',
      'wolt.com/restaurant/{chainName}',
    ],
    lieferando: [
      'site:lieferando.de "{chainName}"',
      'lieferando.de/speisekarte/{chainName}',
    ],
    just_eat: [
      'site:just-eat.ch "{chainName}"',
      'site:just-eat.co.uk "{chainName}"',
    ],
  },
};

/**
 * Delivery platform configurations
 */
export const PLATFORM_CONFIGS = {
  uber_eats: {
    name: 'Uber Eats',
    domains: ['ubereats.com'],
    menuUrlPattern: /ubereats\.com\/.*\/store\/([^\/]+)/,
    countries: ['CH', 'DE', 'AT', 'UK', 'FR', 'IT'],
  },
  wolt: {
    name: 'Wolt',
    domains: ['wolt.com'],
    menuUrlPattern: /wolt\.com\/.*\/restaurant\/([^\/]+)/,
    countries: ['DE', 'AT'],
  },
  lieferando: {
    name: 'Lieferando',
    domains: ['lieferando.de', 'lieferando.at'],
    menuUrlPattern: /lieferando\.(de|at)\/speisekarte\/([^\/]+)/,
    countries: ['DE', 'AT'],
  },
  just_eat: {
    name: 'Just Eat',
    domains: ['just-eat.ch', 'just-eat.co.uk'],
    menuUrlPattern: /just-eat\.(ch|co\.uk)\/.*\/([^\/]+)/,
    countries: ['CH', 'UK'],
  },
  deliveroo: {
    name: 'Deliveroo',
    domains: ['deliveroo.co.uk', 'deliveroo.fr'],
    menuUrlPattern: /deliveroo\.(co\.uk|fr)\/menu\/.*\/([^\/]+)/,
    countries: ['UK', 'FR'],
  },
  smood: {
    name: 'Smood',
    domains: ['smood.ch'],
    menuUrlPattern: /smood\.ch\/.*\/([^\/]+)/,
    countries: ['CH'],
  },
};

/**
 * Known chains to enumerate (from previous discovery)
 */
export const KNOWN_CHAINS: Partial<DiscoveredChain>[] = [
  {
    name: 'dean&david',
    type: 'chain',
    countries: ['DE', 'AT', 'CH'],
    plantedProducts: ['planted.chicken'],
    website: 'https://deananddavid.com',
    storeLocatorUrl: 'https://deananddavid.com/en/locations/',
  },
  {
    name: 'Birdie Birdie Chicken',
    type: 'chain',
    countries: ['DE'],
    plantedProducts: ['planted.chicken'],
  },
  {
    name: 'doen doen planted kebap',
    type: 'chain',
    countries: ['DE'],
    plantedProducts: ['planted.kebab'],
  },
  {
    name: 'Cotidiano',
    type: 'chain',
    countries: ['DE'],
    plantedProducts: ['planted.chicken'],
  },
  {
    name: 'råbowls',
    type: 'chain',
    countries: ['DE'],
    plantedProducts: ['planted.chicken', 'planted.duck', 'planted.pulled'],
  },
  {
    name: 'KAIMUG',
    type: 'chain',
    countries: ['CH', 'DE'],
    plantedProducts: ['planted.chicken'],
  },
  {
    name: 'Brezelkönig',
    type: 'chain',
    countries: ['CH'],
    plantedProducts: ['planted.chicken'],
  },
  {
    name: 'Hiltl',
    type: 'chain',
    countries: ['CH'],
    plantedProducts: ['planted.chicken', 'planted.kebab'],
  },
  {
    name: 'tibits',
    type: 'chain',
    countries: ['CH', 'DE'],
    plantedProducts: ['planted.chicken'],
  },
  {
    name: 'Yardbird',
    type: 'chain',
    countries: ['CH'],
    plantedProducts: ['planted.chicken'],
  },
  {
    name: 'Nooch Asian Kitchen',
    type: 'chain',
    countries: ['CH'],
    plantedProducts: ['planted.chicken'],
  },
  {
    name: 'Hans im Glück',
    type: 'chain',
    countries: ['DE', 'AT'],
    plantedProducts: ['planted.pastrami'],
  },
  {
    name: 'Vapiano',
    type: 'chain',
    countries: ['DE', 'AT'],
    plantedProducts: ['planted.chicken'],
  },
  {
    name: 'Subway',
    type: 'chain',
    countries: ['CH'],
    plantedProducts: ['planted.chicken'],
  },
  {
    name: 'La Piadineria',
    type: 'chain',
    countries: ['IT'],
    plantedProducts: ['planted.chicken'],
    notes: '400+ locations in Italy',
  },
];

/**
 * Agent reasoning prompts for Claude
 * These help guide the search tree exploration
 */
export const REASONING_PROMPTS = {
  identifyChain: `
Analyze this search result and determine:
1. Is this a single restaurant or part of a chain?
2. If it's a chain, what is the chain name?
3. How many locations might this chain have?
4. What countries/cities does it operate in?
5. What Planted products do they serve?

Look for indicators like:
- Multiple location mentions
- "Locations", "Standorte", "Filialen" links
- Store locator pages
- Franchise information
- Multiple cities mentioned
`,

  generateSearchQueries: `
Based on the discovered chain "{chainName}", generate search queries to find all their locations.
Consider:
1. Their website's store locator (if available)
2. Each delivery platform they're on
3. Each country they operate in
4. Major cities in those countries

Return a list of specific search queries that will help enumerate all locations.
`,

  extractLocationData: `
From this delivery platform page, extract:
1. Restaurant name
2. Full address
3. City and postal code
4. Country
5. List of Planted dishes with prices
6. Rating and review count (if visible)
7. Delivery fee and minimum order (if visible)

Format as structured JSON.
`,

  verifyPlantedPartnership: `
Analyze this menu/page and determine:
1. Does this restaurant actually serve Planted products?
2. What specific Planted products do they serve? (planted.chicken, planted.kebab, etc.)
3. What dishes feature Planted products?
4. Are there prices visible?
5. Confidence level (high/medium/low)

Look for explicit mentions of:
- "Planted" or "planted."
- "Pea protein" / "Erbsenprotein"
- Swiss plant-based meat
`,
};

/**
 * Example output format for the agent
 */
export const EXAMPLE_OUTPUT: DiscoveredChain = {
  name: 'dean&david',
  type: 'chain',
  totalLocations: 87,
  countries: ['DE', 'AT', 'CH'],
  cities: ['Berlin', 'Munich', 'Vienna', 'Zurich', /* ... */],
  plantedProducts: ['planted.chicken'],
  website: 'https://deananddavid.com',
  storeLocatorUrl: 'https://deananddavid.com/en/locations/',
  locations: [
    {
      name: 'dean&david Berlin Potsdamer Platz',
      address: 'Potsdamer Platz 1',
      city: 'Berlin',
      country: 'DE',
      postalCode: '10785',
      verified: true,
      verifiedAt: '2025-12-08',
      deliveryPlatforms: [
        {
          platform: 'wolt',
          url: 'https://wolt.com/en/deu/berlin/restaurant/deandavid-potsdamer-platz',
          rating: 9.1,
          reviewCount: 245,
        },
        {
          platform: 'uber_eats',
          url: 'https://www.ubereats.com/de-en/store/dean&david-berlin-bulowstrasse/...',
          rating: 4.6,
          reviewCount: 512,
        },
      ],
      plantedDishes: [
        {
          name: 'Planted Tuscany Chicken Salad',
          description: 'Grilled planted.chicken with sun-dried tomatoes, arugula, parmesan',
          price: '14.90',
          currency: 'EUR',
          plantedProduct: 'planted.chicken',
        },
        {
          name: 'Caesar Salad with Planted Chicken',
          description: 'Classic caesar with planted.chicken strips',
          price: '13.90',
          currency: 'EUR',
          plantedProduct: 'planted.chicken',
        },
      ],
    },
    // ... more locations
  ],
  notes: 'Offers planted.chicken as swap option in most dishes at no extra charge',
};

/**
 * Main agent class - uses web search to discover and enumerate chains
 *
 * This is designed to be used with Claude's extended thinking:
 * 1. Agent receives a task (e.g., "Find all dean&david locations")
 * 2. Agent reasons about what searches to perform
 * 3. Agent executes searches and analyzes results
 * 4. Agent recursively explores promising leads
 * 5. Agent compiles final enumerated list
 */
export class PlantedChainDiscoveryAgent {
  private config: AgentConfig;
  private discoveredChains: Map<string, DiscoveredChain> = new Map();

  constructor(config?: Partial<AgentConfig>) {
    this.config = {
      maxDepth: config?.maxDepth ?? 3,
      maxTasksPerLevel: config?.maxTasksPerLevel ?? 10,
      platforms: config?.platforms ?? ['uber_eats', 'wolt', 'lieferando', 'just_eat'],
      countries: config?.countries ?? ['CH', 'DE', 'AT'],
      searchPatterns: config?.searchPatterns ?? SEARCH_PATTERNS.initial,
    };
  }

  /**
   * Generate initial search tasks
   */
  generateInitialTasks(): SearchTask[] {
    const tasks: SearchTask[] = [];

    for (const platform of this.config.platforms) {
      for (const pattern of this.config.searchPatterns) {
        tasks.push({
          type: 'initial_search',
          query: pattern.replace('{platform}', platform),
          platform,
          priority: 1,
          depth: 0,
        });
      }
    }

    return tasks;
  }

  /**
   * Generate chain enumeration tasks for a discovered chain
   */
  generateChainEnumerationTasks(chain: Partial<DiscoveredChain>): SearchTask[] {
    const tasks: SearchTask[] = [];
    const chainName = chain.name!;

    // Search each platform for this chain
    for (const platform of this.config.platforms) {
      const platformPatterns = SEARCH_PATTERNS.platformSpecific[platform as keyof typeof SEARCH_PATTERNS.platformSpecific] || [];

      for (const pattern of platformPatterns) {
        tasks.push({
          type: 'chain_enumeration',
          query: pattern.replace('{chainName}', chainName),
          platform,
          chainName,
          priority: 2,
          depth: 1,
        });
      }
    }

    // Search for chain locations in each country
    for (const country of chain.countries || this.config.countries) {
      for (const pattern of SEARCH_PATTERNS.chainLocations) {
        tasks.push({
          type: 'chain_enumeration',
          query: pattern
            .replace('{chainName}', chainName)
            .replace('{country}', country),
          chainName,
          priority: 2,
          depth: 1,
        });
      }
    }

    return tasks;
  }

  /**
   * Get the reasoning prompt for a specific task type
   */
  getReasoningPrompt(task: SearchTask): string {
    switch (task.type) {
      case 'initial_search':
        return REASONING_PROMPTS.identifyChain;
      case 'chain_enumeration':
        return REASONING_PROMPTS.extractLocationData;
      case 'location_verification':
        return REASONING_PROMPTS.verifyPlantedPartnership;
      default:
        return '';
    }
  }

  /**
   * Export discovered chains to JSON
   */
  exportToJson(): string {
    const output = {
      discoveredAt: new Date().toISOString(),
      totalChains: this.discoveredChains.size,
      totalLocations: Array.from(this.discoveredChains.values())
        .reduce((sum, chain) => sum + chain.locations.length, 0),
      chains: Array.from(this.discoveredChains.values()),
    };

    return JSON.stringify(output, null, 2);
  }

  /**
   * Get summary statistics
   */
  getStats(): {
    chainsDiscovered: number;
    locationsEnumerated: number;
    platformCoverage: Record<string, number>;
    countryCoverage: Record<string, number>;
  } {
    const platformCoverage: Record<string, number> = {};
    const countryCoverage: Record<string, number> = {};
    let totalLocations = 0;

    for (const chain of this.discoveredChains.values()) {
      totalLocations += chain.locations.length;

      for (const location of chain.locations) {
        // Count by country
        countryCoverage[location.country] = (countryCoverage[location.country] || 0) + 1;

        // Count by platform
        for (const platform of location.deliveryPlatforms) {
          platformCoverage[platform.platform] = (platformCoverage[platform.platform] || 0) + 1;
        }
      }
    }

    return {
      chainsDiscovered: this.discoveredChains.size,
      locationsEnumerated: totalLocations,
      platformCoverage,
      countryCoverage,
    };
  }
}

/**
 * CLI Usage Example:
 *
 * ```typescript
 * import { PlantedChainDiscoveryAgent, KNOWN_CHAINS } from './PlantedChainDiscoveryAgent';
 *
 * const agent = new PlantedChainDiscoveryAgent({
 *   platforms: ['uber_eats', 'wolt', 'lieferando'],
 *   countries: ['CH', 'DE', 'AT'],
 * });
 *
 * // Start with known chains
 * for (const chain of KNOWN_CHAINS) {
 *   const tasks = agent.generateChainEnumerationTasks(chain);
 *   console.log(`Generated ${tasks.length} tasks for ${chain.name}`);
 *
 *   // Execute tasks with web search...
 *   // Results would be processed and added to agent.discoveredChains
 * }
 *
 * // Export results
 * const json = agent.exportToJson();
 * fs.writeFileSync('discovered-chains.json', json);
 * ```
 */
