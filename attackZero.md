# Attack Zero: Data Quality Improvement Plan

## Objective
Iteratively improve venue and dish data quality by verifying against live systems, fixing issues one-by-one, and logging all progress until perfect.

## Verification Endpoints
- **Admin Dashboard:** https://get-planted-db.web.app/live-venues
- **Website Locator:** https://cgjen-box.github.io/planted-website/ch-de/locator-v3/

## Files
- `attackZero.md` - This plan
- `attackZeroProgress.md` - Log of each venue/dish verified with pass/fail

## Skill to Use
Use `website-review` skill from `.claude/skills/website-review/SKILL.md` for:
- Chrome DevTools MCP integration
- Visual inspection
- Console/network error detection
- Interactive testing

---

## Step-by-Step Workflow

### Step 1: Baseline Assessment - Admin Dashboard
**Goal:** Understand current state of live-venues
1. Start Chrome in debug mode: `scripts\chrome-debug.bat`
2. Use website-review skill to navigate to https://get-planted-db.web.app/live-venues
3. Document:
   - Total venues count
   - Any console errors
   - Failed network requests
   - Load time
4. Log findings in attackZeroProgress.md

### Step 2: Baseline Assessment - Website Locator
**Goal:** Verify venues appear on public locator
1. Navigate to https://cgjen-box.github.io/planted-website/ch-de/locator-v3/
2. Check:
   - Map loads correctly
   - Venue markers appear
   - Click several markers to verify popups
3. Note any missing or broken venues
4. Log findings in attackZeroProgress.md

### Step 3: Data Cross-Reference Check
**Goal:** Identify venues not appearing correctly
1. Query promoted venues from database
2. For each promoted venue (CH country), verify:
   - Has production_venue_id
   - Has dishes in production `dishes` collection
   - Appears on website locator
3. Log each venue: ID, name, status, issues
4. Create list of issues to fix

### Step 4: Fix Issues One-by-One
**Iteration Loop for each issue:**
```
1. Document issue in attackZeroProgress.md
2. Implement fix
3. Verify fix using website-review skill
4. Update log: PASS or FAIL
5. If FAIL, analyze and retry
6. Move to next issue
```

### Step 5: Duplicate Detection
**Goal:** Find and resolve duplicate venues
1. Scan for venues with:
   - Same platform URLs (normalized)
   - Same coordinates (<100m apart)
   - Same address
   - Similar names (>85% match)
2. For each duplicate group:
   - Select primary (better data quality)
   - Log decision rationale
   - Merge or flag for review
3. Verify no data loss

### Step 6: Final Verification
**Goal:** Confirm all improvements
1. Re-run Step 1 (Admin Dashboard)
2. Re-run Step 2 (Website Locator)
3. Compare with baseline
4. Document improvements in attackZeroProgress.md

---

## Iteration Loop Diagram

```
┌─────────────────┐
│  IDENTIFY ISSUE │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  LOG IN PROGRESS│
│  FILE           │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  IMPLEMENT FIX  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  VERIFY FIX     │
│  (website-review│
│   skill)        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  PASS?          │──NO─>│  ANALYZE &      │
└────────┬────────┘     │  RETRY          │
         │YES           └─────────────────┘
         ▼
┌─────────────────┐
│  UPDATE LOG     │
│  NEXT ISSUE     │
└─────────────────┘
```

---

## Success Criteria
- All promoted venues visible in Admin Dashboard
- All CH promoted venues appear on locator
- All venues have at least 1 dish
- No duplicate venues (same location, different IDs)
- Zero console errors on both endpoints
- All network requests succeed (2xx)
