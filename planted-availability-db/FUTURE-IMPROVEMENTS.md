# Future Improvements Roadmap

This document outlines potential improvements and enhancements for the Planted Availability Database system.

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

## 2. Discovery System Improvements

### 2.1 Multi-Model AI
- **Current**: Claude-only for extraction and reasoning
- **Improvement**: Combine Claude with vision models (GPT-4V, Gemini Vision)
- **Use Cases**:
  - Extract menu items from menu images
  - Verify dishes from food photos
  - Read prices from image-based menus

### 2.2 Automated Verification
- **Current**: All venues require manual review
- **Improvement**: Auto-verify venues with 90%+ confidence from verified chains
- **Rules Engine**:
  - Known chain + high confidence = auto-verify
  - Duplicate URL detection = auto-reject
  - Brand misuse patterns = auto-reject

### 2.3 Geo-Clustering
- **Current**: Venues reviewed individually
- **Improvement**: Group nearby venues for batch verification
- **Benefit**: Faster reviews, easier to spot patterns

### 2.4 Price Monitoring
- **Current**: Prices captured at discovery time
- **Improvement**: Daily price checks with change alerts
- **Features**:
  - Price history graphs
  - Alerts for significant price changes (>10%)
  - Price comparison across platforms

### 2.5 Combined Venue + Dish Discovery
- **Current**: Separate discovery and extraction processes
- **Improvement**: Inline dish extraction during venue discovery
- **Benefit**: Single review workflow, faster time-to-production

---

## 3. Admin Dashboard Improvements

### 3.1 Analytics Dashboard
- **Metrics**:
  - Discovery success rate over time
  - Platform coverage by country
  - Average time from discovery to production
  - Reviewer productivity metrics
- **Visualizations**:
  - Charts for trends
  - Maps for geographic distribution
  - Heatmaps for platform activity

### 3.2 Batch Import
- **Current**: Manual venue creation only
- **Improvement**: CSV/Excel upload for bulk additions
- **Features**:
  - Template download
  - Validation before import
  - Progress tracking
  - Error reporting

### 3.3 Notification System
- **Alerts**:
  - Stale venues needing re-verification
  - Failed scraper runs
  - New discoveries pending review
  - Partner submission errors
- **Channels**:
  - In-app notifications
  - Email digests
  - Slack integration

### 3.4 Audit Log Viewer
- **Current**: Changes tracked but not viewable
- **Improvement**: Full audit log UI
- **Features**:
  - Search by user, date, action type
  - Diff view for changes
  - Export capability

### 3.5 Role-Based Access Control
- **Current**: Single admin role
- **Improvement**: Multiple roles with different permissions
- **Roles**:
  - Viewer: Read-only access
  - Reviewer: Can verify/reject discoveries
  - Editor: Can modify venues and dishes
  - Admin: Full access including partners and settings

---

## 4. Website Improvements

### 4.1 Personalized Recommendations
- **Current**: Distance-based sorting only
- **Improvement**: ML-based recommendations
- **Factors**:
  - User location history
  - Cuisine preferences
  - Price range preferences
  - Dietary restrictions

### 4.2 Advanced Dish Filtering
- **Current**: Basic venue filtering
- **Improvement**: Rich dish search
- **Filters**:
  - Price range
  - Dietary tags (vegan, gluten-free)
  - Cuisine type
  - Planted product type
  - Rating/reviews

### 4.3 Ratings Integration
- **Current**: No ratings displayed
- **Improvement**: Pull and display ratings from delivery platforms
- **Features**:
  - Aggregate ratings across platforms
  - Review snippets
  - Rating trends

### 4.4 Native Mobile App
- **Current**: Mobile-responsive website
- **Improvement**: Native iOS/Android apps
- **Features**:
  - Push notifications for new venues
  - Offline favorites
  - Quick reorder from history
  - Deep links to delivery apps

### 4.5 User Accounts
- **Current**: Anonymous usage
- **Improvement**: Optional user accounts
- **Features**:
  - Save favorite venues
  - Order history tracking
  - Personalized recommendations
  - Location preferences

---

## 5. Operations Improvements

### 5.1 Monitoring & Alerting
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

### 5.2 Automated Testing
- **Current**: Limited test coverage
- **Improvement**: Comprehensive test suite
- **Tests**:
  - Unit tests for all packages
  - Integration tests for API endpoints
  - E2E tests for critical flows
  - Visual regression tests for admin UI

### 5.3 Staging Environment
- **Current**: Direct production deploys
- **Improvement**: Separate staging Firebase project
- **Workflow**:
  1. Deploy to staging
  2. Run automated tests
  3. Manual QA approval
  4. Deploy to production

### 5.4 CI/CD Pipeline
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

### 5.5 Data Backup Strategy
- **Current**: Firestore automatic backups
- **Improvement**: Enhanced backup strategy
- **Features**:
  - Daily exports to Cloud Storage
  - Cross-region replication
  - Point-in-time recovery testing
  - Backup verification automation

---

## 6. Platform Expansion

### 6.1 Additional Platforms
- **Current**: Uber Eats, Lieferando, Wolt, Just Eat, Smood
- **Add**:
  - Deliveroo (UK, various EU)
  - Glovo (Spain, Eastern Europe)
  - Getir (Germany, Netherlands)
  - Gorillas (Germany)
  - Door Dash (entering EU)

### 6.2 Additional Countries
- **Current**: CH, DE, AT
- **Expand to**:
  - UK (good Planted presence)
  - Netherlands
  - France
  - Italy
  - Spain

### 6.3 Retail Integration
- **Current**: Restaurant-focused
- **Add**:
  - Supermarket availability tracking
  - Real-time stock levels (via partner API)
  - Price comparison across retailers
  - Promotional tracking

---

## 7. Data Quality

### 7.1 Duplicate Detection
- **Current**: URL-based deduplication only
- **Improvement**: Fuzzy matching across venues
- **Methods**:
  - Name similarity (Levenshtein distance)
  - Address normalization and matching
  - Phone number matching
  - Cross-reference delivery URLs

### 7.2 Data Validation Rules
- **Current**: Basic field validation
- **Improvement**: Comprehensive validation
- **Rules**:
  - Valid coordinate ranges per country
  - Phone number format validation
  - URL reachability checks
  - Price sanity checks (too high/low)

### 7.3 Freshness Scoring
- **Current**: Binary stale/fresh
- **Improvement**: Freshness score with decay
- **Factors**:
  - Days since last verification
  - Platform activity indicators
  - Menu changes detected
  - User-reported issues

---

## 8. Partner Ecosystem

### 8.1 Self-Service Portal
- **Current**: Admin-managed partners
- **Improvement**: Partner self-service
- **Features**:
  - Account registration
  - API key management
  - Data submission dashboard
  - Quality metrics viewing
  - Documentation access

### 8.2 Partner API v2
- **Current**: Basic CRUD operations
- **Improvement**: Enhanced partner API
- **Features**:
  - Batch operations
  - Delta updates
  - Webhook subscriptions
  - Rate limit monitoring
  - Error reporting

### 8.3 Data Exchange Standards
- **Current**: Custom JSON format
- **Improvement**: Industry standards support
- **Formats**:
  - Open Food Facts format
  - Schema.org MenuItem
  - GS1 Digital Link

---

## Implementation Priority

### High Priority (Next Quarter)
1. Combined venue + dish discovery
2. Automated verification rules
3. Basic monitoring setup
4. CI/CD pipeline

### Medium Priority (Next 6 Months)
1. Analytics dashboard
2. Batch import
3. Additional platforms (Deliveroo)
4. Staging environment

### Lower Priority (Future)
1. Mobile apps
2. User accounts
3. Partner self-service
4. ML recommendations

---

## Success Metrics

Track these KPIs to measure improvement:

| Metric | Current | Target |
|--------|---------|--------|
| Discovery success rate | ~70% | >85% |
| Time to production | ~2 days | <4 hours |
| Venue coverage (CH) | 80% | 95% |
| Venue coverage (DE) | 60% | 85% |
| Daily active users | - | 1000+ |
| Partner submissions | - | 50/day |
| API response time p95 | 500ms | <200ms |
