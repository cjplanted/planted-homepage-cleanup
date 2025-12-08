# Database Operations Runbook

## Firestore Collections Overview

| Collection | Description | Key Indexes |
|------------|-------------|-------------|
| `venues` | Retail stores, restaurants, kitchens | `status`, `location.latitude`, `type` |
| `dishes` | Restaurant menu items with Planted | `venue_id`, `status` |
| `retail_availability` | Product stock at retail venues | `venue_id`, `product_sku` |
| `promotions` | Active deals and promotions | `chain_id`, `valid_until` |
| `scraper_runs` | Scraper execution history | `scraper_id`, `started_at` |
| `alerts` | System alerts | `acknowledged`, `created_at` |

## Common Operations

### View Collection Stats

```bash
# Using Firebase CLI
firebase firestore:indexes

# Count documents
pnpm --filter @pad/database run cli stats
```

### Backup Database

```bash
# Export to Cloud Storage
gcloud firestore export gs://pad-backups/$(date +%Y%m%d)

# Export specific collection
gcloud firestore export gs://pad-backups/$(date +%Y%m%d) --collection-ids=venues
```

### Restore from Backup

```bash
# Import from Cloud Storage
gcloud firestore import gs://pad-backups/20241206
```

## Data Quality Issues

### Issue: Duplicate Venues

**Detection:**
```bash
pnpm --filter @pad/database run cli find-duplicates --collection venues
```

**Resolution:**
1. Identify canonical record
2. Merge data from duplicates
3. Update references in `dishes` and `retail_availability`
4. Delete duplicate records

```bash
pnpm --filter @pad/database run cli merge-venues --keep {canonicalId} --merge {duplicateId}
```

### Issue: Stale Data

**Detection:**
```bash
# Find venues not updated in 7+ days
pnpm --filter @pad/database run cli find-stale --days 7
```

**Resolution:**
```bash
# Mark as stale
pnpm --filter @pad/database run cli mark-stale --days 7

# Remove very old records (30+ days)
pnpm --filter @pad/database run cli cleanup --days 30 --dry-run
pnpm --filter @pad/database run cli cleanup --days 30
```

### Issue: Missing Geolocation

**Detection:**
```bash
pnpm --filter @pad/database run cli audit --check geolocation
```

**Resolution:**
```bash
# Geocode missing locations
pnpm --filter @pad/database run cli geocode --missing-only
```

## Index Management

### Create New Index

Add to `firestore.indexes.json`:
```json
{
  "collectionGroup": "venues",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "location.latitude", "order": "ASCENDING" }
  ]
}
```

Deploy:
```bash
firebase deploy --only firestore:indexes
```

### Index Build Status

```bash
firebase firestore:indexes --database "(default)"
```

Look for `BUILDING` status - can take 10-30 minutes.

## Performance Issues

### Slow Queries

1. Check query has matching index
2. Add pagination (limit results)
3. Use compound indexes for multiple filters

### High Read Costs

1. Review cache hit rates in monitoring
2. Increase cache TTL for stable data
3. Use aggregation queries (`count()`) instead of fetching all docs
4. Implement cursor-based pagination

### Write Limits

Firestore limits: 10,000 writes/second per database

If hitting limits:
1. Use batch writes (max 500 per batch)
2. Implement write queuing
3. Consider sharding for high-write collections

## Emergency Procedures

### Read-Only Mode

If database issues occur, enable read-only:

```bash
firebase functions:config:set database.readonly=true
firebase deploy --only functions
```

### Kill Stuck Writes

If writes are hanging:
```bash
# Cancel pending Cloud Function executions
gcloud functions call pad-api --data '{"action":"cancel-writes"}'
```

### Rollback Schema Change

1. Deploy previous function version
2. Restore from backup if data corrupted
3. Re-run affected scrapers with `--force-refresh`
