# Planted Availability Database (PAD)

A geo-localized database system for tracking Planted product availability across retail locations, restaurants, and delivery services.

## Architecture

This is a monorepo using pnpm workspaces and Turborepo, containing:

- **@pad/core** - Shared TypeScript types, Zod schemas, and utilities
- **@pad/database** - Firestore collections and CRUD operations
- **@pad/api** - Firebase Cloud Functions for the REST API
- **@pad/scrapers** - Data collection scrapers with change detection
- **@pad/admin-dashboard-v2** - Modern workflow-focused admin dashboard
- **@pad/client-sdk** - SDK for integrating with the planted-website

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- Firebase CLI (`npm install -g firebase-tools`)

### Installation

```bash
cd planted-availability-db
pnpm install
```

### Development

```bash
# Build all packages
pnpm run build

# Run type checking
pnpm run typecheck

# Run tests
pnpm run test

# Start Firebase emulators
pnpm run serve
```

### Project Structure

```
planted-availability-db/
├── packages/
│   ├── core/               # Types, schemas, utilities
│   ├── database/           # Firestore collections
│   ├── api/                # Cloud Functions
│   ├── scrapers/           # Data collection
│   ├── admin-dashboard-v2/ # Admin UI (workflow-focused)
│   └── client-sdk/         # Website integration SDK
├── firebase.json           # Firebase configuration
├── firestore.rules         # Security rules
├── firestore.indexes.json
└── .github/workflows/      # CI/CD pipelines
```

### Admin Dashboard

Modern workflow-focused dashboard:
```bash
cd packages/admin-dashboard-v2
pnpm install && pnpm dev    # http://localhost:5175
```
## API Endpoints

### Public API

- `GET /api/v1/nearby` - Find venues near a location
- `GET /api/v1/venues` - List venues
- `GET /api/v1/venues/:id` - Get venue details
- `GET /api/v1/dishes` - List dishes
- `GET /api/v1/dishes/:id` - Get dish details
- `GET /api/v1/delivery/check` - Check delivery availability

### Admin API (Requires Authentication)

- `POST/PUT/DELETE /api/v1/admin/venues`
- `POST/PUT/DELETE /api/v1/admin/dishes`
- `POST/DELETE /api/v1/admin/promotions`
- `POST/DELETE /api/v1/admin/chains`

## Environment Variables

Create a `.env` file based on `.env.example`:

```bash
# Firebase Admin SDK
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account-email
FIREBASE_PRIVATE_KEY=your-private-key

# For scrapers
GOOGLE_SHEETS_API_KEY=your-api-key
```

## Deployment

Deployments are automated via GitHub Actions:

- **CI**: Runs on all PRs - builds, tests, and deploys previews
- **Deploy**: Runs on main branch - deploys to production

Manual deployment:

```bash
firebase deploy
```

## Scrapers

The PAD includes browser-based scrapers for multiple markets:

### Switzerland
- **Coop** - Retail products at coop.ch
- **Migros** - Retail products at migros.ch

### Germany
- **REWE** - Retail products at rewe.de
- **EDEKA** - Retail products at edeka.de
- **Wolt** - Delivery restaurants
- **Lieferando** - Delivery restaurants

### United Kingdom
- **Sainsbury's** - Retail products
- **Waitrose** - Retail products
- **Deliveroo** - Delivery restaurants

### Netherlands
- **Albert Heijn** - Retail products at ah.nl

### Multi-Market
- **Carrefour** - France, Spain, Italy
- **Glovo** - Spain, Italy delivery
- **Uber Eats** - Multiple markets

### Running Scrapers

```bash
# List available scrapers
pnpm --filter @pad/scrapers run cli --help

# Run specific scraper
pnpm --filter @pad/scrapers run cli run coop-ch --dry-run --verbose

# Check scraper health
pnpm --filter @pad/scrapers run cli health
```

## Services

### API Services
- **Caching** - LRU cache with CDN headers (`middleware/cache.ts`)
- **Monitoring** - Health checks and Slack alerts (`services/monitoring.ts`)
- **Real-time** - Firestore subscriptions (`services/realtime.ts`)
- **Search** - Algolia integration (`services/search.ts`)
- **Geolocation** - IP-to-location (`services/geolocation.ts`)
- **Webhooks** - Partner data parsing (`services/webhook-parser.ts`)

## Documentation

- [Technical Documentation](./TECHNICAL-DOCUMENTATION.md) - Complete system architecture
- [User Guide](./USER-GUIDE.md) - How to use the system
- [Admin Dashboard v2 README](./packages/admin-dashboard-v2/README.md) - v2 dashboard setup
- [Admin Dashboard v2 Plan](./ADMIN-DASHBOARD-2.0-PLAN.md) - v2 design & implementation plan
- [API Documentation](./docs/api.md)
- [Scraper Guide](./docs/scrapers.md)
- [Runbooks](./docs/runbooks/README.md)
  - [Scraper Failures](./docs/runbooks/scraper-failures.md)
  - [Database Operations](./docs/runbooks/database-operations.md)
  - [API Issues](./docs/runbooks/api-issues.md)
  - [Deployment](./docs/runbooks/deployment.md)

## License

Private - Planted Foods AG
