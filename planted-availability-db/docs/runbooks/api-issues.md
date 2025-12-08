# API Issues Runbook

## Health Check

```bash
# Basic health
curl https://pad-api.planted.ch/health

# Detailed health with metrics
curl https://pad-api.planted.ch/health/detailed
```

Expected response:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 3600,
  "database": "connected",
  "cache": { "size": 450, "hitRate": 0.85 }
}
```

## Common Issues

### Issue: High Latency

**Symptoms:**
- Response times > 2s
- Timeout errors from clients

**Diagnosis:**
1. Check monitoring dashboard for latency trends
2. Identify slow endpoints:
   ```bash
   curl https://pad-api.planted.ch/admin/metrics/latency \
     -H "Authorization: Bearer $ADMIN_TOKEN"
   ```

**Fixes:**

1. **Cache miss storm** - Clear and warm cache:
   ```bash
   curl -X POST https://pad-api.planted.ch/admin/cache/warm \
     -H "Authorization: Bearer $ADMIN_TOKEN"
   ```

2. **Missing database index** - Check Firestore console for index recommendations

3. **Cold start issues** - Increase minimum instances:
   ```bash
   firebase functions:config:set api.min_instances=2
   ```

4. **Large payload** - Enable compression, paginate results

### Issue: 500 Internal Server Errors

**Diagnosis:**
```bash
# Check Cloud Functions logs
firebase functions:log --only pad-api

# Filter for errors
gcloud functions logs read pad-api --filter="severity>=ERROR" --limit=50
```

**Common Causes:**

1. **Database connection failed**
   - Check Firestore status: https://status.firebase.google.com/
   - Verify service account permissions

2. **Memory exceeded**
   - Increase function memory:
     ```bash
     firebase functions:config:set api.memory=512MB
     ```

3. **Unhandled exception**
   - Check logs for stack trace
   - Deploy fix and redeploy

### Issue: 429 Too Many Requests

**Symptoms:**
- Clients receiving rate limit errors
- Spike in request count

**Fixes:**

1. **Legitimate traffic spike** - Increase rate limits:
   ```bash
   firebase functions:config:set api.rate_limit=1000
   ```

2. **Abuse/Bot traffic** - Block offending IPs:
   ```bash
   curl -X POST https://pad-api.planted.ch/admin/block-ip \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -d '{"ip": "1.2.3.4"}'
   ```

3. **Enable Cloudflare/WAF** for DDoS protection

### Issue: CORS Errors

**Symptoms:**
- "Access-Control-Allow-Origin" errors in browser console

**Fixes:**

1. Verify allowed origins in config:
   ```bash
   firebase functions:config:get api.cors_origins
   ```

2. Add missing origin:
   ```bash
   firebase functions:config:set api.cors_origins="https://planted.ch,https://www.planted.ch"
   ```

### Issue: Stale Cache Data

**Symptoms:**
- Clients see outdated information
- Recent scraper updates not reflected

**Fixes:**

1. **Clear specific cache entry:**
   ```bash
   curl -X DELETE "https://pad-api.planted.ch/admin/cache/venues/nearby?lat=47.3&lng=8.5" \
     -H "Authorization: Bearer $ADMIN_TOKEN"
   ```

2. **Clear all cache:**
   ```bash
   curl -X POST https://pad-api.planted.ch/admin/cache/clear \
     -H "Authorization: Bearer $ADMIN_TOKEN"
   ```

3. **Reduce cache TTL** for affected endpoints

## Monitoring

### Key Metrics to Watch

| Metric | Warning | Critical |
|--------|---------|----------|
| Latency P95 | > 1s | > 3s |
| Error Rate | > 1% | > 5% |
| Cache Hit Rate | < 70% | < 50% |
| Request Rate | - | > 10k/min |

### Set Up Alerts

```bash
# Configure Slack alerts
firebase functions:config:set alerts.slack_webhook="https://hooks.slack.com/..."
firebase functions:config:set alerts.latency_threshold_ms=2000
firebase functions:config:set alerts.error_rate_threshold=0.05
```

## API Versioning

Current version: `v1`

Endpoints follow pattern: `/v1/venues/nearby`

### Deprecation Process

1. Announce deprecation (3 months notice)
2. Log usage of deprecated endpoints
3. Return deprecation header:
   ```
   Deprecation: true
   Sunset: Sat, 01 Jan 2025 00:00:00 GMT
   ```
4. Remove after sunset date

## Emergency: API Down

1. **Check Firebase Status** - https://status.firebase.google.com/

2. **Check recent deploys** - Rollback if needed:
   ```bash
   firebase functions:rollback pad-api
   ```

3. **Enable maintenance mode:**
   ```bash
   firebase functions:config:set api.maintenance=true
   firebase deploy --only functions
   ```
   Returns 503 with "Under Maintenance" message

4. **Failover to backup** (if configured):
   - Update DNS to backup endpoint
   - Notify clients of temporary endpoint

5. **Post-incident** - Create incident report with:
   - Timeline
   - Root cause
   - Impact
   - Prevention measures
