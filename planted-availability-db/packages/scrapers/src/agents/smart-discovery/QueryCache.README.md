# QueryCache - Query Deduplication System

## Overview

The QueryCache is a Firestore-backed deduplication system that prevents the Smart Discovery Agent from executing redundant searches. It normalizes queries before hashing to catch semantically identical searches with minor formatting differences.

## Features

- **Automatic Query Normalization**: Converts queries to lowercase, trims whitespace, and sorts terms alphabetically
- **Smart Caching Rules**:
  - Queries with results are cached for 24 hours
  - Queries with no results are cached for 7 days
- **Firestore Persistence**: All cache data is stored in the `query_cache` collection
- **MD5 Hashing**: Efficient query deduplication using cryptographic hashing
- **Expiration Management**: Automatic expiration tracking and cleanup utilities

## Installation

The QueryCache is already integrated into the smart-discovery module:

```typescript
import { getQueryCache } from './smart-discovery';
```

## Usage

### Basic Usage

```typescript
import { getQueryCache } from './smart-discovery';

const cache = getQueryCache();

// Reset counter at start of discovery run
cache.resetSkippedCounter();

// Check if query should be skipped
const query = "planted chicken restaurants Berlin";
const shouldSkip = await cache.shouldSkipQuery(query);

if (!shouldSkip) {
  // Execute search
  const results = await executeSearch(query);

  // Record the query execution
  await cache.recordQuery(query, results.length);
}

// Get statistics
const stats = await cache.getStats();
console.log(`Cached: ${stats.totalCached}, Skipped: ${stats.skippedToday}`);
```

### Integration with SmartDiscoveryAgent

```typescript
import { SmartDiscoveryAgent, getQueryCache } from './smart-discovery';

const cache = getQueryCache();
cache.resetSkippedCounter();

// During query execution loop
for (const query of queries) {
  if (await cache.shouldSkipQuery(query)) {
    console.log(`[CACHED] Skipping: ${query}`);
    continue;
  }

  const results = await searchProvider.search(query);
  await cache.recordQuery(query, results.length);

  // Process results...
}

// Show stats at end
const stats = await cache.getStats();
console.log(`Discovery complete. Skipped ${stats.skippedToday} queries.`);
```

## API Reference

### Methods

#### `shouldSkipQuery(query: string): Promise<boolean>`

Checks if a query should be skipped based on cache.

**Returns:** `true` if the query was executed recently and should be skipped

**Cache Rules:**
- Returns `true` if query executed in last 24h with results
- Returns `true` if query executed in last 7d with 0 results
- Returns `false` otherwise (cache expired or no entry)

**Example:**
```typescript
const shouldSkip = await cache.shouldSkipQuery("vegan chicken Berlin");
```

---

#### `recordQuery(query: string, resultsCount: number): Promise<void>`

Records a query execution with the number of results found.

**Parameters:**
- `query`: The original query string
- `resultsCount`: Number of results returned by the search

**Example:**
```typescript
await cache.recordQuery("planted restaurants Munich", 12);
```

---

#### `getStats(): Promise<QueryCacheStats>`

Returns cache statistics.

**Returns:**
```typescript
{
  totalCached: number;    // Total cached queries (not expired)
  skippedToday: number;   // Queries skipped in current session
}
```

**Example:**
```typescript
const stats = await cache.getStats();
console.log(`Total cached: ${stats.totalCached}`);
```

---

#### `cleanupExpired(): Promise<number>`

Deletes expired cache entries from Firestore.

**Returns:** Number of entries deleted

**Example:**
```typescript
const deleted = await cache.cleanupExpired();
console.log(`Cleaned up ${deleted} expired entries`);
```

---

#### `resetSkippedCounter(): void`

Resets the "skipped today" counter. Should be called at the start of each discovery run.

**Example:**
```typescript
cache.resetSkippedCounter();
```

---

#### `getAllCachedQueries(): Promise<QueryCacheEntry[]>`

Returns up to 100 most recent cached queries (for debugging).

**Returns:** Array of `QueryCacheEntry` objects

**Example:**
```typescript
const entries = await cache.getAllCachedQueries();
for (const entry of entries) {
  console.log(`"${entry.originalQuery}" - ${entry.resultsCount} results`);
}
```

---

#### `clearAll(): Promise<void>`

Clears all cache entries (for testing/debugging).

**Example:**
```typescript
await cache.clearAll();
```

---

#### `addCacheEntry(query: string, resultsCount: number, hoursAgo?: number): Promise<void>`

Manually adds a cache entry (for testing or seeding).

**Parameters:**
- `query`: Query string to cache
- `resultsCount`: Number of results to record
- `hoursAgo`: How many hours ago the query was executed (default: 0)

**Example:**
```typescript
// Add a query that was executed 12 hours ago
await cache.addCacheEntry("test query", 5, 12);
```

## Query Normalization

The QueryCache normalizes queries before hashing to catch variations:

```typescript
// All of these are treated as the same query:
"planted chicken Berlin"
"Berlin chicken planted"      // Different order
"PLANTED CHICKEN BERLIN"      // Different case
"  planted   chicken   berlin  "  // Extra spaces
```

**Normalization steps:**
1. Convert to lowercase
2. Trim leading/trailing whitespace
3. Split into terms
4. Sort terms alphabetically
5. Join with single spaces

**Result:** `"berlin chicken planted"`

## Firestore Schema

### Collection: `query_cache`

Each document has the following structure:

```typescript
{
  queryHash: string;         // MD5 hash of normalized query (document ID)
  normalizedQuery: string;   // Normalized query string
  originalQuery: string;     // Original query as submitted
  executedAt: Timestamp;     // When the query was executed
  resultsCount: number;      // Number of results found
  expiresAt: Timestamp;      // When this cache entry expires
}
```

### Indexes

For optimal performance, create these Firestore indexes:

```
Collection: query_cache
- expiresAt (ascending)
- executedAt (descending)
```

## Cache Duration

| Scenario | Cache Duration | Reason |
|----------|---------------|--------|
| Query with results (≥1) | 24 hours | Successful searches likely remain relevant for a day |
| Query with no results (0) | 7 days | Failed searches unlikely to improve soon; avoid wasting API quota |

## Best Practices

### 1. Reset Counter Per Run
Always reset the skipped counter at the start of each discovery run:

```typescript
cache.resetSkippedCounter();
```

### 2. Periodic Cleanup
Clean up expired entries periodically to save storage:

```typescript
// Run once per day or per discovery run
await cache.cleanupExpired();
```

### 3. Check Before Search
Always check cache before executing expensive searches:

```typescript
if (await cache.shouldSkipQuery(query)) {
  continue; // Skip to next query
}
```

### 4. Record All Queries
Record all executed queries, even those with 0 results:

```typescript
const results = await search(query);
await cache.recordQuery(query, results.length);
```

## Integration Example

Complete example showing integration with SmartDiscoveryAgent:

```typescript
import { SmartDiscoveryAgent, getQueryCache } from './smart-discovery';

async function runDiscovery() {
  const cache = getQueryCache();
  const agent = new SmartDiscoveryAgent(searchProvider, {
    maxQueriesPerRun: 100,
    verbose: true,
  });

  // Reset counter at start
  cache.resetSkippedCounter();

  // Clean up old entries
  await cache.cleanupExpired();

  // Generate queries
  const queries = await agent.generateQueries({
    country: 'DE',
    city: 'Berlin',
    platform: 'ubereats',
  });

  // Execute with caching
  for (const query of queries) {
    // Check cache first
    if (await cache.shouldSkipQuery(query)) {
      console.log(`[SKIP] ${query}`);
      continue;
    }

    // Execute search
    console.log(`[SEARCH] ${query}`);
    const results = await agent.search(query);

    // Record execution
    await cache.recordQuery(query, results.length);

    // Process results...
  }

  // Show final stats
  const stats = await cache.getStats();
  console.log(`
    Discovery Complete:
    - Total cached queries: ${stats.totalCached}
    - Queries skipped: ${stats.skippedToday}
  `);
}
```

## Testing

Use the example file for testing:

```typescript
import {
  exampleBasicUsage,
  exampleNormalization,
  exampleTestingSeeding,
} from './QueryCache.test.example';

// Run examples
await exampleBasicUsage();
await exampleNormalization();
await exampleTestingSeeding();
```

## Performance Considerations

- **Firestore Reads**: Each `shouldSkipQuery()` performs 1 read
- **Firestore Writes**: Each `recordQuery()` performs 1 write
- **Hash Computation**: MD5 hashing is fast and negligible overhead
- **Query Normalization**: Minimal string processing overhead

**Optimization:** The cache significantly reduces API costs by preventing duplicate searches, far outweighing the small Firestore costs.

## Troubleshooting

### Cache Not Working

1. Check Firestore connection:
   ```typescript
   const cache = getQueryCache();
   const stats = await cache.getStats();
   console.log(stats); // Should return valid stats
   ```

2. Verify query normalization:
   ```typescript
   const entries = await cache.getAllCachedQueries();
   console.log(entries.map(e => e.normalizedQuery));
   ```

### Too Many Skips

If too many queries are being skipped, you can:
1. Clear the cache: `await cache.clearAll()`
2. Wait for expiration (24h for results, 7d for no results)

### Check Specific Query

```typescript
const entries = await cache.getAllCachedQueries();
const query = entries.find(e => e.originalQuery.includes("Berlin"));
console.log(query);
```

## License

Internal use only - Part of the Planted Availability Database project.
