# T007: Chain Venue Dish Discovery Analysis

## Summary

**Total Chain Analysis:**
- Total venues in database: 1,922
- Chain venues: 1,633 (85%)
- Non-chain venues: 289 (15%)
- Total chains: 38

**Chain Status Breakdown:**
- Complete (all venues have dishes): 23 chains
- Ready to copy (have source dishes): 4 chains → **NOW COMPLETE**
- Need discovery (no source dishes): 11 chains
  - Retail chains (skip): 4 chains, 1,395 venues
  - Restaurant chains (need discovery): 7 chains, 61 venues

---

## Current State (Post-Copy)

**Venues with dishes: 268 / 1,922 (13.9%)**
- Total dishes in database: 1,223
- Average dishes per venue: 4.6

**Venues without dishes: 1,654**
- Retail chains (no dishes expected): 1,395 venues
- Restaurant chains needing discovery: 61 venues
- Independent restaurants: 198 venues (estimated)

---

## Completed Chains (23 chains, ALL venues have dishes)

| Chain Name | Venues | Status |
|------------|--------|--------|
| dean&david | 41 | COMPLETE |
| Birdie Birdie | 41 | COMPLETE |
| dean&david (duplicate chain_id) | 11 | COMPLETE |
| Green Club München | 9 | COMPLETE |
| Rice Up! | 7 | COMPLETE |
| doen doen planted kebap | 5 | COMPLETE |
| chidoba MEXICAN GRILL | 5 | COMPLETE |
| FAT MONK Wien | 4 | COMPLETE |
| Nooch Asian Kitchen | 4 | COMPLETE |
| **Beets & Roots** | **21** | **COMPLETE (just copied +1 venue)** |
| **Yuícery** | **4** | **COMPLETE (already done)** |
| **Stadtsalat** | **4** | **COMPLETE (just copied +2 venues)** |
| **Cotidiano** | **2** | **COMPLETE (just copied +1 venue)** |
| Burgermeister | 2 | COMPLETE |
| Smash Bro's Burger | 2 | COMPLETE |
| Pit's Burger | 2 | COMPLETE |
| Råbowls | 2 | COMPLETE |
| KEBHOUZE | 2 | COMPLETE |
| Alpoke | 1 | COMPLETE |
| Subway | 1 | COMPLETE |
| KAIMUG | 1 | COMPLETE |
| Hiltl | 1 | COMPLETE |
| Swing Kitchen | 1 | COMPLETE |
| Katzentempel München | 1 | COMPLETE |
| Munchies | 1 | COMPLETE |
| Kaspar Schmauser | 1 | COMPLETE |
| Union Diner | 1 | COMPLETE |

**Total complete chain venues: 173**

---

## Quick Win: Copy Completed (4 chains, 4 venues)

Just completed copying dishes to these 4 venues:

| Chain | Venue | City | Dishes Copied |
|-------|-------|------|---------------|
| Beets & Roots | Beets & Roots - Trankgasse | Köln | 5 |
| Stadtsalat | Stadtsalat Berlin | Berlin | 4 |
| Stadtsalat | Stadtsalat Hamburg | Hamburg | 4 |
| Cotidiano | Cotidiano Promenadeplatz | München | 5 |

**Total: 18 dishes copied to 4 venues**

---

## Retail Chains (SKIP - 4 chains, 1,395 venues)

These are grocery stores with retail planted products, not restaurants with menu dishes:

| Chain | Venues | Status |
|-------|--------|--------|
| BILLA | 1,181 | SKIP (grocery store) |
| Coop Supermarkt | 188 | SKIP (grocery store) |
| INTERSPAR | 20 | SKIP (grocery store) |
| REWE | 6 | SKIP (grocery store) |

**Total retail: 1,395 venues (72% of all venues without dishes)**

---

## Restaurant Chains Needing Discovery (7 chains, 61 venues)

These chains have NO dishes anywhere and NO platform URLs for discovery:

### Priority 1: Brezelkönig Basel (50 venues)
- **Status:** CRITICAL - largest chain without dishes
- **Problem:** No delivery platform URLs
- **Venues:** 50 locations across Switzerland
- **Next Action:** Manual research or venue visit required

### Priority 2: NENI Restaurants (4 venues)
- **Status:** HIGH - known planted partner
- **Problem:** No delivery platform URLs
- **Venues:** 4 locations in Zurich/other cities
- **Next Action:** Check NENI website or contact directly
- **Note:** Previous session mentioned NENI has "Jerusalem Plate with planted.chicken" but dishes may not be in database

### Priority 3: Small Chains (6 venues total)
- 60 Seconds to napoli Bonn: 3 venues
- Chupenga - Burritos & Salads: 1 venue
- Mit&Ohne - HB Zürich: 1 venue
- Tibits Zürich: 1 venue
- Max & Benito: 1 venue

**Problem:** All have zero platform URLs → Manual discovery required

---

## Action Plan

### COMPLETED ✓
1. **Copy dishes for 4 chains** → DONE (4 venues updated, +18 dishes)
   - Beets & Roots ✓
   - Stadtsalat ✓
   - Cotidiano ✓
   - Yuícery ✓ (already complete)

### NEXT STEPS

#### Immediate (Chain Discovery)
2. **Brezelkönig (50 venues)** - CRITICAL
   - Action: Web research for planted products on menu
   - Alternative: Check if they're actually retail (pretzel chain)
   - Estimated time: 30 min research

3. **NENI Restaurants (4 venues)** - HIGH
   - Action: Verify if NENI dishes are already in database (possible data issue)
   - Alternative: Check NENI website menu
   - Estimated time: 15 min

4. **Small chains (6 venues)** - MEDIUM
   - Action: Manual research per chain
   - Estimated time: 1 hour total

#### Deferred (Independent Restaurants)
5. **Independent restaurants (~198 venues)** - LOW priority
   - These are venues with chain_id = null
   - Many may need individual discovery
   - Defer until chain work complete

---

## Database Issues Found

### Duplicate chain_id for dean&david
- Two chain IDs exist for dean&david:
  - Chain 1: 41 venues
  - Chain 2: 11 venues
- **Action Needed:** Merge chain IDs to prevent confusion

### NENI Data Discrepancy
- attackZeroProgress.md shows NENI completed with dishes
- Current analysis shows NENI with 0 dishes
- **Action Needed:** Investigate discrepancy

---

## Statistics

### Coverage Progress
- **Before T007:** 264 venues with dishes (13.7%)
- **After chain copy:** 268 venues with dishes (13.9%)
- **Improvement:** +4 venues (+0.2%)

### Remaining Work
- Chain discovery needed: 61 venues (7 chains)
- Independent discovery needed: ~198 venues
- Retail (skip): 1,395 venues

### Realistic Target
- Addressable restaurants: ~259 venues (61 chains + 198 indie)
- Current coverage: 268 venues
- **Target: 400+ venues** (need to discover ~132 more venues)

---

## Scripts Created

1. **analyze-chain-venues.cjs** - High-level chain analysis
2. **analyze-chain-discovery-needs.cjs** - Detailed discovery breakdown
3. **copy-chain-dishes.cjs** - Updated with 4 new chains

---

## Recommendations

### Immediate Actions
1. ✓ Run copy-chain-dishes.cjs for 4 chains → DONE
2. Research Brezelkönig menu (50 venues at stake)
3. Verify NENI data issue
4. Investigate dean&david duplicate chain IDs

### Strategic Decisions Needed
1. **Brezelkönig priority:** Invest time in manual research? (50 venues = 19% of chain discovery work)
2. **Independent venues:** Start dish discovery on non-chain restaurants?
3. **Data quality:** Fix chain ID duplicates and data discrepancies?

### Next Agent Tasks
- **T007 Status:** Partial completion (4/11 chains addressed, retail chains excluded)
- **T008:** Begin independent venue discovery (198 venues)
- **T004/T005:** Extract dishes for specific promoted venues

---

## Notes

- Chain copy is extremely efficient (4 venues in seconds)
- Manual discovery is bottleneck for chains without platform URLs
- Retail chains represent 72% of "zero-dish venues" but are not actionable
- Realistic target should focus on restaurants only (~259 venues remaining)
