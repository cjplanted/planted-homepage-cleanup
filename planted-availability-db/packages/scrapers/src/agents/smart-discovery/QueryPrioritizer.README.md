# Query Prioritizer

A sophisticated budget allocation system for the Smart Discovery Agent that maximizes ROI by distributing queries across different priority tiers.

## Overview

The QueryPrioritizer implements a 4-tier budget allocation strategy:

- **40% (800 queries)** - Known chain enumeration (highest ROI)
- **30% (600 queries)** - High-success strategies (>50% success rate)
- **20% (400 queries)** - City exploration (uncovered cities)
- **10% (200 queries)** - Experimental queries

## Why This Matters

Without prioritization, discovery runs would waste queries on:
- Low-performing strategies
- Already well-covered cities
- Random experimental patterns

With prioritization, we focus on:
- **High ROI**: Enumerating known chains finds 5-10 venues per query
- **Proven strategies**: Using strategies with >50% success rate
- **Coverage gaps**: Targeting cities with <5 discovered venues
- **Innovation**: Still allocating 10% to test new patterns

## Usage

### Basic Usage

```typescript
import { getQueryPrioritizer } from './QueryPrioritizer.js';

const prioritizer = getQueryPrioritizer();

// Generate a query plan for 2000 queries
const plan = await prioritizer.allocateQueryBudget(2000);

// Print summary
console.log(prioritizer.summarizePlan(plan));

// Access specific query groups
console.log(`Chain enumeration: ${plan.chainEnumeration.length} queries`);
console.log(`High-yield strategies: ${plan.highYieldStrategies.length} queries`);
console.log(`City exploration: ${plan.cityExploration.length} queries`);
console.log(`Experimental: ${plan.experimental.length} queries`);
```

### Integration with SmartDiscoveryAgent

```typescript
import { SmartDiscoveryAgent } from './SmartDiscoveryAgent.js';
import { getQueryPrioritizer } from './QueryPrioritizer.js';

const agent = new SmartDiscoveryAgent(searchProvider, {
  maxQueriesPerRun: 2000,
  budgetLimit: 2000,
});

const prioritizer = getQueryPrioritizer();
const plan = await prioritizer.allocateQueryBudget(2000);

// Execute queries in priority order

// 1. Chain enumeration (highest ROI)
for (const chainQuery of plan.chainEnumeration) {
  await agent.enumerateChain(
    chainQuery.chain,
    chainQuery.cities,
    chainQuery.platforms
  );
}

// 2. High-yield strategies
for (const strategyQuery of plan.highYieldStrategies) {
  for (const city of strategyQuery.cities) {
    await agent.executeStrategy(strategyQuery.strategy, { city });
  }
}

// 3. City exploration
for (const cityQuery of plan.cityExploration) {
  await agent.exploreCity(
    cityQuery.city,
    cityQuery.country,
    cityQuery.platforms
  );
}

// 4. Experimental queries
for (const query of plan.experimental) {
  await agent.executeRawQuery(query);
}
```

### Getting Discovery Statistics

```typescript
const stats = await prioritizer.getDiscoveryStats();

console.log('Total Venues:', stats.totalVenues);
console.log('Total Chains:', stats.totalChains);
console.log('Venues by Country:', stats.venuesByCountry);
console.log('Uncovered Cities:', stats.uncoveredCitiesCount);
```

### Finding Chains Needing Discovery

```typescript
// Get verified chains that need more coverage (<80% discovered)
const chains = await prioritizer.getVerifiedChainsNeedingDiscovery();

console.log(`Found ${chains.length} chains needing work:`);
chains.forEach(chain => console.log(`  - ${chain}`));
```

### Finding High-Yield Strategies

```typescript
// Get strategies with >50% success rate
const strategies = await prioritizer.getStrategiesBySuccessRate(50);

strategies.forEach(strategy => {
  console.log(`${strategy.platform}/${strategy.country}: ${strategy.success_rate}%`);
  console.log(`  Template: ${strategy.query_template}`);
});
```

### Finding Uncovered Cities

```typescript
// Get cities with <5 discovered venues
for (const country of ['CH', 'DE', 'AT'] as const) {
  const uncovered = await prioritizer.getUncoveredCities(country);
  console.log(`${country}: ${uncovered.length} cities need coverage`);
  console.log(`  Top 5: ${uncovered.slice(0, 5).join(', ')}`);
}
```

## API Reference

### QueryPrioritizer Class

#### `allocateQueryBudget(totalBudget: number): Promise<QueryPlan>`

Allocates query budget across all priority tiers.

**Parameters:**
- `totalBudget` - Total number of queries to allocate (e.g., 2000)

**Returns:** `QueryPlan` with queries organized by tier

#### `getVerifiedChainsNeedingDiscovery(): Promise<string[]>`

Gets verified Planted partner chains that need more discovery work (coverage <80%).

**Returns:** Array of chain names

#### `getStrategiesBySuccessRate(minRate: number): Promise<DiscoveryStrategy[]>`

Gets strategies with success rate above threshold, sorted by success rate descending.

**Parameters:**
- `minRate` - Minimum success rate (0-100)

**Returns:** Array of strategies

#### `getUncoveredCities(country: SupportedCountry): Promise<string[]>`

Gets cities with low venue coverage (<5 venues), sorted by coverage ascending.

**Parameters:**
- `country` - Country code ('CH', 'DE', or 'AT')

**Returns:** Array of city names

#### `getDiscoveryStats(): Promise<DiscoveryStats>`

Gets comprehensive statistics about current discovery state.

**Returns:** Statistics object with venue counts, chains, coverage, etc.

#### `summarizePlan(plan: QueryPlan): string`

Generates a human-readable summary of a query plan.

**Parameters:**
- `plan` - Query plan to summarize

**Returns:** Formatted string summary

### Types

#### `QueryPlan`

```typescript
interface QueryPlan {
  chainEnumeration: ChainEnumerationQuery[];
  highYieldStrategies: HighYieldQuery[];
  cityExploration: CityExplorationQuery[];
  experimental: string[];
  totalQueries: number;
  budgetAllocation: BudgetAllocation;
}
```

#### `ChainEnumerationQuery`

```typescript
interface ChainEnumerationQuery {
  chain: string;                    // Chain name
  cities: string[];                 // Cities to search
  platforms: DeliveryPlatform[];    // Platforms to search
  priority: number;                 // Priority score (0-100)
  estimatedQueries: number;         // Estimated query count
}
```

#### `HighYieldQuery`

```typescript
interface HighYieldQuery {
  strategyId: string;              // Strategy ID
  strategy: DiscoveryStrategy;     // Full strategy object
  cities: string[];                // Cities to apply strategy to
  estimatedQueries: number;        // Estimated query count
  successRate: number;             // Strategy success rate (0-100)
}
```

#### `CityExplorationQuery`

```typescript
interface CityExplorationQuery {
  city: string;                    // City name
  country: SupportedCountry;       // Country code
  platforms: DeliveryPlatform[];   // Platforms available in city
  estimatedQueries: number;        // Estimated query count
  coverageGap: number;             // Coverage gap (0-100, higher = less covered)
}
```

#### `BudgetAllocation`

```typescript
interface BudgetAllocation {
  total: number;
  chainEnumeration: {
    allocated: number;   // Allocated budget
    percentage: number;  // Percentage of total
    actual: number;      // Actual queries planned
  };
  highYieldStrategies: { ... };
  cityExploration: { ... };
  experimental: { ... };
}
```

## Budget Allocation Strategy

### Tier 1: Chain Enumeration (40%)

**Why 40%?** Highest ROI - each query can discover 5-10 venues

**How it works:**
1. Identifies verified chains with <80% coverage
2. Calculates priority based on:
   - Chain size (larger = higher priority)
   - Geographic spread (more countries = higher)
   - Current coverage (lower = higher)
3. For each chain:
   - Targets top 5 cities per country
   - Searches all available platforms
   - Estimates queries needed

**Example queries:**
- `site:ubereats.com/de "dean&david" Berlin`
- `site:lieferando.de "Birdie Birdie" München`
- `site:wolt.com/at "råbowls" Wien`

### Tier 2: High-Yield Strategies (30%)

**Why 30%?** Proven strategies with >50% success rate

**How it works:**
1. Filters strategies with:
   - Success rate ≥50%
   - At least 5 uses (statistical significance)
   - Not deprecated
2. Sorts by success rate descending
3. Applies to top 10 cities per strategy

**Example strategies:**
- `site:just-eat.ch "planted.chicken" {city}` (80% success)
- `site:lieferando.de planted chicken {city}` (70% success)

### Tier 3: City Exploration (20%)

**Why 20%?** Fill coverage gaps in undiscovered cities

**How it works:**
1. Identifies cities with <5 discovered venues
2. Calculates coverage gap: `100 - (venues × 20)`
3. Sorts by coverage gap descending
4. Uses 3 different search strategies per city

**Coverage calculation:**
- 0 venues = 100% gap
- 1 venue = 80% gap
- 2 venues = 60% gap
- 5+ venues = 0% gap (well covered)

### Tier 4: Experimental (10%)

**Why 10%?** Innovation and pattern testing

**How it works:**
1. Tests new query patterns:
   - Product-specific searches
   - Cross-platform searches
   - Local/regional patterns
   - Menu/dish focused
2. Results feed back into strategy learning

**Example queries:**
- `planted.kebab vegan delivery zurich`
- `planted protein delivery switzerland`
- `menu with planted chicken`

## Priority Scoring

### Chain Priority Formula

```
Base Priority: 50

+ Countries: +10 per country
+ Size: +20 if >50 locations, +10 if >20
+ Low Coverage: +20 if <20% covered, +10 if <50%

Max Priority: 100
```

**Example:**
- dean&david: 3 countries × 10 + 50 locations (20) + 40% covered (10) = **80 priority**
- Small local chain: 1 country × 10 + 5 locations (0) + 100% covered (0) = **60 priority**

## Performance Characteristics

### Memory Usage
- Loads all venues and strategies into memory
- ~1MB per 1000 venues
- Efficient for datasets <100k venues

### Query Planning Time
- ~100ms for 2000-query budget
- Scales linearly with budget size
- Database queries are cached

### Query Execution
- Chain enumeration: 5-10 venues per query
- High-yield strategies: 2-3 venues per query
- City exploration: 1-2 venues per query
- Experimental: 0.5-1 venue per query

**Overall expected ROI:** ~3 venues per query

## Best Practices

### Budget Sizing

```typescript
// Small discovery run (quick test)
const plan = await prioritizer.allocateQueryBudget(100);

// Medium discovery run (daily scheduled)
const plan = await prioritizer.allocateQueryBudget(500);

// Large discovery run (comprehensive)
const plan = await prioritizer.allocateQueryBudget(2000);

// Full coverage run (monthly deep dive)
const plan = await prioritizer.allocateQueryBudget(5000);
```

### Monitoring

```typescript
// Before run
const statsBefore = await prioritizer.getDiscoveryStats();

// Execute discovery
await executeDiscoveryRun(plan);

// After run
const statsAfter = await prioritizer.getDiscoveryStats();

console.log(`Discovered ${statsAfter.totalVenues - statsBefore.totalVenues} new venues`);
console.log(`Covered ${statsBefore.uncoveredCitiesCount - statsAfter.uncoveredCitiesCount} new cities`);
```

### Re-planning

```typescript
// Re-generate plan every 1000 queries
let queriesExecuted = 0;

while (queriesExecuted < 5000) {
  const remainingBudget = 5000 - queriesExecuted;
  const plan = await prioritizer.allocateQueryBudget(Math.min(1000, remainingBudget));

  await executeQueries(plan);
  queriesExecuted += plan.totalQueries;
}
```

## Example Output

```
=== QUERY PRIORITIZATION PLAN ===

Total Budget: 2000 queries (target: 2000)

1. CHAIN ENUMERATION (40% budget, 823 queries):
   - 12 chains to enumerate
   - Top chains: dean&david, Birdie Birdie, råbowls

2. HIGH-YIELD STRATEGIES (30% budget, 590 queries):
   - 7 strategies with >50% success rate
   - Top success rates: 80%, 75%, 70%

3. CITY EXPLORATION (20% budget, 387 queries):
   - 129 under-covered cities
   - Top gaps: Erfurt (DE), Rostock (DE), Kassel (DE)

4. EXPERIMENTAL (10% budget, 200 queries):
   - 200 experimental queries
   - Testing new patterns and approaches

=================================
```

## See Also

- [SmartDiscoveryAgent.ts](./SmartDiscoveryAgent.ts) - Main discovery agent
- [DiscoveryStrategies](../../database/src/collections/discovery-strategies.ts) - Strategy database
- [DiscoveredVenues](../../database/src/collections/discovered-venues.ts) - Venue database
- [QueryCache.ts](./QueryCache.ts) - Query caching system
- [SearchEnginePool.ts](./SearchEnginePool.ts) - Search budget management
