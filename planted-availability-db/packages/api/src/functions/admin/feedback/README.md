# Feedback & Learning APIs

This directory contains the AI learning feedback APIs for improving discovery strategies.

## Files

- `submit.ts` - Submit structured feedback for AI learning
- `process.ts` - Process feedback to update strategy success rates
- `index.ts` - Module exports

## Firebase Function Names

When deployed, these functions are available as:

- `adminFeedbackSubmit` - POST submit feedback
- `adminFeedbackProcess` - POST process accumulated feedback

## How It Works

### Feedback Collection

When admins review venues/dishes, they can submit structured feedback:

1. **Approve** - Everything is correct
2. **Partial** - Mostly correct but needs minor fixes
3. **Reject** - False positive or completely wrong

Each feedback includes:
- Entity type (venue or dish)
- Entity ID
- Feedback type
- Optional tags (e.g., `wrong_price`, `missing_dish`)
- Optional corrections (field-level)

### Strategy Learning

The system processes feedback to improve discovery strategies:

1. **Collect** - Gather feedback for venues/dishes
2. **Group** - Group by discovery strategy
3. **Calculate** - Compute new success rate
4. **Update** - Apply changes to strategies

#### Success Rate Calculation

```
New Success Rate = (Old Rate × Historical Weight) + (Feedback Rate × Feedback Weight)

Where:
- Historical Weight = min(total_uses / 10, 0.8)
- Feedback Weight = 1 - Historical Weight
- Feedback Rate = (approvals + partials × 0.5) / (approvals + partials + rejections) × 100
```

This ensures:
- Strategies with more data are more stable
- New feedback still influences the rate
- Partial approvals count as 50% success

## Usage Examples

### Submit Feedback During Review

```javascript
// When approving a venue
await submitFeedback({
  entityType: 'venue',
  entityId: 'venue-123',
  feedbackType: 'approve',
});

// When partially approving with corrections
await submitFeedback({
  entityType: 'dish',
  entityId: 'dish-789',
  feedbackType: 'partial',
  tags: ['wrong_price'],
  corrections: [
    {
      field: 'price',
      expected: 'CHF 15.90',
      actual: 'CHF 14.90'
    }
  ]
});

// When rejecting
await submitFeedback({
  entityType: 'venue',
  entityId: 'venue-456',
  feedbackType: 'reject',
  tags: ['false_positive', 'not_restaurant'],
  feedback: 'This is a ghost kitchen, not a real restaurant'
});
```

### Process Feedback

```javascript
// Process all pending feedback
await processFeedback({
  limit: 100
});

// Process for specific strategy
await processFeedback({
  strategyId: 'strategy-789',
  limit: 50
});

// Dry run (preview changes)
await processFeedback({
  dryRun: true,
  limit: 100
});
```

## Database Schema

### AI Feedback Collection

The `ai_feedback` collection stores feedback items:

```typescript
interface AIFeedback {
  id: string;

  // Entity references
  discovered_venue_id?: string;
  discovered_dish_id?: string;

  // AI prediction (for compatibility)
  ai_prediction: {
    product_sku: string;
    confidence: number;
    factors: string[];
  };

  // Human feedback
  human_feedback: 'correct' | 'wrong_product' | 'not_planted' | 'needs_review';
  feedback_notes?: string;

  // Reviewer
  reviewer_id: string;

  // Timestamps
  created_at: Date;
  updated_at: Date;
}
```

## Feedback Tags

Common feedback tags for structured learning:

### Price Issues
- `wrong_price` - Price doesn't match menu
- `outdated_price` - Price is old
- `missing_price` - Price not found

### Product Issues
- `wrong_product` - Wrong Planted product identified
- `not_planted` - Not actually a Planted dish
- `misidentified` - Product type wrong

### Data Quality
- `missing_dish` - Expected dish not found
- `duplicate` - Duplicate entry
- `outdated_menu` - Menu has changed
- `incomplete_data` - Missing fields

### Venue Issues
- `false_positive` - Not a valid venue
- `ghost_kitchen` - Delivery-only kitchen
- `closed` - Venue no longer exists
- `wrong_location` - Address incorrect

## Scheduled Processing

Consider running feedback processing on a schedule:

```javascript
// In Firebase Functions
export const scheduledFeedbackProcess = onSchedule({
  schedule: 'every 6 hours',
  region: 'europe-west6',
}, async () => {
  // Process recent feedback
  await processFeedback({
    limit: 500,
    dryRun: false
  });
});
```

## Monitoring

### Key Metrics

Track these metrics for AI learning:

1. **Feedback Volume**
   - Feedback items per day
   - Feedback by type (approve/partial/reject)
   - Feedback by tag

2. **Strategy Performance**
   - Success rate trends over time
   - Strategies with improving rates
   - Strategies with declining rates

3. **Processing Stats**
   - Items processed per run
   - Strategies updated per run
   - Average success rate change

### Alerts

Set up alerts for:
- Strategy success rate drops below 30%
- Large volumes of rejections
- Processing failures

## Best Practices

### For Admins Reviewing

1. **Be Specific** - Use tags to categorize issues
2. **Provide Context** - Add notes explaining why
3. **Use Corrections** - Specify what should be instead of what is
4. **Be Consistent** - Use same tags for similar issues

### For Processing

1. **Run Regularly** - Process feedback at least daily
2. **Monitor Results** - Check strategy updates make sense
3. **Use Dry Runs** - Preview changes before applying
4. **Limit Batch Size** - Don't overwhelm with too many updates

### For Strategy Management

1. **Deprecate Low Performers** - Auto-deprecate strategies < 10% success
2. **Promote High Performers** - Use successful strategies more
3. **Evolve Strategies** - Create variations of successful ones
4. **Test New Strategies** - Give new strategies fair chance (min 10 uses)

## Error Handling

### Submit Endpoint
- Validates input schema
- Checks entity exists (warning only)
- Always stores feedback even if entity missing

### Process Endpoint
- Continues on individual failures
- Logs warnings for missing entities
- Returns success/failure for each strategy
- Never fails entire batch

## Future Enhancements

1. **ML Model Training**
   - Export feedback for model retraining
   - Include corrections in training data
   - Track prediction accuracy over time

2. **Automated Learning**
   - Auto-process feedback on threshold
   - Auto-evolve successful strategies
   - Auto-deprecate consistent failures

3. **Feedback Analytics**
   - Dashboard for feedback trends
   - Tag frequency analysis
   - Correction pattern detection

4. **Real-time Updates**
   - Update strategies immediately on feedback
   - Push notifications for significant changes
   - Live strategy performance monitoring
