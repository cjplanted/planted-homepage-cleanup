# Admin Dashboard v2 - Infrastructure Reference

This document provides a comprehensive reference of the infrastructure created by Agent 1 for use by other agents.

## Project Overview

**Package Name**: `@pad/admin-dashboard-v2`
**Port**: 5175
**Technology Stack**: React 18, TypeScript, Vite, TailwindCSS, React Router 7, React Query 5

## Directory Structure

```
admin-dashboard-v2/
├── src/
│   ├── app/                           # Application-level code
│   │   ├── providers/
│   │   │   ├── AuthProvider.tsx       # Firebase auth context
│   │   │   └── QueryProvider.tsx      # React Query setup
│   │   ├── routes/
│   │   │   └── router.tsx             # Route configuration
│   │   └── App.tsx                    # Root component
│   │
│   ├── lib/                           # Core libraries
│   │   ├── api/
│   │   │   ├── client.ts              # API client with retry logic
│   │   │   └── endpoints.ts           # API endpoint constants
│   │   ├── firebase.ts                # Firebase initialization
│   │   └── utils.ts                   # Utility functions (cn, formatDate, etc.)
│   │
│   ├── pages/                         # Page components (placeholder)
│   │   ├── DashboardPage.tsx          # Main dashboard
│   │   ├── ScrapeControlPage.tsx      # Scrape management
│   │   ├── ReviewQueuePage.tsx        # Review queue
│   │   ├── SyncPage.tsx               # Sync to website
│   │   ├── VenuesPage.tsx             # Venue browser
│   │   ├── LiveVenuesPage.tsx         # Live venues
│   │   ├── CostsPage.tsx              # Cost monitoring
│   │   └── LoginPage.tsx              # Authentication
│   │
│   ├── shared/                        # Shared/reusable code
│   │   ├── components/
│   │   │   ├── Layout/
│   │   │   │   ├── MainLayout.tsx     # Main app layout
│   │   │   │   ├── Sidebar.tsx        # Navigation sidebar
│   │   │   │   └── Header.tsx         # Top header bar
│   │   │   ├── ErrorBoundary.tsx      # Error boundary wrapper
│   │   │   ├── ErrorFallback.tsx      # Error UI
│   │   │   ├── LoadingState.tsx       # Loading spinner
│   │   │   ├── EmptyState.tsx         # Empty state UI
│   │   │   └── ErrorState.tsx         # Error display
│   │   ├── hooks/
│   │   │   └── useAuth.ts             # Auth hook
│   │   └── ui/                        # Base UI components
│   │       ├── Button.tsx             # Button variants
│   │       ├── Card.tsx               # Card components
│   │       ├── Badge.tsx              # Status badges
│   │       ├── Input.tsx              # Form input
│   │       └── Dialog.tsx             # Modal dialog
│   │
│   ├── index.css                      # Global styles + Tailwind
│   └── main.tsx                       # Entry point
│
├── index.html                         # HTML template
├── package.json                       # Dependencies
├── tsconfig.json                      # TypeScript config
├── vite.config.ts                     # Vite config
├── tailwind.config.js                 # Tailwind config
├── postcss.config.js                  # PostCSS config
├── .env.example                       # Environment template
├── .gitignore                         # Git ignore
└── README.md                          # Documentation
```

## Key Components

### API Client (`src/lib/api/client.ts`)

Production-ready API client with:
- **Auto Token Refresh**: Gets Firebase token automatically
- **Retry Logic**: 3 retries with exponential backoff
- **Timeout**: 30-second request timeout
- **Offline Detection**: Checks network connectivity
- **Error Types**: `ApiError` and `NetworkError` classes

**Usage Example**:
```typescript
import { get, post } from '@/lib/api/client';
import { API_ENDPOINTS } from '@/lib/api/endpoints';

// GET request
const data = await get<VenueData>(API_ENDPOINTS.VENUES);

// POST request
const result = await post<SyncResult>(API_ENDPOINTS.SYNC_START, { venueIds: [...] });
```

### Authentication System

**Components**:
- `src/lib/firebase.ts` - Firebase initialization
- `src/shared/hooks/useAuth.ts` - Auth hook with state management
- `src/app/providers/AuthProvider.tsx` - Context provider

**Usage Example**:
```typescript
import { useAuthContext } from '@/app/providers/AuthProvider';

function MyComponent() {
  const { user, isAuthenticated, signOut } = useAuthContext();

  return <div>{user?.email}</div>;
}
```

### Error Boundary

Global error boundary catches all React errors and shows recovery UI.

**Features**:
- Automatic error catching
- Stack trace in development
- Recovery options (retry, reload, go home)
- Optional custom fallback

### Layout System

**MainLayout**: Primary app layout with sidebar and header
**Sidebar**: Navigation with three sections (Workflow, Browser, Operations)
**Header**: Top bar with user info and sign out

All protected routes automatically wrapped in MainLayout.

### React Query Setup

Configured with:
- 5-minute stale time
- 10-minute cache time
- 2 retries for queries
- 1 retry for mutations
- Auto refetch on reconnect

**Usage Example**:
```typescript
import { useQuery } from '@tanstack/react-query';

const { data, isLoading, error } = useQuery({
  queryKey: ['venues'],
  queryFn: () => get<Venue[]>(API_ENDPOINTS.VENUES),
});
```

### UI Components

All components follow Shadcn design system using Radix UI primitives:

**Button**: Multiple variants (default, destructive, outline, secondary, ghost, link)
**Card**: Container with Header, Title, Description, Content, Footer
**Badge**: Status indicators with color variants
**Input**: Form input with consistent styling
**Dialog**: Modal dialog with overlay

**Usage Example**:
```typescript
import { Button } from '@/shared/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/ui/Card';

<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>
    <Button variant="default">Click Me</Button>
  </CardContent>
</Card>
```

### Utility Components

**LoadingState**: Spinner with optional message
**EmptyState**: Shows when no data available
**ErrorState**: Error display with retry button

## Routes

| Path | Component | Description |
|------|-----------|-------------|
| `/login` | LoginPage | Authentication (public) |
| `/` | DashboardPage | Main dashboard (protected) |
| `/scrape-control` | ScrapeControlPage | Scrape management (protected) |
| `/review-queue` | ReviewQueuePage | Review queue (protected) |
| `/sync` | SyncPage | Sync to website (protected) |
| `/venues` | VenuesPage | Venue browser (protected) |
| `/live-venues` | LiveVenuesPage | Live venues (protected) |
| `/costs` | CostsPage | Cost monitoring (protected) |

All routes redirect to `/login` if not authenticated.

## API Endpoints

Defined in `src/lib/api/endpoints.ts`:

```typescript
API_ENDPOINTS = {
  // Health & Status
  HEALTH: '/admin/health',

  // Dashboard
  DASHBOARD_STATS: '/admin/dashboard/stats',

  // Scrape Control
  SCRAPE_STATUS: '/admin/scrape/status',
  SCRAPE_START: '/admin/scrape/start',
  SCRAPE_STOP: '/admin/scrape/stop',
  SCRAPE_LOGS: '/admin/scrape/logs',

  // Review Queue
  REVIEW_QUEUE: '/admin/review/queue',
  REVIEW_APPROVE: '/admin/review/approve',
  REVIEW_REJECT: '/admin/review/reject',
  REVIEW_BULK: '/admin/review/bulk',

  // Sync
  SYNC_STATUS: '/admin/sync/status',
  SYNC_START: '/admin/sync/start',
  SYNC_HISTORY: '/admin/sync/history',

  // Venues
  VENUES: '/admin/venues',
  VENUE_BY_ID: (id) => `/admin/venues/${id}`,
  VENUE_UPDATE: (id) => `/admin/venues/${id}`,
  VENUE_DELETE: (id) => `/admin/venues/${id}`,

  // Live Venues
  LIVE_VENUES: '/admin/live-venues',

  // Costs
  COST_STATS: '/admin/costs/stats',
  COST_HISTORY: '/admin/costs/history',
  COST_BREAKDOWN: '/admin/costs/breakdown',
}
```

## Environment Variables

Required in `.env`:

```bash
# Firebase
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=

# API
VITE_API_URL=http://localhost:3000
```

## Styling

### Tailwind CSS

Custom theme with CSS variables in `src/index.css`:
- `--background`, `--foreground`
- `--card`, `--card-foreground`
- `--primary`, `--primary-foreground`
- `--secondary`, `--muted`, `--accent`
- `--destructive`, `--border`, `--input`, `--ring`

### Utility Function

```typescript
import { cn } from '@/lib/utils';

// Merge Tailwind classes safely
<div className={cn('px-4 py-2', isActive && 'bg-blue-500', className)} />
```

## Development Commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Start dev server (port 5175)
pnpm build            # Build for production
pnpm preview          # Preview production build
pnpm typecheck        # TypeScript check
```

## Type Safety

- TypeScript strict mode enabled
- Path aliases: `@/*` maps to `src/*`
- Import types from `@pad/core` package

## Next Steps for Other Agents

### Agent 2: Dashboard & Scrape Control
- Implement `DashboardPage.tsx`
- Implement `ScrapeControlPage.tsx`
- Use API endpoints for real data

### Agent 3: Review Queue & Sync
- Implement `ReviewQueuePage.tsx`
- Implement `SyncPage.tsx`
- Create review workflow components

### Agent 4: Venue Browser & Live Venues
- Implement `VenuesPage.tsx`
- Implement `LiveVenuesPage.tsx`
- Create venue table/grid components

### Agent 5: Cost Monitor
- Implement `CostsPage.tsx`
- Create cost charts and statistics

## Best Practices

1. **Use existing API client** - Don't create fetch calls directly
2. **Use React Query** - For all data fetching
3. **Follow component structure** - Keep pages simple, extract complex logic
4. **Use utility components** - LoadingState, EmptyState, ErrorState
5. **Type everything** - Import types from `@pad/core`
6. **Use Tailwind** - Follow existing theme variables
7. **Handle errors** - Error boundary catches them, but handle gracefully
8. **Test auth** - All pages are protected except login

## Support

If you need to modify infrastructure:
- API client: `src/lib/api/client.ts`
- Routes: `src/app/routes/router.tsx`
- Layout: `src/shared/components/Layout/`
- Theme: `src/index.css`
