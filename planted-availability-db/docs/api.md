# PAD API Documentation

Base URL: `https://pad-api.planted.ch/v1`

## Authentication

Public endpoints require no authentication.
Admin endpoints require a Bearer token in the Authorization header.

```
Authorization: Bearer <token>
```

## Public Endpoints

### GET /venues/nearby

Find venues near a location.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| lat | number | Yes | Latitude |
| lng | number | Yes | Longitude |
| radius | number | No | Radius in km (default: 10, max: 50) |
| type | string | No | Filter by type: `retail`, `restaurant`, `delivery_kitchen` |
| limit | number | No | Max results (default: 20, max: 100) |
| page | number | No | Page number for pagination |

**Response:**
```json
{
  "venues": [
    {
      "id": "venue_123",
      "name": "Restaurant Example",
      "type": "restaurant",
      "location": {
        "latitude": 47.3769,
        "longitude": 8.5417,
        "address": {
          "street": "Bahnhofstrasse 1",
          "city": "Zurich",
          "postal_code": "8001",
          "country": "CH"
        }
      },
      "distance_km": 0.5,
      "is_open": true,
      "planted_dish_count": 3
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 45,
    "totalPages": 3,
    "hasMore": true
  }
}
```

### GET /venues/:id

Get venue details including dishes.

**Response:**
```json
{
  "id": "venue_123",
  "name": "Restaurant Example",
  "type": "restaurant",
  "chain_id": "chain_456",
  "location": { ... },
  "opening_hours": {
    "regular": {
      "monday": [{ "open": "11:00", "close": "22:00" }],
      "tuesday": [{ "open": "11:00", "close": "22:00" }]
    }
  },
  "planted_dishes": [
    {
      "id": "dish_789",
      "name": "Planted Chicken Burger",
      "price": { "amount": 18.50, "currency": "CHF" },
      "planted_products": ["planted.chicken"]
    }
  ]
}
```

### GET /dishes

List dishes with Planted products.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| venue_id | string | Filter by venue |
| chain_id | string | Filter by chain |
| product | string | Filter by Planted product |
| min_price | number | Minimum price |
| max_price | number | Maximum price |

### GET /dishes/:id

Get dish details.

### GET /delivery/check

Check if delivery is available at a location.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| lat | number | Yes | Delivery latitude |
| lng | number | Yes | Delivery longitude |
| platform | string | No | Filter by platform (uber_eats, wolt, etc.) |

**Response:**
```json
{
  "available": true,
  "platforms": [
    {
      "name": "uber_eats",
      "restaurant_count": 5,
      "estimated_delivery_time": "25-35 min"
    },
    {
      "name": "wolt",
      "restaurant_count": 3,
      "estimated_delivery_time": "30-40 min"
    }
  ],
  "restaurants": [
    {
      "id": "venue_123",
      "name": "Restaurant Example",
      "platform": "uber_eats",
      "delivery_url": "https://ubereats.com/...",
      "planted_dish_count": 2
    }
  ]
}
```

### GET /promotions

Get active promotions.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| chain_id | string | Filter by chain |
| country | string | Filter by country (CH, DE, etc.) |

### GET /search

Full-text search across venues and dishes.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| q | string | Yes | Search query |
| lat | number | No | For geo-filtered results |
| lng | number | No | For geo-filtered results |
| type | string | No | Filter by venue type |

## Admin Endpoints

All admin endpoints require authentication.

### POST /admin/venues

Create a new venue.

**Body:**
```json
{
  "name": "New Restaurant",
  "type": "restaurant",
  "chain_id": "chain_456",
  "location": {
    "latitude": 47.3769,
    "longitude": 8.5417,
    "address": {
      "street": "Example Street 1",
      "city": "Zurich",
      "postal_code": "8001",
      "country": "CH"
    }
  }
}
```

### PUT /admin/venues/:id

Update a venue.

### DELETE /admin/venues/:id

Delete a venue.

### POST /admin/dishes

Create a dish.

### PUT /admin/dishes/:id

Update a dish.

### DELETE /admin/dishes/:id

Delete a dish.

### POST /admin/cache/clear

Clear the API cache.

### POST /admin/cache/warm

Pre-populate cache with common queries.

## Webhooks

Partners can send data updates via webhooks.

### POST /webhooks/partner

Receive partner data updates.

**Headers:**
```
X-Partner-ID: partner_123
X-Partner-Secret: <secret>
Content-Type: application/json
```

**Body:**
```json
{
  "type": "menu_update",
  "data": {
    "dishes": [
      {
        "name": "New Planted Dish",
        "price": 15.00,
        "venue_name": "Restaurant ABC"
      }
    ]
  }
}
```

## Rate Limits

| Endpoint Type | Limit |
|---------------|-------|
| Public | 100 req/min per IP |
| Admin | 1000 req/min per token |
| Webhooks | 60 req/min per partner |

## Error Responses

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Venue not found",
    "details": { "venue_id": "invalid_123" }
  }
}
```

| Code | HTTP Status | Description |
|------|-------------|-------------|
| BAD_REQUEST | 400 | Invalid request parameters |
| UNAUTHORIZED | 401 | Missing or invalid auth |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| RATE_LIMITED | 429 | Too many requests |
| INTERNAL_ERROR | 500 | Server error |

## Caching

Responses include cache headers:

```
Cache-Control: public, max-age=300, s-maxage=300, stale-while-revalidate=3600
X-Cache: HIT
```

| Endpoint | Cache TTL |
|----------|-----------|
| /venues/nearby | 5 min |
| /venues/:id | 5 min |
| /dishes | 5 min |
| /promotions | 1 hour |
| /search | 1 min |
