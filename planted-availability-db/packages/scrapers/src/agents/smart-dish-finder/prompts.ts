/**
 * Claude Prompts for Smart Dish Finder
 *
 * Structured prompts for dish extraction, product matching, and learning.
 */

// =============================================================================
// SYSTEM PROMPT
// =============================================================================

export const DISH_FINDER_SYSTEM_PROMPT = `You are an expert at extracting menu item data from food delivery platform pages.

CRITICAL DISTINCTION - "Planted" is a BRAND NAME:
- "Planted" is a Swiss company that makes plant-based meat alternatives
- Look for "planted" (with lowercase), "Planted", "planted.chicken", etc.
- Do NOT include dishes that just say "plant-based", "vegan", "Beyond Meat", etc.
- Only include dishes where the Planted brand is explicitly mentioned

Your job is to:
1. Extract dishes that contain Planted products from delivery platform pages
2. Identify which specific Planted product is used
3. Extract accurate prices with currency
4. Determine dietary information

Available Planted products:
- planted.chicken - default chicken pieces/strips
- planted.chicken_tenders - breaded chicken tenders
- planted.chicken_burger - chicken burger patty
- planted.kebab - döner/kebab style meat
- planted.schnitzel - breaded schnitzel cutlet
- planted.pulled - pulled pork style shreds
- planted.burger - beef-style burger patty
- planted.steak - steak cuts
- planted.pastrami - pastrami-style slices
- planted.duck - duck alternative

Always respond with valid JSON. Be precise and accurate.`;

// =============================================================================
// DISH EXTRACTION PROMPT
// =============================================================================

export const DISH_EXTRACTION_PROMPT = `Extract ALL dishes from this delivery platform page that contain Planted products.

Context:
- Platform: {platform}
- Country: {country}
- Venue: {venue_name}
- Known Planted products at this venue (if any): {known_products}

Page content:
{page_content}

Instructions:
1. Search the entire page for mentions of "planted" (the brand)
2. For EACH dish that mentions Planted:
   - Extract the EXACT dish name as shown on the platform
   - Extract the full description if available
   - Extract the category (e.g., "Salads", "Bowls", "Burgers")
   - Extract the EXACT price with currency (e.g., "12.90", "EUR" or "18.50", "CHF")
   - Extract the image URL if visible
   - Identify which Planted product it uses
   - Determine if it's fully vegan (no dairy, eggs, or honey)
   - Note any dietary tags (gluten-free, etc.)

CRITICAL RULES:
- Only include dishes where "Planted" or "planted" (the brand) explicitly appears
- Do NOT include dishes that say "plant-based", "vegan chicken", "Beyond" etc. without mentioning Planted
- Extract prices EXACTLY as shown (e.g., "€12.90" → price: "12.90", currency: "EUR")
- If a dish has multiple sizes, extract the base/regular price

Return JSON:
{
  "dishes": [
    {
      "name": "Tuscany Chicken Salad",
      "description": "Fresh mixed greens with planted.chicken, sun-dried tomatoes, mozzarella, and Italian herbs",
      "category": "Salads",
      "image_url": "https://...",
      "price": "12.90",
      "currency": "EUR",
      "planted_product_guess": "planted.chicken",
      "product_confidence": 95,
      "is_vegan": false,
      "dietary_tags": ["gluten-free"],
      "reasoning": "Description explicitly mentions 'planted.chicken'. Contains mozzarella so not vegan."
    }
  ],
  "page_quality": {
    "menu_found": true,
    "prices_visible": true,
    "descriptions_available": true,
    "images_available": true
  },
  "extraction_notes": "Found 3 dishes with Planted products in the Salads and Bowls sections."
}

If no Planted dishes are found, return:
{
  "dishes": [],
  "page_quality": { ... },
  "extraction_notes": "No Planted products found. Page shows vegan options but none specifically mention the Planted brand."
}

IMPORTANT: Return COMPLETE, valid JSON. Do not truncate or abbreviate the response.`;

// =============================================================================
// PRODUCT MATCHING PROMPT
// =============================================================================

export const PRODUCT_MATCHING_PROMPT = `Identify which Planted product is used in this dish.

Dish name: {dish_name}
Description: {description}
Known products at this venue: {venue_products}

Planted product SKUs and descriptions:
- planted.chicken - Default chicken pieces/strips, most common product
- planted.chicken_tenders - Breaded chicken tenders, crispy coating
- planted.chicken_burger - Chicken-style burger patty
- planted.kebab - Döner/kebab meat, sliced or in pieces
- planted.schnitzel - Breaded schnitzel cutlet, flat
- planted.pulled - Pulled pork style, shredded texture
- planted.burger - Beef-style burger patty
- planted.steak - Steak cuts, usually grilled
- planted.pastrami - Pastrami-style deli slices
- planted.duck - Duck alternative, rare

Matching hints:
- "Chicken" without further specification → planted.chicken
- "Tender", "tenders", "strips" (breaded) → planted.chicken_tenders
- "Döner", "kebab", "kebap" → planted.kebab
- "Schnitzel", "wiener" → planted.schnitzel
- "Pulled", "shredded" → planted.pulled
- "Burger patty" (beef-like) → planted.burger
- "Steak" → planted.steak
- Words like "salad", "bowl", "wrap" with chicken → planted.chicken

Return JSON:
{
  "product": "planted.chicken",
  "confidence": 90,
  "reasoning": "Dish name contains 'Chicken' and description mentions 'chicken pieces', which matches planted.chicken"
}`;

// =============================================================================
// CONFIDENCE SCORING PROMPT
// =============================================================================

export const CONFIDENCE_SCORING_PROMPT = `Score the confidence level for this extracted dish.

Dish data:
- Name: {dish_name}
- Description: {description}
- Price: {price} {currency}
- Extracted product: {product}
- Source URL: {url}
- Extraction method: {method}

Consider these factors:
1. Name clarity: Does the dish name explicitly mention "planted"?
2. Description evidence: Is there clear evidence of Planted products in description?
3. Price validity: Is the price realistic for the dish type?
4. Source reliability: Is this from a major delivery platform?
5. Product match: How confident are we in the product identification?

Score each factor 0-100 and provide overall score.

Return JSON:
{
  "overall_score": 85,
  "factors": [
    {
      "factor": "name_clarity",
      "score": 90,
      "reason": "Dish name explicitly contains 'planted.chicken'"
    },
    {
      "factor": "description_evidence",
      "score": 80,
      "reason": "Description mentions plant-based chicken from Planted"
    },
    {
      "factor": "price_validity",
      "score": 95,
      "reason": "€12.90 is reasonable for a salad with protein"
    },
    {
      "factor": "source_reliability",
      "score": 90,
      "reason": "Uber Eats is a major platform with accurate data"
    },
    {
      "factor": "product_match",
      "score": 85,
      "reason": "Chicken in salad typically uses planted.chicken pieces"
    }
  ],
  "recommendation": "accept"
}`;

// =============================================================================
// LEARNING PROMPT
// =============================================================================

export const DISH_LEARNING_PROMPT = `Analyze this feedback data and suggest improvements for dish extraction.

Recent feedback data (last {days} days):
{feedback_data}

Current extraction strategies:
{strategies}

Analyze:
1. What extraction patterns are working well?
2. What are common errors or misidentifications?
3. Which platforms have the best/worst extraction rates?
4. Are there specific chains with unique patterns?
5. What new extraction patterns should we try?

Provide specific, actionable recommendations.

Return JSON:
{
  "strategy_updates": [
    {
      "strategy_id": "str_123",
      "action": "deprecate",
      "reason": "Only 15% success rate on Wolt, selectors outdated"
    },
    {
      "strategy_id": "str_456",
      "action": "boost",
      "reason": "92% accuracy on Uber Eats JSON extraction"
    }
  ],
  "new_strategies": [
    {
      "platform": "lieferando",
      "extraction_config": {
        "json_menu_path": "__INITIAL_STATE__.menu.items"
      },
      "tags": ["high-precision"],
      "reasoning": "Lieferando now uses __INITIAL_STATE__ for menu data"
    }
  ],
  "insights": [
    {
      "type": "extraction_pattern",
      "description": "dean&david menus always list 'planted.chicken' in item names, not descriptions",
      "confidence": 85
    },
    {
      "type": "platform_change",
      "description": "Wolt updated their HTML structure, new selectors needed",
      "confidence": 90
    }
  ]
}`;

// =============================================================================
// JSON EXTRACTION PROMPT
// =============================================================================

export const JSON_MENU_EXTRACTION_PROMPT = `Extract dish information from this JSON menu data.

Platform: {platform}
Venue: {venue_name}
Country: {country}

JSON data:
{json_data}

Find ALL menu items that contain Planted products and extract:
1. Dish name
2. Description
3. Price (with currency)
4. Category
5. Image URL

Only include items where "planted" (the brand) appears in the name or description.

Return the same JSON format as the HTML extraction prompt.`;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Fill a prompt template with variables
 */
export function fillPromptTemplate(
  template: string,
  variables: Record<string, string | number | undefined>
): string {
  let result = template;

  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{${key}}`;
    result = result.replace(new RegExp(placeholder, 'g'), String(value ?? ''));
  }

  return result;
}

/**
 * Truncate content to fit within token limits
 * Rough estimate: 4 chars = 1 token
 */
export function truncateContent(content: string, maxTokens: number = 6000): string {
  const maxChars = maxTokens * 4;

  if (content.length <= maxChars) {
    return content;
  }

  // Keep first and last portions for context
  const halfMax = Math.floor(maxChars / 2);
  const firstPart = content.slice(0, halfMax);
  const lastPart = content.slice(-halfMax);

  return `${firstPart}\n\n[... content truncated ...]\n\n${lastPart}`;
}

/**
 * Clean HTML for extraction (remove scripts, styles, etc.)
 */
export function cleanHtmlForExtraction(html: string): string {
  // Remove script tags and content
  let cleaned = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove style tags and content
  cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // Remove HTML comments
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');

  // Remove SVG content (usually icons, not needed for extraction)
  cleaned = cleaned.replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '');

  // Collapse whitespace
  cleaned = cleaned.replace(/\s+/g, ' ');

  return cleaned.trim();
}
