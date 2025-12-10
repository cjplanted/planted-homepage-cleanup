# Admin Dashboard 2.0 - Work Plan to Production

## Current Status Summary

**Frontend Dashboard**: ✅ Complete and running at http://localhost:5175/
**Backend APIs**: 90% implemented, needs TypeScript fixes before deployment
**Database Collections**: ✅ Complete

---

## Phase 1: Fix TypeScript Errors (Priority: HIGH)

### 1.1 API Package - Critical Fixes

| File | Issue | Fix Required | Effort |
|------|-------|--------------|--------|
| `services/search.ts` | Algolia v5 API changes | Update to new `algoliasearch` import syntax | 30 min |
| `services/geolocation.ts` | Type assertions | Add proper type guards | 20 min |
| `services/realtime.ts` | `.toDate()` on Date | Check if Firestore Timestamp, add guard | 10 min |
| `middleware/partnerAuth.ts` | Missing `Partner` type | Add to @pad/core or remove unused code | 15 min |
| `services/budgetThrottle.ts` | Import issue | Should resolve after pnpm install | 5 min |

### 1.2 Scheduled Functions - Lower Priority

These are pre-existing issues not related to Dashboard 2.0:

| File | Issue |
|------|-------|
| `scheduled/discovery.ts` | Missing `@pad/scrapers/agents/smart-discovery` module |
| `scheduled/scraper-orchestrator.ts` | Missing collection methods (`markManyStale`, `archiveMany`, etc.) |

**Recommendation**: Comment out or stub these scheduled functions for now; they're not needed for the dashboard.

---

## Phase 2: End-to-End Testing Checklist

### 2.1 Authentication Flow
- [ ] Login with Firebase credentials
- [ ] Protected routes redirect to login when not authenticated
- [ ] Sign out works correctly
- [ ] Token refresh works for long sessions

### 2.2 Workflow Dashboard
- [ ] Pipeline status shows correct states
- [ ] Quick action buttons navigate correctly
- [ ] Today's stats display (may show 0 initially)
- [ ] Running operations widget updates in real-time

### 2.3 Scrape Control
- [ ] Discovery config dialog opens and validates input
- [ ] Extraction config dialog opens and validates input
- [ ] Start discovery triggers API call
- [ ] Start extraction triggers API call
- [ ] Budget status displays correctly
- [ ] Running operations show progress

### 2.4 Review Queue
- [ ] Hierarchical tree loads venues by country/chain
- [ ] Filtering by status works
- [ ] Filtering by country works
- [ ] Search works
- [ ] Venue detail panel shows all information
- [ ] Dish grid displays correctly
- [ ] Approve button triggers API and updates UI
- [ ] Partial approve opens feedback form
- [ ] Reject opens reason form
- [ ] Keyboard shortcuts (j/k/a/r/e/?) work
- [ ] Bulk actions work

### 2.5 Sync to Website
- [ ] Preview shows pending additions/updates
- [ ] Item selection works
- [ ] Select all/none works
- [ ] Diff view shows changes
- [ ] Sync execution works
- [ ] History panel shows past syncs

### 2.6 Venue Browser
- [ ] Tree view renders hierarchy
- [ ] Table view renders with sorting
- [ ] Cards view renders
- [ ] View toggle works
- [ ] Filters work (status, country, chain)
- [ ] Search works
- [ ] Venue detail panel shows all info
- [ ] Export to CSV works

### 2.7 Cost Monitor
- [ ] KPI cards display metrics
- [ ] Cost breakdown chart renders
- [ ] Period selector works (7d/30d/90d)

---

## Phase 3: Deployment Steps

### 3.1 Pre-Deployment Checklist

```bash
# 1. Run all type checks
cd packages/admin-dashboard-v2 && pnpm typecheck
cd packages/database && pnpm typecheck
cd packages/api && pnpm typecheck  # Fix errors first

# 2. Build dashboard
cd packages/admin-dashboard-v2 && pnpm build

# 3. Verify build output
ls -la dist/
```

### 3.2 Firebase Hosting Deployment

```bash
# Option A: Deploy to existing Firebase project
firebase deploy --only hosting:admin-dashboard-v2

# Option B: Create new hosting target
firebase hosting:sites:create admin-dashboard-v2
firebase target:apply hosting admin-dashboard-v2 admin-dashboard-v2
firebase deploy --only hosting:admin-dashboard-v2
```

Add to `firebase.json`:
```json
{
  "hosting": {
    "target": "admin-dashboard-v2",
    "public": "packages/admin-dashboard-v2/dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

### 3.3 API Functions Deployment

```bash
# Deploy admin functions
firebase deploy --only functions:adminReviewQueueHandler,functions:adminApproveVenueHandler,...
```

---

## Phase 4: Post-Deployment Verification

### 4.1 Production Smoke Tests
- [ ] Dashboard loads at production URL
- [ ] Login works with production Firebase
- [ ] API calls return data (check Network tab)
- [ ] No console errors
- [ ] Mobile responsiveness

### 4.2 Monitoring Setup
- [ ] Error boundary reports to Sentry (optional)
- [ ] Firebase Analytics configured
- [ ] Cloud Functions logs accessible

---

## Quick Reference: Running Locally

```bash
# Terminal 1: Dashboard
cd packages/admin-dashboard-v2
pnpm dev
# Opens at http://localhost:5175/

# Terminal 2: Firebase Emulators (optional, for local API testing)
firebase emulators:start --only functions,firestore
```

---

## Files Modified/Created in This Implementation

### New Packages
- `packages/admin-dashboard-v2/` - Complete new dashboard

### Backend API Files
- `packages/api/src/functions/admin/review/` - Review endpoints
- `packages/api/src/functions/admin/scrapers/` - Scraper control endpoints
- `packages/api/src/functions/admin/sync/` - Sync endpoints
- `packages/api/src/functions/admin/analytics/` - Analytics endpoints
- `packages/api/src/functions/admin/budget/` - Budget endpoints
- `packages/api/src/functions/admin/feedback/` - Feedback endpoints

### Database Collections
- `packages/database/src/collections/syncHistory.ts` - Sync history
- `packages/database/src/collections/budgetTracking.ts` - Budget tracking
- `packages/database/src/collections/ai-feedback.ts` - AI feedback

### Type Definitions
- `packages/core/src/types/scraper.ts` - Extended with progress, costs, logs

---

## Estimated Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Fix TypeScript | 2-3 hours | None |
| Phase 2: E2E Testing | 2-4 hours | Phase 1 |
| Phase 3: Deployment | 1 hour | Phase 1, 2 |
| Phase 4: Verification | 1 hour | Phase 3 |

**Total: ~6-9 hours to production-ready**

---

## Contact & Resources

- Dashboard running at: http://localhost:5175/
- Firebase Console: https://console.firebase.google.com/project/get-planted-db
- Plan Document: `ADMIN-DASHBOARD-2.0-PLAN.md`
