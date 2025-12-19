# Locator Skill - Venue Discovery System

## Overview
The Planted venue locator helps users find restaurants and stores serving Planted products near their location.

## Architecture

### Frontend (Astro)
```
planted-astro/src/
├── pages/[locale]/locator-v3.astro    # Main page + API loader script
├── components/locator/
│   ├── LocatorResultsV3.astro         # Results container + filter controller
│   ├── VenueCardV3.astro              # Individual venue card
│   ├── VenueDetailPanelV3.astro       # Detail modal overlay
│   ├── ZipOverlay.astro               # ZIP input modal on homepage
│   └── use-cases/                     # Test scenarios
```

### Backend (Firebase Functions)
```
planted-availability-db/packages/api/src/functions/public/
├── nearby.ts                          # GET /nearby - Main venue search API
├── geolocate.ts                       # IP-to-location lookup
└── schemas/requests.ts                # Query validation (nearbyQuerySchema)
```

### Database (Firestore)
```
Collections:
├── discovered_venues                  # Primary source (500+ venues)
│   ├── coordinates: { latitude, longitude }  # CRITICAL: Must have valid coords
│   ├── address: { city, country, postal_code }
│   ├── dishes: []                     # Embedded dish objects
│   └── delivery_platforms: []
└── venues                             # Secondary source (curated)
```

## Key Learnings

### 1. Coordinate Data is Critical
- ALL distance calculations depend on `coordinates.latitude/longitude`
- Venues with `0,0` coordinates trigger "country fallback" mode
- Country fallback returns all venues in country with FAKE distances (10.0, 10.1, 10.2...)

### 2. ZIP Geocoding Flow
```
User Input (ZIP)
  → Check knownZipCoords (20 hardcoded entries)
  → If miss: Call Nominatim OpenStreetMap API (200-500ms)
  → Return { lat, lng }
  → Call /nearby API with coordinates
```

### 3. Nearby API Flow
```
/nearby?lat=X&lng=Y&radius_km=10&type=restaurant&limit=20&slim=true

1. Check in-memory LRU cache (TTL: 60s)
2. Query discovered_venues (primary, up to 500)
3. Calculate bounding box for quick pre-filter
4. Apply Haversine distance formula for exact filtering
5. If NO geo-matching venues → Country fallback
6. Query venues collection (secondary, curated)
7. Dedupe chains (show only 1 per chain)
8. Sort by distance, limit results
9. Return slim response (~6KB vs 18KB full)
```

### 4. Performance Optimizations (T028)
- `slim=true` reduces payload from 18KB to 6KB
- LRU cache with 100 entries, 60s TTL
- Coordinates rounded to 3 decimals (~100m precision) for cache key
- Bounding box pre-filter before expensive Haversine calc

## Common Issues

### Issue: Wrong venues appear for ZIP code
**Cause**: Venues missing coordinates → country fallback mode
**Fix**: Geocode all venues to add valid coordinates

### Issue: Distance filters show no results
**Cause**: All distances are fake (10km+) due to missing coordinates
**Fix**: With real coordinates, real distances will work

### Issue: Slow loading for unknown ZIP
**Cause**: Nominatim API call adds 200-500ms
**Fix**: Pre-compute ZIP→coordinates mapping for all Swiss/German/Austrian ZIPs

## Swiss Postal Code System
- 4-digit format: XYZZ
- X = Region (1=Geneva, 8=Zurich, 9=St. Gallen, etc.)
- YZZ = Sub-region
- ~4,600 active postal codes in Switzerland

## API Endpoints

### GET /nearby
```typescript
Query Params:
- lat: number (required) -90 to 90
- lng: number (required) -180 to 180
- radius_km: number (default: 10, max: 50)
- type: 'retail' | 'restaurant' | 'delivery_kitchen' | 'all'
- limit: number (default: 20, max: 100)
- slim: boolean (default: false) - Reduced payload
- open_now: boolean - Filter to open venues
- product_sku: string - Filter by planted product
- dedupe_chains: boolean (default: true)

Response (slim mode):
{
  results: [{
    venue: { id, name, type, location, address, delivery_platforms, distance_km },
    dishes: [{ id, name, price, planted_products }],
    is_open: boolean,
    today_hours: string
  }],
  total: number,
  has_more: boolean
}
```

## Testing Checklist
- [ ] ZIP 8001 returns Zurich venues only
- [ ] ZIP 3000 returns Bern venues only
- [ ] Distance <500m filter works
- [ ] Distance <1km filter works
- [ ] No venue beyond 5km radius
- [ ] First 3 cards load fast
- [ ] Load more works progressively
- [ ] Detail panel opens correctly

## Related Documentation
- `SYSTEM_OVERVIEW.md` - Full system architecture
- `TECHNICAL-DOCUMENTATION.md` - API reference
- `attackZeroProgress.md` - Data quality tracking
