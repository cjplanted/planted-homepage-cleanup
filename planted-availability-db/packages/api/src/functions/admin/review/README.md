# Review Workflow APIs

This directory contains the backend APIs for the Admin Dashboard 2.0 review workflow.

## Files

- `queue.ts` - Review queue with hierarchical structure (Country → Chain → Venue)
- `approve.ts` - Approve venues with optional dish approvals
- `partialApprove.ts` - Approve with corrections and feedback
- `reject.ts` - Reject false positives
- `bulk.ts` - Bulk approve/reject operations
- `index.ts` - Module exports

## Firebase Function Names

When deployed, these functions are available as:

- `adminReviewQueue` - GET review queue
- `adminApproveVenue` - POST approve venue
- `adminPartialApproveVenue` - POST partial approve with corrections
- `adminRejectVenue` - POST reject venue
- `adminBulkApprove` - POST bulk approve
- `adminBulkReject` - POST bulk reject

## URL Structure

All functions are deployed to Firebase Cloud Functions:

```
https://<region>-<project-id>.cloudfunctions.net/<function-name>
```

For example:
```
https://europe-west6-planted-prod.cloudfunctions.net/adminReviewQueue?status=discovered&limit=50
```

## Authentication

All endpoints require:
1. Firebase Authentication (Bearer token)
2. Admin role (custom claim: `admin: true`)

## Error Handling

All endpoints follow a consistent error pattern:
- Input validation with Zod
- Try-catch blocks for database operations
- Detailed error logging
- User-friendly error messages

## Database Operations

### Collections Used
- `discovered_venues` - Venues found by discovery agent
- `discovered_dishes` - Dishes extracted from menus
- `discovery_strategies` - Search strategies with success rates
- `change_logs` - Audit trail

### Transactions
- Bulk operations use sequential processing (not true transactions)
- Individual operations are atomic
- Strategy updates are best-effort (logged on failure)

## Testing

### Local Testing
```bash
# Start Firebase emulators
cd packages/api
npm run serve

# Create admin user in Auth emulator
# Get token from emulator UI

# Test endpoints
curl -H "Authorization: Bearer <token>" \
  http://localhost:5001/PROJECT/europe-west6/adminReviewQueue
```

### Integration Tests
```bash
# Run tests (when available)
npm test
```

## Performance

### Pagination
- Review queue uses cursor-based pagination
- Default limit: 50 items
- Maximum limit: 100 items
- Cursor is the ID of the last item

### Timeouts
- Standard endpoints: 60 seconds
- Bulk operations: 540 seconds (9 minutes)

### Optimization
- Hierarchical grouping done in memory (fast)
- Dishes fetched in parallel for queue items
- Strategy updates are async (don't block response)

## Monitoring

### Logs
All operations log to Cloud Functions logs:
- Success/failure for each operation
- User ID for audit trail
- Error details for debugging

### Metrics to Track
- Approval rate by confidence level
- Average review time per venue
- Bulk operation success rate
- Strategy success rate trends

## Future Enhancements

See `../../REVIEW_APIS.md` for detailed roadmap.
