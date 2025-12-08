# Planted Availability Database - System Overview & Integration Plan

## Executive Summary

The **Planted Availability Database (PAD)** is a comprehensive system for tracking where Planted products are available across retail stores, restaurants, and delivery platforms in Europe. This document provides a full overview of the current state, gaps, and action plan to achieve a fully automated, production-ready system.

---

## Current Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA COLLECTION LAYER                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Scrapers  │  │   Partner   │  │   Manual    │  │  Planted Locations  │ │
│  │  (17 impl)  │  │   Webhooks  │  │   Import    │  │   API (Salesforce)  │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
│         │                │                │                    │            │
│         └────────────────┴────────────────┴────────────────────┘            │
│                                    │                                        │
│                                    ▼                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                              STAGING & VALIDATION                            │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  Zod Schemas → Confidence Scoring → Conflict Detection → Review Queue │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────────┤
│                              FIRESTORE DATABASE                              │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌───────────┐ ┌─────────┐ ┌─────────┐ │
│  │ venues  │ │ dishes  │ │products │ │promotions │ │ chains  │ │ retail_ │ │
│  │  1800+  │ │   TBD   │ │   12    │ │    TBD    │ │   15+   │ │avail.   │ │
│  └─────────┘ └─────────┘ └─────────┘ └───────────┘ └─────────┘ └─────────┘ │
├─────────────────────────────────────────────────────────────────────────────┤
│                                 API LAYER                                    │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  Firebase Cloud Functions (europe-west6)                              │   │
│  │  • /api/v1/nearby     • /api/v1/venues     • /api/v1/dishes          │   │
│  │  • /api/v1/delivery   • /api/v1/admin/*    • /api/v1/partner/*       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────────┤
│                              CONSUMER LAYER                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │ Admin Dashboard │  │   Client SDK    │  │   Planted Website           │  │
│  │  (React SPA)    │  │  (React Hooks)  │  │   (Astro StoreLocator)      │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Package Status

| Package | Purpose | Status | Completeness |
|---------|---------|--------|--------------|
| `@pad/core` | Types, schemas, constants | ✅ Working | 100% |
| `@pad/database` | Firestore CRUD operations | ✅ Working | 100% |
| `@pad/api` | REST API endpoints | ✅ Working | 90% |
| `@pad/scrapers` | Data collection | ⚠️ Partial | 70% |
| `@pad/admin-dashboard` | Management UI | ⚠️ Partial | 40% |
| `@pad/client-sdk` | Website integration | ✅ Working | 100% |

---

## Data Flow: Current vs Target

### Current State (Manual)

```
JSON Files (retailers/*.json) ─────┐
                                   ├──► Astro Build ──► Static HTML ──► Website
TypeScript (deliveryRestaurants.ts)┘
```

### Target State (Automated)

```
Scrapers/Partners ──► Firestore ──► API ──► Client SDK ──► Website (Dynamic)
       │                  │
       ▼                  ▼
  Admin Dashboard    Real-time Updates
```

---

## Gap Analysis

### 1. DATA GAPS

| Data Type | Current Source | Target Source | Gap |
|-----------|---------------|---------------|-----|
| Retail Partners | 13 manual JSON files | Scrapers + API | Need to import & automate |
| Restaurant Locations | Static TS file (15 entries) | Firestore venues collection | **Have 69 from Planted API** |
| Store Locations | None | Firestore venues collection | **Have 1731 from Planted API** |
| Menu Dishes | Hardcoded in delivery data | Firestore dishes collection | Need to populate |
| Real-time Availability | None | Scraped daily | Need scraper activation |

### 2. INFRASTRUCTURE GAPS

| Component | Status | Gap |
|-----------|--------|-----|
| Firestore Database | ✅ Deployed | None |
| Cloud Functions | ✅ Deployed | None |
| Scraper Scheduler | ⚠️ Placeholder | Need Cloud Tasks queue |
| Proxy Service | ❌ Not configured | Need ScraperAPI or similar |
| Admin Dashboard | ⚠️ Shell only | Pages need API wiring |
| Website Integration | ❌ Not connected | Need to replace static data |

### 3. AUTOMATION GAPS

| Process | Current | Target |
|---------|---------|--------|
| Data collection | Manual | Daily automated scrapers |
| Data validation | None | Zod schemas + confidence scoring |
| Data approval | Manual | Auto-approve above threshold |
| Website updates | Rebuild required | Real-time via API |

---

## Scraped Data Available (Ready to Import)

From `https://locations.eatplanted.com/` (Salesforce API):

```
📊 TOTAL: 1,800 locations

BY TYPE:
  • Stores: 1,731
  • Restaurants: 69

BY COUNTRY:
  🇦🇹 Austria: 1,347 (mostly Billa)
  🇨🇭 Switzerland: 246 (Coop + Brezelkönig restaurants)
  🇩🇪 Germany: 171 (REWE)
  🇮🇹 Italy: 24
  🇬🇧 UK: 12 (Barburrito restaurants)

RESTAURANT BRANDS:
  • Brezelkönig: 57 locations (Switzerland)
  • Barburrito: 12 locations (UK)
```

**Files Ready:**
- `data/planted-all-locations.json` (1.3 MB)
- `data/planted-restaurants.json` (92 KB)
- `data/planted-stores.json` (1.3 MB)
- `data/planted-restaurants.csv` (13 KB)

---

## Action Plan: Getting to Production

### Phase 1: Import Existing Data (Day 1)

**Goal:** Populate Firestore with all available location data

1. **Import 1,800 Planted Locations**
   - Create import script
   - Transform scraped data to venue schema
   - Batch write to Firestore
   - Create chains for Brezelkönig, Barburrito, Billa, Coop, REWE

2. **Import Existing Website Data**
   - Convert retailers/*.json to chains + venues
   - Convert deliveryRestaurants.ts to venues + dishes

### Phase 2: Wire Up Admin Dashboard (Day 2)

**Goal:** Admin can view and manage all data

1. **Fix Dashboard Stats**
   - Connect to real API endpoints
   - Show actual venue/dish/scraper counts

2. **Complete Venues Page**
   - List all venues with pagination
   - Filter by country, type, chain
   - Add/Edit/Delete functionality

3. **Complete Dishes Page**
   - List dishes by venue
   - CRUD operations

### Phase 3: Connect Website (Day 3)

**Goal:** Store Locator displays live data from PAD

1. **Install Client SDK**
   ```bash
   cd planted-astro
   npm install @pad/client-sdk
   ```

2. **Create API Wrapper Component**
   - Fetch data from PAD API
   - Fallback to static data if API fails

3. **Update StoreLocator.astro**
   - Replace static imports with API calls
   - Add loading states
   - Keep existing UI/styling

### Phase 4: Activate Scrapers (Day 4-5)

**Goal:** Automated daily data refresh

1. **Configure Proxy Service**
   - Sign up for ScraperAPI or similar
   - Add environment variables

2. **Test Individual Scrapers**
   ```bash
   cd packages/scrapers
   pnpm scrape coop --dry-run --verbose
   pnpm scrape wolt --dry-run --verbose
   ```

3. **Enable Scheduled Orchestrator**
   - Update dailyScraperOrchestrator to actually run scrapers
   - Configure Cloud Tasks for parallel execution

4. **Set Up Monitoring**
   - Slack webhook for failures
   - Daily summary reports

### Phase 5: Polish & Scale (Week 2)

1. **Add Search Functionality**
   - Algolia integration for full-text search
   - Address autocomplete

2. **Add Map Display**
   - Integrate Mapbox or Google Maps
   - Show venue markers
   - Distance-based sorting

3. **Performance Optimization**
   - CDN caching for API responses
   - Geohash indexing for proximity queries

---

## Quick Wins (Can Do Right Now)

1. **Import scraped restaurant data to Firestore** - 30 mins
2. **Fix admin dashboard to show real stats** - 1 hour
3. **Create chains for known brands** - 30 mins
4. **Test API endpoints with Postman/curl** - 15 mins

---

## Environment Variables Needed

```bash
# Firebase (required)
FIREBASE_PROJECT_ID=get-planted-db
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...

# Scraper Proxy (required for production scrapers)
SCRAPER_API_KEY=...

# Optional Services
SLACK_WEBHOOK_URL=...
ALGOLIA_APP_ID=...
ALGOLIA_API_KEY=...
MAXMIND_LICENSE_KEY=...
```

---

## API Endpoints Available

### Public (No Auth)
```
GET  /api/v1/nearby?lat=47.3&lng=8.5&radius_km=10
GET  /api/v1/venues?country=CH&type=restaurant
GET  /api/v1/venues/:id
GET  /api/v1/dishes?venue_id=xxx
GET  /api/v1/delivery/check?postal_code=8000&country=CH
```

### Admin (Firebase Auth Required)
```
POST   /api/v1/admin/venues
PUT    /api/v1/admin/venues/:id
DELETE /api/v1/admin/venues/:id
GET    /api/v1/admin/scraper-status
```

---

## Deployment Commands

```bash
# Build everything
pnpm build

# Deploy functions + hosting
firebase deploy

# Deploy only functions
firebase deploy --only functions

# Deploy only admin dashboard
firebase deploy --only hosting

# Run scrapers locally
cd packages/scrapers
pnpm scrape <scraper-name> --dry-run
```

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Venues in database | 0 | 2,000+ |
| Countries covered | 0 | 8 |
| Automated scraper runs/day | 0 | 10+ |
| API response time | N/A | <200ms |
| Data freshness | N/A | <24 hours |
| Admin dashboard uptime | Unknown | 99.9% |

---

## Next Step

**Run the data import script to populate Firestore with the 1,800 scraped locations.**
