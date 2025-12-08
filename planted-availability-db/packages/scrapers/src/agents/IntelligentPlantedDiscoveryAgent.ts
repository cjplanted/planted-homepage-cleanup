/**
 * Intelligent Planted Discovery Agent
 *
 * An advanced agent that:
 * 1. Searches delivery platforms for "planted" menu items
 * 2. AUTOMATICALLY detects if a restaurant is a chain (multiple locations)
 * 3. Triggers chain enumeration when a chain is detected
 * 4. Compiles comprehensive location data
 *
 * Chain Detection Signals:
 * - Multiple search results with same brand name but different cities
 * - Store locator / Standorte links on website
 * - "X locations" or "X Filialen" mentions
 * - Franchise indicators
 * - Multiple delivery platform listings in different cities
 */

export interface DiscoveryResult {
  name: string;
  isChain: boolean;
  chainConfidence: 'high' | 'medium' | 'low';
  chainSignals: string[];
  estimatedLocations?: number;
  countries: string[];
  cities: string[];
  plantedProducts: string[];
  plantedDishes: PlantedDish[];
  deliveryPlatforms: string[];
  locations: LocationData[];
  website?: string;
  storeLocatorUrl?: string;
}

export interface LocationData {
  name: string;
  address?: string;
  city: string;
  country: string;
  postalCode?: string;
  deliveryUrls: DeliveryUrl[];
  verified: boolean;
}

export interface DeliveryUrl {
  platform: string;
  url: string;
  rating?: number;
}

export interface PlantedDish {
  name: string;
  price?: string;
  currency?: string;
  plantedProduct: string;
}

/**
 * Chain Detection Rules
 *
 * HIGH confidence chain signals:
 * - 3+ locations found on delivery platforms
 * - Store locator page exists
 * - Explicit "X locations" mention
 * - Franchise/chain terminology used
 *
 * MEDIUM confidence signals:
 * - 2 locations found
 * - Multiple cities mentioned
 * - Brand-style naming (e.g., "Birdie Birdie", "dean&david")
 *
 * LOW confidence (single location likely):
 * - Only 1 result found
 * - Unique/local restaurant name
 * - No multi-city presence
 */
export const CHAIN_DETECTION_RULES = {
  highConfidence: {
    minLocations: 3,
    signals: [
      'store locator',
      'standorte',
      'filialen',
      'locations',
      'franchise',
      'all restaurants',
      'find us',
      'in your area',
    ],
  },
  mediumConfidence: {
    minLocations: 2,
    signals: [
      'multiple cities',
      'brand naming pattern',
      'standardized menu',
    ],
  },
  chainNamePatterns: [
    // Repeated words (e.g., "Birdie Birdie")
    /^(\w+)\s+\1$/i,
    // Format with ampersand (e.g., "dean&david")
    /^\w+[&]\w+$/i,
    // All caps brand (e.g., "KAIMUG")
    /^[A-Z]{4,}$/,
    // Known chain suffixes
    /(grill|kitchen|burger|chicken|kebab|bowl|bar|cafe|coffee)$/i,
  ],
};

/**
 * Platform-specific search strategies
 */
export const PLATFORM_SEARCH_STRATEGIES = {
  // Initial discovery - find ALL planted restaurants
  initial: {
    queries: [
      '{platform} planted chicken',
      '{platform} planted.chicken menu',
      '{platform} planted kebab vegan',
      '{platform} planted burger',
      '{platform} planted schnitzel',
      '{platform} planted pulled',
    ],
    platforms: ['ubereats.com', 'wolt.com', 'lieferando.de', 'just-eat.ch', 'deliveroo.co.uk'],
  },

  // Chain enumeration - find ALL locations of a chain
  chainEnumeration: {
    queries: [
      '"{chainName}" {platform} all locations',
      '"{chainName}" {platform} {country}',
      '"{chainName}" store locator',
      '"{chainName}" standorte filialen',
      '"{chainName}" {city} delivery',
    ],
    // Major cities to check for each country
    cities: {
      DE: ['Berlin', 'München', 'Hamburg', 'Frankfurt', 'Köln', 'Stuttgart', 'Düsseldorf', 'Leipzig', 'Nürnberg'],
      CH: ['Zürich', 'Basel', 'Bern', 'Genf', 'Lausanne', 'Luzern', 'St. Gallen', 'Zug'],
      AT: ['Wien', 'Graz', 'Salzburg', 'Linz', 'Innsbruck'],
      UK: ['London', 'Manchester', 'Birmingham', 'Edinburgh', 'Glasgow', 'Bristol'],
      FR: ['Paris', 'Lyon', 'Marseille', 'Bordeaux', 'Nice'],
      IT: ['Milano', 'Roma', 'Torino', 'Firenze', 'Bologna'],
    },
  },
};

/**
 * Reasoning prompts for chain detection
 */
export const CHAIN_DETECTION_PROMPTS = {
  analyzeSearchResults: `
Analyze these search results for "{restaurantName}" and determine:

1. IS THIS A CHAIN?
   Look for these signals:
   - Multiple locations in search results (different cities/addresses)
   - Store locator or "Standorte" pages
   - "X locations" or "X Filialen" mentions
   - Results from multiple delivery platforms in different cities
   - Franchise or chain terminology
   - Standardized branding across results

2. CHAIN CONFIDENCE LEVEL:
   - HIGH: 3+ locations found OR store locator exists
   - MEDIUM: 2 locations found OR strong brand signals
   - LOW: Only 1 location, appears to be independent

3. ESTIMATED SCALE:
   - How many locations might this chain have?
   - What countries/cities are mentioned?

4. PLANTED PRODUCTS:
   - Which specific Planted products do they serve?
   - planted.chicken, planted.kebab, planted.schnitzel, planted.pulled, etc.

Return structured analysis with clear reasoning.
`,

  generateEnumerationPlan: `
Create a search plan to enumerate ALL locations of the chain "{chainName}".

Based on what we know:
- Countries: {countries}
- Delivery platforms: {platforms}
- Estimated locations: {estimatedLocations}

Generate specific search queries that will help find every location:
1. Platform-specific searches (site:ubereats.com "{chainName}")
2. Country/city combinations
3. Store locator page if available
4. Alternative spellings or brand variations

Return a prioritized list of search queries.
`,
};

/**
 * Example workflow execution
 */
export const EXAMPLE_WORKFLOW = `
=== INTELLIGENT PLANTED DISCOVERY WORKFLOW ===

STEP 1: Initial Platform Search
-------------------------------
Search: "wolt.com planted chicken Germany"
Results:
  - Birdie Birdie Chicken Hamburg
  - Birdie Birdie Chicken Berlin
  - dean&david München
  - doen doen planted kebap Stuttgart

STEP 2: Chain Detection Analysis
--------------------------------
For "Birdie Birdie Chicken":
  ✓ Signal: Same name in 2+ cities (Hamburg, Berlin)
  ✓ Signal: Repeated word pattern ("Birdie Birdie")
  ✓ Signal: Multiple Lieferando listings found
  → CHAIN DETECTED (HIGH confidence)
  → Trigger: Chain Enumeration Agent

For "doen doen planted kebap":
  ✓ Signal: Found in Stuttgart AND Berlin
  ✓ Signal: Brand-style naming
  → CHAIN DETECTED (HIGH confidence)
  → Trigger: Chain Enumeration Agent

STEP 3: Chain Enumeration (for Birdie Birdie)
---------------------------------------------
Search: "Birdie Birdie Chicken" all locations Germany
Search: site:lieferando.de "Birdie Birdie"
Search: "Birdie Birdie" Hamburg Berlin Köln München Frankfurt

Results: 12 locations found
  - Hamburg Barmbek
  - Hamburg Altona
  - Berlin Rudow
  - Berlin Kreuzberg
  - Köln Südbahnhof
  - Leipzig Gohlis
  - Augsburg
  - Oldenburg
  - Braunschweig
  - Viersen
  - Dortmund
  - Essen

STEP 4: Compile & Verify
------------------------
For each location:
  - Extract full address
  - Get delivery platform URLs
  - Verify Planted menu items
  - Record prices and dishes

STEP 5: Export Results
----------------------
{
  "name": "Birdie Birdie Chicken",
  "isChain": true,
  "totalLocations": 12,
  "countries": ["DE"],
  "plantedProducts": ["planted.chicken"],
  "locations": [...]
}
`;

/**
 * Main Agent Class
 */
export class IntelligentPlantedDiscoveryAgent {
  private discoveredRestaurants: Map<string, DiscoveryResult> = new Map();
  private chainQueue: string[] = [];
  private processedChains: Set<string> = new Set();

  /**
   * Analyze search results to detect chains
   */
  detectChain(restaurantName: string, searchResults: string[]): {
    isChain: boolean;
    confidence: 'high' | 'medium' | 'low';
    signals: string[];
    estimatedLocations: number;
  } {
    const signals: string[] = [];
    let locationCount = 0;
    const cities = new Set<string>();

    // Check for chain signals in results
    for (const result of searchResults) {
      const lower = result.toLowerCase();

      // Check for store locator signals
      for (const signal of CHAIN_DETECTION_RULES.highConfidence.signals) {
        if (lower.includes(signal)) {
          signals.push(`Found "${signal}" in results`);
        }
      }

      // Extract cities from results
      const cityMatches = result.match(/(?:Berlin|München|Hamburg|Frankfurt|Köln|Stuttgart|Wien|Zürich|Basel|Bern)/gi);
      if (cityMatches) {
        cityMatches.forEach(c => cities.add(c));
      }

      // Count location mentions
      if (lower.includes(restaurantName.toLowerCase())) {
        locationCount++;
      }
    }

    // Check name patterns
    for (const pattern of CHAIN_DETECTION_RULES.chainNamePatterns) {
      if (pattern.test(restaurantName)) {
        signals.push(`Name matches chain pattern: ${pattern}`);
      }
    }

    // Determine confidence
    let confidence: 'high' | 'medium' | 'low' = 'low';
    const isChain = signals.length > 0 || cities.size >= 2;

    if (cities.size >= 3 || signals.length >= 2) {
      confidence = 'high';
    } else if (cities.size >= 2 || signals.length >= 1) {
      confidence = 'medium';
    }

    return {
      isChain,
      confidence,
      signals,
      estimatedLocations: Math.max(cities.size, locationCount),
    };
  }

  /**
   * Generate enumeration queries for a detected chain
   */
  generateEnumerationQueries(
    chainName: string,
    countries: string[],
    platforms: string[]
  ): string[] {
    const queries: string[] = [];

    // Platform-specific site searches
    for (const platform of platforms) {
      queries.push(`site:${platform} "${chainName}"`);
    }

    // Country-specific searches
    for (const country of countries) {
      queries.push(`"${chainName}" all locations ${country}`);
      queries.push(`"${chainName}" Standorte ${country}`);

      // City searches
      const cities = PLATFORM_SEARCH_STRATEGIES.chainEnumeration.cities[country as keyof typeof PLATFORM_SEARCH_STRATEGIES.chainEnumeration.cities] || [];
      for (const city of cities.slice(0, 5)) { // Top 5 cities
        queries.push(`"${chainName}" ${city} delivery`);
      }
    }

    // Store locator search
    queries.push(`"${chainName}" store locator`);
    queries.push(`"${chainName}" find restaurant`);

    return queries;
  }

  /**
   * Add discovered chain to enumeration queue
   */
  queueChainForEnumeration(chainName: string): void {
    if (!this.processedChains.has(chainName) && !this.chainQueue.includes(chainName)) {
      this.chainQueue.push(chainName);
      console.log(`[CHAIN DETECTED] Queued "${chainName}" for enumeration`);
    }
  }

  /**
   * Process next chain in queue
   */
  getNextChainToProcess(): string | null {
    const next = this.chainQueue.shift();
    if (next) {
      this.processedChains.add(next);
    }
    return next || null;
  }

  /**
   * Export all discovered data
   */
  exportResults(): object {
    return {
      discoveredAt: new Date().toISOString(),
      totalRestaurants: this.discoveredRestaurants.size,
      chains: Array.from(this.discoveredRestaurants.values()).filter(r => r.isChain),
      singleLocations: Array.from(this.discoveredRestaurants.values()).filter(r => !r.isChain),
      statistics: this.getStatistics(),
    };
  }

  /**
   * Get discovery statistics
   */
  getStatistics(): object {
    const restaurants = Array.from(this.discoveredRestaurants.values());
    const totalLocations = restaurants.reduce((sum, r) => sum + r.locations.length, 0);

    const byCountry: Record<string, number> = {};
    const byPlatform: Record<string, number> = {};
    const byProduct: Record<string, number> = {};

    for (const r of restaurants) {
      for (const country of r.countries) {
        byCountry[country] = (byCountry[country] || 0) + r.locations.filter(l => l.country === country).length;
      }
      for (const platform of r.deliveryPlatforms) {
        byPlatform[platform] = (byPlatform[platform] || 0) + 1;
      }
      for (const product of r.plantedProducts) {
        byProduct[product] = (byProduct[product] || 0) + 1;
      }
    }

    return {
      totalRestaurants: restaurants.length,
      totalChains: restaurants.filter(r => r.isChain).length,
      totalLocations,
      byCountry,
      byPlatform,
      byProduct,
    };
  }
}
