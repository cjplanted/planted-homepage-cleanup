# Scraper Configuration - ULTRA CONSERVATIVE

## Current Status: SAFE MODE

All scrapers are configured with **extremely conservative** rate limits to avoid any issues.

### Schedule

| Scraper | Schedule | Status | Notes |
|---------|----------|--------|-------|
| `planted-salesforce` | Sunday 3 AM | **Verification only** | Just checks API is reachable |
| `coop` | Disabled | Needs proxy | DataDome protection |
| `migros` | Disabled | Needs proxy | - |
| `rewe` | Disabled | Needs proxy | - |
| `billa` | Disabled | Needs proxy | - |
| `wolt` | Disabled | Needs proxy | API rate limited |
| `uber-eats` | Disabled | Needs proxy | Very strict limits |
| `lieferando` | Disabled | Needs proxy | - |
| `deliveroo` | Disabled | Needs proxy | - |

### Rate Limits (When Enabled)

```
ULTRA CONSERVATIVE:
- Minimum delay: 30 seconds between requests
- Maximum delay: 60 seconds (random jitter)
- Max requests/minute: 2
- Max requests/hour: 20
- Max requests/day: 100
- Batch size: 5 items
- Batch delay: 5 minutes between batches
- Max venues per run: 50
```

### What Runs Now

**Weekly on Sunday 3 AM (CET):**
1. Logs that the orchestrator ran
2. Does a HEAD request to Planted API (no data transfer)
3. Records that check completed

**That's it.** No actual scraping happens until you:
1. Configure a proxy service
2. Manually enable specific scrapers
3. Test with `--dry-run` first

---

## To Enable More Scrapers

### Step 1: Get Proxy Service

Sign up for one of:
- [ScraperAPI](https://www.scraperapi.com/) - Recommended
- [Bright Data](https://brightdata.com/)
- [Oxylabs](https://oxylabs.io/)

### Step 2: Add Environment Variable

```bash
# In Firebase Console > Functions > Environment Variables
SCRAPER_PROXY_API_KEY=your_api_key_here
```

### Step 3: Test Manually First

```bash
cd packages/scrapers

# Dry run - no writes, just see what would happen
pnpm scrape coop --dry-run --verbose --max-items 3

# Ultra slow mode (5 minute delays)
pnpm scrape coop --dry-run --ultra-slow --max-items 3
```

### Step 4: Enable in Config

Edit `packages/scrapers/src/config/scraper-config.ts`:

```typescript
'coop': {
  schedule: {
    enabled: true,  // Change to true
    maxVenuesPerRun: 10,  // Start very small
  }
}
```

### Step 5: Deploy

```bash
pnpm build
firebase deploy --only functions
```

---

## Safety Features

1. **Global kill switch**: Set `GLOBAL_CONFIG.scrapersEnabled = false` to stop all
2. **Per-scraper disable**: Each scraper can be individually disabled
3. **Max error rate**: Stops if >20% errors
4. **Rate limit pause**: 24 hour pause after hitting rate limits
5. **Max consecutive failures**: Disabled after 3 failures in a row

---

## Monitoring

Check scraper health:
```bash
curl https://europe-west6-get-planted-db.cloudfunctions.net/scraperHealthHandler
```

View recent runs:
```bash
curl https://europe-west6-get-planted-db.cloudfunctions.net/freshnessStatsHandler
```

---

## Why So Conservative?

1. **We already have 1,837 venues** imported from the Planted Salesforce API
2. **Data doesn't change often** - store locations are stable
3. **Being a good citizen** - we don't want to stress any partner APIs
4. **Avoiding IP bans** - better to go slow than get blocked
5. **Manual updates work** - for now, running import scripts manually is fine

---

## Files

- `packages/scrapers/src/config/scraper-config.ts` - Rate limits and schedules
- `packages/api/src/functions/scheduled/scraper-orchestrator.ts` - Cloud Function
- `scripts/import-planted-locations.ts` - Manual import script

---

## Current Data Freshness

The 1,837 venues imported on 2025-12-08 are:
- All marked as `status: 'active'`
- All have `last_verified: today`
- Will become `stale` after 7 days without re-verification
- Will be `archived` after 14 days

This means we have **7 days** before anything gets marked stale - plenty of time to set up proper automation if needed.
