# Attack Zero Progress Log

---

## HOW TO RESUME

### Quick Start
```bash
/attack-zero master    # Coordinates next priority task automatically
```

### Or Run Specific Agents
```bash
/attack-zero venue --task=duplicates    # T001: Vapiano UK duplicates
/attack-zero dish --task=extract        # T004: dean&david DE extraction
/attack-zero monitor --task=summary     # Generate progress report
```

### For Visual QA (Chrome DevTools)
```bash
# Step 1: Start Chrome debug mode (run in terminal, not Claude)
scripts\chrome-debug.bat

# Step 2: Restart Claude Code to connect MCP

# Step 3: Run QA agent
/attack-zero qa --task=verify-venue
```

---

## TOKEN EFFICIENCY RULES

**For MASTER-AGENT:**
- ONLY read lines 1-80 of this file (Current State + Task Queue + What Worked/Didn't)
- DO NOT read historical session logs below the checkpoint
- Delegate actual work to sub-agents immediately

**For SUB-AGENTS:**
- Focus on ONE task only (e.g., T001)
- Complete task, log result, exit
- Do NOT explore unrelated code
- Use scripts directly (they have the context built-in)

**For ALL agents:**
- Keep session logs SHORT (3-5 lines per action)
- Update "Current State" metrics after each batch
- Move completed tasks from Queue to session log
- NEVER read the full progress file (only top 80 lines)

---

## KEY FILES

| File | Purpose | Read When |
|------|---------|-----------|
| `attackZeroProgress.md` | Current state, task queue | Always (top 80 lines only) |
| `attackZero.md` | Full architecture docs | When confused about process |
| `.claude/commands/attack-zero*.md` | Agent instructions | Loaded automatically by slash command |
| `packages/scrapers/*.cjs` | Diagnostic scripts | When running specific fix |

---

## Current State

| Metric | Count | Target | Progress |
|--------|-------|--------|----------|
| Total production venues | 1922 | - | - |
| Venues with dishes | 216 | 2000 (90%) | 10.8% |
| Venues with 0 dishes | 2030 | 0 | - |
| Duplicates fixed | 336 | All | 100% |
| Duplicates pending | 0 | 0 | DONE |
| Country code errors | 0 | 0 | DONE (18 fixed) |

---

## Task Queue

| ID | Type | Target | Agent | Priority | Status |
|----|------|--------|-------|----------|--------|
| T001 | duplicate | ALL duplicates | VENUE-AGENT | HIGH | DONE (324 deleted) |
| T002 | duplicate | Rice Up! Bern (8 venues) | VENUE-AGENT | HIGH | DONE (merged into T001) |
| T003 | country-fix | 18 venues (FR/ES/UK misclassified) | VENUE-AGENT | MEDIUM | DONE |
| T004 | extract | dean&david DE (0-dish) | DISH-AGENT | HIGH | PENDING |
| T005 | extract | CH promoted venues | DISH-AGENT | HIGH | PENDING |
| T006 | verify-venue | Random spot-check | QA-AGENT | LOW | PENDING |

---

## Session Log

### 14:50 | VENUE-AGENT | T003
- Task: country-fix (all misclassified venues)
- Created fix-country-codes.cjs with city→country lookup table
- Found 18 venues (more than expected 9)
- Fixed: FR→DE (6), FR→AT (5), UK→DE (4), ES→AT (1), ES→DE (1), DE→CH (1)
- Result: PASS

### 14:45 | VENUE-AGENT | T001+T002
- Task: duplicates (ALL - generic fix)
- Rewrote fix-duplicates.cjs to be fully dynamic (no hardcoded IDs)
- Added street-level matching for retail chains (BILLA, REWE, INTERSPAR, Coop)
- Result: PASS
- Deleted: 324 duplicate venues
- Preserved: All venues with dishes (31 skipped to avoid data loss)
- Duration: ~5 minutes

### 14:30 | MASTER-AGENT
- State: 45 duplicates pending, 2030 zero-dish venues
- User wants GENERIC duplicate fix (no hardcoded IDs)
- Delegating to VENUE-AGENT: make fix-duplicates.cjs fully dynamic

### 11:49 | MASTER-AGENT
- State: 45 duplicates pending, 2030 zero-dish venues
- RL system now active (auto-review enabled, quality pipeline ready)
- Spawning VENUE-AGENT for T001 (Vapiano UK duplicates)

---

## What Worked

- Duplicate detection by matching name+city effective
- `sync-dishes-to-production.cjs` correctly preserves embedded dishes
- `fix-duplicates.cjs` with dry-run prevents data loss
- Uber Eats extraction works reliably
- Country grouping identifies patterns quickly

## What Didn't Work

- Enumerate mode queries return 0 results (scraper bug #1)
- Just Eat extraction often finds no planted content
- Deliveroo returns 403 on all UK/Italy URLs (platform blocking)
- Wolt rate limiting causes intermittent failures (~50 req/min)
- Some venues are retail stores (INTERSPAR) - no dishes expected

---

## CHECKPOINT: 2025-12-14T00:00:00Z
Last completed: Session 2025-12-13
Tasks completed: 2 (dish sync, duplicate delete)
Next priority: T001 (Vapiano UK duplicates)
Architecture: Upgraded to v2 (Master + Sub-Agent)

---

## Session: 2025-12-14

### 00:00 | MASTER-AGENT | Architecture Upgrade
- Upgraded to Attack Zero v2 (Master + Sub-Agent architecture)
- Created 6 slash commands:
  - `/attack-zero` (main router)
  - `/attack-zero venue` (VENUE-AGENT)
  - `/attack-zero dish` (DISH-AGENT)
  - `/attack-zero scraper` (SCRAPER-AGENT)
  - `/attack-zero qa` (QA-AGENT)
  - `/attack-zero monitor` (MONITOR-AGENT)
- Added Task Queue section
- Added "What Worked" / "What Didn't Work" sections
- Result: PASS

---

## Session: 2025-12-13

---

### Step 1: Baseline Assessment - Admin Dashboard

**Target:** https://get-planted-db.web.app/live-venues
**Status:** PENDING (Requires Chrome debug mode)

#### Notes
- Need to start Chrome in debug mode: `scripts\chrome-debug.bat`
- Then restart Claude Code to connect MCP

---

### Step 2: Baseline Assessment - Website Locator

**Target:** https://cgjen-box.github.io/planted-website/ch-de/locator-v3/
**Status:** PENDING (Requires Chrome debug mode)

---

### Step 3: Data Cross-Reference Check

**Status:** COMPLETE

#### Global Statistics

| Metric | Count | Percentage |
|--------|-------|------------|
| **Total production venues** | 2258 | 100% |
| Venues with dishes | 209 | 9.3% |
| **Venues with 0 dishes** | 2049 | 90.7% |

| Country | 0-Dish Venues | Notes |
|---------|---------------|-------|
| AT | 1355 | Mostly INTERSPAR retail stores |
| DE | 326 | Many restaurants |
| CH | 303 | Many restaurants |
| UK | 29 | Vapiano chain |
| IT | 29 | Cadoro retail + restaurants |
| FR | 7 | Misclassified cities |

#### Promoted Venues Analysis

| Metric | Count |
|--------|-------|
| Total promoted venues | 308 |
| With embedded dishes | 209 |
| **Without embedded dishes** | 99 |
| Total embedded dishes | 625 |

**Root Cause:** 99 venues were promoted BEFORE dishes were extracted. They have delivery platform URLs but need dish extraction run.

---

#### dean&david Venues (54 total)

| Venue Name | ID | City | Dishes | Status | Issues |
|------------|-----|------|--------|--------|--------|
| dean&david Zürich | EnHyTub2MQ5txuL8KZT7 | Zürich | 10 | PASS | None |
| dean&david Basel Centralbahnplatz | 5Su3SzAu7scIHkCkzXHc | Basel | 12 | PASS | None |
| dean&david Kranzler Eck | UgX9ZrS78qaAeJaLEqbv | Berlin | 0 | FAIL | No dishes |
| dean&david Seiersberg | Uvii8TEtCJvxLmVG85nO | Graz | 0 | FAIL | No dishes |
| dean&david PlusCity | WwBnW3vkjnqCGzuWJl1t | Linz | 0 | FAIL | No dishes |
| dean&david Makartplatz | XZiMRcwNCrEj0eBRjV8I | Salzburg | 0 | FAIL | No dishes |
| dean&david Koenigsbau | bjxFTCHgsFAJBV4y6lgD | Stuttgart | 0 | FAIL | No dishes |
| dean&david Muehlenstr. | dxk4YgqPptf2E9EunqKe | Berlin | 0 | FAIL | No dishes |
| dean&david Basel Centralbahnplatz | oam2VMUaxdVPJEW3R1V9 | Basel | 0 | FAIL | DUPLICATE + No dishes |

#### Kaimug Venues (2 total)

| Venue Name | ID | City | Dishes | Status | Issues |
|------------|-----|------|--------|--------|--------|
| KAIMUG Zürich | 3IW5FzpaIXGxXod5mf1C | Zürich | 0 | FAIL | DUPLICATE + No dishes |
| KAIMUG Zürich | FVt7bAz3i4hypIOt6j7d | Zürich | 1 | WARN | DUPLICATE (primary?) |

#### Vapiano Venues (8 total - ALL have 0 dishes)

| Venue Name | ID | City | Dishes | Status | Issues |
|------------|-----|------|--------|--------|--------|
| Vapiano - Great Portland Street | 0TVLk5Jd6FR0fwrzH8Dx | London | 0 | FAIL | DUPLICATE + No dishes |
| Vapiano (Manchester) | 9lFjyenT05buvGEZ39VS | Manchester | 0 | FAIL | No dishes |
| Vapiano - Tower Bridge | E5SGBo3Isty8qKTpyboz | London | 0 | FAIL | DUPLICATE + No dishes |
| Vapiano (Tower Bridge) | HbkYZsKgNWxT5qRCV4qM | London | 0 | FAIL | DUPLICATE + No dishes |
| Vapiano (Great Portland Street) | cJJSREy1R4tpkrFgIgwD | London | 0 | FAIL | DUPLICATE + No dishes |
| Vapiano - Paddington | cjJ6gGILMnP4qdVUOezI | London | 0 | FAIL | DUPLICATE + No dishes |
| Vapiano (Paddington) | ydn9AOwk4jBEeamroqSd | London | 0 | FAIL | DUPLICATE + No dishes |
| Vapiano - Paddington | zMtBVatQXcLi2PgX5TMo | London | 0 | FAIL | DUPLICATE + No dishes |

#### Hiltl Venues (1 total)

| Venue Name | ID | City | Dishes | Status | Issues |
|------------|-----|------|--------|--------|--------|
| Hiltl - Vegetarian Restaurant | uNeoL9NV38iQwN5iaJef | Zürich | 4 | PASS | None |

---

### Step 4: Issues Found

#### Issue Summary
| # | Type | Count | Description |
|---|------|-------|-------------|
| 1 | No Dishes | 15+ | Production venues with 0 dishes |
| 2 | Duplicates | 10+ | Same venue, multiple entries |
| 3 | Chain Inconsistency | ~20 | "no chain" vs proper chain assignment |

#### Critical Issues to Fix

**Priority 1: Duplicates to Merge**
1. dean&david Basel Centralbahnplatz: 5Su3SzAu7scIHkCkzXHc (12 dishes) ← PRIMARY vs oam2VMUaxdVPJEW3R1V9 (0 dishes) ← DELETE
2. KAIMUG Zürich: FVt7bAz3i4hypIOt6j7d (1 dish) ← PRIMARY vs 3IW5FzpaIXGxXod5mf1C (0 dishes) ← DELETE
3. Vapiano Tower Bridge: 3 duplicates - select primary
4. Vapiano Great Portland Street: 2 duplicates - select primary
5. Vapiano Paddington: 3 duplicates - select primary

**Priority 2: Venues with 0 Dishes**
- Need to check if discovered_venues have dishes to sync
- Or need to run dish extraction

---

### Fixes Applied

#### Dish Extraction & Sync (2025-12-13)

**Batch 1: Swiss Venues (CH)**
| Venue | Production ID | Dishes Synced | Status |
|-------|---------------|---------------|--------|
| Smash Bro's Burger (Muri) | 2QHLM1myzgqFCuPe2fCR | 1 | PASS |
| Nooch Asian Kitchen (Viktoriaplatz) | OSYFSaQ1cQ2Ccpl6CMZO | 2 | PASS |
| Rice Up! (Bern) | lHgXO6mkhHcZssumyyr8 | 1 | PASS |
| Rice Up! (Bern) | 88V7JpCXVFtHPY2hkUPo | 1 | PASS (DUPLICATE?) |

**Batch 2: German Venues (DE)**
| Venue | Production ID | Dishes Synced | Status |
|-------|---------------|---------------|--------|
| Pit's Burger Stuttgart | tfatyfkCDbxZeq1ZQaW3 | 3 | PASS |
| Pit's Burger Esslingen | ejyLTljUSquNVpzRpCOp | 5 | PASS |
| Pit's Burger Fellbach | hfh05GHvxhUuIwX4EnZd | 5 | PASS |

**Total: 18 dishes synced to 7 venues**

#### Venues Still Without Dishes (flagged for manual review)
- Mit&Ohne - HB Zürich (happycow URL, no delivery platform)
- Nón Lá Basel (Just Eat - no planted content found)
- Brezelkönig Basel (Just Eat - no planted content found)
- KAIMUG Zürich (Just Eat - no planted content found)
- dean&david Basel Centralbahnplatz (Just Eat - no planted content found)
- Multiple Wolt venues in DE (no planted content found)

---

### Step 5: Duplicate Detection

**Status:** MAJOR ISSUES FOUND

#### Production Venue Duplicates by Chain

| Chain | Total Venues | With Dishes | Without Dishes | Issue Severity |
|-------|--------------|-------------|----------------|----------------|
| dean&david | 88 | ~40 | ~48 | CRITICAL |
| Rice Up! | 16 | 3 | 13 | HIGH |
| KAIMUG | 2 | 1 | 1 | MEDIUM |
| Vapiano | ~8 | 0 | 8 | HIGH |

#### Example Duplicate Groups

**dean&david Basel Centralbahnplatz**
- nvNIawnFkxCU9Jjhh9Kz: 13 dishes ← PRIMARY
- YJGxUkQ8dqA9Gf7ECy2l: 0 dishes ← DELETE

**dean&david (Hirschengraben) Bern**
- jPOIPDjSdw0O0K1rFv1N: 3 dishes ← PRIMARY
- 27bEiDVALQQE2A8oZMmO: 0 dishes ← DELETE

**dean&david Berlin Bülowstraße**
- 11A5GdRpDPQX6yIIoTlX: 4 dishes ← PRIMARY
- lRaMnnk8McbHJDTtTNzr: 0 dishes ← DELETE

**KAIMUG Zürich**
- 3OnKGnneXCY9MIRL2lxx: 1 dish ← PRIMARY
- 3D5POGbXfe60Re9uCT2w: 0 dishes ← DELETE

**Rice Up! (Bern)**
- 88V7JpCXVFtHPY2hkUPo: 1 dish
- lHgXO6mkhHcZssumyyr8: 1 dish
- Plus 6 more with 0 dishes ← NEED INVESTIGATION

#### Country Code Misclassification (country=FR instead of DE/AT)

| Venue | City | Current Country | Correct Country |
|-------|------|-----------------|-----------------|
| dean&david Erfurt | Erfurt | FR | DE |
| dean&david Koenigsbau | Stuttgart | FR | DE |
| dean&david Orleansplatz | München | FR | DE |
| dean&david Nikolaistraße | Leipzig | FR | DE |
| dean&david PlusCity | Linz | FR | AT |
| dean&david Kranzler Eck | Berlin | FR | DE |
| dean&david Makartplatz | Salzburg | FR | AT |
| dean&david Seiersberg | Graz | FR | AT |
| dean&david Burggasse | Vienna | FR | AT |

#### Root Cause Analysis
1. **Venues created from multiple sources**: Salesforce imports, discovery agent, manual creation
2. **No cross-source deduplication**: Same venue imported from different sources
3. **City mapping issues**: France set as default country for some imports

#### Duplicates Fixed (2025-12-13)

**12 venues deleted:**
| Deleted Venue | Primary Kept | Dishes Preserved |
|---------------|--------------|------------------|
| dean&david Basel Centralbahnplatz | nvNIawnFkxCU9Jjhh9Kz | 13 |
| dean&david (Hirschengraben) Bern | jPOIPDjSdw0O0K1rFv1N | 3 |
| dean&david Berlin Bülowstraße | 11A5GdRpDPQX6yIIoTlX | 4 |
| dean&david München Pasinger Bahnhof | 1pf5c3fCYVPqBnYywoRK | 5 |
| dean&david München Orleansplatz | P2EQ4vkfHMoLYga2vjD8 | 3 |
| dean&david München Parkstadt | g8UbXqyMLYa4KSnsDZwq | 3 |
| dean&david München Leopoldstr | owJT10kiJoT9XJn9G7sV | 5 |
| dean&david München Werksviertel | c74C0zDD27bzUmjB2R51 | 5 |
| dean&david München 5 Höfe | lJ6zEvFpfwtjSL1T1ZdW | 5 |
| dean&david München Bahnhofplatz | SodzG6vHUv7BxdNgMFU1 | 4 |
| dean&david Georgsplatz | fJhIMIptUIAOzBZYqvDI | 3 |
| KAIMUG Zürich | 3OnKGnneXCY9MIRL2lxx | 1 |

**Result:** 0 data loss, all duplicates had 0 dishes

---

### Step 6: Final Verification

**Status:** PARTIAL COMPLETE

#### Comparison with Baseline
| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Total production venues | 2258 | 2246 | -12 duplicates |
| Venues with dishes | 209 | 216 | +7 venues |
| Venues with 0 dishes | 2049 | 2030 | -19 |
| CH venues with 0 dishes | 303 | 296 | -7 |

#### Session Summary (2025-12-13)

**Completed:**
1. Extracted and synced 18 dishes to 7 venues
2. Deleted 12 clear duplicate venues (0 data loss)
3. Documented all data quality issues

**Remaining Work:**
1. ~2030 venues still have 0 dishes (many are retail stores)
2. Many more duplicates need investigation
3. Country code misclassification needs fixing
4. Visual assessment needs Chrome debug mode

#### Next Steps
1. Start Chrome debug mode (`scripts\chrome-debug.bat`)
2. Run visual assessment of Admin Dashboard and Locator
3. Continue dish extraction for remaining venues
4. Investigate and fix remaining duplicates
