# Admin Dashboard Hooks

This directory contains custom React hooks for the admin dashboard functionality.

## Available Hooks

### useHierarchicalData

Transforms flat venue data into a hierarchical tree structure for display.

```typescript
import { useHierarchicalData } from './hooks';

const { tree, stats } = useHierarchicalData({
  venues: discoveredVenues,
  groupBy: 'country', // 'country' | 'type' | 'chain'
});

// tree: CountryNode[] - hierarchical tree structure
// stats: { totalPending, byCountry, byConfidence }
```

**Features:**
- Groups venues by country
- Organizes chains with their locations
- Separates independent venues
- Calculates confidence statistics
- Sorts by confidence and count

### useKeyboardShortcuts

Handles keyboard navigation and actions for the dashboard.

```typescript
import { useKeyboardShortcuts } from './hooks';

useKeyboardShortcuts({
  onVerify: () => handleVerify(),
  onReject: () => handleReject(),
  onEdit: () => handleEdit(),
  onNavigateUp: () => setSelectedIndex(prev => prev - 1),
  onNavigateDown: () => setSelectedIndex(prev => prev + 1),
  onToggleSelect: () => toggleSelection(),
  onSelectAll: () => selectAll(),
  enabled: !isModalOpen, // Optional: disable when modal is open
});
```

**Keyboard Shortcuts:**
- `v` - Verify current item
- `r` - Reject current item
- `e` - Edit current item
- `Space` - Toggle selection
- `ArrowUp` - Navigate up
- `ArrowDown` - Navigate down
- `Ctrl/Cmd + A` - Select all
- `Ctrl/Cmd + Shift + V` - Verify selected items
- `Ctrl/Cmd + Shift + R` - Reject selected items

**Features:**
- Ignores shortcuts when typing in inputs
- Supports modifier keys (Ctrl/Cmd + Shift)
- Can be disabled conditionally

### usePlatformHealth

Fetches and manages platform health data for delivery platforms.

```typescript
import { usePlatformHealth } from './hooks';

const { platforms, circuitBreakers, isLoading, refetch } = usePlatformHealth();

// platforms: PlatformHealth[] - status, error rates, response times
// circuitBreakers: CircuitBreaker[] - circuit breaker states
```

**Features:**
- Auto-refreshes every 30 seconds
- Tracks platform operational status
- Monitors error rates and response times
- Circuit breaker state management

### useSyncStatus

Manages website sync status and triggers sync operations.

```typescript
import { useSyncStatus } from './hooks';

const {
  lastSync,
  pendingChanges,
  isLoading,
  sync,
  isSyncing,
  lastSyncStatus,
  lastSyncError,
  refetch,
} = useSyncStatus();

// Trigger sync
await sync();

// Check pending changes
console.log(pendingChanges.toAdd, pendingChanges.toUpdate, pendingChanges.toRemove);
```

**Features:**
- Auto-refreshes every minute
- Tracks pending changes (add/update/remove)
- Triggers manual sync
- Shows last sync timestamp and status
- Invalidates related queries after sync

## Usage with React Query

All hooks that fetch data use `@tanstack/react-query` for:
- Automatic caching
- Background refetching
- Loading and error states
- Query invalidation

Make sure to wrap your app with `QueryClientProvider`:

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* Your app */}
    </QueryClientProvider>
  );
}
```

## Type Exports

All hooks export their types for TypeScript usage:

```typescript
import type {
  CountryNode,
  ChainNode,
  VenueNode,
  HierarchicalStats,
  PlatformHealth,
  CircuitBreaker,
  SyncStatusResponse,
} from './hooks';
```
