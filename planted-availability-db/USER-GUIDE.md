# Planted Availability Database - User Guide

This guide explains how to run, use, and maintain the Planted Availability Database system.

---

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9.x (`npm install -g pnpm`)
- Firebase CLI (`npm install -g firebase-tools`)
- Gemini API key (for AI features) - recommended
- Google Custom Search API key (for web search)

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

The admin dashboard provides a workflow-first experience with enhanced stability.

**Production URL:** `https://get-planted-db.web.app`

### Development Mode

```bash
cd planted-availability-db/packages/admin-dashboard-v2
pnpm install
pnpm dev
```

The dashboard will be available at `http://localhost:5173`

### Login

1. Navigate to `http://localhost:5173/login` (or `https://get-planted-db.web.app/login` for production)
2. Sign in with your Firebase-authenticated account
3. Your account must have admin claims set in Firebase

### Navigation Sections

The dashboard is organized into workflow sections:

**Workflow Section** - Main operational flow:
| Page | URL | Description |
|------|-----|-------------|
| Dashboard | `/` | Pipeline overview, quick actions, running operations |
| Scrape Control | `/scrape-control` | Trigger discovery and extraction |
| Review Queue | `/review-queue` | Review and approve discovered venues |
| Sync to Website | `/sync` | Push approved data to production |

**Browser Section** - Data exploration:
| Page | URL | Description |
|------|-----|-------------|
| Venue Browser | `/venues` | Browse all venues with hierarchy |
| Live on Website | `/live-venues` | View published venues |

**Operations Section** - Monitoring:
| Page | URL | Description |
|------|-----|-------------|
| Cost Monitor | `/costs` | Track API costs and budget |

### Key Features

1. **Workflow Pipeline** - Visual pipeline showing: Scraping → Extraction → Review → Website Sync
2. **Hierarchical Review** - Venues organized by Country → Chain → Location
3. **Bulk Operations** - Approve or reject multiple venues at once
4. **AI Feedback** - Provide feedback that improves AI accuracy
5. **Real-time Progress** - Live status updates for running operations
6. **Error Recovery** - Automatic retries with exponential backoff
7. **Budget Tracking** - Monitor daily/monthly API costs

### Keyboard Shortcuts (Review Queue)

| Key | Action |
|-----|--------|
| `j` / `k` | Navigate up/down |
| `a` | Approve current venue |
| `r` | Reject current venue |
| `e` | Edit current venue |
| `p` | Partial approve |
| `?` | Show help |


---

## 3. Running Discovery Agents

### Venue Discovery

Find new restaurants serving Planted products:

```bash
cd planted-availability-db/packages/scrapers

# Discover venues in Germany on Uber Eats
pnpm run discovery --countries DE --platforms uber-eats

# Discover across all platforms in Switzerland
pnpm run discovery --countries CH

# Use specific discovery mode
pnpm run discovery --mode explore --countries CH
pnpm run discovery --mode enumerate --chains "dean&david,Hiltl"
pnpm run discovery --mode verify --countries DE

# Dry run (don't save to database)
pnpm run discovery --countries AT --dry-run

# Limit number of queries
pnpm run discovery --countries DE --max-queries 50

# Verbose output
pnpm run discovery --countries CH --verbose
```

**Discovery Modes:**
| Mode | Description |
|------|-------------|
| `explore` | Search for new venues across cities (default) |
| `enumerate` | Find all locations of specific chains |
| `verify` | Re-check existing venue URLs |

**Options:**
| Flag | Description |
|------|-------------|
| `--mode, -m` | Discovery mode: explore, enumerate, verify (default: explore) |
| `--countries, -c` | Comma-separated countries: CH,DE,AT |
| `--platforms, -p` | Comma-separated platforms (default: all) |
| `--chains` | Comma-separated chain names (for enumerate mode) |
| `--max-queries` | Maximum search queries to execute (default: 20) |
| `--dry-run` | Don't save results to database |
| `--verbose, -v` | Detailed logging |
| `--ai` | AI provider: gemini (default) or claude |
| `--provider` | Search provider: google (default), serpapi, mock |

**Budget & Caching:**
- Free quota: 600 queries/day (6 search engines x 100 each)
- Paid fallback: $5 per 1,000 queries after free quota exhausted
- Query cache prevents duplicate searches (24h for results, 7d for no results)

### Search Pool Management

Monitor and manage search engine quota:

```bash
cd planted-availability-db/packages/scrapers

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
cd planted-availability-db/packages/scrapers

# Enrich venues with dish data
pnpm run dish-finder --mode enrich --chains dean-david

# Refresh prices for existing dishes
pnpm run dish-finder --mode refresh --countries CH

# Verify dishes still exist
pnpm run dish-finder --mode verify --max-venues 50

# Dry run with verbose output
pnpm run dish-finder --chains kaimug --dry-run --verbose

# Show statistics
pnpm run dish-finder --stats
```

**Extraction Modes:**
| Mode | Description |
|------|-------------|
| `enrich` | Add dishes to venues without dish data (default) |
| `refresh` | Update prices for existing dishes |
| `verify` | Check if dishes still exist on platforms |

**Options:**
| Flag | Description |
|------|-------------|
| `--mode, -m` | Mode: enrich, refresh, verify |
| `--venues` | Comma-separated venue IDs to process |
| `--chains` | Comma-separated chain IDs to process |
| `--countries, -c` | Comma-separated country codes (CH,DE,AT) |
| `--platforms, -p` | Comma-separated platforms |
| `--max-venues` | Limit venues processed (default: 50) |
| `--dry-run` | Don't save results |
| `--verbose, -v` | Verbose output |
| `--learn` | Run learning process after extraction |
| `--stats` | Show statistics and exit |

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

# Review in order of confidence (highest first)
pnpm run review --sequential

# Review venues with specific status
pnpm run review --status discovered
```

**Options:**
| Flag | Description |
|------|-------------|
| `--batch, -b` | Number of venues to review (default: 10) |
| `--country, -c` | Filter by country: CH, DE, AT |
| `--random, -r` | Show venues in random order (default) |
| `--sequential, -s` | Show venues in order of confidence score |
| `--status` | Filter by status: discovered, verified, etc. |

**Interactive Commands:**
| Key | Action |
|-----|--------|
| `y` / `yes` / `+` | Verify venue (correct) |
| `n` / `no` / `-` | Reject venue (false positive) |
| `s` / `skip` | Skip this venue |
| `o` / `open` | Open URL in browser |
| `q` / `quit` | Exit review session |
| `?` / `help` | Show help |

### Command Line Review (Dishes)

Interactive CLI for reviewing extracted dishes:

```bash
cd planted-availability-db/packages/scrapers

# Review 10 dishes
pnpm run review-dishes

# Review dishes from specific chain
pnpm run review-dishes --chain dean-david

# Review Swiss dishes with high confidence
pnpm run review-dishes --country CH --min-confidence 80

# Review more dishes
pnpm run review-dishes --batch 20
```

**Options:**
| Flag | Description |
|------|-------------|
| `--batch, -b` | Number of dishes to review (default: 10) |
| `--chain` | Filter by chain ID (e.g., dean-david) |
| `--country` | Filter by country: CH, DE, AT |
| `--status` | Filter by status: discovered, verified |
| `--min-confidence` | Minimum confidence score (0-100) |

**Interactive Commands:**
| Key | Action |
|-----|--------|
| `y` / `yes` / `+` | Verify dish (correct) |
| `n` / `no` / `-` | Reject dish (not Planted) |
| `p` | Wrong product - enter correct one |
| `r` | Wrong price - mark for re-extraction |
| `s` / `skip` | Skip this dish |
| `o` / `open` | Open source URL in browser |
| `q` / `quit` | Exit review session |
| `?` / `help` | Show help |

### Admin Dashboard Review

Use the Review Queue page in the Admin Dashboard for a modern visual interface:

1. Navigate to `https://get-planted-db.web.app/review-queue` (production) or `http://localhost:5173/review-queue` (dev)
2. **Filter**: Use sidebar filters for country, confidence, status
3. **Browse**: Navigate the hierarchical tree (Country → Chain → Venue)
4. **Review**: View venue details, delivery platforms, and **dishes with product types**
5. **Approve**:
   - Full Approve - Everything correct
   - Partial Approve - Correct with minor fixes + feedback
6. **Reject**: Mark as false positive with reason
7. **Bulk Actions**: Select multiple venues for bulk approve/reject

**What You'll See:**
- Venue name and address
- Delivery platform links (Uber Eats, Wolt, etc.)
- **Dishes**: Name, product type (e.g., planted.chicken), price, confidence score
- Confidence factors explaining why this venue was discovered

**Approval Workflow States:**
```
DISCOVERED → VERIFIED/REJECTED → READY FOR SYNC → LIVE ON WEBSITE
```

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
cd planted-availability-db/packages/scrapers

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

## 7. Environment Variables

### API Keys Location

**All API keys are stored in:** `planted-availability-db/.env`

This file is gitignored and contains sensitive credentials. The keys are already configured for this project:
- **Gemini AI Key** (`GOOGLE_AI_API_KEY`) - For AI-powered discovery and extraction
- **Google Search Key** (`GOOGLE_SEARCH_API_KEY`) - For web search queries

**Important:** Never commit `.env` to git. If you need to set up on a new machine, copy the keys from the existing `.env` file or request them from the project owner.

### Required Variables

```bash
# Firebase/Google Cloud
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
FIREBASE_PROJECT_ID=get-planted-db

# Gemini AI (recommended - default provider)
# Key is stored in .env - DO NOT share publicly
GOOGLE_AI_API_KEY=<configured>

# Google Custom Search
# Key is stored in .env - DO NOT share publicly
GOOGLE_SEARCH_API_KEY=<configured>
```

### Optional Variables

```bash
# AI Model selection
GOOGLE_AI_MODEL=gemini-2.5-flash

# Claude AI (alternative to Gemini)
ANTHROPIC_API_KEY=your-anthropic-api-key-here

# Custom Search Engine IDs (defaults provided)
GOOGLE_SEARCH_ENGINE_ID_1=engine-id-1
GOOGLE_SEARCH_ENGINE_ID_2=engine-id-2
# ... up to GOOGLE_SEARCH_ENGINE_ID_6

# Discovery settings
MAX_QUERIES_PER_RUN=2000
ENABLE_QUERY_CACHE=true
ENABLE_INLINE_DISH_EXTRACTION=true

# Admin Dashboard
VITE_API_URL=http://localhost:5001/planted-availability-db/us-central1/api
VITE_FIREBASE_AUTH_DOMAIN=planted-availability-db.firebaseapp.com
```

---

## 8. Troubleshooting

### Common Issues

**"No AI API key found"**
```bash
# Set Gemini key (recommended)
GOOGLE_AI_API_KEY=your-key-here

# Or set Claude key
ANTHROPIC_API_KEY=your-key-here
```

**"No search credentials available"**
```bash
# Ensure search API key is set
GOOGLE_SEARCH_API_KEY=your-key-here
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
- Check search pool quota: `pnpm run search-pool stats`

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

## 9. Daily Operations

### Recommended Workflow

1. **Morning:** Open Dashboard (`https://get-planted-db.web.app`) - check pipeline status and overnight discoveries
2. **Review:** Navigate to Review Queue - process pending venues with bulk actions
   - Each venue shows its **dishes** with product types, prices, and confidence scores
   - Use Partial Approve to provide feedback on incorrect data
3. **Monitor:** Check Cost Monitor for budget usage and API costs
4. **Sync:** Use Sync to Website page to push approved venues live
5. **Verify:** Check Live on Website to confirm data is published

### Scheduled Tasks

The system runs automated tasks:

| Task | Schedule | Description |
|------|----------|-------------|
| Discovery | Daily 3 AM | Find new venues |
| Verification | Weekly Sunday 4 AM | Re-verify existing venues |

### Budget Monitoring

- Check `/costs` page in admin dashboard
- Monitor free quota usage daily
- Review paid query costs weekly
- Use `pnpm run search-pool stats` for CLI monitoring

### Data Freshness

- Venues are marked "stale" after 7 days without verification
- Run verification mode to refresh stale data
- Review flagged items in Moderation page

---

## 10. API Usage

### Public API Endpoints

```bash
# Get venues by country
curl "https://europe-west6-planted-availability-db.cloudfunctions.net/api/v1/venues?country=CH"

# Get nearby venues
curl "https://europe-west6-planted-availability-db.cloudfunctions.net/api/v1/nearby?lat=47.3769&lng=8.5417&radius_km=5"

# Get dishes
curl "https://europe-west6-planted-availability-db.cloudfunctions.net/api/v1/dishes?product=planted.chicken"

# Get venue details
curl "https://europe-west6-planted-availability-db.cloudfunctions.net/api/v1/venues/VENUE_ID"
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

## 11. Development

### Package Structure

```
packages/
├── core/              # Shared types (modify types here)
├── database/          # Firestore operations (add new collections here)
├── api/               # Cloud Functions (add API endpoints here)
├── scrapers/          # Discovery agents (modify extraction logic here)
├── admin-dashboard-v2/# Admin UI (add new pages here)
└── client-sdk/        # Public SDK (update for new endpoints)
```

### Adding a New Page to Admin

1. Create page component in `packages/admin-dashboard-v2/src/pages/`
2. Add route in `packages/admin-dashboard-v2/src/App.tsx`
3. Add navigation link in `packages/admin-dashboard-v2/src/components/Layout.tsx`

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
pnpm --filter @pad/admin-dashboard-v2 dev
```

---

## 12. Quick Reference

### Discovery CLI Cheatsheet

```bash
# Basic discovery
pnpm run discovery --countries CH

# Multiple countries and platforms
pnpm run discovery --countries CH,DE,AT --platforms uber-eats,lieferando

# Chain enumeration
pnpm run discovery --mode enumerate --chains "dean&david"

# Dry run with verbose
pnpm run discovery --countries DE --dry-run --verbose

# Force specific AI provider
pnpm run discovery --countries CH --ai gemini
```

### Review CLI Cheatsheet

```bash
# Quick venue review
pnpm run review --batch 10 --country CH

# Sequential review (highest confidence first)
pnpm run review --sequential --batch 20

# Dish review by chain
pnpm run review-dishes --chain dean-david --batch 15
```

### Admin Dashboard Shortcuts

| Page | URL | Purpose |
|------|-----|---------|
| Dashboard | `http://localhost:5173/` | Pipeline overview |
| Review Queue | `http://localhost:5173/review-queue` | Process discoveries |
| Sync | `http://localhost:5173/sync` | Push to website |
| Cost Monitor | `http://localhost:5173/costs` | Track API costs |
| Venue Browser | `http://localhost:5173/venues` | Browse all data |

---

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the TECHNICAL-DOCUMENTATION.md for system details
3. Check Firebase console for deployment issues
4. Review Cloud Functions logs for runtime errors
5. Use `--verbose` flag for detailed CLI output
