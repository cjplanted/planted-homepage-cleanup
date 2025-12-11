# Planted Availability Database (PAD)

## Comprehensive Project Scope & Technical Architecture

**Version 1.0 – December 2025**

> *"Where can I eat Planted right now?"*

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Core Objectives & Requirements](#2-core-objectives--requirements)
3. [System Architecture](#3-system-architecture)
4. [Database Schema](#4-database-schema)
5. [Scraping Architecture](#5-scraping-architecture)
6. [API Design](#6-api-design)
7. [Implementation Phases](#7-implementation-phases)
8. [Repository Structure](#8-repository-structure)
9. [Cost Analysis](#9-cost-analysis)
10. [Risk Mitigation](#10-risk-mitigation)
11. [Getting Started with Claude Code](#11-getting-started-with-claude-code)
12. [Appendix](#12-appendix)

---

## 1. Executive Summary

The Planted Availability Database (PAD) is a comprehensive, geo-localized system that answers one fundamental question: **"Where can I get Planted products right now?"**

The system encompasses three core verticals:

- **Retail**: Physical stores selling Planted products with real-time promotions
- **Foodservice**: Restaurants with Planted dishes on their current menus
- **Delivery**: Food delivery platforms offering Planted dishes to specific addresses

The system will automatically scrape, validate, and maintain data freshness across hundreds of sources daily, while also accepting manual inputs from internal communications.

**Reference Website**: https://cgjen-box.github.io/planted-website/de/ (current locator feature)

---

## 2. Core Objectives & Requirements

### 2.1 User-Facing Requirements

When a user visits the Planted website, the system must:

- Detect user location via IP geolocation or manual address entry
- Display three clear verticals: Retail, Restaurants, Delivery
- Show proximity-sorted results with opening hours awareness
- **Focus on DISHES, not just venues** – with images where available
- Show "next available" times when venues are closed
- Provide deep links to ordering/purchase options

### 2.2 Data Freshness Requirements

- Every database entry must be validated daily
- Promotions must have start/end dates and auto-expire
- Menu items must be verified against current source data
- Stale entries (>7 days unverified) get flagged, >14 days get archived
- All changes (additions, updates, removals) must be logged

### 2.3 Data Input Requirements

- Automated scraping for public data sources
- Manual input interface for internal team
- Email/webhook integration for partner communications
- Bulk import capability for partner data feeds

---

## 3. System Architecture

### 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    DATA SOURCES                             │
│  [Retail APIs] [Restaurant Sites] [Delivery Platforms]      │
│  [Manual Input] [Email Webhooks] [Partner Feeds]            │
└───────────────────────────┬─────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              SCRAPER ORCHESTRATION LAYER                    │
│     [Scheduler] [Queue] [Rate Limiter] [Error Handler]      │
└───────────────────────────┬─────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 FIRESTORE DATABASE                          │
│  [Venues] [Dishes] [Products] [Promos] [ChangeLogs]         │
└───────────────────────────┬─────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     API LAYER                               │
│       [REST API] [GraphQL] [Webhooks] [Admin API]           │
└───────────────────────────┬─────────────────────────────────┘
                            ▼
            [Website Frontend] [Admin Dashboard]
```

### 3.2 Technology Stack

#### 3.2.1 Database Layer

**Primary: Firebase Firestore** (free tier: 50K reads/day, 20K writes/day)
- NoSQL document database with native geospatial queries
- Real-time listeners for live updates
- Automatic scaling, no infrastructure management
- Offline support for mobile apps

**Media Storage: Firebase Storage** (free tier: 5GB storage, 1GB/day download)
- Dish images, venue logos, product photos
- CDN-backed for global delivery
- Automatic image optimization

**Search Layer: Algolia** (free tier: 10K records, 10K searches/month)
- Full-text search for dishes and venues
- Geo-search with radius filtering
- Faceted filtering (cuisine, price, dietary)

#### 3.2.2 Backend Services

**Runtime: Cloud Functions for Firebase** (free tier: 2M invocations/month)
- Serverless, scales automatically
- TypeScript/Node.js for all backend logic
- Triggered by HTTP, schedules, or database events

**Scheduling: Cloud Scheduler** (free tier: 3 jobs)
- Daily scraper orchestration
- Hourly freshness checks
- Weekly cleanup jobs

**Queue: Cloud Tasks** (free tier: 1M operations/month)
- Distributed scraping job queue
- Rate-limited execution
- Automatic retries with backoff

#### 3.2.3 Scraping Infrastructure

**Web Scraping: Puppeteer/Playwright** (runs in Cloud Functions)
- JavaScript rendering for SPAs
- Screenshot capture for visual verification

**Proxy Service: ScraperAPI or Bright Data** (paid, ~$29/month for 100K requests)
- Rotating residential proxies
- CAPTCHA solving
- Geographic targeting

**Alternative Free Option: Crawlee + own proxy rotation**
- Open-source crawling framework
- Requires more setup but no recurring cost

#### 3.2.4 Frontend & Admin

**Website Integration**: JavaScript SDK consumed by planted-website
- Lightweight bundle (<50KB)
- Framework-agnostic
- SSR-compatible

**Admin Dashboard**: Firebase Hosting + React
- Manual data entry interface
- Moderation queue for flagged items
- Analytics and monitoring

---

## 4. Database Schema

### 4.1 Core Collections

#### 4.1.1 `venues`

Central collection for all locations (retail, restaurants, delivery kitchens):

```typescript
interface Venue {
  id: string;                          // Auto-generated unique ID
  type: 'retail' | 'restaurant' | 'delivery_kitchen';
  name: string;                        // e.g., "Coop Bahnhofstrasse"
  chain_id?: string;                   // Reference to chains collection
  location: GeoPoint;                  // Firestore GeoPoint for geo-queries
  address: {
    street: string;
    city: string;
    postal_code: string;
    country: string;                   // ISO 3166-1 alpha-2
  };
  opening_hours: {
    regular: {
      [day: string]: { open: string; close: string }[];  // "monday": [{"open": "08:00", "close": "20:00"}]
    };
    exceptions?: {
      date: string;                    // "2025-12-25"
      hours: { open: string; close: string }[] | 'closed';
    }[];
  };
  delivery_zones?: string[] | GeoJSON; // Postal codes or polygons
  contact?: {
    phone?: string;
    email?: string;
    website?: string;
  };
  source: {
    type: 'scraped' | 'manual' | 'partner_feed';
    url?: string;
    scraper_id?: string;
  };
  last_verified: Timestamp;
  status: 'active' | 'stale' | 'archived';
  created_at: Timestamp;
  updated_at: Timestamp;
}
```

#### 4.1.2 `dishes`

Individual menu items featuring Planted products:

```typescript
interface Dish {
  id: string;
  venue_id: string;                    // Reference to venues collection
  name: string;                        // Dish name
  name_localized?: {                   // Translations
    [locale: string]: string;          // { "de": "Planted Kebap Döner", "en": "Planted Kebab Döner" }
  };
  description: string;
  description_localized?: {
    [locale: string]: string;
  };
  planted_products: string[];          // SKUs from products collection
  price: {
    amount: number;
    currency: string;                  // ISO 4217
  };
  image_url?: string;                  // Firebase Storage URL
  image_source?: string;               // Original source URL
  dietary_tags: string[];              // ['vegan', 'gluten-free', 'high-protein']
  cuisine_type?: string;               // 'italian', 'asian', 'middle-eastern'
  availability: {
    type: 'permanent' | 'limited' | 'seasonal';
    start_date?: Timestamp;
    end_date?: Timestamp;
    days_available?: string[];         // ['monday', 'tuesday', ...] for specials
  };
  delivery_partners?: {
    partner: 'uber_eats' | 'wolt' | 'lieferando' | 'deliveroo' | 'just_eat' | 'glovo';
    url: string;
    price?: number;                    // May differ from dine-in price
  }[];
  source: {
    type: 'scraped' | 'manual' | 'partner_feed';
    url?: string;
    scraper_id?: string;
  };
  last_verified: Timestamp;
  status: 'active' | 'stale' | 'archived';
  created_at: Timestamp;
  updated_at: Timestamp;
}
```

#### 4.1.3 `products`

Planted product catalog:

```typescript
interface Product {
  sku: string;                         // Primary key, e.g., "PLANTED-CHICKEN-NATURE-300G"
  name: {
    [locale: string]: string;          // { "de": "planted.chicken Nature", "en": "planted.chicken Nature" }
  };
  category: string;                    // 'chicken', 'steak', 'pulled', 'kebab', etc.
  variant: string;                     // 'nature', 'lemon-herbs', 'bbq', etc.
  weight_grams?: number;
  image_url: string;                   // Product packshot
  markets: string[];                   // ['CH', 'DE', 'AT', 'FR', 'IT', 'NL', 'UK', 'ES']
  retail_only: boolean;                // Some products only in retail, not foodservice
  active: boolean;
}
```

#### 4.1.4 `retail_availability`

Product availability at retail locations:

```typescript
interface RetailAvailability {
  id: string;
  venue_id: string;                    // Reference to retail venue
  product_sku: string;                 // Reference to products
  in_stock: boolean;
  price?: {
    regular: number;
    currency: string;
  };
  promotion?: {
    id: string;                        // Reference to promotions
    price: number;
    valid_until: Timestamp;
  };
  shelf_location?: string;             // "Aisle 5, Vegan section"
  last_verified: Timestamp;
  source: {
    type: 'scraped' | 'manual' | 'partner_feed';
    url?: string;
  };
}
```

#### 4.1.5 `promotions`

Active promotions and specials:

```typescript
interface Promotion {
  id: string;
  venue_id?: string;                   // Specific venue or null for chain-wide
  chain_id?: string;                   // Chain-wide promotion
  product_skus: string[];              // Products included
  promo_type: 'discount' | 'bundle' | 'special' | 'new_product';
  discount?: {
    type: 'percent' | 'fixed';
    value: number;                     // 20 for 20% or 2.00 for CHF 2 off
  };
  title: string;
  description?: string;
  image_url?: string;
  valid_from: Timestamp;
  valid_until: Timestamp;
  terms?: string;                      // Fine print
  source: {
    type: 'scraped' | 'manual' | 'partner_feed';
    url?: string;
  };
  created_at: Timestamp;
}
```

#### 4.1.6 `chains`

Restaurant and retail chains:

```typescript
interface Chain {
  id: string;
  name: string;                        // "Subway", "Coop", "Hiltl"
  type: 'retail' | 'restaurant' | 'both';
  logo_url?: string;
  website?: string;
  markets: string[];                   // Countries where active
  partnership_level?: 'standard' | 'premium' | 'flagship';
  contact?: {
    name?: string;
    email?: string;
  };
}
```

#### 4.1.7 `change_logs`

Audit trail for all data changes:

```typescript
interface ChangeLog {
  id: string;
  timestamp: Timestamp;
  action: 'created' | 'updated' | 'archived' | 'restored';
  collection: string;                  // 'venues', 'dishes', 'promotions', etc.
  document_id: string;
  changes: {
    field: string;
    before: any;
    after: any;
  }[];
  source: {
    type: 'scraper' | 'manual' | 'system' | 'webhook';
    scraper_id?: string;
    user_id?: string;
    ip?: string;
  };
  reason?: string;                     // "Daily verification", "Manual correction"
}
```

#### 4.1.8 `scraper_runs`

Scraper execution tracking:

```typescript
interface ScraperRun {
  id: string;
  scraper_id: string;                  // 'coop-ch', 'wolt-de', etc.
  started_at: Timestamp;
  completed_at?: Timestamp;
  status: 'running' | 'completed' | 'failed' | 'partial';
  stats: {
    venues_checked: number;
    venues_updated: number;
    dishes_found: number;
    dishes_updated: number;
    errors: number;
  };
  errors?: {
    message: string;
    url?: string;
    stack?: string;
  }[];
  next_run?: Timestamp;
}
```

### 4.2 Firestore Indexes

Required composite indexes for efficient queries:

```json
{
  "indexes": [
    {
      "collectionGroup": "venues",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "type", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "location", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "dishes",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "planted_products", "arrayConfig": "CONTAINS" },
        { "fieldPath": "last_verified", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "promotions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "valid_until", "order": "ASCENDING" },
        { "fieldPath": "chain_id", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "change_logs",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "collection", "order": "ASCENDING" },
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    }
  ]
}
```

---

## 5. Scraping Architecture

### 5.1 Scraper Types & Strategies

Different data sources require different scraping approaches. The system uses a plugin architecture where each source type has a dedicated scraper module.

#### 5.1.1 Retail Scrapers

| Source | Market | Strategy | Frequency |
|--------|--------|----------|-----------|
| Coop | CH | API-based. Product search API available | Daily |
| Migros | CH | API-based. Query product availability by store | Daily |
| REWE | DE | Semi-structured. Scrape weekly flyers (PDF) + online shop | Daily + Weekly |
| EDEKA | DE | Web scraping. Online shop product pages | Daily |
| Carrefour | FR/ES/IT | Multi-market. Separate scrapers per market | Daily |
| Albert Heijn | NL | API + bonus tracking. Track 'Bonus' promotions | Daily |
| Sainsbury's | UK | JavaScript rendering required (Puppeteer) | Daily |
| Waitrose | UK | JavaScript rendering required (Puppeteer) | Daily |

#### 5.1.2 Restaurant Menu Scrapers

| Source Type | Strategy |
|-------------|----------|
| Chain Restaurants | Scrape central menu pages (e.g., subway.com/ch, vapiano.com) |
| Independent Restaurants | Manual entry + periodic verification via Google Business/TripAdvisor |
| Hotel/Catering | Partner data feeds (B2B relationships) |
| Deutsche Bahn | Scrape ICE dining car menus from bahn.de |

#### 5.1.3 Delivery Platform Scrapers

| Platform | Markets | Strategy |
|----------|---------|----------|
| Uber Eats | All | GraphQL API scraping. Search for 'planted' keyword per city |
| Wolt | DE/AT | REST API. Enumerate restaurants, search menus for Planted items |
| Lieferando/Just Eat | DE/AT/NL | Takeaway.com API. Multi-market coverage |
| Deliveroo | UK/FR | UK-focused. API-based menu scraping |
| Glovo | ES/IT | REST API scraping |

**Image Capture**: Screenshot dish images from delivery platforms, store in Firebase Storage with original source attribution.

### 5.2 Scraper Orchestration

```
┌──────────────────────────────────────────────────────────────┐
│                    CLOUD SCHEDULER                           │
│                   (Triggers at 4 AM CET)                     │
└─────────────────────────┬────────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────────┐
│                 ORCHESTRATOR FUNCTION                        │
│  1. Query stale records needing verification                 │
│  2. Create scrape jobs for each source                       │
│  3. Push jobs to Cloud Tasks queue                           │
└─────────────────────────┬────────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────────┐
│                    CLOUD TASKS QUEUE                         │
│  - Rate limited (10 req/sec per source)                      │
│  - Automatic retries with exponential backoff                │
│  - Dead letter queue for failed jobs                         │
└─────────────────────────┬────────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────────┐
│                   SCRAPER FUNCTIONS                          │
│  - 5 minute timeout per job                                  │
│  - Write to staging collection                               │
│  - Log all changes                                           │
└─────────────────────────┬────────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────────┐
│                  VALIDATOR FUNCTION                          │
│  - Compare staging vs production                             │
│  - Flag significant changes for review                       │
│  - Promote clean data to production                          │
└──────────────────────────────────────────────────────────────┘
```

### 5.3 Data Freshness Protocol

Each record has a freshness score based on last verification:

| Age | Status | UI Treatment | Action |
|-----|--------|--------------|--------|
| 0-24 hours | Fresh (green) | Fully trusted | None |
| 1-7 days | Stale (yellow) | Shown with subtle indicator | Priority re-scrape |
| 7-14 days | Very stale (orange) | Flagged for manual review | Alert to admin |
| >14 days | Archived (red) | Removed from active queries | Auto-archive |

Daily jobs specifically target stale records for re-verification before scraping new sources.

### 5.4 Intelligent Scraping Priorities

Not all sources need daily scraping. The system adapts frequency based on:

- **Change velocity**: Delivery menus change more often than retail assortments
- **Business value**: High-traffic restaurants get priority
- **Data reliability**: Sources with stable APIs scraped less frequently
- **User demand**: Areas with more user queries get priority

### 5.5 Scraper Module Template

```typescript
// packages/scrapers/base/scraper.ts
export interface ScraperConfig {
  id: string;
  name: string;
  market: string[];
  type: 'retail' | 'restaurant' | 'delivery';
  schedule: string;  // cron expression
  rateLimit: {
    requestsPerSecond: number;
    maxConcurrent: number;
  };
  retryPolicy: {
    maxRetries: number;
    backoffMs: number;
  };
}

export interface ScraperResult {
  venues: Partial<Venue>[];
  dishes: Partial<Dish>[];
  promotions: Partial<Promotion>[];
  errors: ScraperError[];
}

export abstract class BaseScraper {
  abstract config: ScraperConfig;
  abstract scrape(): Promise<ScraperResult>;
  abstract verifyVenue(venue: Venue): Promise<boolean>;
}
```

---

## 6. API Design

### 6.1 Public API Endpoints

RESTful API consumed by the Planted website:

#### 6.1.1 Discovery Endpoints

**GET /api/v1/nearby**

Returns venues and dishes near a location.

```
Query params:
  lat: number (required)
  lng: number (required)
  radius_km: number (default: 10, max: 50)
  type: 'retail' | 'restaurant' | 'delivery' | 'all' (default: 'all')
  limit: number (default: 20, max: 100)
  open_now: boolean (default: false)
  product_sku: string (filter by specific product)

Response:
{
  "results": [
    {
      "venue": { ... },
      "dishes": [ ... ],
      "distance_km": 1.2,
      "is_open": true,
      "next_open": null
    }
  ],
  "total": 45,
  "has_more": true
}
```

**GET /api/v1/venues/:id**

Full venue details including all dishes and opening hours.

```
Response:
{
  "venue": { ... },
  "dishes": [ ... ],
  "promotions": [ ... ],
  "is_open": true,
  "today_hours": { "open": "11:00", "close": "22:00" },
  "delivery_partners": [ ... ]
}
```

**GET /api/v1/dishes**

Search dishes by product, cuisine, dietary tags.

```
Query params:
  product_sku: string
  lat: number
  lng: number
  radius_km: number
  tags: string[] (comma-separated)
  cuisine: string
  available_now: boolean
  min_price: number
  max_price: number
  limit: number

Response:
{
  "dishes": [
    {
      "dish": { ... },
      "venue": { ... },
      "distance_km": 0.8,
      "delivery_available": true
    }
  ]
}
```

**GET /api/v1/delivery/check**

Check delivery availability for specific address.

```
Query params:
  address: string (full address)
  OR
  postal_code: string
  country: string (ISO 3166-1 alpha-2)

Response:
{
  "available": true,
  "options": [
    {
      "venue": { ... },
      "dishes": [ ... ],
      "partners": [
        { "partner": "wolt", "url": "...", "estimated_delivery": "30-45 min" }
      ]
    }
  ]
}
```

#### 6.1.2 Geolocation

**GET /api/v1/geolocate**

IP-to-location lookup using MaxMind GeoLite2 (free).

```
Response:
{
  "city": "Zürich",
  "region": "Zürich",
  "country": "CH",
  "lat": 47.3769,
  "lng": 8.5417,
  "timezone": "Europe/Zurich"
}
```

### 6.2 Admin API Endpoints

Authenticated endpoints for internal team (Firebase Auth):

#### 6.2.1 Manual Data Entry

**POST /api/admin/venues**
```typescript
{
  type: 'retail' | 'restaurant' | 'delivery_kitchen';
  name: string;
  chain_id?: string;
  address: { ... };
  opening_hours: { ... };
  // ... all venue fields
}
```

**POST /api/admin/dishes**
```typescript
{
  venue_id: string;
  name: string;
  description: string;
  planted_products: string[];
  price: { amount: number; currency: string };
  image?: File;  // Multipart upload
  // ... all dish fields
}
```

**POST /api/admin/promotions**
```typescript
{
  venue_id?: string;
  chain_id?: string;
  product_skus: string[];
  promo_type: string;
  discount?: { type: string; value: number };
  valid_from: string;  // ISO 8601
  valid_until: string;
  // ... all promotion fields
}
```

**POST /api/admin/quick-add**

Simplified endpoint for quick additions from emails/Slack.

```typescript
{
  text: string;  // Natural language: "Restaurant XYZ, Zurich, planted kebab döner, CHF 12, starts Jan 15"
}

// Parsed using Claude API, returns structured data for confirmation
```

#### 6.2.2 Moderation & Monitoring

**GET /api/admin/flagged**

List items flagged for review (stale, conflicting data, scraper errors).

```
Query params:
  type: 'stale' | 'conflict' | 'error' | 'all'
  collection: string
  limit: number

Response:
{
  "items": [
    {
      "type": "stale",
      "collection": "dishes",
      "document": { ... },
      "reason": "Not verified in 10 days",
      "last_verified": "2025-11-26T..."
    }
  ]
}
```

**GET /api/admin/changelog**

Daily/weekly summary of changes.

```
Query params:
  from: string (ISO 8601)
  to: string (ISO 8601)
  collection: string
  action: string

Response:
{
  "summary": {
    "created": 45,
    "updated": 123,
    "archived": 12
  },
  "changes": [ ... ]
}
```

**GET /api/admin/scraper-status**

Health dashboard for all scrapers.

```
Response:
{
  "scrapers": [
    {
      "id": "coop-ch",
      "name": "Coop Switzerland",
      "status": "healthy",
      "last_run": "2025-12-06T04:15:00Z",
      "success_rate_7d": 0.98,
      "next_run": "2025-12-07T04:00:00Z"
    }
  ]
}
```

### 6.3 Webhook Endpoints

For automated data ingestion:

**POST /api/webhooks/partner-feed**

Receive data from partners (e.g., restaurant chains pushing their menus).

```typescript
Headers:
  X-Partner-ID: string
  X-Partner-Secret: string

Body:
{
  "type": "menu_update" | "promotion" | "venue_update",
  "data": { ... }
}
```

**POST /api/webhooks/email-parser**

Receives parsed emails from email forwarding service (Zapier/Make.com integration).

```typescript
{
  "from": "partner@restaurant.com",
  "subject": "New menu item with Planted",
  "body": "...",
  "attachments": [ ... ]
}
```

---

## 7. Implementation Phases

### 7.1 Phase 1: Foundation (Weeks 1-4)

**Goal**: Working database with manual entry and basic API

- [ ] Set up Firebase project (Firestore, Storage, Functions, Hosting)
- [ ] Implement database schema with TypeScript interfaces
- [ ] Create Zod validation schemas for all collections
- [ ] Build basic CRUD API for all collections
- [ ] Create admin dashboard for manual data entry
- [ ] Import existing data from current website
- [ ] Set up change logging with Firestore triggers
- [ ] Basic authentication with Firebase Auth

**Deliverable**: Admin can manually add/edit venues, dishes, promotions

### 7.2 Phase 2: Scraping Infrastructure (Weeks 5-8)

**Goal**: Automated data collection from key sources

- [ ] Build scraper orchestration framework
- [ ] Implement base scraper class with common functionality
- [ ] Create 5 priority scrapers:
  - [ ] Coop (CH) - API-based
  - [ ] Migros (CH) - API-based
  - [ ] Wolt (DE/AT) - REST API
  - [ ] Uber Eats (All markets) - GraphQL
  - [ ] Lieferando (DE/AT/NL) - REST API
- [ ] Set up Cloud Scheduler for daily runs
- [ ] Build data validation pipeline
- [ ] Implement freshness tracking and stale data handling
- [ ] Add image scraping and Firebase Storage upload
- [ ] Create scraper health monitoring dashboard

**Deliverable**: Switzerland retail & delivery data auto-updated daily

### 7.3 Phase 3: Geographic Expansion (Weeks 9-12)

**Goal**: Cover all 6+ markets

- [ ] Implement scrapers for DE:
  - [ ] REWE (web + flyer PDF)
  - [ ] EDEKA (web scraping)
- [ ] Implement scrapers for UK:
  - [ ] Sainsbury's (Puppeteer)
  - [ ] Waitrose (Puppeteer)
  - [ ] Deliveroo (API)
- [ ] Implement scrapers for FR/IT/ES/NL:
  - [ ] Carrefour (multi-market)
  - [ ] Albert Heijn (NL)
  - [ ] Glovo (ES/IT)
- [ ] Add multi-language support for dish names/descriptions
- [ ] Currency handling for different markets
- [ ] Timezone handling for opening hours

**Deliverable**: Full coverage across all Planted markets

### 7.4 Phase 4: Intelligence & Integration (Weeks 13-16)

**Goal**: Smart features and website integration

- [ ] Implement Algolia search index
- [ ] Build real-time availability checking
- [ ] Create email/webhook parsing for partner communications
- [ ] Integrate API with planted-website frontend
- [ ] Build IP geolocation service (MaxMind)
- [ ] Add opening hours logic ("next available")
- [ ] Implement "similar dishes nearby" recommendations
- [ ] Build client SDK for website integration

**Deliverable**: Full integration with planted-website

### 7.5 Phase 5: Optimization & Scale (Weeks 17-20)

**Goal**: Production-ready, cost-optimized system

- [ ] Performance optimization (caching, query optimization)
- [ ] Implement CDN caching for API responses
- [ ] Add analytics and monitoring dashboards
- [ ] Implement smart scraping priorities based on usage
- [ ] Build automated alerting for scraper failures
- [ ] Create runbooks for common issues
- [ ] Load testing and scaling validation
- [ ] Documentation for all systems
- [ ] Security audit

**Deliverable**: Production-ready system with monitoring

---

## 8. Repository Structure

```
planted-availability-db/
├── packages/
│   ├── core/                      # Shared types, utils, constants
│   │   ├── src/
│   │   │   ├── types/
│   │   │   │   ├── venue.ts
│   │   │   │   ├── dish.ts
│   │   │   │   ├── product.ts
│   │   │   │   ├── promotion.ts
│   │   │   │   └── index.ts
│   │   │   ├── schemas/           # Zod validation schemas
│   │   │   ├── utils/
│   │   │   │   ├── geo.ts
│   │   │   │   ├── time.ts
│   │   │   │   └── currency.ts
│   │   │   └── constants/
│   │   │       ├── markets.ts
│   │   │       └── products.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── database/                  # Firestore schemas, migrations
│   │   ├── src/
│   │   │   ├── collections/
│   │   │   ├── indexes/
│   │   │   └── migrations/
│   │   └── package.json
│   │
│   ├── api/                       # Cloud Functions API
│   │   ├── src/
│   │   │   ├── functions/
│   │   │   │   ├── public/
│   │   │   │   │   ├── nearby.ts
│   │   │   │   │   ├── venues.ts
│   │   │   │   │   ├── dishes.ts
│   │   │   │   │   └── delivery.ts
│   │   │   │   ├── admin/
│   │   │   │   │   ├── crud.ts
│   │   │   │   │   ├── moderation.ts
│   │   │   │   │   └── analytics.ts
│   │   │   │   └── webhooks/
│   │   │   │       ├── partner.ts
│   │   │   │       └── email.ts
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts
│   │   │   │   ├── rateLimit.ts
│   │   │   │   └── cors.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── scrapers/                  # All scraper modules
│   │   ├── src/
│   │   │   ├── base/
│   │   │   │   ├── scraper.ts
│   │   │   │   ├── validator.ts
│   │   │   │   └── imageCapture.ts
│   │   │   ├── retail/
│   │   │   │   ├── coop.ts
│   │   │   │   ├── migros.ts
│   │   │   │   ├── rewe.ts
│   │   │   │   ├── edeka.ts
│   │   │   │   ├── carrefour.ts
│   │   │   │   ├── albertHeijn.ts
│   │   │   │   ├── sainsburys.ts
│   │   │   │   └── waitrose.ts
│   │   │   ├── delivery/
│   │   │   │   ├── wolt.ts
│   │   │   │   ├── uberEats.ts
│   │   │   │   ├── lieferando.ts
│   │   │   │   ├── deliveroo.ts
│   │   │   │   └── glovo.ts
│   │   │   ├── restaurants/
│   │   │   │   ├── chains/
│   │   │   │   │   ├── subway.ts
│   │   │   │   │   ├── vapiano.ts
│   │   │   │   │   └── deutscheBahn.ts
│   │   │   │   └── independent.ts
│   │   │   └── orchestrator/
│   │   │       ├── scheduler.ts
│   │   │       ├── queue.ts
│   │   │       └── monitor.ts
│   │   └── package.json
│   │
│   ├── admin-dashboard-v2/        # React admin UI
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   ├── hooks/
│   │   │   └── App.tsx
│   │   ├── public/
│   │   └── package.json
│   │
│   └── client-sdk/                # SDK for planted-website
│       ├── src/
│       │   ├── client.ts
│       │   ├── hooks.ts           # React hooks
│       │   └── types.ts
│       ├── package.json
│       └── README.md
│
├── firebase/
│   ├── firestore.rules
│   ├── firestore.indexes.json
│   └── storage.rules
│
├── scripts/
│   ├── seed-data.ts               # Initial data population
│   ├── migrate.ts                 # Schema migrations
│   └── import-current.ts          # Import from current website
│
├── docs/
│   ├── api.md
│   ├── scrapers.md
│   ├── admin.md
│   └── runbooks/
│
├── .github/
│   └── workflows/
│       ├── ci.yml
│       ├── deploy-functions.yml
│       └── deploy-admin.yml
│
├── package.json                   # Workspace root
├── pnpm-workspace.yaml
├── turbo.json                     # Turborepo config
├── firebase.json
├── .firebaserc
└── README.md
```

### 8.1 Key Technology Choices

| Technology | Purpose | Why |
|------------|---------|-----|
| **Turborepo** | Monorepo management | Smart caching, parallel builds |
| **TypeScript** | All code | Type safety across packages |
| **pnpm** | Package manager | Fast, disk-efficient |
| **Zod** | Runtime validation | Matches TS types, runtime safety |
| **Vitest** | Unit testing | Fast, ESM-native |
| **Playwright** | E2E testing + scraping | Modern, reliable |
| **GitHub Actions** | CI/CD | Free for public repos |

---

## 9. Cost Analysis

### 9.1 Free Tier Coverage

The system is designed to operate primarily within free tiers:

| Service | Free Tier | Expected Usage | Status |
|---------|-----------|----------------|--------|
| Firestore reads | 50K/day | ~30K/day | ✅ Within |
| Firestore writes | 20K/day | ~5K/day | ✅ Within |
| Firestore storage | 1 GB | ~500 MB | ✅ Within |
| Firebase Storage | 5 GB | ~2 GB | ✅ Within |
| Cloud Functions | 2M invocations/mo | ~500K/mo | ✅ Within |
| Cloud Functions compute | 400K GB-sec/mo | ~200K GB-sec/mo | ✅ Within |
| Cloud Scheduler | 3 jobs | 3 jobs | ✅ Within |
| Cloud Tasks | 1M operations/mo | ~100K/mo | ✅ Within |
| Algolia | 10K records, 10K searches/mo | ~5K records | ✅ Within |
| Firebase Hosting | 10 GB transfer/mo | ~1 GB/mo | ✅ Within |
| Firebase Auth | 50K MAU | ~100 admin users | ✅ Within |

### 9.2 Expected Paid Costs

Minimal paid services required:

| Service | Cost | Notes |
|---------|------|-------|
| **Proxy Service (ScraperAPI)** | ~$29/mo | 100K requests, essential for reliable scraping |
| **MaxMind GeoIP** | Free | GeoLite2 free tier |
| **Domain (optional)** | ~$12/yr | api.planted.ch or similar |
| **Firebase Blaze Plan** | Pay-as-you-go | Only if exceeding free tier |

**Total estimated monthly cost: ~$30-50/month at launch**

### 9.3 Scaling Costs

If free tiers are exceeded:

| Service | Overage Cost |
|---------|--------------|
| Firestore reads | $0.06 per 100K |
| Firestore writes | $0.18 per 100K |
| Firestore storage | $0.18 per GB/mo |
| Firebase Storage | $0.026 per GB/mo |
| Cloud Functions | $0.40 per million invocations |
| Algolia | Consider Meilisearch (self-hosted, free) if >10K records |

### 9.4 Cost Optimization Strategies

- **Aggressive caching**: Cache API responses at CDN level (Firebase Hosting)
- **Smart scraping**: Only scrape sources that have likely changed
- **Batch operations**: Use Firestore batch writes to reduce write count
- **Composite indexes**: Reduce read operations with efficient queries
- **Image optimization**: Compress and resize images before storage

---

## 10. Risk Mitigation

### 10.1 Technical Risks

#### Scraper Breakage
- **Risk**: Websites change structure, breaking scrapers
- **Mitigation**: 
  - Implement scraper health monitoring with alerts
  - Each scraper has fallback selectors
  - Visual regression detection using screenshots
  - Weekly review of scraper success rates
  - Modular scraper design for easy fixes

#### Rate Limiting / IP Blocking
- **Risk**: Getting blocked by source websites
- **Mitigation**:
  - Use rotating residential proxies (ScraperAPI)
  - Implement exponential backoff
  - Respect robots.txt
  - Distribute scraping load across 24 hours
  - Use geographic proxy targeting

#### Data Accuracy
- **Risk**: Stale or incorrect data shown to users
- **Mitigation**:
  - Multi-source verification where possible
  - User feedback integration ("Report incorrect info")
  - Clear freshness indicators in UI
  - Aggressive archiving of unverified data (14 days)
  - Manual review queue for flagged items

### 10.2 Operational Risks

#### Free Tier Exhaustion
- **Risk**: Unexpected usage spikes exceeding free tiers
- **Mitigation**:
  - Set up billing alerts at 50%/80%/100% of limits
  - Implement rate limiting on public API
  - Cache aggressively
  - Monitor daily usage metrics

#### Data Privacy
- **Risk**: Storing/processing data incorrectly
- **Mitigation**:
  - No PII in database
  - IP addresses only used transiently for geolocation
  - GDPR-compliant infrastructure (Firebase EU region: europe-west6)
  - Clear data retention policies

#### Single Point of Failure
- **Risk**: Firebase outage takes down entire system
- **Mitigation**:
  - Firebase has 99.95% SLA
  - Implement client-side caching
  - Consider read replicas for critical data

### 10.3 Legal Risks

#### Terms of Service
- **Risk**: Scraping may violate ToS of some platforms
- **Mitigation**:
  - Prioritize API-based data collection
  - For scraping: operate within reasonable limits
  - Don't overload servers (rate limiting)
  - Attribute data sources
  - Be prepared to stop scraping specific sources if requested

---

## 11. Getting Started with Claude Code

### 11.1 Initial Setup Commands

```bash
# Create monorepo
mkdir planted-availability-db && cd planted-availability-db
pnpm init

# Set up workspace
cat > pnpm-workspace.yaml << 'EOF'
packages:
  - 'packages/*'
EOF

# Install dev dependencies
pnpm add -D turbo typescript @types/node vitest

# Initialize Firebase
npm install -g firebase-tools
firebase login
firebase init
# Select: Firestore, Functions, Hosting, Storage
# Use TypeScript for functions
# Region: europe-west6 (Zurich)

# Create packages
mkdir -p packages/{core,database,api,scrapers,admin-dashboard-v2,client-sdk}

# Initialize core package
cd packages/core
pnpm init
pnpm add zod
pnpm add -D typescript @types/node

# Initialize API package
cd ../api
pnpm init
pnpm add firebase-admin firebase-functions
pnpm add -D typescript @types/node
```

### 11.2 Claude Code Prompting Strategy

When working with Claude Code, structure prompts by phase and component:

#### Phase 1 Prompts

```
"Set up the packages/core package with TypeScript interfaces for all database collections: Venue, Dish, Product, Promotion, ChangeLog. Include Zod validation schemas that match the interfaces. Export everything from index.ts."
```

```
"Create the packages/database package with Firestore initialization, collection references, and basic CRUD operations for venues and dishes. Use the types from @pad/core."
```

```
"Build the admin dashboard in packages/admin-dashboard-v2 using React + Vite + Tailwind. Create pages for: VenueList, VenueForm, DishList, DishForm. Use Firebase Auth for login."
```

#### Phase 2 Prompts

```
"Create the base scraper class in packages/scrapers/src/base/scraper.ts with:
- Config interface (id, name, market, schedule, rateLimit)
- Abstract scrape() method returning venues, dishes, promotions
- Built-in rate limiting and retry logic
- Error handling and logging"
```

```
"Implement the Coop Switzerland scraper. Research their API structure and create a scraper that:
- Fetches all stores
- Searches for Planted products by SKU
- Maps to our Venue and RetailAvailability schemas
- Handles pagination"
```

#### Phase 3 Prompts

```
"Implement the Wolt scraper for Germany and Austria. Use their public API to:
- Search restaurants by city
- Filter menus for 'planted' keyword
- Extract dish details with images
- Map delivery zones to postal codes"
```

#### Phase 4 Prompts

```
"Create the public API endpoints in packages/api:
- GET /nearby with geo-queries
- GET /venues/:id with dishes
- GET /dishes with filtering
- GET /delivery/check for address validation
Include rate limiting and caching headers."
```

### 11.3 First Week Milestones

| Day | Milestone |
|-----|-----------|
| 1 | Firebase project setup, Firestore rules, basic schema |
| 2 | Core package with types and validation |
| 3 | Database package with CRUD operations |
| 4 | Admin dashboard - venue management |
| 5 | Admin dashboard - dish management |
| 6 | First scraper (Coop) - basic implementation |
| 7 | Scraper orchestration - Cloud Scheduler integration |

### 11.4 Testing Strategy

```typescript
// Example test for Coop scraper
import { describe, it, expect, vi } from 'vitest';
import { CoopScraper } from './coop';

describe('CoopScraper', () => {
  it('should fetch stores with Planted products', async () => {
    const scraper = new CoopScraper();
    const result = await scraper.scrape();
    
    expect(result.venues.length).toBeGreaterThan(0);
    expect(result.venues[0]).toHaveProperty('name');
    expect(result.venues[0]).toHaveProperty('location');
  });

  it('should handle rate limiting gracefully', async () => {
    // Mock rate limit response
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      status: 429,
      headers: { 'retry-after': '60' }
    });
    
    const scraper = new CoopScraper();
    await expect(scraper.scrape()).resolves.not.toThrow();
  });
});
```

---

## 12. Appendix

### A. Planted Product SKU Reference

Current product lineup for scraper matching:

| Category | Products |
|----------|----------|
| **planted.chicken** | Nature, Lemon Herbs, Jerusalem Style, Crispy Strips, Burger |
| **planted.steak** | Classic, Paprika |
| **planted.kebab** | Original |
| **planted.pulled** | BBQ, Spicy Herbs |
| **planted.schnitzel** | Wiener Art, Classic |
| **planted.bratwurst** | Original, Herbs |
| **planted.duck** | Asian Style |
| **planted.skewers** | Herbs, Tandoori |
| **planted.filetwürfel** | Classic, A La Mexicana |
| **planted.burger** | Crispy |
| **planted.nuggets** | Classic |

### B. Market Coverage

| Market | Key Retailers | Key Delivery | Priority |
|--------|---------------|--------------|----------|
| Switzerland | Coop, Migros | Uber Eats, Just Eat | P0 |
| Germany | REWE, EDEKA | Wolt, Lieferando, Uber Eats | P0 |
| Austria | REWE, BILLA | Wolt, Lieferando | P1 |
| France | Carrefour | Uber Eats, Deliveroo | P1 |
| UK | Sainsbury's, Waitrose | Deliveroo, Uber Eats, Just Eat | P1 |
| Netherlands | Albert Heijn | Uber Eats, Thuisbezorgd | P2 |
| Italy | Carrefour | Glovo, Deliveroo | P2 |
| Spain | Carrefour | Glovo, Uber Eats | P2 |

### C. Key External Resources

| Resource | URL | Purpose |
|----------|-----|---------|
| Firebase Console | console.firebase.google.com | Database management |
| Algolia Dashboard | algolia.com/dashboard | Search configuration |
| ScraperAPI | scraperapi.com | Proxy service |
| MaxMind GeoLite2 | dev.maxmind.com/geoip/geolite2-free-geolocation-data | IP geolocation |
| Cloud Scheduler | console.cloud.google.com/cloudscheduler | Job scheduling |

### D. Useful Scraper Patterns

#### Handling Pagination

```typescript
async function* paginatedFetch<T>(
  fetcher: (page: number) => Promise<{ data: T[]; hasMore: boolean }>
): AsyncGenerator<T> {
  let page = 1;
  let hasMore = true;
  
  while (hasMore) {
    const result = await fetcher(page);
    for (const item of result.data) {
      yield item;
    }
    hasMore = result.hasMore;
    page++;
  }
}
```

#### Rate-Limited Fetch

```typescript
import pLimit from 'p-limit';

const limit = pLimit(5); // 5 concurrent requests

async function fetchWithRateLimit<T>(urls: string[]): Promise<T[]> {
  return Promise.all(
    urls.map(url => limit(() => fetch(url).then(r => r.json())))
  );
}
```

#### Retry with Exponential Backoff

```typescript
async function fetchWithRetry(
  url: string,
  maxRetries = 3,
  baseDelay = 1000
): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url);
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('retry-after') || '60');
        await sleep(retryAfter * 1000);
        continue;
      }
      return response;
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      await sleep(baseDelay * Math.pow(2, attempt));
    }
  }
  throw new Error('Max retries exceeded');
}
```

---

## Quick Start Checklist

- [ ] Create GitHub repository: `planted-availability-db`
- [ ] Set up Firebase project in europe-west6
- [ ] Enable Firestore, Functions, Storage, Hosting
- [ ] Initialize monorepo with pnpm + Turborepo
- [ ] Create core package with types
- [ ] Set up CI/CD with GitHub Actions
- [ ] Deploy first Cloud Function
- [ ] Create admin dashboard skeleton
- [ ] Implement first scraper (Coop)
- [ ] Set up monitoring and alerts

---

*Document generated December 2025. For questions, contact the development team.*
