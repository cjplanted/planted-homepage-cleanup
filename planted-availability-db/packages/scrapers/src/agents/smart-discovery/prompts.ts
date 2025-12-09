/**
 * Claude Prompts for Smart Discovery Agent
 *
 * These prompts guide Claude's reasoning during the discovery process.
 * They are designed to be specific, structured, and produce consistent outputs.
 */

/**
 * System prompt that establishes Claude's role and constraints
 */
export const SYSTEM_PROMPT = `You are an expert at discovering restaurants that serve Planted products (a specific Swiss plant-based meat BRAND) through web searches on delivery platforms.

CRITICAL DISTINCTION - READ CAREFULLY:
- "Planted" is a BRAND NAME (Swiss company) - the exact word "planted" or "Planted" must appear
- "plant-based", "plant based", "vegan", "vegetarian" are NOT the same as "Planted"
- Generic plant-based products (Beyond Meat, Impossible, etc.) are NOT Planted products
- Only count a venue if you see the exact word "planted" (case-insensitive) in their menu

Your tasks:
1. Generate effective search queries to find restaurants serving Planted brand products
2. Parse and analyze search results - ONLY include venues with explicit "planted" mention
3. Determine if a restaurant is part of a chain
4. Extract structured data about venues and their Planted menu items
5. Learn from feedback to improve search strategies

Key Planted brand products to look for (must have "planted" in the name):
- planted.chicken / planted chicken
- planted.chicken_tenders / planted chicken tenders
- planted.chicken_burger / planted chicken burger
- planted.kebab / planted kebab
- planted.schnitzel / planted schnitzel
- planted.pulled / planted pulled
- planted.steak / planted steak
- planted.duck / planted duck
- planted.pastrami / planted pastrami

COMMON FALSE POSITIVES TO AVOID:
- "plant-based chicken" (NOT planted)
- "plant burger" (NOT planted)
- "vegan chicken" (NOT planted)
- Generic vegan/vegetarian options

Important platforms by country:
- Switzerland (CH): Just Eat (eat.ch), Uber Eats, Smood
- Germany (DE): Lieferando, Wolt, Uber Eats
- Austria (AT): Lieferando, Wolt, Uber Eats

Always output structured JSON responses as specified in the prompts.`;

/**
 * Generate search queries based on context
 */
export const GENERATE_QUERIES_PROMPT = `Given the following search context, generate effective search queries to discover restaurants serving Planted products.

Context:
- Platform: {platform}
- Country: {country}
- City: {city}
- Target product: {product}
- Previous queries that worked: {successful_queries}
- Previous queries that failed: {failed_queries}
- Known venues to avoid duplicates: {known_venues}

Generate 3-5 search queries, ordered by expected effectiveness.

IMPORTANT: Respond with ONLY a valid JSON object. Do not include any explanation, preamble, or text before or after the JSON. Start your response with { and end with }.

Output JSON format:
{
  "queries": [
    {
      "query": "site:lieferando.de planted.chicken Berlin",
      "reasoning": "Specific product name with city targeting",
      "expected_results": "venue_list",
      "confidence": 0.8
    }
  ]
}`;

/**
 * Parse search results to identify potential venues
 */
export const PARSE_RESULTS_PROMPT = `Analyze these search results and identify potential restaurants serving Planted brand products.

CRITICAL: "Planted" is a BRAND NAME. You must find the exact word "planted" (case-insensitive) in the menu or snippet.
- "plant-based" is NOT "planted"
- "plant chicken" is NOT "planted chicken"
- "vegan" is NOT "planted"
- ONLY include venues where you can see "planted" explicitly

Search query: {query}
Platform: {platform}

Results:
{results}

For each result that appears to be a restaurant on a delivery platform:
1. Extract the restaurant name
2. Extract the URL
3. Identify the city if mentioned
4. Look for EXPLICIT "planted" brand mentions in the snippet (not just plant-based!)
5. Assess if this might be part of a chain

IMPORTANT: Respond with ONLY a valid JSON object. Do not include any explanation, preamble, or text before or after the JSON. Start your response with { and end with }.

Output JSON format:
{
  "venues": [
    {
      "name": "Restaurant Name",
      "url": "https://...",
      "city": "Berlin",
      "planted_mentions": ["planted chicken", "planted.chicken"],
      "is_likely_chain": false,
      "chain_signals": [],
      "confidence": 0.85,
      "reasoning": "Direct match on planted.chicken in menu snippet"
    }
  ],
  "chains_detected": [
    {
      "name": "dean&david",
      "signals": ["Multiple locations in results", "Brand-style naming"],
      "cities_found": ["Berlin", "München"],
      "should_enumerate": true
    }
  ],
  "no_results_reason": null
}`;

/**
 * Analyze a venue page to confirm Planted products
 */
export const ANALYZE_VENUE_PROMPT = `Analyze this venue information and determine if they serve authentic Planted brand products.

CRITICAL DISTINCTION:
- "Planted" is a BRAND NAME (Swiss company) - look for the exact word "planted"
- "plant-based", "plant burger", "vegan chicken" are NOT Planted products
- The word "planted" (case-insensitive) MUST appear for it to be a Planted product

Venue: {venue_name}
URL: {url}
Platform: {platform}

Page content/menu:
{content}

Determine:
1. Does this restaurant EXPLICITLY mention "Planted" brand products (not just generic plant-based)?
2. Which specific Planted products do they offer? (Only if "planted" appears)
3. What dishes contain Planted products?
4. Is this a chain restaurant?

VALID indicators (must contain "planted"):
- "planted.chicken" or "planted chicken"
- "planted burger", "planted kebab", "planted schnitzel"
- "by planted" or "with planted"
- "Planted®" or "Planted Foods"

INVALID (these are NOT Planted brand):
- "plant-based chicken"
- "plant burger"
- "vegan chicken"
- "vegetarian option"

IMPORTANT: Respond with ONLY a valid JSON object. Do not include any explanation, preamble, or text before or after the JSON. Start your response with { and end with }.

Output JSON format:
{
  "serves_planted": true,
  "confidence": 0.9,
  "reasoning": "Menu explicitly lists 'planted.chicken' in multiple dishes",
  "planted_products": ["planted.chicken"],
  "dishes": [
    {
      "name": "Planted Chicken Burger",
      "description": "Crispy planted.chicken with...",
      "price": "€12.90",
      "planted_product": "planted.chicken",
      "is_vegan": true,
      "confidence": 0.95
    }
  ],
  "is_chain": false,
  "chain_signals": [],
  "chain_name": null,
  "address": {
    "street": "Hauptstraße 1",
    "city": "Berlin",
    "postal_code": "10115",
    "country": "DE"
  }
}`;

/**
 * Detect if a restaurant is part of a chain
 */
export const DETECT_CHAIN_PROMPT = `Analyze this restaurant and determine if it's part of a chain with multiple locations.

Restaurant name: {name}
Platform: {platform}
Search results for this name:
{search_results}

Chain indicators to look for:
1. Same name appearing in multiple cities
2. Store locator or "Standorte" page exists
3. Franchise terminology
4. Standardized naming pattern (e.g., "Name City", "Name Neighborhood")
5. Brand-style naming (e.g., "dean&david", "Birdie Birdie")

IMPORTANT: Respond with ONLY a valid JSON object. Do not include any explanation, preamble, or text before or after the JSON. Start your response with { and end with }.

Output JSON format:
{
  "is_chain": true,
  "confidence": 0.9,
  "signals": [
    "Same name found in 3+ cities",
    "Store locator page exists at website"
  ],
  "estimated_locations": 15,
  "cities_found": ["Berlin", "München", "Hamburg"],
  "countries": ["DE"],
  "store_locator_url": "https://...",
  "enumeration_queries": [
    "site:lieferando.de \\"dean&david\\"",
    "\\"dean&david\\" standorte deutschland"
  ]
}`;

/**
 * Learn from feedback and suggest strategy improvements
 */
export const LEARN_FROM_FEEDBACK_PROMPT = `Analyze this feedback data and suggest improvements to our search strategies.

Recent feedback (last 7 days):
{feedback_data}

Current strategies and their performance:
{strategies}

Analyze:
1. Which query patterns are most successful?
2. Which patterns lead to false positives?
3. What new patterns should we try?
4. Which strategies should be deprecated?

IMPORTANT: Respond with ONLY a valid JSON object. Do not include any explanation, preamble, or text before or after the JSON. Start your response with { and end with }.

Output JSON format:
{
  "insights": [
    {
      "type": "pattern_success",
      "description": "Queries with 'planted.chicken' (with dot) have 30% higher precision than 'planted chicken'",
      "confidence": 0.85
    }
  ],
  "strategy_updates": [
    {
      "strategy_id": "abc123",
      "action": "boost",
      "reason": "High success rate (85%) over 20+ uses"
    },
    {
      "strategy_id": "def456",
      "action": "deprecate",
      "reason": "Only 15% success rate, consistently returns false positives"
    }
  ],
  "new_strategies": [
    {
      "query_template": "site:{platform} \\"planted.chicken\\" {city} vegan",
      "platform": "lieferando",
      "country": "DE",
      "reasoning": "Adding 'vegan' keyword improves precision based on successful queries",
      "expected_improvement": "20% better precision"
    }
  ]
}`;

/**
 * Score confidence in a discovered venue
 */
export const CONFIDENCE_SCORING_PROMPT = `Calculate a confidence score for this discovered venue.

Venue data:
{venue_data}

Discovery context:
- Query used: {query}
- Strategy success rate: {strategy_success_rate}
- Previous verifications: {verification_history}

Score the following factors (0-100 each):
1. Name match quality (how clearly does it mention Planted?)
2. URL reliability (is this a direct platform link?)
3. Menu evidence (how clear are the Planted product references?)
4. Address completeness
5. Chain association (if part of known chain, higher confidence)

IMPORTANT: Respond with ONLY a valid JSON object. Do not include any explanation, preamble, or text before or after the JSON. Start your response with { and end with }.

{
  "overall_score": 78,
  "factors": [
    {
      "factor": "name_match",
      "score": 85,
      "reason": "Menu explicitly mentions 'planted.chicken'"
    },
    {
      "factor": "url_reliability",
      "score": 90,
      "reason": "Direct Lieferando menu page"
    },
    {
      "factor": "menu_evidence",
      "score": 75,
      "reason": "2 dishes found with Planted products"
    },
    {
      "factor": "address_completeness",
      "score": 60,
      "reason": "Only city known, no street address"
    },
    {
      "factor": "chain_association",
      "score": 80,
      "reason": "Part of known chain 'dean&david'"
    }
  ],
  "recommendation": "verify",
  "verification_priority": "medium"
}`;

/**
 * Helper to fill in prompt templates
 */
export function fillPromptTemplate(
  template: string,
  variables: Record<string, string | string[] | number | object>
): string {
  let filled = template;

  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{${key}}`;
    let replacement: string;

    if (Array.isArray(value)) {
      replacement = value.join(', ');
    } else if (typeof value === 'object') {
      replacement = JSON.stringify(value, null, 2);
    } else {
      replacement = String(value);
    }

    filled = filled.replace(new RegExp(placeholder, 'g'), replacement);
  }

  return filled;
}
