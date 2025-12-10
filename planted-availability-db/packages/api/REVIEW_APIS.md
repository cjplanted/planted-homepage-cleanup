# Admin Review & Feedback APIs

This document describes the backend review workflow and feedback APIs built for the Admin Dashboard 2.0.

## Overview

The review workflow APIs enable efficient management of discovered venues and dishes through a hierarchical review queue, approval/rejection workflows, and AI learning feedback.

## Authentication

All endpoints require:
- Firebase Authentication (Bearer token in Authorization header)
- Admin role (`admin` custom claim)

Example:
```
Authorization: Bearer <firebase-id-token>
```

## API Endpoints

### 1. Review Queue API

**Endpoint:** `GET /adminReviewQueue`

Returns venues in a hierarchical structure for efficient review.

**Query Parameters:**
- `country` (optional): Filter by country (`CH`, `DE`, `AT`)
- `status` (optional): Filter by status (default: `discovered`)
  - `discovered` - Newly found, pending review
  - `verified` - Approved venues
  - `rejected` - False positives
  - `promoted` - Moved to production
  - `stale` - Needs re-verification
- `minConfidence` (optional): Minimum confidence score (0-100)
- `search` (optional): Search by name, city, or chain name
- `cursor` (optional): Pagination cursor (ID of last item)
- `limit` (optional): Items per page (default: 50, max: 100)

**Response:**
```json
{
  "items": [
    {
      "id": "venue-123",
      "name": "Restaurant Name",
      "chainId": "chain-456",
      "chainName": "Chain Name",
      "address": {
        "street": "Street 123",
        "city": "Zurich",
        "postalCode": "8001",
        "country": "CH"
      },
      "confidenceScore": 85,
      "status": "discovered",
      "createdAt": "2025-01-15T10:30:00Z",
      "dishes": [
        {
          "id": "dish-789",
          "name": "Planted Chicken Burger",
          "description": "Delicious burger",
          "product": "planted.chicken",
          "confidence": 90,
          "price": "CHF 14.90",
          "imageUrl": "https://...",
          "status": "discovered"
        }
      ]
    }
  ],
  "hierarchy": {
    "countries": [
      {
        "country": "CH",
        "venueTypes": [
          {
            "type": "chain",
            "chains": [
              {
                "chainId": "chain-456",
                "chainName": "Chain Name",
                "venues": [...],
                "totalVenues": 15
              }
            ],
            "totalVenues": 45
          },
          {
            "type": "independent",
            "venues": [...],
            "totalVenues": 30
          }
        ],
        "totalVenues": 75
      }
    ]
  },
  "stats": {
    "pending": 150,
    "verified": 320,
    "rejected": 45,
    "promoted": 280,
    "stale": 12,
    "byCountry": {
      "CH": 400,
      "DE": 280,
      "AT": 127
    },
    "byConfidence": {
      "low": 20,
      "medium": 80,
      "high": 50
    },
    "total": 807
  },
  "pagination": {
    "cursor": "venue-150",
    "hasMore": true,
    "total": 807,
    "pageSize": 50
  }
}
```

---

### 2. Approve Venue API

**Endpoint:** `POST /adminApproveVenue`

Approves a discovered venue and optionally its dishes.

**Path:** `/admin/review/venues/:id/approve`

**Request Body:**
```json
{
  "dishApprovals": [
    {
      "dishId": "dish-789",
      "approved": true
    },
    {
      "dishId": "dish-790",
      "approved": false
    }
  ]
}
```

**Notes:**
- If `dishApprovals` is omitted, all dishes are approved by default
- Updates venue status to `verified`
- Records approval in changelog
- Increases strategy success rate

**Response:**
```json
{
  "success": true,
  "message": "Venue approved successfully",
  "venue": {
    "id": "venue-123",
    "name": "Restaurant Name",
    "status": "verified",
    "verifiedAt": "2025-01-15T11:00:00Z"
  },
  "dishes": {
    "approved": 5,
    "rejected": 1,
    "total": 6
  }
}
```

---

### 3. Partial Approve Venue API

**Endpoint:** `POST /adminPartialApproveVenue`

Approves a venue with corrections and feedback.

**Path:** `/admin/review/venues/:id/partial-approve`

**Request Body:**
```json
{
  "feedback": "Price was incorrect, updated to match menu",
  "feedbackTags": ["wrong_price", "needs_attention"],
  "dishUpdates": [
    {
      "dishId": "dish-789",
      "updates": {
        "price_by_country": {
          "CH": "CHF 15.90"
        }
      },
      "approved": true
    }
  ]
}
```

**Feedback Tags:**
Common tags include:
- `wrong_price`
- `missing_dish`
- `wrong_product`
- `outdated_menu`
- `needs_attention`

**Response:**
```json
{
  "success": true,
  "message": "Venue partially approved with corrections",
  "venue": {
    "id": "venue-123",
    "name": "Restaurant Name",
    "status": "verified",
    "verifiedAt": "2025-01-15T11:05:00Z"
  },
  "feedback": {
    "message": "Price was incorrect, updated to match menu",
    "tags": ["wrong_price", "needs_attention"]
  },
  "dishes": {
    "updated": 3,
    "approved": 5,
    "rejected": 1,
    "errors": 0,
    "total": 6
  },
  "dishResults": [
    {
      "dishId": "dish-789",
      "status": "updated"
    }
  ]
}
```

---

### 4. Reject Venue API

**Endpoint:** `POST /adminRejectVenue`

Rejects a discovered venue as a false positive.

**Path:** `/admin/review/venues/:id/reject`

**Request Body:**
```json
{
  "reason": "Not actually a restaurant, delivery kitchen only",
  "feedbackTags": ["false_positive", "delivery_only"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Venue rejected successfully",
  "venue": {
    "id": "venue-123",
    "name": "Restaurant Name",
    "status": "rejected",
    "rejectionReason": "Not actually a restaurant, delivery kitchen only"
  },
  "feedback": {
    "reason": "Not actually a restaurant, delivery kitchen only",
    "tags": ["false_positive", "delivery_only"]
  }
}
```

**Notes:**
- Updates strategy to reflect false positive
- Decreases strategy success rate
- Records rejection in changelog

---

### 5. Bulk Approve API

**Endpoint:** `POST /adminBulkApprove`

Approves multiple venues at once.

**Request Body:**
```json
{
  "venueIds": [
    "venue-123",
    "venue-124",
    "venue-125"
  ]
}
```

**Limits:**
- Maximum 100 venues per request
- Timeout: 9 minutes

**Response:**
```json
{
  "success": true,
  "message": "Bulk approval completed: 95 approved, 3 already verified, 1 errors, 1 not found",
  "summary": {
    "total": 100,
    "successful": 95,
    "alreadyVerified": 3,
    "errors": 1,
    "notFound": 1
  },
  "results": [
    {
      "venueId": "venue-123",
      "status": "success",
      "venueName": "Restaurant Name"
    },
    {
      "venueId": "venue-124",
      "status": "already_verified",
      "venueName": "Another Restaurant"
    },
    {
      "venueId": "venue-125",
      "status": "error",
      "error": "Database connection timeout"
    }
  ]
}
```

---

### 6. Bulk Reject API

**Endpoint:** `POST /adminBulkReject`

Rejects multiple venues at once.

**Request Body:**
```json
{
  "venueIds": [
    "venue-123",
    "venue-124"
  ],
  "reason": "Bulk cleanup of ghost kitchens"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Bulk rejection completed: 48 rejected, 2 already rejected, 0 errors, 0 not found",
  "summary": {
    "total": 50,
    "successful": 48,
    "alreadyRejected": 2,
    "errors": 0,
    "notFound": 0
  },
  "results": [...]
}
```

---

### 7. Feedback Submit API

**Endpoint:** `POST /adminFeedbackSubmit`

Submits structured feedback for AI learning.

**Request Body:**
```json
{
  "entityType": "venue",
  "entityId": "venue-123",
  "feedbackType": "partial",
  "feedback": "Good discovery but prices need updating",
  "tags": ["wrong_price", "needs_refresh"],
  "corrections": [
    {
      "field": "price",
      "expected": "CHF 15.90",
      "actual": "CHF 14.90"
    }
  ]
}
```

**Fields:**
- `entityType`: `venue` or `dish`
- `feedbackType`: `approve`, `partial`, or `reject`
- `feedback` (optional): Free-form feedback text
- `tags` (optional): Structured feedback tags
- `corrections` (optional): Field-level corrections for learning

**Response:**
```json
{
  "success": true,
  "message": "Feedback submitted successfully",
  "feedback": {
    "id": "feedback-456",
    "entityType": "venue",
    "entityId": "venue-123",
    "feedbackType": "partial",
    "tags": ["wrong_price", "needs_refresh"],
    "corrections": [...],
    "createdAt": "2025-01-15T11:20:00Z"
  }
}
```

---

### 8. Feedback Process API

**Endpoint:** `POST /adminFeedbackProcess`

Processes collected feedback to update strategy success rates.

**Query Parameters:**
- `strategyId` (optional): Process feedback for specific strategy only
- `limit` (optional): Maximum feedback items to process (default: 100)
- `dryRun` (optional): If `true`, simulate without making changes (default: `false`)

**How It Works:**
1. Collects unprocessed feedback for venues/dishes
2. Groups feedback by discovery strategy
3. Calculates new success rate based on:
   - Approvals: Increase success rate
   - Rejections: Decrease success rate
   - Partial approvals: Slight increase (50% weight)
4. Updates strategy success rate using weighted average

**Response:**
```json
{
  "success": true,
  "message": "Processed 85 feedback items, updated 12 strategies",
  "dryRun": false,
  "processed": 85,
  "strategies": [
    {
      "strategyId": "strategy-789",
      "oldSuccessRate": 70,
      "newSuccessRate": 75,
      "approvals": 12,
      "rejections": 2,
      "partials": 3
    }
  ]
}
```

**Dry Run Example:**
```
POST /adminFeedbackProcess?dryRun=true&limit=50
```

This simulates processing without making changes, useful for preview.

---

## Error Responses

All endpoints return consistent error responses:

```json
{
  "error": "Error type",
  "message": "Detailed error message",
  "details": [...]  // Optional validation errors
}
```

**Common HTTP Status Codes:**
- `400` - Bad Request (invalid input)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (not admin)
- `404` - Not Found (entity doesn't exist)
- `405` - Method Not Allowed
- `500` - Internal Server Error

---

## Workflow Examples

### Example 1: Review and Approve a Venue

```bash
# 1. Get the review queue
GET /adminReviewQueue?status=discovered&minConfidence=70&limit=20

# 2. Review a specific venue (from queue results)
# Approve with selective dish approvals
POST /adminApproveVenue
Path: /admin/review/venues/venue-123/approve
Body: {
  "dishApprovals": [
    {"dishId": "dish-789", "approved": true},
    {"dishId": "dish-790", "approved": true},
    {"dishId": "dish-791", "approved": false}
  ]
}
```

### Example 2: Partial Approval with Corrections

```bash
# Approve venue but fix incorrect prices
POST /adminPartialApproveVenue
Path: /admin/review/venues/venue-123/partial-approve
Body: {
  "feedback": "Menu prices were outdated",
  "feedbackTags": ["wrong_price", "outdated_menu"],
  "dishUpdates": [
    {
      "dishId": "dish-789",
      "updates": {
        "price_by_country": {"CH": "CHF 16.90"}
      },
      "approved": true
    }
  ]
}
```

### Example 3: Bulk Operations

```bash
# Approve all high-confidence chain venues
POST /adminBulkApprove
Body: {
  "venueIds": ["venue-1", "venue-2", ..., "venue-50"]
}

# Reject all ghost kitchens
POST /adminBulkReject
Body: {
  "venueIds": ["venue-100", "venue-101", ...],
  "reason": "Ghost kitchens not included in database"
}
```

### Example 4: AI Learning Workflow

```bash
# 1. Submit detailed feedback during review
POST /adminFeedbackSubmit
Body: {
  "entityType": "dish",
  "entityId": "dish-789",
  "feedbackType": "partial",
  "tags": ["wrong_product", "misidentified"],
  "corrections": [
    {
      "field": "planted_product",
      "expected": "planted.kebab",
      "actual": "planted.chicken"
    }
  ]
}

# 2. Process accumulated feedback (run periodically)
POST /adminFeedbackProcess?limit=100&dryRun=false

# 3. Preview what would change (dry run)
POST /adminFeedbackProcess?dryRun=true
```

---

## Implementation Notes

### Database Collections Used

- **discovered_venues**: Stores discovered venues
- **discovered_dishes**: Stores extracted dishes
- **discovery_strategies**: AI search strategies
- **ai_feedback**: Feedback for learning
- **change_logs**: Audit trail of changes

### Authentication & Authorization

All endpoints use Firebase Admin SDK for authentication:
1. Verify ID token from Authorization header
2. Check for `admin` custom claim
3. Reject unauthorized requests with 401/403

### Error Handling

- All database operations wrapped in try-catch
- Detailed error logging with `console.error`
- User-friendly error messages
- Validation errors include field-level details

### Performance Considerations

- Bulk operations limited to 100 items (9-minute timeout)
- Review queue uses cursor-based pagination
- Efficient hierarchical grouping in memory
- Strategy updates batched when possible

### Changelog Integration

All approve/reject operations automatically:
- Record changes in `change_logs` collection
- Track user ID and timestamp
- Include reason and before/after values
- Support audit trail and rollback

---

## Testing

### Manual Testing

Use Firebase Emulator for local testing:

```bash
# Start emulators
npm run serve

# Get auth token
# (Use Firebase Auth emulator UI to create admin user)

# Test endpoints
curl -H "Authorization: Bearer <token>" \
  http://localhost:5001/PROJECT_ID/REGION/adminReviewQueue?limit=10
```

### Postman Collection

Import the API endpoints into Postman:
- Set `Authorization` header with Bearer token
- Use environment variables for base URL
- Test all endpoints with sample data

---

## Deployment

Deploy functions to Firebase:

```bash
# Build
npm run build

# Deploy all admin functions
firebase deploy --only functions

# Deploy specific function
firebase deploy --only functions:adminReviewQueue
```

---

## Future Enhancements

Potential improvements for v2:

1. **Real-time updates** - WebSocket support for live queue updates
2. **Advanced filtering** - Full-text search, compound filters
3. **Batch processing** - Schedule automated approvals based on confidence
4. **Analytics** - Reviewer performance metrics, approval rates
5. **ML integration** - Auto-approve high-confidence items
6. **Webhook notifications** - Alert on high-priority discoveries
7. **Export functionality** - CSV/JSON export of review queue

---

## Support

For issues or questions:
- Check Firebase Functions logs
- Review error responses for details
- Verify authentication tokens are valid
- Ensure admin role is properly set
