# Scraper Improvements Knowledge Base

This document tracks known issues, learnings, and planned improvements for the planted scraper system.

---

## Critical Issues (High Priority)

### 1. Enumerate Mode Query Pattern Broken
**Status:** NOT FIXED
**Severity:** Critical - 100% failure rate

**Problem:**
Enumerate mode uses query pattern `site:[platform] "[ChainName]" [Country]` which returns 0 results.
- Example failing: `site:wolt "Birdie Birdie" DE`
- Example working (explore mode): `site:wolt "Birdie Birdie" Berlin`

**Root Cause:**
Google doesn't index delivery platforms by exact restaurant name + country code. It indexes by city names.

**Fix Required:**
Rewrite `SmartDiscoveryAgent.ts` enumerate mode to:
1. Use city-based queries instead of country-based
2. Query pattern should be: `site:[platform] "[ChainName]" [City]`
3. Iterate through configured cities per country (reuse explore mode's city list)

**Files to Modify:**
- `packages/scrapers/src/agents/smart-discovery/SmartDiscoveryAgent.ts` (lines ~763-800, enumerate mode handler)
- May need to add city lists per country in config

**Test After Fix:**
```bash
cd packages/scrapers && pnpm run local --discovery
# Verify: Enumerate queries use city names, not country codes
```

---

### 2. URL Country Detection Fails for Dual-Locale URLs
**Status:** NOT FIXED
**Severity:** Medium - causes extraction failures

**Problem:**
URLs like `https://www.ubereats.com/nl-en/store/...` fail with:
`Could not detect country for URL`

**Root Cause:**
Country parser expects single locale (`/de/`, `/ch/`) but doesn't handle dual-locale format (`/nl-en/`, `/de-at/`).

**Fix Required:**
Update URL country detection in `SmartDishFinderAgent.ts` or related utility:
1. Add regex for `[lang]-[locale]` patterns
2. Extract first part as country code
3. Handle edge cases like `nl-en` (Netherlands with English UI)

**Files to Modify:**
- Search for country detection logic in `packages/scrapers/src/`
- Likely in a URL parsing utility or the fetcher

**Test After Fix:**
```bash
# Test with a known nl-en URL
```

---

### 3. Query Cache Blocks Retries After Strategy Fix
**Status:** NOT FIXED
**Severity:** Medium - prevents iteration on query strategies

**Problem:**
0-result queries are cached for 168 hours (7 days). If you fix the query pattern, you can't re-test because cache returns the old 0 result.

**Fix Options:**
1. Shorter TTL for 0-result queries (e.g., 24h instead of 168h)
2. Different cache keys for different query patterns
3. Add `--clear-cache` CLI flag to invalidate specific queries
4. Store query pattern version in cache key

**Files to Modify:**
- `packages/scrapers/src/` - search for QueryCache or cache implementation

---

## Medium Priority Issues

### 4. Network Errors During Firestore Cache Checks
**Status:** NOT FIXED
**Severity:** Low - non-fatal but noisy

**Problem:**
`ENETUNREACH` and `TLS connection` errors during cache checks:
```
Error: 14 UNAVAILABLE: No connection established
```

**Root Cause:**
Transient network issues or Firestore connection limits during high-load discovery runs.

**Fix Options:**
1. Add retry logic with exponential backoff for cache operations
2. Graceful degradation - proceed without cache if unavailable
3. Connection pooling for Firestore

---

### 5. JSON Truncation from Gemini Responses
**Status:** PARTIALLY FIXED (recovery works)
**Severity:** Low - recovery mechanism works

**Current State:**
Gemini sometimes returns truncated JSON responses. The scraper has recovery logic that extracts complete objects from truncated JSON.

**Improvement Ideas:**
1. Request smaller batches to avoid truncation
2. Add `max_tokens` parameter to Gemini calls
3. Implement streaming response handling

---

## Completed Improvements

### Fixed: run-local.ts Enumerate Mode Field Name
**Date:** 2024-12-10
**Problem:** `chains` field passed instead of `target_chains`
**Fix:** Changed line 292 from `chains:` to `target_chains:`

### Fixed: Extraction Lifecycle Management
**Date:** 2024-12-10
**Problem:** Called `agent.run()` instead of proper lifecycle
**Fix:** Now calls `agent.initialize()` → `agent.runExtraction(config)` → cleanup in finally

---

## Performance Observations

### Extraction Timing
- ~3-5 seconds per venue (Puppeteer page load + menu scroll + AI extraction)
- 13 venues processed in ~2 minutes
- Bottleneck: Sequential venue processing (could parallelize with multiple browser contexts)

### Discovery Timing
- 265 queries in ~10 minutes
- SearchEnginePool rotates through 3 credentials
- Cache hits significantly speed up repeated runs

---

## Architecture Notes

### Dual Dish Storage
Dishes are stored in TWO places:
1. **Embedded:** `discovered_venues.dishes[]` - only when `extractDishesInline: true`
2. **Collection:** `discovered_dishes` with `venue_id` field

The queue.ts endpoint now merges both sources (fixed 2024-12-10).

### Query Cache Behavior
- Good results: cached 24h
- Zero results: cached 168h (too long!)
- Cache key: query string + platform + country

---

## Next Actions Checklist

When improving the scraper, address these in order:

- [ ] Fix enumerate mode to use city-based queries
- [ ] Add nl-en URL pattern handling
- [ ] Reduce 0-result cache TTL to 24h
- [ ] Add `--clear-cache` CLI flag
- [ ] Add retry logic for Firestore cache operations
- [ ] Consider parallel venue extraction (multiple browser contexts)

---

## Testing Commands

```bash
# Run discovery only (explore mode - working)
cd packages/scrapers
pnpm run local --discovery

# Run extraction only (enrich mode - working)
pnpm run local --extraction

# Dry run (no database writes)
pnpm run local --dry-run

# Verbose output
pnpm run local --verbose

# Check current config
cat ../../scraper-config.json
```

---

## Related Files

| File | Purpose |
|------|---------|
| `packages/scrapers/src/cli/run-local.ts` | Unified local runner |
| `packages/scrapers/src/agents/smart-discovery/SmartDiscoveryAgent.ts` | Discovery logic |
| `packages/scrapers/src/agents/smart-dish-finder/SmartDishFinderAgent.ts` | Extraction logic |
| `planted-availability-db/scraper-config.json` | Runtime configuration |
| `packages/api/src/functions/admin/review/queue.ts` | Review queue API (dishes merge) |
