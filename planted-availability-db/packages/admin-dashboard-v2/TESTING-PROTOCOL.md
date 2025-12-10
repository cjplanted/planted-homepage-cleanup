# Admin Dashboard 2.0 - Testing Protocol

## Overview

This document outlines a comprehensive testing protocol for the Admin Dashboard 2.0 implementation. All tests can be executed autonomously without user intervention.

---

## Phase 1: Build & Compilation Verification

### 1.1 TypeScript Compilation
- [ ] Run `npx tsc --noEmit` - verify zero errors
- [ ] Run `npx tsc --noEmit --strict` - check strict mode compliance
- [ ] Verify all imports resolve correctly

### 1.2 Production Build
- [ ] Run `npm run build` - verify production build succeeds
- [ ] Check build output size is reasonable (< 5MB)
- [ ] Verify no build warnings for missing dependencies

### 1.3 Dependency Check
- [ ] Verify all peer dependencies are satisfied
- [ ] Check for circular dependency issues
- [ ] Validate package.json dependencies match actual imports

---

## Phase 2: Code Quality & Structure

### 2.1 File Structure Verification
- [ ] Verify all expected directories exist:
  - `src/app/` - Entry, providers, routing
  - `src/pages/` - Page components
  - `src/features/` - Feature modules
  - `src/shared/` - Shared components
  - `src/lib/` - Utilities
- [ ] Verify feature module structure is consistent:
  - Each feature has `api/`, `hooks/`, `components/`, `types.ts`
- [ ] Count total files and verify reasonable size

### 2.2 Export Verification
- [ ] Verify all feature index.ts files export correctly
- [ ] Check for naming conflicts between types and components
- [ ] Verify API functions are properly exported

### 2.3 Component Completeness
- [ ] Verify all pages referenced in router exist
- [ ] Check all imported components exist
- [ ] Verify all hooks are implemented

---

## Phase 3: Feature Module Tests

### 3.1 Review Feature (`src/features/review/`)
**Files to verify:**
- [ ] `types.ts` - All types defined (ReviewVenue, ReviewDish, HierarchyNode, etc.)
- [ ] `api/reviewApi.ts` - All API functions implemented
- [ ] `hooks/useReviewQueue.ts` - Hook implemented with React Query
- [ ] `hooks/useApproval.ts` - Approval mutations implemented
- [ ] `hooks/useFeedback.ts` - Feedback hook implemented
- [ ] `components/HierarchyTree.tsx` - Tree navigation works
- [ ] `components/VenueDetailPanel.tsx` - Detail view works
- [ ] `components/DishGrid.tsx` - Dish display works
- [ ] `components/ApprovalButtons.tsx` - Button actions defined
- [ ] `components/FeedbackForm.tsx` - Form validation works
- [ ] `components/BulkActionsBar.tsx` - Bulk actions defined

**Functionality checks:**
- [ ] Keyboard navigation constants defined (j/k/a/r/e)
- [ ] Confidence score display logic
- [ ] Filter options complete

### 3.2 Scraping Feature (`src/features/scraping/`)
**Files to verify:**
- [ ] `types.ts` - ScraperProgress, BudgetStatus, PipelineStage types
- [ ] `api/scraperApi.ts` - SSE support implemented
- [ ] `hooks/useScrapers.ts` - Scraper list hook
- [ ] `hooks/useScraperRun.ts` - Run management hook
- [ ] `hooks/useBudget.ts` - Budget status hook
- [ ] `components/PipelineStatus.tsx` - Pipeline visualization
- [ ] `components/ScraperProgress.tsx` - Real-time progress
- [ ] `components/BudgetStatus.tsx` - Budget display
- [ ] `components/DiscoveryConfigDialog.tsx` - Config form
- [ ] `components/ExtractionConfigDialog.tsx` - Config form

**Functionality checks:**
- [ ] SSE event handling logic
- [ ] Progress calculation
- [ ] Budget threshold warnings (80%)

### 3.3 Browser Feature (`src/features/browser/`)
**Files to verify:**
- [ ] `types.ts` - BrowserVenue, BrowserFilters, ViewMode types
- [ ] `api/browserApi.ts` - API functions
- [ ] `hooks/useVenueBrowser.ts` - Browser hook
- [ ] `hooks/useFilters.ts` - Filter management
- [ ] `components/VenueTree.tsx` - Tree view
- [ ] `components/VenueTable.tsx` - Table view with sorting
- [ ] `components/VenueCards.tsx` - Card grid view
- [ ] `components/BrowserFilters.tsx` - Filter controls
- [ ] `components/VenueDetail.tsx` - Detail panel
- [ ] `components/ViewToggle.tsx` - View mode switcher

**Functionality checks:**
- [ ] Three view modes work
- [ ] Filter state management
- [ ] Sort functionality
- [ ] Country emoji mappings

### 3.4 Sync Feature (`src/features/sync/`)
**Files to verify:**
- [ ] `types.ts` - SyncItem, SyncPreview, SyncHistoryEntry types
- [ ] `api/syncApi.ts` - Sync API functions
- [ ] `hooks/useSyncPreview.ts` - Preview hook
- [ ] `hooks/useSync.ts` - Sync execution hook
- [ ] `hooks/useSyncHistory.ts` - History hook
- [ ] `components/SyncPreview.tsx` - Preview component
- [ ] `components/SyncDiff.tsx` - Diff viewer
- [ ] `components/SyncProgress.tsx` - Progress indicator
- [ ] `components/SyncHistory.tsx` - History list

**Functionality checks:**
- [ ] Change type categorization (addition/update/removal)
- [ ] Selection state management
- [ ] Diff display logic

---

## Phase 4: Page Integration Tests

### 4.1 Router Configuration
- [ ] Verify all routes are defined in `router.tsx`
- [ ] Check protected routes wrap with authentication
- [ ] Verify public routes (login) redirect when authenticated
- [ ] Check catch-all redirect works

### 4.2 Page Components
**Workflow Pages:**
- [ ] `pages/workflow/DashboardPage.tsx` - Renders without errors
- [ ] `pages/workflow/ScrapeControlPage.tsx` - Renders without errors
- [ ] `pages/workflow/SyncPage.tsx` - Renders without errors

**Browser Pages:**
- [ ] `pages/browser/VenueBrowserPage.tsx` - Renders without errors

**Other Pages:**
- [ ] `pages/ReviewQueuePage.tsx` - Renders without errors
- [ ] `pages/LoginPage.tsx` - Renders without errors
- [ ] `pages/ScrapeControlPage.tsx` - Renders without errors
- [ ] `pages/LiveVenuesPage.tsx` - Renders without errors
- [ ] `pages/CostsPage.tsx` - Renders without errors

### 4.3 Layout & Navigation
- [ ] `MainLayout.tsx` - Layout renders
- [ ] `Sidebar.tsx` - Navigation items correct
- [ ] `Header.tsx` - Header displays

---

## Phase 5: Shared Components Tests

### 5.1 UI Components
- [ ] `Button.tsx` - All variants defined
- [ ] `Card.tsx` - Component renders
- [ ] `Badge.tsx` - All variants defined
- [ ] `Input.tsx` - Component renders
- [ ] `Checkbox.tsx` - onCheckedChange works
- [ ] `Dialog.tsx` - Modal functionality
- [ ] `Label.tsx` - Component renders

### 5.2 State Components
- [ ] `LoadingState.tsx` - Loading spinner
- [ ] `ErrorState.tsx` - Error display with retry
- [ ] `EmptyState.tsx` - Empty state message

### 5.3 Error Handling
- [ ] `ErrorBoundary.tsx` - Catches errors
- [ ] Error recovery mechanism works

---

## Phase 6: API Client Tests

### 6.1 Client Configuration
- [ ] `lib/api/client.ts` - Base URL configuration
- [ ] Retry logic (3 retries with exponential backoff)
- [ ] Timeout handling (30s default)
- [ ] Authentication header injection
- [ ] Error response handling

### 6.2 Offline Detection
- [ ] Network status detection
- [ ] Offline mode handling

---

## Phase 7: Provider Tests

### 7.1 Auth Provider
- [ ] Firebase initialization
- [ ] User state management
- [ ] Login/logout functions
- [ ] Auth state persistence

### 7.2 Query Provider
- [ ] React Query configuration
- [ ] Stale time settings (5 min)
- [ ] Error handling

### 7.3 Error Boundary Provider
- [ ] Global error catching
- [ ] Error recovery UI

---

## Phase 8: Backend API Endpoint Verification

### 8.1 Review Endpoints (packages/api/src/functions/admin/review/)
- [ ] `queue.ts` - GET /admin/review/queue
- [ ] `approve.ts` - POST /admin/review/venues/:id/approve
- [ ] `partialApprove.ts` - POST /admin/review/venues/:id/partial-approve
- [ ] `reject.ts` - POST /admin/review/venues/:id/reject
- [ ] `bulk.ts` - POST /admin/review/bulk/approve, bulk/reject

### 8.2 Scraper Endpoints (packages/api/src/functions/admin/scrapers/)
- [ ] `startDiscovery.ts` - POST /admin/scrapers/discovery/start
- [ ] `startExtraction.ts` - POST /admin/scrapers/extraction/start
- [ ] `stream.ts` - GET /admin/scrapers/runs/:runId/stream (SSE)
- [ ] `cancel.ts` - POST /admin/scrapers/runs/:runId/cancel
- [ ] `available.ts` - GET /admin/scrapers/available

### 8.3 Budget Endpoints (packages/api/src/functions/admin/budget/)
- [ ] `status.ts` - GET /admin/budget/status

### 8.4 Sync Endpoints (packages/api/src/functions/admin/sync/)
- [ ] `preview.ts` - GET /admin/sync/preview
- [ ] `execute.ts` - POST /admin/sync/execute
- [ ] `history.ts` - GET /admin/sync/history

### 8.5 Analytics Endpoints (packages/api/src/functions/admin/analytics/)
- [ ] `kpis.ts` - GET /admin/analytics/kpis
- [ ] `costs.ts` - GET /admin/analytics/costs
- [ ] `rejections.ts` - GET /admin/analytics/rejections

### 8.6 Feedback Endpoints (packages/api/src/functions/admin/feedback/)
- [ ] `submit.ts` - POST /admin/feedback/submit
- [ ] `process.ts` - Learning trigger logic

---

## Phase 9: Database Collections Verification

### 9.1 New Collections
- [ ] `budgetTracking.ts` - Budget tracking collection
- [ ] `syncHistory.ts` - Sync history collection
- [ ] Verify collection schemas match types

---

## Phase 10: Integration Verification

### 10.1 Cross-Package Imports
- [ ] Admin dashboard imports from @pad/core work
- [ ] Admin dashboard imports from @pad/database work
- [ ] Type consistency across packages

### 10.2 Environment Configuration
- [ ] `vite-env.d.ts` - Environment types defined
- [ ] All VITE_ variables typed
- [ ] Firebase config variables present

---

## Execution Commands

```bash
# Phase 1: Build Verification
cd packages/admin-dashboard-v2
npx tsc --noEmit
npm run build

# Phase 2-7: Code Analysis (automated script checks)
# Run file existence checks
# Run import resolution checks
# Run export verification

# Phase 8-9: Backend Verification
cd packages/api
npx tsc --noEmit

cd packages/database
npx tsc --noEmit
```

---

## Success Criteria

1. **Zero TypeScript errors** in all packages
2. **Production build succeeds** without warnings
3. **All files exist** as specified in the plan
4. **All exports resolve** without circular dependencies
5. **All routes are accessible** (verified via router config)
6. **Backend endpoints exist** with proper signatures

---

## Test Execution Log

| Phase | Status | Notes |
|-------|--------|-------|
| 1. Build & Compilation | Pending | |
| 2. Code Quality | Pending | |
| 3. Feature Modules | Pending | |
| 4. Page Integration | Pending | |
| 5. Shared Components | Pending | |
| 6. API Client | Pending | |
| 7. Providers | Pending | |
| 8. Backend APIs | Pending | |
| 9. Database Collections | Pending | |
| 10. Integration | Pending | |

