# Admin Portal Redesign Plan

## Executive Summary

A fundamental redesign of the PAD Admin Portal to transform it from a fragmented 11-page dashboard into a focused, workflow-driven command center optimized for scraping management, venue review, and website synchronization.

---

## Current State Analysis

### Pain Points Identified

1. **Fragmented Navigation (11 pages)**
   - Dashboard (placeholder with zeros)
   - Venues, Dishes, Scrapers, Promotions, Moderation
   - Discovery Review, Partners, Budget, Analytics, Batch Import
   - Users must navigate between multiple pages to complete simple workflows

2. **No Clear Workflow**
   - Discovery → Review → Production pipeline is scattered across pages
   - No visual representation of data flow
   - "Push to website" functionality missing entirely

3. **Dashboard is Useless**
   - Shows hardcoded zeros
   - No real-time metrics or actionable insights
   - No quick access to pending work

4. **Discovery Review Buried**
   - Hidden as one of 11 nav items
   - Should be the PRIMARY workflow for the team
   - No hierarchical view as requested

5. **Scraper Management is Read-Only**
   - Can only view scraper runs
   - Cannot trigger, pause, or configure scrapers
   - Platform health monitoring not visible

6. **No Reinforcement Learning Support**
   - Cannot provide feedback on AI confidence scores
   - No way to mark AI decisions as correct/incorrect
   - Missing training signal loop

### Current Architecture Strengths (Keep)

- React Query for data fetching (excellent caching)
- Firebase Authentication (working well)
- Custom CSS variables (consistent theming)
- API client structure (well-organized)
- VenuesPage grouping logic (good foundation)
- Notification system (useful)

---

## Redesign Architecture

### New Navigation Structure (4 Core Areas)

```
+------------------+
|  PAD Command     |
|    Center        |
+------------------+
| 1. Dashboard     | <- Real-time metrics, pending work, platform health
| 2. Review Queue  | <- PRIMARY: Discovery review workflow
| 3. Data Browser  | <- Hierarchical venue/dish exploration
| 4. Operations    | <- Scrapers, sync, settings
+------------------+
```

### Page Breakdown

#### 1. Dashboard (Command Center)
**Purpose**: At-a-glance status and quick actions

```
+--------------------------------------------------+
|  COMMAND CENTER                                   |
+--------------------------------------------------+
| [Pending Review: 47] [Verified Today: 12]        |
| [Platform Health]    [Website Sync Status]        |
+--------------------------------------------------+
|                      |                            |
|  REVIEW QUEUE        |  PLATFORM HEALTH           |
|  High Conf: 23       |  [====] Wolt: 98%          |
|  Medium: 15          |  [====] Uber: 94%          |
|  Low: 9              |  [==  ] Lieferando: 72%    |
|  [Start Review ->]   |  [    ] JustEat: Down      |
|                      |                            |
+--------------------------------------------------+
|  RECENT ACTIVITY                                  |
|  - Verified "Hans im Gluck Berlin" (2m ago)       |
|  - Scraper completed: DE-wolt (5m ago)           |
|  - 3 new venues discovered (15m ago)             |
+--------------------------------------------------+
|  QUICK ACTIONS                                    |
|  [Run Discovery] [Sync to Website] [View Reports] |
+--------------------------------------------------+
```

#### 2. Review Queue (Primary Workflow)
**Purpose**: Efficient venue/dish review with AI feedback

```
+--------------------------------------------------+
| REVIEW QUEUE                        [Filters v]  |
+--------------------------------------------------+
| View: [Hierarchical] [Cards] [Table]             |
| Group: [Country > Type > Chain > Location]       |
+--------------------------------------------------+
|                                                   |
| DE Germany (23 pending)                       [-] |
| +-- Foodservice (18)                             |
|     +-- Hans im Gluck (5 locations)              |
|         +-- Berlin Mitte                         |
|             [x] Planted Burger    CHF 18.90      |
|             [ ] Vegan Schnitzel   CHF 16.50      |
|             [Verify All] [Edit] [Reject]         |
|         +-- Munich Hauptbahnhof                  |
|             ...                                   |
|     +-- KAIMUG (3 locations)                     |
|         ...                                       |
| +-- Retail (5)                                   |
|     +-- Independent (5)                          |
|         +-- Bio Company Berlin                   |
|             ...                                   |
|                                                   |
| CH Switzerland (15 pending)                   [+] |
| AT Austria (9 pending)                        [+] |
+--------------------------------------------------+
| BULK ACTIONS: [Verify 47 Selected] [Reject]      |
+--------------------------------------------------+
```

**Key Features:**
- Hierarchical drill-down (Country → Type → Chain → Location → Dishes)
- Inline editing without modals for speed
- AI confidence indicators with feedback buttons
- Bulk operations at every level
- Keyboard shortcuts (j/k navigate, v=verify, r=reject, e=edit)

#### 3. Data Browser
**Purpose**: Explore and manage verified production data

```
+--------------------------------------------------+
| DATA BROWSER                                      |
+--------------------------------------------------+
| [Venues: 1,247] [Dishes: 8,934] [Chains: 156]    |
+--------------------------------------------------+
| Filter: [Country v] [Type v] [Chain v] [Search]  |
+--------------------------------------------------+
|                         |                         |
|  HIERARCHY              |  DETAIL PANEL           |
|  ---------------------- |  ---------------------- |
|  v DE Germany (456)     |  Hans im Gluck          |
|    v Foodservice (312)  |  Chain ID: hans-im-gluck|
|      > Hans im Gluck    |  Type: Foodservice      |
|      > KAIMUG           |  Locations: 42          |
|      > L'Osteria        |  Dishes: 156            |
|    > Retail (144)       |  Countries: DE, AT, CH  |
|  > CH Switzerland       |  ---------------------- |
|  > AT Austria           |  DISHES                 |
|                         |  - Planted Burger       |
|                         |  - Vegan Schnitzel      |
|                         |  ---------------------- |
|                         |  ACTIONS                |
|                         |  [Edit] [Sync to Web]   |
|                         |  [View on Website]      |
+--------------------------------------------------+
```

#### 4. Operations
**Purpose**: Scraper management, website sync, system settings

```
+--------------------------------------------------+
| OPERATIONS                                        |
+--------------------------------------------------+
| TABS: [Scrapers] [Website Sync] [Platform Health]|
+--------------------------------------------------+

=== SCRAPERS TAB ===
+--------------------------------------------------+
| ACTIVE SCRAPERS                                   |
| [DE-wolt] Running... 45/120 venues    [Stop]     |
| [AT-wolt] Queued                       [Cancel]  |
+--------------------------------------------------+
| AVAILABLE SCRAPERS                                |
| +------------------+------------------+           |
| | DE - Wolt        | DE - Uber Eats   |           |
| | Last: 2h ago     | Last: 4h ago     |           |
| | [Run Now]        | [Run Now]        |           |
| +------------------+------------------+           |
| | CH - Wolt        | CH - Smood       |           |
| | Last: 1h ago     | Last: 6h ago     |           |
| | [Run Now]        | [Run Now]        |           |
| +------------------+------------------+           |
+--------------------------------------------------+
| DISCOVERY AGENTS                                  |
| [Run Chain Discovery] [Run Dish Finder]          |
+--------------------------------------------------+

=== WEBSITE SYNC TAB ===
+--------------------------------------------------+
| SYNC STATUS                                       |
| Last sync: 2 hours ago                           |
| Pending changes: 23 venues, 156 dishes           |
+--------------------------------------------------+
| PREVIEW CHANGES                                   |
| + 12 new venues to add                           |
| ~ 8 venues to update                             |
| - 3 venues to remove                             |
+--------------------------------------------------+
| [Preview Full Diff] [Sync Now] [Schedule Sync]   |
+--------------------------------------------------+

=== PLATFORM HEALTH TAB ===
+--------------------------------------------------+
| PLATFORM STATUS (Last 24h)                       |
+--------------------------------------------------+
| Platform     | Success | Avg Time | Status       |
|--------------|---------|----------|--------------|
| Wolt         | 98.2%   | 1.2s     | [Healthy]    |
| Uber Eats    | 94.5%   | 2.1s     | [Healthy]    |
| Lieferando   | 72.1%   | 3.4s     | [Degraded]   |
| Just Eat     | 0%      | -        | [Down]       |
| Deliveroo    | 88.9%   | 1.8s     | [Healthy]    |
+--------------------------------------------------+
| CIRCUIT BREAKERS                                  |
| Lieferando: HALF_OPEN (will retry in 5m)         |
| Just Eat: OPEN (blocked for 2h)                  |
+--------------------------------------------------+
```

---

## AI Feedback Loop for Reinforcement Learning

### Confidence Feedback UI

Every AI-detected dish shows its confidence score with feedback buttons:

```
+--------------------------------------------------+
| Planted Burger with Cheese                        |
| Price: CHF 18.90                                  |
| AI Confidence: [=======   ] 72%                   |
|                                                   |
| Matched Product: planted-chicken-burger           |
| Why: "Name contains 'Planted', description        |
|       mentions 'plant-based patty'"               |
|                                                   |
| Was this match correct?                           |
| [Yes, Correct] [No, Wrong Product] [Not Planted] |
+--------------------------------------------------+
```

### Feedback Data Collection

```typescript
interface AIFeedback {
  id: string;
  dish_id: string;
  venue_id: string;
  ai_prediction: {
    product_sku: string;
    confidence: number;
    factors: string[];
  };
  human_feedback: 'correct' | 'wrong_product' | 'not_planted' | 'needs_review';
  correct_product_sku?: string;  // If wrong_product
  reviewer_id: string;
  timestamp: Date;
}
```

### Training Signal Integration

The feedback loop feeds into:
1. **Real-time confidence adjustment** - Boost/penalize similar patterns
2. **Batch training data export** - For model retraining
3. **Pattern learning** - Automatic rule generation for common corrections

---

## Implementation Plan

### Phase 1: Foundation (New Layout & Navigation)

**Files to modify:**
- `App.tsx` - Simplify routes to 4 main pages
- `Layout.tsx` - New sidebar with 4 main sections
- `index.css` - Add new CSS classes for hierarchical views

**New files:**
- `pages/CommandCenterPage.tsx` - Real-time dashboard
- `pages/ReviewQueuePage.tsx` - Hierarchical review
- `pages/DataBrowserPage.tsx` - Production data explorer
- `pages/OperationsPage.tsx` - Scrapers, sync, health

### Phase 2: Command Center Dashboard

**Components:**
- `components/dashboard/PlatformHealthWidget.tsx`
- `components/dashboard/ReviewQueueWidget.tsx`
- `components/dashboard/RecentActivityWidget.tsx`
- `components/dashboard/QuickActionsWidget.tsx`
- `components/dashboard/SyncStatusWidget.tsx`

**API additions:**
- `dashboardApi.getMetrics()` - Real-time counts
- `dashboardApi.getRecentActivity()` - Activity feed
- `platformHealthApi.getSummary()` - Platform status

### Phase 3: Hierarchical Review Queue

**Components:**
- `components/review/HierarchicalTree.tsx` - Collapsible tree
- `components/review/CountryNode.tsx`
- `components/review/VenueTypeNode.tsx`
- `components/review/ChainNode.tsx`
- `components/review/LocationNode.tsx`
- `components/review/DishRow.tsx` - Inline dish editor
- `components/review/AIFeedbackButtons.tsx`
- `components/review/BulkActionBar.tsx`

**State management:**
- `hooks/useHierarchicalData.ts` - Transform flat data to tree
- `hooks/useKeyboardShortcuts.ts` - j/k/v/r/e shortcuts

### Phase 4: Data Browser

**Components:**
- `components/browser/TreeView.tsx` - Left panel tree
- `components/browser/DetailPanel.tsx` - Right panel details
- `components/browser/VenueDetail.tsx`
- `components/browser/DishList.tsx`
- `components/browser/ChainDetail.tsx`

### Phase 5: Operations Center

**Components:**
- `components/operations/ScraperManager.tsx`
- `components/operations/ScraperCard.tsx`
- `components/operations/WebsiteSyncPanel.tsx`
- `components/operations/SyncPreview.tsx`
- `components/operations/PlatformHealthTable.tsx`
- `components/operations/CircuitBreakerStatus.tsx`

**API additions:**
- `scrapersApi.trigger(scraperId)` - Manual trigger
- `scrapersApi.stop(runId)` - Stop running scraper
- `syncApi.preview()` - Get pending changes
- `syncApi.execute()` - Push to website
- `platformHealthApi.getCircuitBreakers()`

### Phase 6: AI Feedback Integration

**Components:**
- `components/ai/ConfidenceBar.tsx` - Visual confidence
- `components/ai/FeedbackButtons.tsx` - Correct/Wrong/Not Planted
- `components/ai/MatchExplanation.tsx` - Why AI matched

**API additions:**
- `feedbackApi.submit(feedback)` - Record feedback
- `feedbackApi.getStats()` - Feedback metrics
- `feedbackApi.exportTrainingData()` - For model retraining

---

## Data Transformations

### Hierarchical Data Structure

```typescript
interface HierarchicalData {
  countries: CountryNode[];
}

interface CountryNode {
  code: string;
  name: string;
  pendingCount: number;
  expanded: boolean;
  venueTypes: VenueTypeNode[];
}

interface VenueTypeNode {
  type: 'restaurant' | 'retail' | 'delivery_kitchen';
  label: string;
  pendingCount: number;
  expanded: boolean;
  chains: ChainNode[];
  independents: LocationNode[];  // Non-chain venues
}

interface ChainNode {
  chainId: string;
  chainName: string;
  pendingCount: number;
  expanded: boolean;
  locations: LocationNode[];
}

interface LocationNode {
  venueId: string;
  name: string;
  address: string;
  city: string;
  pendingCount: number;
  expanded: boolean;
  dishes: DishNode[];
  confidence: number;
  status: 'discovered' | 'verified' | 'rejected';
}

interface DishNode {
  dishId: string;
  name: string;
  price: string;
  product: string;
  confidence: number;
  selected: boolean;
  aiFactors: string[];
}
```

### Transform Function

```typescript
function buildHierarchy(venues: DiscoveredVenue[]): HierarchicalData {
  const byCountry = groupBy(venues, v => v.address.country);

  return {
    countries: Object.entries(byCountry).map(([code, countryVenues]) => ({
      code,
      name: COUNTRY_NAMES[code],
      pendingCount: countryVenues.filter(v => v.status === 'discovered').length,
      expanded: false,
      venueTypes: buildVenueTypes(countryVenues),
    }))
  };
}

function buildVenueTypes(venues: DiscoveredVenue[]): VenueTypeNode[] {
  const byType = groupBy(venues, v => v.type || 'restaurant');

  return Object.entries(byType).map(([type, typeVenues]) => {
    const chains = typeVenues.filter(v => v.chain_id);
    const independents = typeVenues.filter(v => !v.chain_id);

    return {
      type,
      label: TYPE_LABELS[type],
      pendingCount: typeVenues.filter(v => v.status === 'discovered').length,
      expanded: false,
      chains: buildChains(chains),
      independents: independents.map(buildLocation),
    };
  });
}
```

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `j` | Move down in list |
| `k` | Move up in list |
| `Enter` | Expand/collapse node |
| `v` | Verify selected |
| `r` | Reject selected (prompts for reason) |
| `e` | Edit selected |
| `Space` | Toggle selection |
| `a` | Select all at current level |
| `?` | Show keyboard shortcuts |

---

## Migration Strategy

### Week 1: Foundation
- Create new page structure
- Update navigation
- Keep old pages accessible via hidden routes

### Week 2: Command Center + Review Queue
- Implement dashboard widgets
- Build hierarchical tree view
- Add keyboard shortcuts

### Week 3: Data Browser + Operations
- Production data explorer
- Scraper management
- Website sync

### Week 4: AI Feedback + Polish
- Feedback buttons and collection
- Training data export
- Bug fixes and optimization

---

## Success Metrics

1. **Review Efficiency**: Time to review a venue < 30 seconds
2. **Workflow Completion**: 90% of discovered venues reviewed within 24h
3. **AI Feedback**: 100+ feedback signals collected per week
4. **Sync Frequency**: Website updated daily with new venues
5. **Team Satisfaction**: Positive feedback from review team

---

## Files to Create

```
packages/admin-dashboard/src/
├── pages/
│   ├── CommandCenterPage.tsx    (NEW)
│   ├── ReviewQueuePage.tsx      (NEW)
│   ├── DataBrowserPage.tsx      (NEW)
│   └── OperationsPage.tsx       (NEW)
├── components/
│   ├── dashboard/
│   │   ├── PlatformHealthWidget.tsx
│   │   ├── ReviewQueueWidget.tsx
│   │   ├── RecentActivityWidget.tsx
│   │   ├── QuickActionsWidget.tsx
│   │   └── SyncStatusWidget.tsx
│   ├── review/
│   │   ├── HierarchicalTree.tsx
│   │   ├── CountryNode.tsx
│   │   ├── VenueTypeNode.tsx
│   │   ├── ChainNode.tsx
│   │   ├── LocationNode.tsx
│   │   ├── DishRow.tsx
│   │   ├── AIFeedbackButtons.tsx
│   │   └── BulkActionBar.tsx
│   ├── browser/
│   │   ├── TreeView.tsx
│   │   ├── DetailPanel.tsx
│   │   └── SearchBar.tsx
│   ├── operations/
│   │   ├── ScraperManager.tsx
│   │   ├── WebsiteSyncPanel.tsx
│   │   └── PlatformHealthTable.tsx
│   └── ai/
│       ├── ConfidenceBar.tsx
│       ├── FeedbackButtons.tsx
│       └── MatchExplanation.tsx
├── hooks/
│   ├── useHierarchicalData.ts
│   ├── useKeyboardShortcuts.ts
│   └── useSyncStatus.ts
└── lib/
    └── api.ts  (add new endpoints)
```

## API Endpoints to Add

```typescript
// Dashboard
GET /admin/metrics          -> { pending, verified, rejected, byPlatform }
GET /admin/activity         -> { events: ActivityEvent[] }

// Platform Health
GET /admin/platform-health  -> { platforms: PlatformHealth[] }
GET /admin/circuit-breakers -> { breakers: CircuitBreakerStatus[] }

// Scraper Control
POST /admin/scrapers/:id/trigger -> { runId: string }
POST /admin/scrapers/:runId/stop -> { success: boolean }
GET  /admin/scrapers/available   -> { scrapers: AvailableScraper[] }

// Website Sync
GET  /admin/sync/preview    -> { toAdd, toUpdate, toRemove }
POST /admin/sync/execute    -> { synced: number, errors: string[] }
GET  /admin/sync/status     -> { lastSync, pendingCount }

// AI Feedback
POST /admin/feedback        -> { success: boolean }
GET  /admin/feedback/stats  -> { correct, wrong, notPlanted }
GET  /admin/feedback/export -> CSV/JSON training data
```
