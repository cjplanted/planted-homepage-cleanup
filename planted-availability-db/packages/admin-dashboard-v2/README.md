# Admin Dashboard v2

Modern admin dashboard for managing Planted Availability Database with enhanced stability and features.

## Features

- **Error Boundary System**: Global error handling with recovery UI
- **API Client with Retry Logic**: Automatic retries with exponential backoff
- **Firebase Authentication**: Secure admin authentication
- **Modern UI Components**: Shadcn-style components with Radix UI
- **React Query Integration**: Efficient data fetching with 5-minute stale time
- **Type-Safe**: Full TypeScript with strict mode

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **React Router 7** - Routing
- **TanStack Query** - Data fetching
- **Zustand** - State management
- **Firebase 11** - Authentication
- **Tailwind CSS** - Styling
- **Radix UI** - Headless UI components

## Getting Started

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your Firebase credentials:

```bash
cp .env.example .env
```

### 3. Run Development Server

```bash
pnpm dev
```

The app will be available at http://localhost:5175

### 4. Build for Production

```bash
pnpm build
```

## Project Structure

```
src/
├── app/                    # App-level components
│   ├── providers/          # Context providers (Auth, Query)
│   ├── routes/             # Route configuration
│   └── App.tsx             # Root component
├── lib/                    # Core libraries
│   ├── api/                # API client and endpoints
│   ├── firebase.ts         # Firebase configuration
│   └── utils.ts            # Utility functions
├── pages/                  # Page components
├── shared/                 # Shared components
│   ├── components/         # Reusable components
│   │   ├── Layout/         # Layout components
│   │   ├── ErrorBoundary.tsx
│   │   ├── ErrorFallback.tsx
│   │   └── ...
│   ├── hooks/              # Custom hooks
│   └── ui/                 # UI components (Button, Card, etc.)
├── index.css               # Global styles
└── main.tsx                # Entry point
```

## Available Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm preview` - Preview production build
- `pnpm typecheck` - Run TypeScript type checking

## Navigation Structure

### Workflow Section
- **Dashboard** - Overview and quick actions
- **Scrape Control** - Manage scraping operations
- **Review Queue** - Review and approve venues
- **Sync to Website** - Publish to live site

### Browser Section
- **Venue Browser** - Browse all venues
- **Live on Website** - View published venues

### Operations Section
- **Cost Monitor** - Track API costs

## API Configuration

The API base URL can be configured via the `VITE_API_URL` environment variable. Default is `http://localhost:3000`.

All API requests include:
- Automatic Firebase token refresh
- Retry with exponential backoff (3 retries)
- 30-second timeout
- Offline detection

## Authentication

Uses Firebase Authentication for admin access. The auth flow:
1. User signs in via `/login`
2. Firebase provides JWT token
3. Token automatically included in all API requests
4. Token refreshed automatically when needed

## Error Handling

Global error boundary catches all React errors and displays a user-friendly recovery UI with:
- Clear error message
- Recovery options (retry, reload, go home)
- Stack trace in development mode

## Development Notes

- Uses TypeScript strict mode for maximum type safety
- Tailwind CSS for styling with custom theme variables
- React Query with 5-minute stale time for optimal caching
- All components are functional with hooks
- Port 5175 to avoid conflicts with v1 dashboard (5174)
