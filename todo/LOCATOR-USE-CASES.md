# Store Locator Use Cases

## Overview
These use cases define the expected behavior for the planted store locator fixes.

---

## UC-1: Country-Specific ZIP Placeholder

### Description
The ZIP input field should show a placeholder that matches the user's locale/country.

### Preconditions
- User is on the planted website
- User clicks "Restaurants finden" to open the locator

### Test Cases

| ID | Locale | Expected Placeholder | Current (Bug) |
|----|--------|---------------------|---------------|
| UC-1.1 | ch-de (Swiss German) | `8001` | `10115` |
| UC-1.2 | ch-fr (Swiss French) | `8001` | `10115` |
| UC-1.3 | de (Germany) | `10115` | `10115` |
| UC-1.4 | at (Austria) | `1010` | `10115` |
| UC-1.5 | uk (United Kingdom) | `SW1A` | `10115` |

### Acceptance Criteria
- [ ] Swiss locales show 4-digit Swiss ZIP placeholder (8001)
- [ ] German locale shows 5-digit German ZIP placeholder (10115)
- [ ] Austrian locale shows 4-digit Austrian ZIP placeholder (1010)
- [ ] UK locale shows alphanumeric UK postcode placeholder (SW1A)

---

## UC-2: Dishes Displayed for All Venues

### Description
Every restaurant venue should display at least one dish with name, description, and price.

### Preconditions
- User has entered a valid ZIP code
- Results view is displayed

### Test Cases

| ID | Venue | City | Expected Dishes |
|----|-------|------|-----------------|
| UC-2.1 | dean&david Zürich HB | Zürich | 1-2 dishes with CHF prices |
| UC-2.2 | dean&david Luzern | Luzern | 1-2 dishes with CHF prices |
| UC-2.3 | KAIMUG Zürich HB | Zürich | Already has dishes (verify) |
| UC-2.4 | KAIMUG Glattzentrum | Wallisellen | 1-2 dishes with CHF prices |
| UC-2.5 | Nooch Asian Kitchen | Zürich | Already has dishes (verify) |

### Acceptance Criteria
- [ ] All dean&david CH locations show at least 1 dish
- [ ] All KAIMUG CH locations show at least 1 dish
- [ ] Dishes include: name, description, price in local currency
- [ ] VEGAN badge displayed for vegan dishes

---

## UC-3: Distance-Based Filtering

### Description
Only venues within a reasonable distance (max 50km) should be shown in results.

### Preconditions
- User has entered a valid ZIP code
- Geocoding successfully returns coordinates

### Test Cases

| ID | ZIP | City | Expected | Should NOT Show |
|----|-----|------|----------|-----------------|
| UC-3.1 | 8000 | Zürich | Zürich, Wallisellen venues | Luzern (52km), Basel (85km) |
| UC-3.2 | 6000 | Luzern | Luzern, Ebikon venues | Zürich (52km), Bern (90km) |
| UC-3.3 | 3000 | Bern | Bern, Thun venues | Zürich (120km), Basel (95km) |
| UC-3.4 | 10115 | Berlin | Berlin venues | München (585km) |

### Distance Reference (Switzerland)
- Zürich to Wallisellen: ~8km (should show)
- Zürich to Winterthur: ~25km (should show)
- Zürich to Luzern: ~52km (should NOT show)
- Zürich to Basel: ~85km (should NOT show)

### Acceptance Criteria
- [ ] Venues beyond 50km are filtered out
- [ ] Results are sorted by distance (closest first)
- [ ] Distance badge shows for each venue
- [ ] Header shows correct count of filtered results

---

## Test Verification Checklist

### Local Testing (localhost:4321)
- [ ] UC-1: Verify ZIP placeholder on ch-de page
- [ ] UC-2: Enter 8000, verify all venues show dishes
- [ ] UC-3: Enter 8000, verify Luzern venues NOT shown

### Production Testing (GitHub Pages)
- [ ] UC-1: Verify ZIP placeholder on ch-de page
- [ ] UC-2: Enter 8000, verify all venues show dishes
- [ ] UC-3: Enter 8000, verify Luzern venues NOT shown
- [ ] Cross-browser: Test in Chrome, Firefox, Safari

---

## Implementation Order
1. Fix ZIP placeholder (simplest, isolated change)
2. Add missing dishes (data change only)
3. Add distance filtering (logic change)
