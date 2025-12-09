# Planted Availability Database - User Guide

This guide explains how to run, use, and maintain the Planted Availability Database system.

---

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9.x (`npm install -g pnpm`)
- Firebase CLI (`npm install -g firebase-tools`)
- Gemini API key (for AI features) - recommended
- Google Custom Search API key + Engine ID (for web search)

### Initial Setup

```bash
# Clone the repository
git clone <repository-url>
cd planted-website

# Install dependencies for the backend
cd planted-availability-db
pnpm install

# Build all packages
pnpm build

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys
```

---

## 1. Running the Website

### Development Mode

```bash
cd planted-astro
npm install
npm run dev
```

The website will be available at `http://localhost:4321`

### Production Build

```bash
npm run build
npm run preview  # Preview the production build
```

### Deployment

The website is automatically deployed to GitHub Pages on push to `main` branch.

---

## 2. Running the Admin Dashboard

### Development Mode

```bash
cd planted-availability-db/packages/admin-dashboard
npm install
npm run dev
```

The admin dashboard will be available at `http://localhost:5173`

### Login

1. Navigate to `http://localhost:5173/login`
2. Sign in with your Firebase-authenticated account
3. Your account must have admin claims set in Firebase

### Available Pages

| Page | URL | Description |
|------|-----|-------------|
| Dashboard | `/` | Overview stats and metrics |
| Venues | `/venues` | Manage restaurant/retail locations |
| Dishes | `/dishes` | Manage menu items |
| Scrapers | `/scrapers` | Monitor scraper status |
| Promotions | `/promotions` | Manage promotions |
| Moderation | `/moderation` | Review flagged items |
| Partners | `/partners` | Manage partner integrations |
| Discovery Review | `/discovery-review` | Review AI-discovered venues |

---

## 3. Running Discovery Agents

### Venue Discovery

Find new restaurants serving Planted products:

```bash
cd planted-availability-db/packages/scrapers

# Discover venues in Germany on Uber Eats
pnpm run discovery --country DE --platform uber-eats

# Discover across all platforms in Switzerland
pnpm run discovery --country CH

# Dry run (don't save to database)
pnpm run discovery --country AT --dry-run

# Limit number of queries
pnpm run discovery --country DE --max-queries 20
```

**Options:**
| Flag | Description |
|------|-------------|
| `--country, -c` | Target country (CH, DE, AT) |
| `--platform, -p` | Specific platform (uber-eats, lieferando, wolt, just-eat, smood) |
| `--max-queries` | Maximum search queries to execute (default: 2000) |
| `--dry-run` | Don't save results to database |
| `--verbose, -v` | Detailed logging |
| `--ai` | AI provider: gemini (default) or claude |
| `--provider` | Search provider: google (default), serpapi, mock |

**Budget & Caching:**
- Default budget: 2,000 queries per run
- First 600 queries are free (6 search engines × 100 each)
- Queries 601-2000 cost $5 per 1,000 queries
- Query cache prevents duplicate searches (24h for results, 7d for no results)

### Search Pool Management

Monitor and manage search engine quota:

```bash
# View current quota usage
pnpm run search-pool stats

# Detailed per-engine usage
pnpm run search-pool list

# Test engine rotation
pnpm run search-pool test
```

### Dish Extraction

Extract menu items from discovered venues:

```bash
# Enrich venues with dish data
pnpm run dish-finder --mode enrich --chains dean-david

# Refresh prices for existing dishes
pnpm run dish-finder --mode refresh --countries CH

# Verify dishes still exist
pnpm run dish-finder --mode verify --max-venues 50

# All platforms for a specific chain
pnpm run dish-finder --chains "BIRDIE BIRDIE CHICKEN"
```

**Options:**
| Flag | Description |
|------|-------------|
| `--mode, -m` | Mode: enrich, refresh, verify |
| `--chains` | Specific chain IDs to process |
| `--countries, -c` | Target countries |
| `--platforms, -p` | Specific platforms |
| `--max-venues` | Limit venues processed |
| `--dry-run` | Don't save results |

---

## 4. Reviewing Discoveries

### Command Line Review (Venues)

Interactive CLI for reviewing discovered venues:

```bash
cd planted-availability-db/packages/scrapers

# Review 10 random venues
pnpm run review

# Review German venues
pnpm run review --country DE

# Review specific number
pnpm run review --batch 20

# Review in order of confidence
pnpm run review --sequential
```

**Interactive Commands:**
| Key | Action |
|-----|--------|
| `y` | Verify venue (correct) |
| `n` | Reject venue (false positive) |
| `s` | Skip this venue |
| `o` | Open URL in browser |
| `q` | Quit review session |
| `?` | Show help |

### Command Line Review (Dishes)

Interactive CLI for reviewing extracted dishes:

```bash
# Review 10 dishes
pnpm run review-dishes

# Review dishes from specific chain
pnpm run review-dishes --chain dean-david

# Review Swiss dishes with high confidence
pnpm run review-dishes --country CH --min-confidence 80
```

**Interactive Commands:**
| Key | Action |
|-----|--------|
| `y` | Verify dish (correct) |
| `n` | Reject dish (not Planted) |
| `p` | Wrong product - enter correct one |
| `r` | Wrong price - mark for re-extraction |
| `s` | Skip |
| `o` | Open source URL |
| `q` | Quit |

### Admin Dashboard Review

Use the Discovery Review page in the admin dashboard for a visual interface:

1. Navigate to `/discovery-review`
2. Filter by country, confidence, or platform
3. Click "Verify All" to approve venue + dishes
4. Click "Edit & Verify" to correct data before approving
5. Click "Reject" to mark as false positive

---

## 5. Managing Data

### Exporting to Website

Export discovered data to the website:

```bash
cd planted-availability-db

# Export venues to website data files
node scripts/export-to-website.js

# Sync venues with website
node scripts/sync-to-website.js
```

### Batch Scripts (Windows)

Pre-configured batch scripts for common operations:

```bash
# Run discovery for all countries
run-discovery-all.bat

# Run discovery for Germany only
run-discovery-de.bat

# Run dish extraction
run-dish-finder.bat

# Run venue review
run-review.bat
```

---

## 6. Firebase Operations

### Deploy Cloud Functions

```bash
cd planted-availability-db

# Deploy all functions
firebase deploy --only functions

# Deploy specific function
firebase deploy --only functions:scheduledDiscovery

# View function logs
firebase functions:log
```

### Firestore Operations

```bash
# Deploy security rules
firebase deploy --only firestore:rules

# Deploy indexes
firebase deploy --only firestore:indexes

# Start emulator for local testing
firebase emulators:start
```

---

## 7. Troubleshooting

### Common Issues

**"ANTHROPIC_API_KEY not set"**
```bash
# Add to .env file
ANTHROPIC_API_KEY=your-key-here

# Or set environment variable
export ANTHROPIC_API_KEY=your-key-here
```

**"Login failed" in Admin Dashboard**
1. Check Firebase Auth is configured
2. Verify user has admin claims:
   ```bash
   firebase auth:setCustomUserClaims <uid> '{"admin": true}'
   ```

**"No venues discovered"**
- Check API keys are valid
- Check internet connectivity
- Try with `--verbose` flag for details
- Verify search strategies aren't all deprecated

**Build Errors**
```bash
# Clean and rebuild
pnpm clean
pnpm install
pnpm build
```

### Logs

**Cloud Functions Logs:**
```bash
firebase functions:log --only discovery
firebase functions:log --only scheduledDiscovery
```

**Local Logs:**
Check console output when running CLI tools with `--verbose` flag.

---

## 8. Daily Operations

### Recommended Workflow

1. **Morning:** Check admin dashboard for overnight discoveries
2. **Review:** Process pending venues in Discovery Review
3. **Monitor:** Check scraper status for any failures
4. **Export:** After reviews, export data to website

### Scheduled Tasks

The system runs automated tasks:

| Task | Schedule | Description |
|------|----------|-------------|
| Discovery | Daily 3 AM | Find new venues |
| Verification | Weekly Sunday 4 AM | Re-verify existing venues |

### Data Freshness

- Venues are marked "stale" after 7 days without verification
- Run verification mode to refresh stale data
- Review flagged items in Moderation page

---

## 9. API Usage

### Public API Endpoints

```bash
# Get venues by country
curl "https://europe-west6-get-planted-db.cloudfunctions.net/venues?country=CH"

# Get nearby venues
curl "https://europe-west6-get-planted-db.cloudfunctions.net/nearby?lat=47.3769&lng=8.5417&radius=5"

# Get dishes
curl "https://europe-west6-get-planted-db.cloudfunctions.net/dishes?product=planted.chicken"
```

### Using the SDK

```javascript
import { PADClient } from '@pad/client-sdk';

const client = new PADClient();

// Get nearby venues
const venues = await client.getNearbyVenues(47.3769, 8.5417, 5);

// Get venue details
const venue = await client.getVenue('venue-id');
```

---

## 10. Development

### Package Structure

```
packages/
├── core/           # Shared types (modify types here)
├── database/       # Firestore operations (add new collections here)
├── api/            # Cloud Functions (add API endpoints here)
├── scrapers/       # Discovery agents (modify extraction logic here)
├── admin-dashboard/# Admin UI (add new pages here)
└── client-sdk/     # Public SDK (update for new endpoints)
```

### Adding a New Page to Admin

1. Create page component in `packages/admin-dashboard/src/pages/`
2. Add route in `packages/admin-dashboard/src/App.tsx`
3. Add navigation link in `packages/admin-dashboard/src/components/Layout.tsx`

### Adding a New Collection

1. Define types in `packages/core/src/types/`
2. Create collection file in `packages/database/src/collections/`
3. Export from `packages/database/src/collections/index.ts`

### Building Packages

```bash
# Build all packages
pnpm build

# Build specific package
pnpm --filter @pad/core build
pnpm --filter @pad/scrapers build

# Watch mode
pnpm --filter @pad/admin-dashboard dev
```

---

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the TECHNICAL-DOCUMENTATION.md for system details
3. Check Firebase console for deployment issues
4. Review Cloud Functions logs for runtime errors
