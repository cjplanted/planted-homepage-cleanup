# Future Improvements Roadmap

This document outlines potential improvements and enhancements for the Planted Availability Database system.

> **Last Updated:** December 2024

---

## 0. Critical: Security & Compliance (PRIORITY)

### 0.1 Secrets Management (CRITICAL)

**Current Issue:** API keys and credentials must never be stored in documentation or code repositories.

**Required Actions:**
1. Use environment variables exclusively for all secrets
2. Implement secrets rotation strategy (90-day rotation for API keys)
3. Use Google Secret Manager or similar for production secrets
4. Audit all repositories for accidentally committed secrets

**Implementation:**
```bash
# Use Secret Manager for production
gcloud secrets create google-ai-api-key --replication-policy="automatic"
gcloud secrets versions add google-ai-api-key --data-file=./key.txt

# Reference in Cloud Functions
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
```

### 0.2 Data Privacy & GDPR Compliance

**Requirements:**
- Document what user data is collected (if any)
- Implement data retention policies (auto-delete after X days)
- Add privacy policy for admin dashboard users
- Ensure scraped data doesn't include personal information
- Add data export/deletion capabilities for GDPR requests

**Implementation Checklist:**
- [ ] Data inventory document
- [ ] Privacy policy for admin users
- [ ] Data retention automation (Cloud Scheduler + cleanup function)
- [ ] Right-to-erasure endpoint

### 0.3 API Security Hardening

**Current Gaps:**
- Rate limiting per client
- Request validation/sanitization
- API key authentication for public endpoints
- Abuse detection

**Implementation:**
```typescript
// Rate limiting middleware
const rateLimit = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later'
};

// Request validation
const validateVenueQuery = z.object({
  country: z.enum(['CH', 'DE', 'AT']).optional(),
  limit: z.number().min(1).max(100).default(50),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional()
});
```

### 0.4 Security Auditing

**Recurring Tasks:**
- Monthly: Review Firebase security rules
- Quarterly: Dependency vulnerability scan (`npm audit`, `pnpm audit`)
- Quarterly: Review API access logs for anomalies
- Annually: External security assessment

**Tooling:**
- GitHub Dependabot for automatic vulnerability alerts
- Snyk for continuous security monitoring
- Firebase App Check for client verification

---

## 1. Architecture Improvements

### 1.1 Real-time Data Sync
- **Current**: Manual export/sync between Firestore and website
- **Improvement**: Use Firebase Realtime triggers to auto-update website data
- **Benefit**: Zero-latency updates when venues are verified

### 1.2 GraphQL API
- **Current**: REST endpoints with fixed response shapes
- **Improvement**: Implement GraphQL layer for flexible querying
- **Benefit**: Clients can request exactly the data they need

### 1.3 Edge Caching
- **Current**: Direct Firebase calls for all requests
- **Improvement**: Add Cloudflare Workers or similar edge caching
- **Benefit**: Faster response times, reduced costs

### 1.4 Webhook Integrations
- **Current**: Partner data manually ingested
- **Improvement**: Standardized webhook endpoints for partners
- **Benefit**: Automated data ingestion from partner systems

---

## 2. AI & Search Infrastructure

### 2.1 Gemini 2.5 Flash as Default AI

**Configuration:**
- **Default Model**: `gemini-2.5-flash` for all discovery and extraction tasks
- **Fallback**: `gemini-2.0-flash` if 2.5 unavailable
- **Alternative**: Claude (claude-sonnet-4) for complex reasoning tasks

**Implementation:**
```typescript
// DishFinderAIClient configuration
const DEFAULT_MODEL = 'gemini-2.5-flash';
const FALLBACK_MODEL = 'gemini-2.0-flash';

// Environment variable (see .env.example)
// GOOGLE_AI_API_KEY=<your-api-key>
```

**Benefits:**
- Higher context window for full menu extraction
- Faster response times vs Claude
- Cost-effective (high quota available)
- Better structured JSON output

**Tasks:**
1. Update `DishFinderAIClient` default model to `gemini-2.5-flash`
2. Update `SmartDiscoveryAgent` AI client to prefer Gemini
3. Add model fallback logic for rate limits
4. Update environment documentation

### 2.2 Google Custom Search Integration

**Current Implementation (Already Built):**
- `SearchEnginePool` manages multiple API credentials
- Automatic rotation on 429 rate limit errors
- Daily quota tracking in Firestore (`search_engine_quota`)
- Supports JSON array and numbered env var configurations

**Google Custom Search API Specifications:**
- Free tier: 100 queries/day per credential
- Paid tier: $5 per 1,000 queries, up to 10,000/day
- API endpoint: `https://www.googleapis.com/customsearch/v1`
- Response: JSON with `items[]` array (title, link, snippet)

**Budget Configuration:**
```
Daily Budget: 2,000 queries per discovery run
Strategy: 6 search engines (600 free) + paid fallback (1,400 paid)
Cost: $0 for first 600, then $5/1,000 queries
Max daily cost: $7 (for 2,000 queries)
```

**Configuration:**
```bash
# See .env.example for all required environment variables
# Primary API key (high quota)
GOOGLE_SEARCH_API_KEY=<your-api-key>

# Search Engine ID (configured for site-restricted search)
GOOGLE_SEARCH_ENGINE_ID=<your-engine-id>

# Budget limit per run
MAX_QUERIES_PER_RUN=2000
```

**Tasks:**
1. ~~Create Google Programmable Search Engine~~ (DONE - 6 engines created)
2. Configure for sites: `ubereats.com`, `lieferando.de`, `lieferando.at`, `just-eat.ch`, `wolt.com`, `smood.ch`
3. Enable billing in Google Cloud Console for paid fallback
4. Update `SearchEnginePool` to support paid fallback mode
5. Set daily spending limits in Cloud Console ($10/day cap)
6. Add query cost tracking and alerting

### 2.3 Search Efficiency Optimization

To maximize the value of the 2,000 daily query budget, implement these optimizations:

#### A. Query Deduplication
- **Cache recent queries** (24h TTL) to avoid repeating identical searches
- **Normalize queries** before caching (lowercase, trim, sort terms)
- **Skip queries** that have been executed in the last 7 days with no results

```typescript
interface QueryCache {
  query_hash: string;
  executed_at: Date;
  results_count: number;
  ttl: '24h' | '7d';
}
```

#### B. Smart Query Prioritization
Prioritize queries by expected yield:

| Priority | Query Type | Expected Yield | Budget Allocation |
|----------|------------|----------------|-------------------|
| 1 | Known chain + city | 80% | 40% (800 queries) |
| 2 | High-success strategies | 60% | 30% (600 queries) |
| 3 | New city exploration | 30% | 20% (400 queries) |
| 4 | Experimental queries | 15% | 10% (200 queries) |

#### C. Batch City Processing
Instead of individual city queries, batch nearby cities:

```typescript
// Before: 3 queries
"planted chicken Zürich"
"planted chicken Winterthur"
"planted chicken Baden"

// After: 1 query
"planted chicken (Zürich OR Winterthur OR Baden)"
```

**Efficiency Gain:** 3x reduction for city clusters

#### D. Platform-Specific Site Restrictions
Use precise site: queries to reduce noise:

```typescript
// Inefficient (broad search)
"planted chicken restaurant Berlin"

// Efficient (site-restricted)
"site:lieferando.de planted chicken Berlin"
"site:wolt.com/en/deu/berlin planted"
```

#### E. Skip Known Venues
Before executing a query, check if target venues already exist:

```typescript
async function shouldSkipQuery(query: string): Promise<boolean> {
  // Extract city and platform from query
  const { city, platform } = parseQuery(query);

  // Check existing venue coverage
  const coverage = await getVenueCoverage(city, platform);

  // Skip if >90% coverage achieved
  return coverage > 0.9;
}
```

#### F. Incremental Discovery
Track last discovery date per city/platform and only re-query after threshold:

```typescript
interface DiscoveryCoverage {
  city: string;
  platform: DeliveryPlatform;
  last_discovery: Date;
  venues_found: number;
  coverage_score: number;  // 0-100
  next_discovery_due: Date;  // last + 30 days
}
```

#### G. Query Budget Allocation Algorithm

```typescript
async function allocateQueryBudget(totalBudget: number = 2000): QueryPlan {
  const plan: QueryPlan = {
    chain_enumeration: [],     // 40%
    high_yield_strategies: [], // 30%
    city_exploration: [],      // 20%
    experimental: [],          // 10%
  };

  // 1. Chain enumeration (highest ROI)
  const chains = await getVerifiedChainsNeedingDiscovery();
  plan.chain_enumeration = chains.slice(0, Math.floor(totalBudget * 0.4));

  // 2. High-yield strategies (>50% success rate)
  const strategies = await getStrategiesBySuccessRate(0.5);
  plan.high_yield_strategies = strategies.slice(0, Math.floor(totalBudget * 0.3));

  // 3. City exploration (uncovered cities)
  const cities = await getUncoveredCities();
  plan.city_exploration = cities.slice(0, Math.floor(totalBudget * 0.2));

  // 4. Experimental (new strategies, edge cases)
  plan.experimental = await generateExperimentalQueries(Math.floor(totalBudget * 0.1));

  return plan;
}
```

### 2.4 Query Efficiency Metrics

Track these KPIs to measure search efficiency:

| Metric | Target | Calculation |
|--------|--------|-------------|
| Queries per venue | <5 | total_queries / venues_found |
| Discovery rate | >20% | venues_found / queries_executed |
| Duplicate rate | <10% | skipped_duplicates / total_planned |
| Budget utilization | >90% | queries_used / budget |
| Cost per venue | <$0.05 | total_cost / venues_found |

---

## 3. Discovery System Improvements

### 3.1 Multi-Model AI
- **Current**: Gemini for extraction, optional Claude for reasoning
- **Improvement**: Combine with vision models (Gemini Vision)
- **Use Cases**:
  - Extract menu items from menu images
  - Verify dishes from food photos
  - Read prices from image-based menus

### 3.2 Automated Verification
- **Current**: All venues require manual review
- **Improvement**: Auto-verify venues with 90%+ confidence from verified chains
- **Rules Engine**:
  - Known chain + high confidence = auto-verify
  - Duplicate URL detection = auto-reject
  - Brand misuse patterns = auto-reject

### 3.3 Geo-Clustering
- **Current**: Venues reviewed individually
- **Improvement**: Group nearby venues for batch verification
- **Benefit**: Faster reviews, easier to spot patterns

### 3.4 Price Monitoring
- **Current**: Prices captured at discovery time
- **Improvement**: Weekly price checks with change alerts
- **Features**:
  - Price history graphs
  - Alerts for significant price changes (>10%)
  - Price comparison across platforms

### 3.5 Combined Venue + Dish Discovery
- **Current**: Separate discovery and extraction processes
- **Improvement**: Inline dish extraction during venue discovery
- **Benefit**: Single review workflow, faster time-to-production

### 3.6 Platform Resilience & Anti-Bot Handling

**Problem:** Delivery platforms frequently change their HTML structure and implement anti-bot measures.

**Current Gaps:**
- No detection when platform structures change
- No fallback when Puppeteer is blocked
- No versioning of platform adapters

**Improvements:**

#### A. Platform Structure Monitoring
```typescript
interface PlatformHealthCheck {
  platform: DeliveryPlatform;
  last_successful_scrape: Date;
  consecutive_failures: number;
  html_signature_hash: string;  // Detect structural changes
  status: 'healthy' | 'degraded' | 'broken';
}

// Alert when platform breaks
if (consecutiveFailures >= 3) {
  await sendAlert('Platform adapter may need update', { platform });
}
```

#### B. Anti-Bot Countermeasures
- **Headless browser rotation**: Switch between Puppeteer, Playwright, and cloud browser services
- **Residential proxy pool**: Rotate IPs to avoid rate limiting
- **Request fingerprint randomization**: Randomize headers, viewport, timing
- **Cloud browser fallback**: Use Browserless.io or similar when local fails

```typescript
const browserStrategies = [
  { type: 'puppeteer-local', priority: 1 },
  { type: 'playwright-local', priority: 2 },
  { type: 'browserless-cloud', priority: 3, costPerRequest: 0.01 },
  { type: 'scrapingbee', priority: 4, costPerRequest: 0.002 }
];
```

#### C. Platform Adapter Versioning
- Tag each adapter with a version
- Keep previous versions for rollback
- A/B test new adapter versions before full deployment

#### D. Graceful Degradation
When scraping fails:
1. Serve cached data (mark as "last updated X days ago")
2. Show "temporarily unavailable" for specific platforms
3. Fall back to alternative data sources (Google Places, etc.)

### 3.7 Menu Change Detection

**Problem:** Menus change frequently, but we only discover dishes at initial scrape.

**Solution:**
```typescript
interface MenuSnapshot {
  venue_id: string;
  platform: DeliveryPlatform;
  snapshot_date: Date;
  dish_hashes: string[];  // Hash of dish names + prices
  total_dishes: number;
}

// Weekly comparison job
async function detectMenuChanges(): Promise<MenuChangeReport[]> {
  // Compare current menu to last snapshot
  // Alert on significant changes (>10% dishes changed)
  // Trigger re-extraction for changed venues
}
```

---

## 4. Admin Dashboard Improvements

### 4.1 Analytics Dashboard
- **Metrics**:
  - Discovery success rate over time
  - Platform coverage by country
  - Average time from discovery to production
  - Reviewer productivity metrics
  - Query budget usage and efficiency
- **Visualizations**:
  - Charts for trends
  - Maps for geographic distribution
  - Heatmaps for platform activity

### 4.2 Batch Import
- **Current**: Manual venue creation only
- **Improvement**: CSV/Excel upload for bulk additions
- **Features**:
  - Template download
  - Validation before import
  - Progress tracking
  - Error reporting

### 4.3 Notification System
- **Alerts**:
  - Stale venues needing re-verification
  - Failed scraper runs
  - New discoveries pending review
  - Query budget warnings (80%, 90%, 100%)
- **Channels**:
  - In-app notifications
  - Email digests
  - Slack integration

### 4.4 Audit Log Viewer
- **Current**: Changes tracked but not viewable
- **Improvement**: Full audit log UI
- **Features**:
  - Search by user, date, action type
  - Diff view for changes
  - Export capability

### 4.5 Role-Based Access Control
- **Current**: Single admin role
- **Improvement**: Multiple roles with different permissions
- **Roles**:
  - Viewer: Read-only access
  - Reviewer: Can verify/reject discoveries
  - Editor: Can modify venues and dishes
  - Admin: Full access including partners and settings

---

## 5. Website Improvements

### 5.1 Personalized Recommendations
- **Current**: Distance-based sorting only
- **Improvement**: ML-based recommendations
- **Factors**:
  - User location history
  - Cuisine preferences
  - Price range preferences
  - Dietary restrictions

### 5.2 Advanced Dish Filtering
- **Current**: Basic venue filtering
- **Improvement**: Rich dish search
- **Filters**:
  - Price range
  - Dietary tags (vegan, gluten-free)
  - Cuisine type
  - Planted product type
  - Rating/reviews

### 5.3 Ratings Integration
- **Current**: No ratings displayed
- **Improvement**: Pull and display ratings from delivery platforms
- **Features**:
  - Aggregate ratings across platforms
  - Review snippets
  - Rating trends

### 5.4 Native Mobile App
- **Current**: Mobile-responsive website
- **Improvement**: Native iOS/Android apps
- **Features**:
  - Push notifications for new venues
  - Offline favorites
  - Quick reorder from history
  - Deep links to delivery apps

### 5.5 User Accounts
- **Current**: Anonymous usage
- **Improvement**: Optional user accounts
- **Features**:
  - Save favorite venues
  - Order history tracking
  - Personalized recommendations
  - Location preferences

---

## 6. Operations Improvements

### 6.1 Error Handling & Fault Tolerance

**Current Gaps:**
- No circuit breakers for external API calls
- No retry strategies with backoff
- No dead letter queues for failed operations

**Improvements:**

#### A. Circuit Breaker Pattern
Prevent cascade failures when external services are down:

```typescript
import CircuitBreaker from 'opossum';

const geminiBreaker = new CircuitBreaker(callGeminiAPI, {
  timeout: 30000,           // 30s timeout
  errorThresholdPercentage: 50,
  resetTimeout: 60000,      // Try again after 1 min
  volumeThreshold: 5        // Min requests before tripping
});

geminiBreaker.on('open', () => {
  console.warn('Gemini circuit OPEN - falling back to Claude');
  switchToFallbackProvider();
});
```

#### B. Retry Strategy with Exponential Backoff
```typescript
interface RetryConfig {
  maxRetries: 3;
  baseDelayMs: 1000;
  maxDelayMs: 30000;
  retryableErrors: ['RATE_LIMIT', 'TIMEOUT', 'SERVICE_UNAVAILABLE'];
}

async function withRetry<T>(fn: () => Promise<T>, config: RetryConfig): Promise<T> {
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (!isRetryable(error) || attempt === config.maxRetries) throw error;
      const delay = Math.min(
        config.baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000,
        config.maxDelayMs
      );
      await sleep(delay);
    }
  }
}
```

#### C. Dead Letter Queue for Failed Operations
```typescript
// When discovery/extraction fails after retries
await db.collection('failed_operations').add({
  type: 'dish_extraction',
  venue_id: venue.id,
  error: error.message,
  stack: error.stack,
  attempts: 3,
  created_at: new Date(),
  status: 'pending_retry'  // or 'requires_manual'
});

// Scheduled job to retry failed operations
export const retryFailedOperations = onSchedule('every 6 hours', async () => {
  const failed = await db.collection('failed_operations')
    .where('status', '==', 'pending_retry')
    .where('attempts', '<', 5)
    .limit(50)
    .get();
  // Retry with fresh context
});
```

#### D. Graceful Degradation Strategies
| Failure | Fallback |
|---------|----------|
| Gemini down | Use Claude |
| Google Search exhausted | Use SerpAPI |
| Puppeteer blocked | Use cloud browser |
| Firestore write fails | Queue locally, retry |
| AI extraction fails | Mark for manual review |

### 6.2 Monitoring & Alerting
- **Current**: Manual log checking
- **Improvement**: Automated monitoring
- **Tools**:
  - Cloud Monitoring dashboards
  - PagerDuty/Opsgenie integration
  - Custom alerts for:
    - Function failures
    - High error rates
    - Slow response times
    - Database quota usage
    - Search API budget exhaustion

### 6.2 Automated Testing
- **Current**: Limited test coverage
- **Improvement**: Comprehensive test suite
- **Tests**:
  - Unit tests for all packages
  - Integration tests for API endpoints
  - E2E tests for critical flows
  - Visual regression tests for admin UI

### 6.3 Staging Environment
- **Current**: Direct production deploys
- **Improvement**: Separate staging Firebase project
- **Workflow**:
  1. Deploy to staging
  2. Run automated tests
  3. Manual QA approval
  4. Deploy to production

### 6.4 CI/CD Pipeline
- **Current**: Manual deploys
- **Improvement**: Automated deployment pipeline
- **Pipeline**:
  ```
  Push to main
  → Run tests
  → Build all packages
  → Deploy to staging
  → Run E2E tests
  → Await approval
  → Deploy to production
  ```

### 6.5 Data Backup Strategy
- **Current**: Firestore automatic backups
- **Improvement**: Enhanced backup strategy
- **Features**:
  - Daily exports to Cloud Storage
  - Cross-region replication
  - Point-in-time recovery testing
  - Backup verification automation

---

## 7. Retail Integration

### 7.1 Supermarket Availability
- **Current**: Restaurant-focused
- **Add**:
  - Supermarket availability tracking
  - Real-time stock levels (via partner API)
  - Price comparison across retailers
  - Promotional tracking

---

## 8. Data Quality

### 8.1 Duplicate Detection
- **Current**: URL-based deduplication only
- **Improvement**: Fuzzy matching across venues
- **Methods**:
  - Name similarity (Levenshtein distance)
  - Address normalization and matching
  - Phone number matching
  - Cross-reference delivery URLs

### 8.2 Data Validation Rules
- **Current**: Basic field validation
- **Improvement**: Comprehensive validation
- **Rules**:
  - Valid coordinate ranges per country
  - Phone number format validation
  - URL reachability checks
  - Price sanity checks (too high/low)

### 8.3 Freshness Scoring
- **Current**: Binary stale/fresh
- **Improvement**: Freshness score with decay
- **Factors**:
  - Days since last verification
  - Platform activity indicators
  - Menu changes detected
  - User-reported issues

---

## 9. Data Migration & API Versioning

### 9.1 Schema Migration Strategy

**Problem:** As the system evolves, data schemas change, but existing data needs migration.

**Implementation:**
```typescript
// Migration registry
const migrations: Migration[] = [
  {
    version: 1,
    name: 'add_confidence_factors',
    up: async (db) => {
      // Add confidence_factors array to venues without it
      const venues = await db.collection('discovered_venues')
        .where('confidence_factors', '==', null)
        .get();
      // Batch update with default values
    },
    down: async (db) => { /* Rollback logic */ }
  }
];

// Run pending migrations on deploy
export const runMigrations = onDeploy(async () => {
  const currentVersion = await getSchemaVersion();
  const pending = migrations.filter(m => m.version > currentVersion);
  for (const migration of pending) {
    await migration.up(db);
    await setSchemaVersion(migration.version);
  }
});
```

### 9.2 API Versioning

**Current:** No API versioning
**Risk:** Breaking changes affect all clients

**Implementation:**
```typescript
// Version in URL path
app.use('/v1/venues', v1VenuesRouter);
app.use('/v2/venues', v2VenuesRouter);

// Or via header
app.use((req, res, next) => {
  const version = req.headers['api-version'] || 'v1';
  req.apiVersion = version;
  next();
});

// Deprecation headers
res.set('Deprecation', 'true');
res.set('Sunset', 'Sat, 1 Jul 2025 00:00:00 GMT');
res.set('Link', '</v2/venues>; rel="successor-version"');
```

### 9.3 Database Backup Verification

**Current:** Trust Firestore automatic backups
**Risk:** Backups may be corrupted or incomplete

**Implementation:**
- Weekly restore test to staging environment
- Automated data integrity checks post-restore
- Document recovery procedures

---

## 10. Accessibility & Internationalization

### 10.1 Admin Dashboard Accessibility (WCAG 2.1 AA)

**Current Gaps:**
- No keyboard navigation support
- Missing ARIA labels
- Insufficient color contrast in some areas
- No screen reader testing

**Implementation Checklist:**
- [ ] Add `aria-label` to all interactive elements
- [ ] Ensure focus indicators are visible
- [ ] Add skip navigation links
- [ ] Test with screen readers (NVDA, VoiceOver)
- [ ] Ensure 4.5:1 color contrast ratio
- [ ] Add keyboard shortcuts for common actions

### 10.2 Admin Dashboard Localization

**Current:** English only
**Improvement:** Support German, French for Swiss team

```typescript
// i18n configuration
const resources = {
  en: { translation: { ... } },
  de: { translation: { ... } },
  fr: { translation: { ... } }
};

// Usage
const { t } = useTranslation();
<Button>{t('venues.verify')}</Button>
```

### 10.3 Localized Venue/Dish Data

**Consideration:** Dish names may differ by language/region

```typescript
interface LocalizedDish {
  name: {
    default: string;
    de?: string;
    fr?: string;
    it?: string;
  };
  description: {
    default: string;
    de?: string;
    // ...
  };
}
```

---

## 11. User Feedback & Community Features

### 11.1 User Submission System

**Problem:** Users may know about Planted locations we haven't discovered.

**Implementation:**
```typescript
interface UserSubmission {
  id: string;
  type: 'new_venue' | 'correction' | 'removal';
  venue_data: {
    name: string;
    address: string;
    platform_url?: string;
    planted_dishes?: string[];
  };
  submitter_email?: string;  // Optional, for follow-up
  status: 'pending' | 'verified' | 'rejected';
  created_at: Date;
}

// Public endpoint
POST /api/submissions
{
  "type": "new_venue",
  "venue_data": { ... },
  "captcha_token": "..."  // Spam prevention
}
```

### 11.2 Data Correction Reporting

Allow users to report incorrect information:
- Wrong address
- Closed permanently
- No longer serving Planted
- Incorrect prices

```typescript
interface DataCorrection {
  venue_id: string;
  field: 'address' | 'hours' | 'menu' | 'closed' | 'other';
  current_value: string;
  suggested_value: string;
  evidence_url?: string;
  reporter_email?: string;
}
```

### 11.3 Community Verification

For regions with many pending venues:
- Allow trusted users to verify venues
- Gamification: leaderboard for contributions
- Badge system for active contributors

---

## 12. Legal & Compliance

### 12.1 Scraping Terms of Service Compliance

**Platforms scraped:**
| Platform | ToS Status | Robots.txt | Risk Level |
|----------|------------|------------|------------|
| Uber Eats | Review needed | Partially allows | Medium |
| Lieferando | Review needed | Allows search | Low |
| Wolt | Review needed | Allows search | Low |
| Just Eat | Review needed | Restrictive | High |
| Smood | Review needed | Minimal | Low |

**Mitigations:**
- Rate limiting (2-3 sec between requests)
- Respectful user-agent identification
- Cache results to minimize requests
- Consider official API partnerships

### 12.2 Data Licensing

**Questions to resolve:**
- Who owns scraped restaurant data?
- Can we store/display platform ratings?
- Image copyright for dish photos
- Price data usage rights

**Recommendations:**
- Consult legal counsel
- Document data sources
- Add attribution where required
- Consider data licensing agreements with platforms

### 12.3 Platform Partnership Opportunities

Instead of scraping, pursue official partnerships:
- Uber Eats Partner API
- Wolt Business API
- Official data feeds

**Benefits:**
- Legal certainty
- Real-time data
- No anti-bot issues
- Richer data (order counts, ratings)

---

## 13. Disaster Recovery & Business Continuity

### 13.1 Service Level Objectives (SLOs)

| Service | Availability Target | Latency Target (p95) |
|---------|--------------------|--------------------|
| Public API | 99.5% | < 500ms |
| Admin Dashboard | 99% | < 2s |
| Discovery Jobs | 95% | N/A (batch) |
| Website Data | 99.9% | < 100ms (cached) |

### 13.2 Disaster Recovery Plan

**Scenarios:**

| Scenario | RTO | RPO | Recovery Steps |
|----------|-----|-----|----------------|
| Firebase region outage | 4h | 1h | Failover to backup region |
| Data corruption | 2h | 24h | Restore from backup |
| API key compromise | 1h | 0 | Rotate keys, deploy |
| Malicious data injection | 4h | 0 | Rollback, review audit logs |

**Recovery Procedures:**
1. **Firebase Outage**
   - Pre-configured backup project in different region
   - DNS failover via Cloudflare
   - Automated health checks trigger failover

2. **Data Restore**
   ```bash
   # Export from backup
   gcloud firestore export gs://backup-bucket/latest

   # Import to production
   gcloud firestore import gs://backup-bucket/latest
   ```

### 13.3 Incident Response Runbook

```markdown
## Incident: Discovery Agent Failures

**Severity:** P2 (High)
**On-Call:** [Rotation schedule]

### Detection
- Alert: "Discovery success rate < 50% for 2 hours"
- Dashboard: Check /admin/analytics

### Diagnosis
1. Check AI provider status (Gemini, Claude)
2. Check search API quota
3. Review recent code changes
4. Check platform adapter health

### Resolution
1. If AI down: Switch to backup provider
2. If quota exhausted: Wait for reset or enable paid tier
3. If adapter broken: Rollback to previous version
4. Document in post-mortem

### Communication
- Update status page
- Notify stakeholders via Slack
```

### 13.4 Regular DR Testing

**Schedule:**
- Monthly: Backup restore test
- Quarterly: Full failover drill
- Annually: Complete disaster simulation

---

## 14. Cost Optimization

### 14.1 Cloud Cost Analysis

**Current Cost Centers:**
| Service | Estimated Monthly | Optimization Potential |
|---------|------------------|----------------------|
| Firebase Functions | $50-100 | Medium (cold starts) |
| Firestore | $20-50 | Low |
| Google Search API | $0-200 | High (use free tier) |
| AI API (Gemini) | $10-50 | Medium |
| Cloud Storage | $5-10 | Low |

### 14.2 Cost Reduction Strategies

1. **Function Optimization**
   - Reduce cold starts with min instances (trade-off: cost vs latency)
   - Optimize memory allocation (test with different sizes)
   - Batch operations to reduce invocations

2. **Search API Optimization**
   - Maximize free tier (6 engines = 600 free/day)
   - Query deduplication (already implemented)
   - Smart prioritization (already implemented)

3. **AI Cost Optimization**
   - Use smaller models for simple tasks
   - Cache AI responses for similar queries
   - Batch menu extractions

4. **Storage Optimization**
   - Archive old discovery runs
   - Compress stored HTML snapshots
   - TTL policies for temporary data

### 14.3 Cost Monitoring

```typescript
// Track cost per operation
interface OperationCost {
  operation: 'discovery' | 'extraction' | 'verification';
  venue_id: string;
  costs: {
    search_queries: number;
    ai_tokens: number;
    compute_ms: number;
  };
  total_usd: number;
}

// Monthly cost dashboard
- Real-time spend tracking
- Budget alerts at 50%, 80%, 100%
- Cost attribution by feature
```

---

## Implementation Priority

### Phase 0: CRITICAL - Security (Immediate)
1. **Remove all hardcoded API keys from documentation** ✅
2. Implement secrets management (Google Secret Manager)
3. Audit repositories for committed secrets
4. Add API rate limiting
5. Review and harden Firebase security rules

### Phase 1: Immediate (This Week) - COMPLETED
1. ~~Configure Gemini 2.5 Flash as default AI model~~ ✅
2. ~~Set up Google Custom Search Engine with site restrictions~~ ✅ (6 engines configured)
3. ~~Implement 2,000 query daily budget enforcement~~ ✅
4. ~~Add query deduplication cache~~ ✅

**Implemented Features:**
- `GeminiClient.ts` and `DishFinderAIClient.ts` default to gemini-2.5-flash with 2.0-flash fallback
- `SearchEnginePool.ts` manages 6 search engines (600 free/day) with paid fallback ($5/1000)
- `QueryCache.ts` prevents duplicate queries (24h cache for results, 7d for no results)
- `SmartDiscoveryAgent.ts` enforces budgetLimit (default: 2000) and enableQueryCache options

### Phase 2: High Priority (Next 2 Weeks) - COMPLETED
1. ~~Implement query prioritization algorithm~~ ✅
2. ~~Add batch city processing for efficiency~~ ✅
3. ~~Combined venue + dish discovery workflow~~ ✅
4. ~~Automated verification rules for high-confidence chains~~ ✅
5. ~~Query budget monitoring dashboard~~ ✅

**Implemented Features:**
- `QueryPrioritizer.ts` allocates budget: 40% chains, 30% high-yield, 20% exploration, 10% experimental
- `SmartDiscoveryAgent.ts` batches cities using OR syntax (e.g., "Zürich OR Winterthur OR Baden")
- `extractDishesInline` option enables dish extraction during venue discovery (single workflow)
- `AutoVerifier.ts` auto-verifies high-confidence chains, auto-rejects brand misuse patterns
- `BudgetMonitoringPage.tsx` admin dashboard with real-time budget tracking and efficiency metrics

### Phase 3: Medium Priority (Next Month) - COMPLETED
1. ~~Analytics dashboard with efficiency metrics~~ ✅
2. ~~Batch import functionality~~ ✅
3. ~~Notification system with budget alerts~~ ✅
4. Staging environment setup
5. ~~CI/CD pipeline~~ ✅

**Implemented Features:**
- `AnalyticsDashboardPage.tsx` - Full analytics with query efficiency metrics, discovery trends, strategy performance
- `BatchImportPage.tsx` - CSV upload with drag-drop, validation, preview, and progress tracking
- `NotificationBell.tsx`, `NotificationPanel.tsx`, `useNotifications.ts` - In-app notification system with budget alerts
- `.github/workflows/ci.yml` - GitHub Actions CI with lint, build, test (including Phase 2 feature tests), and Firebase preview deploys

### Phase 4: Resilience & Operations (Next)
1. Platform health monitoring & adapter versioning (Section 3.6)
2. Circuit breakers and retry strategies (Section 6.1)
3. Dead letter queue for failed operations
4. Disaster recovery procedures (Section 13)
5. Menu change detection (Section 3.7)

### Phase 5: Compliance & Legal (Next)
1. Review scraping ToS for all platforms (Section 12.1)
2. GDPR compliance audit (Section 0.2)
3. Data retention policies
4. Explore official platform partnerships (Section 12.3)

### Phase 6: User Experience (Future)
1. User submission system (Section 11.1)
2. Data correction reporting (Section 11.2)
3. Admin dashboard accessibility (Section 10.1)
4. Admin dashboard localization (Section 10.2)

### Phase 7: Lower Priority (Future)
1. Mobile apps
2. User accounts
3. ML recommendations
4. Vision model integration for menu images
5. API versioning (Section 9.2)
6. Schema migration system (Section 9.1)

---

## Success Metrics

Track these KPIs to measure improvement:

| Metric | Current | Target |
|--------|---------|--------|
| Discovery success rate | ~70% | >85% |
| Time to production | ~2 days | <4 hours |
| Venue coverage (CH) | 80% | 95% |
| Venue coverage (DE) | 60% | 85% |
| Queries per venue found | ~10 | <5 |
| Daily query budget usage | - | >90% |
| Cost per venue discovered | - | <$0.05 |
| API response time p95 | 500ms | <200ms |

---

## API Key Reference

> **SECURITY NOTE:** Never store actual API keys in documentation. All keys should be stored in environment variables or a secrets manager. See Section 0.1 for secrets management best practices.

### Gemini AI (Primary)
```
API Key: [Stored in GOOGLE_AI_API_KEY env var]
Model: gemini-2.5-flash
Quota: High (enterprise tier)
Location: Google Secret Manager or .env file (never commit)
```

### Google Custom Search
```
API Key: [Stored in GOOGLE_SEARCH_API_KEY env var]
Search Engines: 6 configured
Free Tier: 600 queries/day (6 engines × 100 each)
Paid Tier: Up to 10,000/day at $5/1,000 queries
Budget Limit: 2,000 queries per run
Max Daily Cost: $7 (600 free + 1,400 paid)
```

### Setup Instructions

1. **Search Engines Created** (DONE)
   - 6 Programmable Search Engines configured
   - Sites: `ubereats.com/*`, `lieferando.de/*`, `lieferando.at/*`, `just-eat.ch/*`, `wolt.com/*`, `smood.ch/*`

2. **Configure Environment**
   ```bash
   # Copy from .env.example and fill in your keys
   cp .env.example .env

   # Required environment variables:
   GOOGLE_AI_API_KEY=<your-gemini-api-key>
   GOOGLE_SEARCH_API_KEY=<your-search-api-key>

   # 6 Search Engine IDs (get from Google Programmable Search Console)
   GOOGLE_SEARCH_ENGINE_ID_1=<engine-id-1>
   GOOGLE_SEARCH_ENGINE_ID_2=<engine-id-2>
   GOOGLE_SEARCH_ENGINE_ID_3=<engine-id-3>
   GOOGLE_SEARCH_ENGINE_ID_4=<engine-id-4>
   GOOGLE_SEARCH_ENGINE_ID_5=<engine-id-5>
   GOOGLE_SEARCH_ENGINE_ID_6=<engine-id-6>

   MAX_QUERIES_PER_RUN=2000
   ```

3. **Enable Billing for Paid Fallback**
   - Go to: https://console.cloud.google.com/billing
   - Link billing account to project
   - Set daily budget limit: $10/day

4. **Enable Custom Search API**
   - Go to: https://console.cloud.google.com/apis/library/customsearch.googleapis.com
   - Enable the API for your project

5. **Monitor Usage & Costs**
   - Dashboard: https://console.cloud.google.com/apis/api/customsearch.googleapis.com/metrics
   - Billing: https://console.cloud.google.com/billing
   - Set up budget alerts at $5 and $8/day

### Engine Rotation Strategy

```
Query 1-100:    Engine 1 (free)
Query 101-200:  Engine 2 (free)
Query 201-300:  Engine 3 (free)
Query 301-400:  Engine 4 (free)
Query 401-500:  Engine 5 (free)
Query 501-600:  Engine 6 (free)
Query 601-2000: Any engine (paid @ $5/1,000)
```

**Daily Cost Examples:**
| Queries | Free | Paid | Cost |
|---------|------|------|------|
| 500 | 500 | 0 | $0 |
| 600 | 600 | 0 | $0 |
| 1,000 | 600 | 400 | $2.50 |
| 1,500 | 600 | 900 | $4.50 |
| 2,000 | 600 | 1,400 | $7.00 |
