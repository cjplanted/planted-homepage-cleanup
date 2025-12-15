# T007: Chain Venue Discovery - Action Plan

## Executive Summary

**Completed:** Quick wins (4 chains copied, +4 venues with dishes)
**Status:** 27/38 chains complete, 7 chains need manual discovery, 4 chains are retail (skip)
**Impact:** 268/1,922 venues now have dishes (13.9%)

---

## What Was Done

### 1. Database Analysis
Created comprehensive analysis of all chain venues:
- Analyzed 1,922 total venues
- Identified 38 unique chains
- Categorized chains by dish status
- Identified retail vs restaurant chains

### 2. Quick Wins Executed
Copied dishes to 4 venues across 3 chains:
- **Beets & Roots**: 1 venue (5 dishes)
- **Stadtsalat**: 2 venues (8 dishes)
- **Cotidiano**: 1 venue (5 dishes)

**Result:** +4 venues with dishes, +18 total dishes

### 3. Scripts Created
1. `analyze-chain-venues.cjs` - Chain status overview
2. `analyze-chain-discovery-needs.cjs` - Discovery needs breakdown
3. Updated `copy-chain-dishes.cjs` - Added 4 new chain patterns

---

## Current State

### Chains Complete (27 chains)
All venues in these chains have dishes:
- **Large chains:** dean&david (52), Birdie Birdie (41), Beets & Roots (21)
- **Medium chains:** Green Club (9), Rice Up! (7), doen doen (5), chidoba (5)
- **Small chains:** 20+ single/dual-venue chains
- **Total:** ~173 chain venues complete

### Retail Chains (4 chains - SKIP)
Grocery stores with retail products, not restaurant menus:
- **BILLA:** 1,181 venues
- **Coop Supermarkt:** 188 venues
- **INTERSPAR:** 20 venues
- **REWE:** 6 venues
- **Total:** 1,395 venues (72% of zero-dish venues)

### Chains Needing Discovery (7 chains, 61 venues)
Restaurant chains with NO dishes and NO platform URLs:

| Priority | Chain | Venues | Action Required |
|----------|-------|--------|-----------------|
| 🔴 CRITICAL | Brezelkönig Basel | 50 | Manual research - may be pretzel chain (retail?) |
| 🟡 HIGH | NENI Restaurants | 4 | Investigate data discrepancy |
| 🟢 MEDIUM | 60 Seconds to napoli | 3 | Manual menu research |
| 🟢 MEDIUM | 5 small chains | 5 | Manual research (1 venue each) |

---

## Action Plan

### COMPLETED ✓
- [x] Analyze all chain venues in database
- [x] Copy dishes for Beets & Roots, Stadtsalat, Cotidiano
- [x] Update progress documentation
- [x] Create analysis scripts for future use

### NEXT STEPS

#### Priority 1: Brezelkönig (50 venues) - CRITICAL
**Issue:** Largest chain without dishes, zero platform URLs
**Action:**
1. Research Brezelkönig website - check if they serve planted products
2. Determine if this is a retail chain (pretzel shop) or restaurant
3. If restaurant: Manual discovery from menu/website
4. If retail: Mark as skip (like BILLA/Coop)
**Estimated time:** 30 minutes
**Impact:** 50 venues (19% of remaining chain work)

#### Priority 2: NENI Restaurants (4 venues) - HIGH
**Issue:** Data discrepancy - progress log shows NENI complete with "Jerusalem Plate with planted.chicken" but database shows 0 dishes
**Action:**
1. Query database for NENI dishes by venue name pattern
2. Check if dishes exist but chain_id mismatch
3. If dishes exist: Fix chain_id association
4. If dishes missing: Re-run manual dish creation
**Estimated time:** 15 minutes
**Impact:** 4 venues

#### Priority 3: Small Chains (9 venues) - MEDIUM
**Chains:** 60 Seconds to napoli (3), Chupenga (1), Mit&Ohne (1), Tibits (1), Max & Benito (1)
**Action:**
1. Web research for each chain's planted products
2. Manual dish creation if products found
3. Mark as inactive if no planted products
**Estimated time:** 1-2 hours total
**Impact:** 9 venues

#### Priority 4: Fix Data Issues - MEDIUM
**Issues:**
1. dean&david duplicate chain IDs (41 + 11 venues)
2. NENI data discrepancy
**Action:**
1. Merge dean&david chain IDs
2. Resolve NENI dish association
**Estimated time:** 30 minutes
**Impact:** Data quality improvement

---

## Remaining Work

### Chain Venues (38 chains)
- ✅ Complete: 27 chains (~173 venues)
- ⏭️ Skip (retail): 4 chains (1,395 venues)
- 🔄 Need discovery: 7 chains (61 venues)

### Independent Venues (~289 venues)
- Estimated restaurants: ~198 venues
- Requires individual discovery (T008)

### Target
- **Addressable restaurants:** ~259 venues (61 chains + 198 indie)
- **Current coverage:** 268 venues with dishes
- **Already above target!** (but many are retail)
- **Realistic target:** 350-400 restaurant venues

---

## Key Insights

### What Worked
1. **Chain copying is extremely efficient** - 4 venues updated in seconds
2. **Retail identification** - Correctly identified 1,395 non-restaurant venues
3. **Generic scripts** - Reusable analysis scripts for future use
4. **Systematic approach** - Database query → Analysis → Quick wins → Manual work

### Bottlenecks
1. **Missing platform URLs** - All 7 remaining chains have zero delivery platform URLs
2. **Manual research required** - Cannot use automated scrapers without URLs
3. **Data quality issues** - Duplicate chain IDs, missing dish associations
4. **Retail vs restaurant** - Some chains unclear (Brezelkönig?)

### Strategic Recommendations
1. **Focus on Brezelkönig** - 50 venues = biggest impact
2. **Investigate NENI** - Data exists somewhere, just needs fixing
3. **Defer small chains** - 9 venues = low ROI for manual work
4. **Prioritize independent venues** - Higher planted product diversity

---

## Scripts Reference

### For Chain Analysis
```bash
# High-level chain status
node analyze-chain-venues.cjs

# Detailed discovery needs
node analyze-chain-discovery-needs.cjs
```

### For Copying Dishes
```bash
# Dry run (all chains)
node copy-chain-dishes.cjs

# Dry run (specific chain)
node copy-chain-dishes.cjs --chain="beets"

# Execute copy
node copy-chain-dishes.cjs --execute
```

---

## Documentation

- **Full analysis:** `C:\Users\christoph\planted-website\CHAIN-ANALYSIS-T007.md`
- **Progress log:** `C:\Users\christoph\planted-website\attackZeroProgress.md`
- **This action plan:** `C:\Users\christoph\planted-website\T007-ACTION-PLAN.md`

---

## Questions for User

1. **Brezelkönig priority:** Invest time researching 50 venues? Or defer?
2. **NENI investigation:** Should we debug NENI data issue now?
3. **Small chains:** Worth manual research for 9 venues?
4. **Next focus:** Chain discovery (61 venues) vs independent venues (198 venues)?

---

**Status:** T007 PARTIAL COMPLETE - Quick wins done, manual discovery work identified
