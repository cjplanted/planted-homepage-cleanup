# QueryCache Quick Start Guide

## 30-Second Overview

QueryCache prevents duplicate searches by normalizing and caching queries in Firestore.

**Cache Rules:**
- Queries with results: cached 24 hours
- Queries with no results: cached 7 days

## Installation

Already integrated! Just import:

```typescript
import { getQueryCache } from './smart-discovery';
```

## Basic Usage (3 Steps)

```typescript
const cache = getQueryCache();

// 1. Check before searching
if (await cache.shouldSkipQuery(query)) {
  continue; // Skip this query
}

// 2. Execute search
const results = await search(query);

// 3. Record results
await cache.recordQuery(query, results.length);
```

## Complete Example

```typescript
import { getQueryCache } from './smart-discovery';

async function discoverRestaurants() {
  const cache = getQueryCache();
  cache.resetSkippedCounter(); // Reset counter per run

  const queries = [
    "planted chicken Berlin",
    "vegan chicken Munich",
  ];

  for (const query of queries) {
    if (await cache.shouldSkipQuery(query)) {
      console.log(`[SKIP] ${query}`);
      continue;
    }

    console.log(`[SEARCH] ${query}`);
    const results = await executeSearch(query);
    await cache.recordQuery(query, results.length);
  }

  const stats = await cache.getStats();
  console.log(`Skipped ${stats.skippedToday} queries`);
}
```

## Key Methods

| Method | Purpose | Returns |
|--------|---------|---------|
| `shouldSkipQuery(query)` | Check if cached | `boolean` |
| `recordQuery(query, count)` | Save execution | `void` |
| `getStats()` | Get statistics | `{ totalCached, skippedToday }` |
| `resetSkippedCounter()` | Reset counter | `void` |
| `cleanupExpired()` | Delete old entries | `number` (deleted) |

## Query Normalization

These are all treated as the **same query**:

```typescript
"planted chicken Berlin"
"Berlin chicken planted"     // ✓ Different order
"PLANTED CHICKEN BERLIN"     // ✓ Different case
"  planted   chicken  berlin  "  // ✓ Extra spaces
```

All normalize to: `"berlin chicken planted"`

## Typical Workflow

```typescript
// At start of discovery run
cache.resetSkippedCounter();
await cache.cleanupExpired();

// During search loop
for (const query of queries) {
  if (await cache.shouldSkipQuery(query)) continue;

  const results = await search(query);
  await cache.recordQuery(query, results.length);
}

// At end of run
const stats = await cache.getStats();
console.log(`Cached: ${stats.totalCached}, Skipped: ${stats.skippedToday}`);
```

## Performance Impact

**Benefits:**
- Reduces API calls by ~30-50% (typical)
- Faster execution (skipped queries are instant)
- Lower costs (fewer Google Search API calls)

**Cost:**
- 1 Firestore read per `shouldSkipQuery()`
- 1 Firestore write per `recordQuery()`

Net savings are significant since API costs >> Firestore costs.

## Common Patterns

### Pattern 1: Skip Cached Queries

```typescript
if (await cache.shouldSkipQuery(query)) {
  this.log(`[CACHED] ${query}`);
  continue;
}
```

### Pattern 2: Track Stats

```typescript
cache.resetSkippedCounter();
// ... run queries ...
const stats = await cache.getStats();
console.log(`Skipped ${stats.skippedToday} of ${stats.totalCached} cached`);
```

### Pattern 3: Periodic Cleanup

```typescript
// Once per run
const deleted = await cache.cleanupExpired();
console.log(`Cleaned ${deleted} expired entries`);
```

## Debugging

### View cached queries

```typescript
const entries = await cache.getAllCachedQueries();
for (const entry of entries) {
  const ageMinutes = (Date.now() - entry.executedAt.toMillis()) / 1000 / 60;
  console.log(`"${entry.originalQuery}" - ${entry.resultsCount} results (${ageMinutes.toFixed(0)}m ago)`);
}
```

### Clear all cache

```typescript
await cache.clearAll();
console.log('Cache cleared!');
```

### Seed test data

```typescript
await cache.addCacheEntry("test query", 5, 12); // 12 hours ago
```

## Firestore

**Collection:** `query_cache`

**Fields:**
- `queryHash` (string, document ID)
- `normalizedQuery` (string)
- `originalQuery` (string)
- `executedAt` (Timestamp)
- `resultsCount` (number)
- `expiresAt` (Timestamp)

## More Info

- Full API reference: `QueryCache.README.md`
- Usage examples: `QueryCache.test.example.ts`
- Implementation: `QueryCache.ts`
