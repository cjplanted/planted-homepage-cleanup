# Attack Zero Progress Log

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

---

### Step 6: Final Verification

#### Comparison with Baseline
| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Venues with 0 dishes | 15+ | TBD | TBD |
| Duplicate venue groups | 5+ | TBD | TBD |
| Chain assignments missing | ~20 | TBD | TBD |
