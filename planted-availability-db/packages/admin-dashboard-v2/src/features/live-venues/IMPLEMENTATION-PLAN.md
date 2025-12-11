# Live Venues Browser - Bug Fix Plan

## Problem Statement

When clicking on a venue in the Live Venues Browser, the venue details don't load.

### Root Cause Analysis

1. **The hierarchy tree now shows ALL venues** (built from `allLiveVenues` in the API)
2. **The `items` array only contains paginated venues** (100 per page)
3. **`LiveVenuesPage.tsx` line 59-62 searches only in `data.items`** to find the selected venue:
   ```typescript
   const selectedVenue = useMemo(() => {
     if (!selectedVenueId || !data?.items) return undefined;
     return data.items.find((v) => v.id === selectedVenueId);  // <-- Only searches paginated items!
   }, [selectedVenueId, data?.items]);
   ```
4. **When user clicks venue outside current page**, `find()` returns `undefined`

### Evidence

- The `HierarchyNode` type (line 53 in types.ts) has `venue?: LiveVenue` embedded
- When a venue node is clicked, the full `LiveVenue` data is available in the tree node
- But the page discards this and only uses the venueId to search in paginated items

## Solution Options

### Option A: Use venue data from hierarchy node (Recommended)
- Modify `LiveVenueTree` to pass the full venue object when selected, not just the ID
- Modify `LiveVenuesPage` to store the selected venue directly, not just the ID
- **Pros**: Simple, efficient, no additional API calls
- **Cons**: Venue data in tree must stay in sync with any mutations

### Option B: Fetch single venue on selection
- When a venue is selected, fetch its details via a new API endpoint
- **Pros**: Always fresh data
- **Cons**: Additional API call, added latency, need new endpoint

### Option C: Return all venues in items array (not just paginated)
- Remove pagination from items response
- **Pros**: Simple data model
- **Cons**: Large payloads, slow responses with 2200+ venues

## Chosen Solution: Option A

Pass the full venue object from the hierarchy tree to the page component.

## Implementation Steps

### Step 1: Modify LiveVenueTree component
**File**: `src/features/live-venues/components/LiveVenueTree.tsx`

Change the `onSelectVenue` callback signature:
- Before: `onSelectVenue: (venueId: string) => void`
- After: `onSelectVenue: (venue: LiveVenue) => void`

Update all calls to `onSelectVenue` to pass `node.venue` instead of `node.venue.id`.

### Step 2: Modify LiveVenuesPage
**File**: `src/pages/LiveVenuesPage.tsx`

1. Change state from storing ID to storing the full venue:
   - Before: `const [selectedVenueId, setSelectedVenueId] = useState<string | undefined>()`
   - After: `const [selectedVenue, setSelectedVenue] = useState<LiveVenue | undefined>()`

2. Remove the `useMemo` that searches for venue in items

3. Update `handleSelectVenue` to accept `LiveVenue` instead of `string`

4. Update `LiveVenueTree` prop from `selectedVenueId` to derive from `selectedVenue?.id`

### Step 3: Update Tests
**File**: `src/features/live-venues/__tests__/LiveVenuesPage.test.tsx`

Update tests to reflect the new selection behavior.

### Step 4: Update MSW Handlers
**File**: `src/test/mocks/handlers/liveVenues.ts`

Ensure mock data has venues embedded in hierarchy nodes.

## Test Cases

### UC-LV-01: Page Initial Load
- **Given**: User navigates to /live-venues
- **When**: Page loads
- **Then**: Stats bar shows counts, hierarchy tree loads, "Select a venue" prompt shown

### UC-LV-02: Select Venue from Tree
- **Given**: Page is loaded with venues
- **When**: User expands Country > Type > Chain and clicks a venue
- **Then**: Right panel shows venue details (name, address, status, platforms)

### UC-LV-03: Filter by Country
- **Given**: Page is loaded
- **When**: User selects "CH" from country filter
- **Then**: Tree shows only Swiss venues, stats update

### UC-LV-04: Filter by Status
- **Given**: Page is loaded
- **When**: User selects "Stale" from status filter
- **Then**: Tree shows only stale venues, stats update

### UC-LV-05: Filter by Venue Type
- **Given**: Page is loaded
- **When**: User selects "Restaurant" from type filter
- **Then**: Tree shows only restaurants, stats update

### UC-LV-06: Search by Name
- **Given**: Page is loaded
- **When**: User types "pizza" in search
- **Then**: Tree shows only venues with "pizza" in name/city

### UC-LV-07: Mark Venue as Stale
- **Given**: User has selected an active venue
- **When**: User clicks "Mark Stale" and confirms
- **Then**: Status changes to stale, UI updates

### UC-LV-08: Archive Venue
- **Given**: User has selected an active venue
- **When**: User clicks "Archive" and confirms
- **Then**: Status changes to archived, UI updates

### UC-LV-09: Reactivate Venue
- **Given**: User has selected a stale or archived venue
- **When**: User clicks "Mark Active" and confirms
- **Then**: Status changes to active, lastVerified updates

### UC-LV-10: Keyboard Navigation
- **Given**: Focus is on tree
- **When**: User presses arrow keys
- **Then**: Selection moves through tree, venue details update

## Verification Checklist

- [ ] Initial page load shows stats and hierarchy
- [ ] Clicking any venue (first page, last page, filtered) shows details
- [ ] All filters work (country, status, type, search)
- [ ] Combined filters work together
- [ ] Actions (mark stale, archive, reactivate) work
- [ ] Keyboard navigation works
- [ ] Loading states display correctly
- [ ] Error states display correctly
- [ ] Empty state displays when no venues match filters
