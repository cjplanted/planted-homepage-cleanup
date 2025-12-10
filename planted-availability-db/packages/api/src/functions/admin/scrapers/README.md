# Scraper Control & Budget Monitoring APIs

This directory contains the backend APIs for Admin Dashboard 2.0's scraper control and budget monitoring features.

## Overview

These APIs enable:
- Starting discovery and extraction scraper runs
- Real-time progress monitoring via Server-Sent Events (SSE)
- Canceling running scrapers
- Budget tracking and auto-throttling
- Viewing available scrapers and recent runs

## API Endpoints

### 1. Start Discovery API

**Endpoint:** `POST /admin/scrapers/discovery/start`

**Description:** Start a discovery scraper to find restaurants serving Planted products.

**Request Body:**
```typescript
{
  countries: string[];       // ['CH', 'DE', 'AT'] - required
  platforms?: string[];      // ['uber-eats', 'wolt', etc.] - optional
  mode: 'explore' | 'enumerate' | 'verify';  // required
  chainId?: string;          // required for 'enumerate' mode
  maxQueries?: number;       // default: 50
  dryRun?: boolean;          // default: false
}
```

**Response (202 Accepted):**
```typescript
{
  runId: string;
  statusUrl: string;         // URL to stream progress
  status: 'pending';
  message: string;
  config: object;
  estimatedCost: number;     // in USD
}
```

**Error Responses:**
- `400` - Invalid request (validation errors)
- `429` - Budget throttled or insufficient budget
- `401/403` - Authentication/authorization errors

**Example:**
```bash
curl -X POST https://api.planted.com/admin/scrapers/discovery/start \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "countries": ["CH", "DE"],
    "platforms": ["uber-eats", "wolt"],
    "mode": "explore",
    "maxQueries": 30,
    "dryRun": false
  }'
```

### 2. Start Extraction API

**Endpoint:** `POST /admin/scrapers/extraction/start`

**Description:** Start an extraction scraper to enrich venue data with menu details.

**Request Body:**
```typescript
{
  target: 'all' | 'chain' | 'venue';  // required
  chainId?: string;          // required if target is 'chain'
  venueId?: string;          // required if target is 'venue'
  maxVenues?: number;        // default: 50
  mode: 'enrich' | 'refresh' | 'verify';  // required
}
```

**Response (202 Accepted):**
```typescript
{
  runId: string;
  statusUrl: string;
  status: 'pending';
  message: string;
  config: object;
  estimatedCost: number;
}
```

**Example:**
```bash
curl -X POST https://api.planted.com/admin/scrapers/extraction/start \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "target": "chain",
    "chainId": "chain_abc123",
    "mode": "enrich",
    "maxVenues": 10
  }'
```

### 3. Progress Stream API

**Endpoint:** `GET /admin/scrapers/runs/:runId/stream`

**Description:** Stream real-time progress updates via Server-Sent Events (SSE).

**Response:** Server-Sent Events stream with the following event types:

**Event: `init`**
```typescript
{
  runId: string;
  scraperId: string;
  status: string;
  startedAt: Date;
  config: object;
}
```

**Event: `update`**
```typescript
{
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: {
    current: number;
    total: number;
    percentage: number;
  };
  results: {
    found: number;
    processed: number;
    errors: number;
  };
  costs: {
    searchQueries: number;
    aiCalls: number;
    estimated: number;
  };
  eta?: Date;
  logs?: Array<{
    timestamp: Date;
    level: 'info' | 'warn' | 'error';
    message: string;
  }>;
}
```

**Event: `done`**
```typescript
{
  status: 'completed' | 'failed' | 'cancelled';
  completedAt: Date;
  stats: object;
  errors?: Array<object>;
}
```

**Event: `heartbeat`**
```typescript
{
  timestamp: Date;
}
```

**Example (JavaScript):**
```javascript
const eventSource = new EventSource(
  'https://api.planted.com/admin/scrapers/runs/run_123/stream',
  {
    headers: {
      'Authorization': 'Bearer YOUR_TOKEN'
    }
  }
);

eventSource.addEventListener('init', (e) => {
  const data = JSON.parse(e.data);
  console.log('Run started:', data);
});

eventSource.addEventListener('update', (e) => {
  const data = JSON.parse(e.data);
  console.log('Progress:', data.progress.percentage + '%');
});

eventSource.addEventListener('done', (e) => {
  const data = JSON.parse(e.data);
  console.log('Run completed:', data.status);
  eventSource.close();
});

eventSource.onerror = (error) => {
  console.error('Stream error:', error);
  eventSource.close();
};
```

### 4. Cancel API

**Endpoint:** `POST /admin/scrapers/runs/:runId/cancel`

**Description:** Cancel a running or pending scraper.

**Response (200 OK):**
```typescript
{
  success: true;
  message: string;
  runId: string;
  cancelledBy: string;
  cancelledAt: Date;
}
```

**Error Responses:**
- `400` - Run already in terminal state
- `404` - Run not found

**Example:**
```bash
curl -X POST https://api.planted.com/admin/scrapers/runs/run_123/cancel \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 5. Budget Status API

**Endpoint:** `GET /admin/budget/status`

**Description:** Get current budget usage and throttle status.

**Response (200 OK):**
```typescript
{
  today: {
    date: string;           // YYYY-MM-DD
    searchQueries: {
      used: number;
      free: number;
      paid: number;
      cost: number;         // USD
    };
    aiCalls: {
      count: number;
      gemini: number;
      claude: number;
      cost: number;         // USD
    };
    total: number;          // Total cost in USD
    percentage: number;     // % of daily budget
  };
  month: {
    year: number;
    month: number;
    searchQueries: object;
    aiCalls: object;
    total: number;
    percentage: number;
  };
  limits: {
    dailyBudget: number;    // USD
    monthlyBudget: number;  // USD
    throttleAt: number;     // USD (80% of daily)
    throttleThreshold: number;  // 0.8
  };
  isThrottled: boolean;
  throttleReason?: string;
  throttleEvents: {
    today: number;
    month: number;
    recent: Array<{
      timestamp: Date;
      reason: string;
    }>;
  };
}
```

**Example:**
```bash
curl -X GET https://api.planted.com/admin/budget/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 6. Available Scrapers API

**Endpoint:** `GET /admin/scrapers/available`

**Description:** Get available scraper configurations and recent runs.

**Response (200 OK):**
```typescript
{
  discovery: {
    countries: string[];
    platforms: string[];
    modes: Array<{
      id: string;
      name: string;
      description: string;
      estimatedQueries: number;
      estimatedDuration: string;
      requiresChainId?: boolean;
    }>;
    defaultMaxQueries: number;
  };
  extraction: {
    modes: Array<{
      id: string;
      name: string;
      description: string;
      estimatedAICalls: number;
      estimatedDuration: string;
    }>;
    targets: Array<{
      id: string;
      name: string;
      description: string;
      requiresChainId?: boolean;
      requiresVenueId?: boolean;
    }>;
    defaultMaxVenues: number;
  };
  recentRuns: Array<ScraperRun>;
  runningScrapers: Array<ScraperRun>;
  statistics: {
    totalRecentRuns: number;
    currentlyRunning: number;
    recentSuccessRate: number;
  };
}
```

**Example:**
```bash
curl -X GET https://api.planted.com/admin/scrapers/available \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Budget Auto-Throttling

The system automatically throttles scraper operations when:

1. **Daily budget threshold reached** (default: 80% of `DAILY_BUDGET_LIMIT`)
2. **Monthly budget exceeded** (`MONTHLY_BUDGET_LIMIT`)

### Configuration

Set via environment variables:

```bash
DAILY_BUDGET_LIMIT=50          # Daily budget in USD (default: 50)
MONTHLY_BUDGET_LIMIT=1000      # Monthly budget in USD (default: 1000)
BUDGET_THROTTLE_THRESHOLD=0.8  # Throttle at 80% (default: 0.8)
```

### Throttle Response

When throttled, scraper start endpoints return `429 Too Many Requests`:

```typescript
{
  error: 'Budget throttled',
  message: 'Daily budget at 85.5% (42.75/50 USD). Throttle threshold: 80%',
  budgetStatus: {
    currentCost: 42.75,
    dailyLimit: 50,
    percentageUsed: 85.5,
    remainingBudget: 7.25
  }
}
```

## Authentication

All endpoints require:
- Valid Firebase ID token in `Authorization: Bearer <token>` header
- User must have `admin: true` custom claim

## Error Handling

All endpoints return consistent error responses:

```typescript
{
  error: string;              // Error type
  message: string;            // Human-readable message
  details?: any;              // Additional error details
}
```

Common HTTP status codes:
- `200` - Success
- `202` - Accepted (async operation started)
- `400` - Bad request (validation errors)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (not admin)
- `404` - Not found
- `429` - Too many requests (throttled)
- `500` - Internal server error

## Integration with Scrapers

The scraper processes should:

1. **Check for cancellation** periodically:
   ```typescript
   const cancelled = await scraperRuns.isCancelled(runId);
   if (cancelled) {
     // Clean up and exit
     process.exit(0);
   }
   ```

2. **Update progress** regularly:
   ```typescript
   await scraperRuns.updateProgress(runId, current, total);
   ```

3. **Log important events**:
   ```typescript
   await scraperRuns.addLog(runId, 'info', 'Processing venue: ...');
   ```

4. **Update costs** after API calls:
   ```typescript
   await scraperRuns.updateCosts(runId, searchQueries, aiCalls, estimated);
   ```

5. **Record budget usage**:
   ```typescript
   import { recordScraperCosts } from '../services/budgetThrottle.js';

   await recordScraperCosts(
     searchQueriesFree,
     searchQueriesPaid,
     aiCallsGemini,
     aiCallsClaude
   );
   ```

## Database Collections

### scraper_runs
Enhanced with new fields:
- `progress: { current, total, percentage }`
- `costs: { searchQueries, aiCalls, estimated }`
- `logs: Array<{ timestamp, level, message }>`
- `cancelledAt?: Date`
- `cancelledBy?: string`
- `config?: object`

### budget_tracking
New collection for budget monitoring:
- `date: string` (YYYY-MM-DD)
- `searchQueries: { free, paid }`
- `aiCalls: { gemini, claude }`
- `costs: { search, ai, total }`
- `throttleEvents: Array<{ timestamp, reason }>`

## Testing

### Test Discovery Start
```bash
curl -X POST http://localhost:5001/admin/scrapers/discovery/start \
  -H "Authorization: Bearer TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"countries": ["CH"], "mode": "explore", "maxQueries": 5, "dryRun": true}'
```

### Test Budget Status
```bash
curl -X GET http://localhost:5001/admin/budget/status \
  -H "Authorization: Bearer TEST_TOKEN"
```

### Test Stream
```bash
curl -N http://localhost:5001/admin/scrapers/runs/RUN_ID/stream \
  -H "Authorization: Bearer TEST_TOKEN"
```

## Production Deployment

For production, consider:

1. **Replace `spawn` with Cloud Run Jobs** for scraper execution
2. **Use Cloud Tasks** for scheduling and retries
3. **Set up monitoring** for budget alerts
4. **Configure proper CORS** for SSE endpoints
5. **Add rate limiting** per user
6. **Enable audit logging** for all scraper operations

## Cost Estimates

Default cost estimates (configurable in `budgetThrottle.ts`):
- Search query (free tier): $0
- Search query (paid): $0.005 per query
- Gemini AI call: $0.0001 per call
- Claude AI call: $0.0003 per call

Adjust these based on actual API pricing.
