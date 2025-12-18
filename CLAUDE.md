# Claude Code Instructions

Project-specific instructions for Claude Code when working on the Planted Website monorepo.

## Startup Sequence

### 1. Verify MCP Connection

Run `/mcp` to check if Chrome DevTools MCP is connected. You should see:

```
chrome-devtools: connected
```

If not connected, the user needs to restart Claude Code.

### 2. Launch Chrome Debug Instance

Before using the `website-review` skill, launch Chrome with remote debugging:

```bash
scripts/chrome-debug.bat
```

This starts Chrome on port 9222 with a persistent profile for authenticated sessions.

### 3. Website Review Workflow

Once Chrome is running, use the `website-review` skill to:
- Inspect pages visually
- Check console/network errors
- Audit accessibility
- Measure Core Web Vitals

## Key URLs

| Environment | URL |
|-------------|-----|
| Local Astro | http://localhost:4321 |
| Local Admin | http://localhost:5175 |
| GitHub Pages | https://cjplanted.github.io/planted-homepage-cleanup/ |
| Admin Prod | https://admin.planted.com |
| Production | https://planted.com |

## Project Structure

```
planted-website/
├── planted-astro/          # Astro frontend (GitHub Pages)
├── planted-availability-db/ # Firebase backend monorepo
│   ├── packages/api/       # Cloud Functions
│   ├── packages/database/  # Firestore collections
│   ├── packages/scrapers/  # Discovery agents
│   └── packages/admin-dashboard-v2/  # Admin UI
├── scripts/
│   └── chrome-debug.bat    # Chrome debug launcher
└── .mcp.json               # MCP server configuration
```

## Subdirectory Instructions

See `planted-availability-db/CLAUDE.md` for:
- Git commit policy
- Package-specific architecture
- Firebase Cloud Functions naming conventions
- Development commands

## Attack Zero Progress

Track data quality improvements in `attackZeroProgress.md`. This file logs:
- Venue counts and percentages
- Chain completion status
- Bug fixes and their task IDs (T001, T002, etc.)
- Session logs with timestamps

## Common Tasks

### Deploy Firebase Functions
```bash
cd planted-availability-db
firebase deploy --only functions
```

### Build and Preview Astro Site
```bash
cd planted-astro
pnpm build && pnpm preview
```

### Run Admin Dashboard Locally
```bash
cd planted-availability-db/packages/admin-dashboard-v2
pnpm dev
```
