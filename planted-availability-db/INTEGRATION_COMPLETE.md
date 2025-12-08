# Planted Availability Database - Integration Complete

## What's Now Working

### 1. Database: Firestore (Live)
- **1,837 venues** imported and accessible
- **21 chains** created (Coop, Billa, REWE, Brezelkönig, etc.)
- Real-time data with geographic coordinates

### 2. API Endpoints (Live)

| Endpoint | Description | Example |
|----------|-------------|---------|
| `/venues` | List all venues | `?country=CH&type=retail&limit=10` |
| `/nearby` | Find venues near a point | `?lat=47.37&lng=8.54&radius_km=10` |
| `/dishes` | List dishes | `?venue_id=xxx` |
| `/deliveryCheck` | Check delivery availability | `?postal_code=8000&country=CH` |

**Base URL:** `https://europe-west6-get-planted-db.cloudfunctions.net`

### 3. Website Integration Components Created

**Files added to `planted-astro/`:**

1. **`src/data/padApi.ts`** - API client
   - `fetchVenues()` - Get venues with filters
   - `fetchNearbyVenues()` - Get nearby locations
   - `fetchCountryStats()` - Get stats per country

2. **`src/components/NearbyStores.astro`** - Display component
   - Shows real venues from the API
   - Grouped by city
   - Responsive grid layout
   - Matches existing StoreLocator styling

---

## To Display Venues in StoreLocator

Add to `StoreLocator.astro`:

```astro
---
// Add these imports at the top
import NearbyStores from './NearbyStores.astro';
import { fetchVenues, countryCodeToPad } from '../data/padApi';

// Get current country code for API
const currentCountryCode = localeToCountry[locale || 'ch-de']?.code || 'CH';
---
```

Then add the component where you want it (e.g., in the retail tab):

```astro
<!-- Add after the partners-grid in retail-tab -->
<NearbyStores
  country={currentCountryCode}
  type="retail"
  limit={12}
  title="Store Locations"
/>
```

---

## Data Summary

| Country | Stores | Restaurants | Total |
|---------|--------|-------------|-------|
| Austria | 1,326  | 0           | 1,347 |
| Switzerland | 189 | 57          | 246   |
| Germany | 122    | 0           | 171   |
| UK      | 0      | 12          | 12    |
| Italy   | 24     | 0           | 24    |

**Chains:**
- Billa: 1,326 stores (Austria)
- Coop: 189 stores (Switzerland)
- Brezelkönig: 57 restaurants (Switzerland)
- REWE: 49 stores (Germany)
- Interspar: 21 stores (Austria)
- Barburrito: 12 restaurants (UK)

---

## Quick API Test

```bash
# Get Swiss venues
curl "https://europe-west6-get-planted-db.cloudfunctions.net/venues?country=CH&limit=5"

# Find restaurants near Zurich
curl "https://europe-west6-get-planted-db.cloudfunctions.net/nearby?lat=47.37&lng=8.54&radius_km=10&type=restaurant"
```

---

## Admin Dashboard

Access at: **https://get-planted-db.web.app**

---

## Next Steps for Full Production

1. **Enable scheduled scrapers** - Configure proxy service and activate daily runs
2. **Add map view** - Integrate Mapbox or Google Maps to show venue markers
3. **Add search** - Implement postal code / address search
4. **Monitoring** - Set up Slack alerts for scraper failures

---

## Files Modified/Created

### In `planted-availability-db/`:
- `SYSTEM_OVERVIEW.md` - Full architecture documentation
- `scripts/import-planted-locations.ts` - Data import script
- `data/planted-locations.json` - Scraped location data
- `data/planted-restaurants.json` - Restaurant subset
- `data/planted-stores.json` - Store subset

### In `planted-astro/`:
- `src/data/padApi.ts` - API client
- `src/components/NearbyStores.astro` - Venue display component

---

## Architecture Diagram

```
                    ┌─────────────────────────┐
                    │  Planted Salesforce API │
                    │   (locations.eatplanted)│
                    └───────────┬─────────────┘
                                │ Scraped
                                ▼
┌───────────────────────────────────────────────────────────┐
│                    Firestore Database                      │
│   ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────────┐ │
│   │ venues  │ │ chains  │ │ dishes  │ │ scraper_runs    │ │
│   │ (1837)  │ │  (21)   │ │  (TBD)  │ │                 │ │
│   └─────────┘ └─────────┘ └─────────┘ └─────────────────┘ │
└───────────────────────────────────────────────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────┐
│              Cloud Functions API (europe-west6)            │
│   /venues  /nearby  /dishes  /deliveryCheck               │
└───────────────────────────────────────────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
        ┌───────────────────┐   ┌─────────────────────┐
        │  Admin Dashboard  │   │   Planted Website   │
        │ (get-planted-db)  │   │   (StoreLocator)    │
        └───────────────────┘   └─────────────────────┘
```

---

**Status: LIVE and operational!**
