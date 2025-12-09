# Planted Availability Database - Technical Documentation

## Overview

The Planted Availability Database (PAD) is a comprehensive system for managing and discovering locations where Planted products are available. It consists of two main components:

1. **planted-astro** - Public-facing website with store locator
2. **planted-availability-db** - Backend monorepo with database, API, scrapers, and admin dashboard

---

## Part 1: Website Architecture

### 1.1 Technology Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Framework | Astro | 5.16.3 |
| UI Library | React | 19.2.1 |
| Styling | styled-components | 6.1.19 |
| CMS | Sanity | 4.20.3 |
| Build | Static Site Generation | - |
| Deployment | GitHub Pages | - |

### 1.2 Project Structure

```
planted-astro/
├── src/
│   ├── pages/
│   │   └── [locale]/              # Multi-locale pages
│   │       ├── index.astro        # Homepage
│   │       ├── products/          # Product catalog
│   │       ├── recipes/           # Recipe content
│   │       ├── news.astro         # News/blog
│   │       ├── our-story.astro    # Company pages
│   │       └── ...
│   ├── components/
│   │   ├── StoreLocator.astro     # Main store finder
│   │   ├── NearbyStores.astro     # Location cards
│   │   ├── Navbar.astro           # Navigation
│   │   └── ...
│   ├── data/
│   │   ├── chainRestaurants.ts    # 200+ chain locations
│   │   ├── discoveredLocations.ts # Auto-generated venues
│   │   ├── deliveryRestaurants.ts # Delivery partners
│   │   └── padApi.ts              # PAD API client
│   ├── i18n/
│   │   └── config.ts              # Internationalization
│   └── layouts/
│       └── Layout.astro           # Main layout wrapper
├── public/
│   ├── images/                    # Static images
│   ├── fonts/                     # Custom fonts
│   └── video/                     # Hero video
└── astro.config.mjs               # Astro configuration
```

### 1.3 Internationalization (i18n)

The website supports 9 locales across 8 countries:

| Country | Locales | Languages |
|---------|---------|-----------|
| Switzerland | `ch-de`, `ch-fr`, `ch-it`, `ch-en` | German, French, Italian, English |
| Germany | `de`, `de-en` | German, English |
| Austria | `at`, `at-en` | German, English |
| Italy | `it`, `it-en` | Italian, English |
| France | `fr`, `fr-en` | French, English |
| Netherlands | `nl`, `nl-en` | Dutch, English |
| United Kingdom | `uk` | English |
| Spain | `es`, `es-en` | Spanish, English |

### 1.4 Store Locator

The store locator is the primary feature for finding Planted products.

**Data Flow:**
```
User enters ZIP code
       ↓
Geocode ZIP to coordinates (city lookup table)
       ↓
Calculate distances (Haversine formula)
       ↓
Filter by venue type (retail/restaurant/delivery)
       ↓
Display sorted results
```

**Data Sources:**
1. `chainRestaurants.ts` - 200+ manually curated chain locations
2. `discoveredLocations.ts` - Auto-generated from PAD discovery system
3. PAD API - Live venue data from Firestore

**Key Features:**
- Distance-based sorting
- Venue type filtering (retail, restaurant, delivery)
- Delivery platform links (Uber Eats, Wolt, Lieferando, etc.)
- Country-specific pricing display

---

## Part 2: Backend Architecture

### 2.1 Monorepo Structure

```
planted-availability-db/
├── packages/
│   ├── core/                      # Shared types & utilities
│   ├── database/                  # Firestore collections
│   ├── api/                       # Cloud Functions
│   ├── scrapers/                  # Discovery agents
│   ├── admin-dashboard/           # React admin UI
│   └── client-sdk/                # JavaScript SDK
├── firebase/
│   ├── functions/                 # Deployed functions
│   ├── firestore.rules            # Security rules
│   └── firestore.indexes.json     # Database indexes
├── turbo.json                     # Turbo build config
├── pnpm-workspace.yaml            # pnpm workspace
└── package.json                   # Root package
```

### 2.2 Package Details

#### @pad/core
Shared TypeScript types and utilities.

**Key Files:**
- `src/types/index.ts` - Base types (Venue, Dish, Product)
- `src/types/discovery.ts` - Discovery system types
- `src/types/dish-discovery.ts` - Dish extraction types

**Exported Types:**
```typescript
// Venue types
export type VenueType = 'retail' | 'restaurant' | 'delivery_kitchen';
export type VenueStatus = 'active' | 'stale' | 'archived';

// Discovery types
export type DiscoveredVenueStatus = 'discovered' | 'verified' | 'rejected' | 'promoted' | 'stale';

// Platform types
export type DeliveryPlatform = 'uber-eats' | 'lieferando' | 'wolt' | 'just-eat' | 'smood';
export type SupportedCountry = 'CH' | 'DE' | 'AT';

// Product SKUs
export const PLANTED_PRODUCT_SKUS = [
  'planted.chicken',
  'planted.chicken_tenders',
  'planted.kebab',
  'planted.schnitzel',
  'planted.pulled',
  'planted.burger',
  'planted.steak',
  'planted.pastrami',
  'planted.duck'
];
```

#### @pad/database
Firestore collection definitions and query utilities.

**Collections:**

| Collection | Purpose | Key Fields |
|------------|---------|------------|
| `venues` | Production venue data | name, type, address, delivery_platforms |
| `dishes` | Production dish data | venue_id, name, price, planted_products |
| `chains` | Restaurant chain metadata | name, locations_count |
| `promotions` | Active promotions | venue_id, discount, valid_until |
| `discovered_venues` | AI-discovered venues | confidence_score, status |
| `discovered_dishes` | AI-extracted dishes | product_confidence, prices |
| `discovery_strategies` | Search query patterns | success_rate, query_template |
| `discovery_runs` | Discovery execution logs | stats, strategies_used |
| `dish_extraction_strategies` | Menu extraction patterns | extraction_config |
| `dish_extraction_runs` | Extraction execution logs | dishes_extracted |
| `search_feedback` | Discovery feedback | result_type, venue_was_correct |
| `dish_feedback` | Extraction feedback | name_correct, price_correct |

**Key Files:**
- `src/collections/discovered-venues.ts` - Venue discovery queries
- `src/collections/discovered-dishes.ts` - Dish extraction queries
- `src/collections/discovery-strategies.ts` - Strategy management
- `src/collections/dish-feedback.ts` - Feedback collection

#### @pad/api
Firebase Cloud Functions for API endpoints.

**Public Endpoints:**
```
GET  /venues                    # List venues with filters
GET  /venues/:id                # Single venue details
GET  /nearby?lat=X&lng=Y&r=5km  # Nearby venue search
GET  /dishes?product=chicken    # Dish search
GET  /delivery?platform=wolt    # Delivery platform venues
```

**Admin Endpoints:**
```
GET  /admin/venues              # Admin venue list
POST /admin/venues              # Create venue
PUT  /admin/venues/:id          # Update venue
DELETE /admin/venues/:id        # Delete venue

GET  /admin/flagged             # Stale/flagged items
POST /admin/verify/:id          # Verify item
POST /admin/archive/:id         # Archive item
```

**Scheduled Functions:**
```
scheduledDiscovery     # Daily at 3 AM - Run discovery agent
weeklyVerification     # Sundays at 4 AM - Re-verify venues
```

#### @pad/scrapers
AI-powered discovery and extraction agents.

**Key Components:**

1. **SmartDiscoveryAgent**
   - Location: `src/agents/smart-discovery/SmartDiscoveryAgent.ts`
   - Purpose: Find new Planted restaurant partners via web search
   - Uses: Claude AI for reasoning, Google/SerpAPI for search

2. **SmartDishFinderAgent**
   - Location: `src/agents/smart-dish-finder/SmartDishFinderAgent.ts`
   - Purpose: Extract menu items from delivery platform pages
   - Uses: Claude AI for extraction, Puppeteer for page fetching

3. **Platform Adapters**
   - Location: `src/agents/smart-discovery/platforms/`
   - Purpose: Parse search results from each delivery platform
   - Implementations: UberEats, Lieferando, Wolt, JustEat, Smood

**CLI Tools:**
```bash
# Run venue discovery
pnpm run discovery --country DE --platform uber-eats

# Run dish extraction
pnpm run dish-finder --chains dean-david --mode enrich

# Interactive venue review
pnpm run review --batch 10 --country CH

# Interactive dish review
pnpm run review-dishes --batch 10 --chain dean-david
```

#### @pad/admin-dashboard
React-based admin interface.

**Technology Stack:**
| Component | Technology | Version |
|-----------|------------|---------|
| Framework | React | 18.3.1 |
| Routing | React Router | 7.0.1 |
| State | React Query | 5.60.0 |
| Build | Vite | 6.0.1 |
| Auth | Firebase Auth | - |

**Pages:**
- `/` - Dashboard (stats overview)
- `/venues` - Venue management (CRUD)
- `/dishes` - Dish management (CRUD)
- `/scrapers` - Scraper monitoring
- `/promotions` - Promotion management
- `/moderation` - Flagged item review
- `/partners` - Partner management

---

## Part 3: Discovery System

### 3.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Smart Discovery System                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐    ┌──────────────────┐               │
│  │ SmartDiscovery   │───▶│  SmartDishFinder │               │
│  │ Agent            │    │  Agent           │               │
│  └────────┬─────────┘    └────────┬─────────┘               │
│           │                       │                          │
│           ▼                       ▼                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                 Claude AI Integration                 │   │
│  │  • Query generation    • Menu extraction             │   │
│  │  • Result parsing      • Product matching            │   │
│  │  • Chain detection     • Confidence scoring          │   │
│  └──────────────────────────────────────────────────────┘   │
│                           │                                  │
│                           ▼                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                Firestore Database                     │   │
│  │  • discovery_strategies   • discovered_venues        │   │
│  │  • discovery_runs         • discovered_dishes        │   │
│  │  • search_feedback        • dish_feedback            │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Venue Discovery Workflow

```
1. Initialize Discovery Run
   └─ Create discovery_runs record with status: 'pending'

2. For each platform/country combination:
   ├─ Get active strategies (success_rate >= 30%)
   ├─ Execute strategy with city variable substitution
   │   └─ Query: "site:ubereats.com planted chicken {city}"
   ├─ Web Search (Google/SerpAPI)
   ├─ Claude parses results:
   │   └─ Extracts: URL, name, city, chain signals, Planted mentions
   ├─ Filter false positives:
   │   ├─ Brand misuse chains (e.g., Goldies)
   │   ├─ Duplicates (by delivery URL)
   │   └─ Already verified venues
   ├─ Calculate confidence score (0-100)
   ├─ Store in discovered_venues (status: 'discovered')
   └─ Record feedback for strategy learning

3. Update strategy metrics based on results

4. Complete run with stats
```

### 3.3 Dish Extraction Workflow

```
1. Initialize Extraction Run
   └─ Create dish_extraction_runs record

2. For each venue with delivery platform URLs:
   ├─ Fetch page content (Puppeteer)
   ├─ Claude extracts dish data:
   │   ├─ Dish name, description, category
   │   ├─ Price with currency
   │   ├─ Image URL
   │   └─ Planted product guess
   ├─ Match to Planted product SKU
   ├─ Calculate confidence score
   └─ Store in discovered_dishes

3. Update extraction strategy metrics

4. Complete run with stats
```

### 3.4 Confidence Scoring

**Venue Confidence Factors:**
| Factor | Weight | Description |
|--------|--------|-------------|
| Chain Detection | 30-40 | Multiple location indicators |
| Planted Mention | 20-30 | Explicit "Planted" vs generic |
| URL Pattern | 15-20 | Known platform URL structure |
| Strategy Quality | 10-15 | Parent strategy success rate |

**Dish Confidence Factors:**
| Factor | Weight | Description |
|--------|--------|-------------|
| Product Match | 40 | Exact product name match |
| Price Visibility | 20 | Price extracted successfully |
| Description Quality | 20 | Detailed description found |
| Known Chain | 20 | Venue from verified chain |

### 3.5 Reinforcement Learning

The system learns from human feedback:

1. **Strategy Performance Tracking**
   - Track success/failure of each search query
   - Update success_rate after each use
   - Deprecate strategies below 10% success

2. **Strategy Evolution**
   - AI analyzes patterns in successful queries
   - Generates new query variations
   - Creates "evolved" strategies from parents

3. **Feedback Collection**
   - `search_feedback` - Was the venue correct?
   - `dish_feedback` - Was the extraction accurate?

### 3.6 Search Engine Credential Pool

The system manages multiple Google Custom Search API credentials to maximize free-tier usage.

**Architecture:**
```
┌─────────────────────────────────────────────────────┐
│                SearchEnginePool                      │
├─────────────────────────────────────────────────────┤
│  Credentials: [cred_1, cred_2, ... cred_n]          │
│  Daily Limit: 100 queries/credential (free tier)    │
│  Quota Reset: Midnight UTC                          │
│  Storage: Firestore (search_engine_quota)           │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│           Credential Rotation Logic                  │
├─────────────────────────────────────────────────────┤
│  1. Get next credential with remaining quota        │
│  2. Execute query via Google Custom Search API      │
│  3. On success: increment usage counter             │
│  4. On 429 error: mark exhausted, rotate to next    │
│  5. If all exhausted: throw error                   │
└─────────────────────────────────────────────────────┘
```

**Scaling:**
- 1 credential = 100 queries/day free
- 20 credentials = 2,000 queries/day free
- 50 credentials = 5,000 queries/day free

**Configuration:**
```bash
# Option 1: JSON array (recommended)
GOOGLE_SEARCH_CREDENTIALS='[
  {"apiKey":"AIza...1","searchEngineId":"abc...1"},
  {"apiKey":"AIza...2","searchEngineId":"abc...2"}
]'

# Option 2: Numbered environment variables
GOOGLE_SEARCH_API_KEY_1=AIza...
GOOGLE_SEARCH_ENGINE_ID_1=abc...
GOOGLE_SEARCH_API_KEY_2=AIza...
GOOGLE_SEARCH_ENGINE_ID_2=abc...

# Option 3: Single credential (legacy)
GOOGLE_SEARCH_API_KEY=AIza...
GOOGLE_SEARCH_ENGINE_ID=abc...
```

**CLI Tools:**
```bash
pnpm run search-pool stats    # View pool statistics
pnpm run search-pool list     # Detailed per-credential usage
pnpm run search-pool test     # Test credential rotation
```

### 3.7 AI Provider Architecture

The system supports multiple AI providers with auto-detection:

**Smart Discovery (Reasoning & Query Generation):**
| Provider | Model | Use Case |
|----------|-------|----------|
| Gemini | gemini-2.5-flash | Default - fast, cost-effective |
| Claude | claude-sonnet-4 | Alternative - higher reasoning |

**Dish Extraction:**
| Provider | Model | Use Case |
|----------|-------|----------|
| Gemini | gemini-2.5-flash | Default - menu parsing (with 2.0-flash fallback) |

**Auto-Detection Priority:**
1. Check `GOOGLE_AI_API_KEY` or `GEMINI_API_KEY` → use Gemini
2. Check `ANTHROPIC_API_KEY` → use Claude
3. No keys → error

**Automatic Fallback:**
- If Gemini 2.5 Flash fails, automatically falls back to 2.0 Flash
- Maintains all settings during fallback

**Manual Selection:**
```bash
pnpm run discovery --ai gemini    # Force Gemini
pnpm run discovery --ai claude    # Force Claude
```

### 3.8 Query Deduplication Cache

The system prevents redundant API calls by caching executed queries:

**Location:** `QueryCache.ts`

**Cache Rules:**
- Skip if same query executed in last **24 hours** (had results)
- Skip if same query executed in last **7 days** (had 0 results)

**Query Normalization:**
```
"Planted Chicken Berlin" → "berlin chicken planted"
"  BERLIN   chicken  PLANTED  " → "berlin chicken planted"
```
All variations are treated as identical queries.

**Storage:** Firestore collection `query_cache`

### 3.9 Budget Enforcement

The SmartDiscoveryAgent enforces query budgets to control costs:

**Default Budget:** 2,000 queries per run

**Cost Structure:**
| Queries | Free | Paid | Cost |
|---------|------|------|------|
| 0-600 | 600 | 0 | $0 |
| 601-2000 | 600 | 1400 | $7.00 |

---

## Part 4: Data Models

### 4.1 DiscoveredVenue

```typescript
interface DiscoveredVenue {
  id: string;
  discovery_run_id: string;

  // Basic info
  name: string;
  is_chain: boolean;
  chain_id?: string;
  chain_name?: string;
  chain_confidence?: number;

  // Location
  address: {
    street?: string;
    city: string;
    postal_code?: string;
    country: SupportedCountry;
  };
  coordinates?: { lat: number; lng: number };

  // Delivery platforms
  delivery_platforms: {
    platform: DeliveryPlatform;
    url: string;
    rating?: number;
    review_count?: number;
  }[];

  // Products & dishes
  planted_products: PlantedProductSku[];
  dishes: {
    name: string;
    price?: string;
    product: string;
    description?: string;
  }[];

  // Confidence
  confidence_score: number;
  confidence_factors: {
    factor: string;
    score: number;
    reason: string;
  }[];

  // Status
  status: 'discovered' | 'verified' | 'rejected' | 'promoted' | 'stale';
  rejection_reason?: string;

  // Discovery metadata
  discovered_by_strategy_id: string;
  discovered_by_query: string;

  // Timestamps
  created_at: Date;
  verified_at?: Date;
  promoted_at?: Date;
}
```

### 4.2 ExtractedDish

```typescript
interface ExtractedDish {
  id: string;
  extraction_run_id: string;

  // Source
  venue_id: string;
  venue_name: string;
  chain_id?: string;
  chain_name?: string;

  // Dish info
  name: string;
  description?: string;
  category?: string;
  image_url?: string;

  // Planted product
  planted_product: PlantedProductSku;
  product_confidence: number;
  product_match_reason: string;

  // Prices
  prices: {
    country: SupportedCountry;
    platform: DeliveryPlatform;
    price: number;
    currency: string;
    formatted: string;
    last_seen: Date;
  }[];
  price_by_country: Record<SupportedCountry, string>;

  // Dietary info
  is_vegan: boolean;
  dietary_tags: string[];

  // Confidence
  confidence_score: number;
  confidence_factors: ConfidenceFactor[];

  // Status
  status: 'discovered' | 'verified' | 'rejected' | 'promoted' | 'stale';
  rejection_reason?: string;

  // Metadata
  discovered_by_strategy_id: string;
  source_url: string;

  // Timestamps
  created_at: Date;
  verified_at?: Date;
  promoted_at?: Date;
}
```

### 4.3 DiscoveryStrategy

```typescript
interface DiscoveryStrategy {
  id: string;

  // Targeting
  platform: DeliveryPlatform;
  country: SupportedCountry;

  // Query template
  query_template: string;  // e.g., "site:{platform} planted chicken {city}"

  // Performance metrics
  success_rate: number;           // 0-100
  total_uses: number;
  successful_discoveries: number;
  false_positives: number;

  // Origin
  origin: 'seed' | 'agent' | 'manual' | 'evolved';
  parent_strategy_id?: string;

  // Tags
  tags: string[];  // e.g., ['chain-discovery', 'city-specific']

  // Status
  deprecated_at?: Date;
  deprecation_reason?: string;

  // Timestamps
  created_at: Date;
  last_used?: Date;
}
```

---

## Part 5: API Reference

### 5.1 Public API

**Base URL:** `https://europe-west6-get-planted-db.cloudfunctions.net`

#### GET /venues
List venues with optional filters.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| country | string | Filter by country code (CH, DE, AT) |
| type | string | Filter by venue type |
| limit | number | Max results (default: 50) |
| offset | number | Pagination offset |

**Response:**
```json
{
  "venues": [...],
  "total": 150,
  "hasMore": true
}
```

#### GET /nearby
Find venues near a location.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| lat | number | Latitude (required) |
| lng | number | Longitude (required) |
| radius | number | Search radius in km (default: 5) |
| type | string | Venue type filter |

### 5.2 Admin API

Requires Firebase authentication with admin claims.

#### GET /admin/discovered-venues
List discovered venues pending review.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| status | string | Filter by status |
| country | string | Filter by country |
| minConfidence | number | Minimum confidence score |
| limit | number | Max results |

#### POST /admin/discovered-venues/:id/verify
Verify a discovered venue.

**Request Body:**
```json
{
  "updates": {
    "name": "Corrected Name",
    "planted_products": ["planted.chicken"]
  }
}
```

#### POST /admin/discovered-venues/:id/reject
Reject a discovered venue.

**Request Body:**
```json
{
  "reason": "Not a real Planted partner"
}
```

---

## Part 6: Deployment

### 6.1 Frontend (planted-astro)

```bash
# Development
cd planted-astro
npm install
npm run dev

# Production build
npm run build

# Deploy (GitHub Pages)
git push origin main  # Triggers GitHub Actions
```

### 6.2 Backend (planted-availability-db)

```bash
# Install dependencies
cd planted-availability-db
pnpm install

# Build all packages
pnpm build

# Deploy Cloud Functions
firebase deploy --only functions

# Deploy Firestore rules
firebase deploy --only firestore:rules

# Full deploy
firebase deploy
```

### 6.3 Admin Dashboard

```bash
cd packages/admin-dashboard
npm install
npm run dev       # Development
npm run build     # Production build
```

---

## Part 7: Environment Variables

### Firebase Configuration
```env
FIREBASE_PROJECT_ID=get-planted-db
FIREBASE_API_KEY=...
FIREBASE_AUTH_DOMAIN=...
```

### AI Provider Keys
```env
# Gemini AI (recommended - default provider)
GOOGLE_AI_API_KEY=...          # Primary Gemini key
GEMINI_API_KEY=...             # Alternative Gemini key

# Claude AI (alternative)
ANTHROPIC_API_KEY=...          # Claude API key
```

### Web Search Keys
```env
# Google Custom Search (recommended)
# Option 1: JSON array for multiple credentials
GOOGLE_SEARCH_CREDENTIALS='[{"apiKey":"...","searchEngineId":"..."},...]'

# Option 2: Numbered variables
GOOGLE_SEARCH_API_KEY_1=...
GOOGLE_SEARCH_ENGINE_ID_1=...

# Option 3: Single credential (legacy)
GOOGLE_SEARCH_API_KEY=...
GOOGLE_SEARCH_ENGINE_ID=...

# SerpAPI (alternative/fallback)
SERPAPI_API_KEY=...
```

### Optional
```env
NODE_ENV=production
LOG_LEVEL=info
```

---

## Part 8: Monitoring & Troubleshooting

### 8.1 Common Issues

**Discovery Agent Failures:**
- Check `ANTHROPIC_API_KEY` is set
- Check `SERPAPI_API_KEY` is set
- Verify network connectivity
- Check rate limiting (2-3 seconds between queries)

**Admin Dashboard Login Issues:**
- Verify Firebase Auth is configured
- Check user has admin custom claims
- Clear browser cache/cookies

**API Errors:**
- Check Firebase functions logs: `firebase functions:log`
- Verify Firestore rules allow access
- Check CORS configuration

### 8.2 Logs

```bash
# View Cloud Functions logs
firebase functions:log --only discovery

# View specific function logs
firebase functions:log --only scheduledDiscovery
```

### 8.3 Metrics

Key metrics to monitor:
- Discovery success rate (target: >70%)
- Extraction accuracy (target: >85%)
- API response time (target: <500ms)
- Stale venue count (should decrease over time)
