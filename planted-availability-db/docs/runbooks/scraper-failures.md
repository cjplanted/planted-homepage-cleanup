# Scraper Failures Runbook

## Symptoms

- Slack alert: "Scraper X is failing"
- No new data from specific retailer/platform
- Increasing stale record count

## Diagnosis Steps

### 1. Check Scraper Health Dashboard

```bash
# View all scraper health status
pnpm --filter @pad/scrapers run cli health
```

Output shows:
- Last run time
- Success rate (7 days)
- Error count
- Status: healthy/warning/critical/inactive

### 2. View Recent Run Logs

```bash
# Get last 5 runs for specific scraper
pnpm --filter @pad/scrapers run cli runs --scraper coop-ch --last 5
```

Look for:
- Error messages
- Duration anomalies
- Zero items scraped

### 3. Test Scraper Manually

```bash
# Run in dry-run mode with verbose output
pnpm --filter @pad/scrapers run cli run coop-ch --dry-run --verbose
```

For visual debugging (browser-based scrapers):
```bash
pnpm --filter @pad/scrapers run cli run coop-ch --dry-run --headful --slow
```

## Common Issues and Fixes

### Issue: CAPTCHA/Bot Detection

**Symptoms:**
- Scraper returns 0 items
- "Blocked" or "CAPTCHA" in logs

**Fixes:**
1. Increase delays:
   ```bash
   pnpm --filter @pad/scrapers run cli run coop-ch --min-delay 5000 --max-delay 10000
   ```

2. Rotate user agents (automatic in stealth mode)

3. Use residential proxy if available:
   ```bash
   PROXY_URL=http://user:pass@proxy:port pnpm --filter @pad/scrapers run cli run coop-ch
   ```

4. For persistent blocks, wait 24-48 hours before retrying

### Issue: Website Structure Changed

**Symptoms:**
- Scraper runs but finds 0 products
- "Element not found" errors

**Fixes:**
1. Check website manually to verify structure changed
2. Update CSS selectors in scraper file
3. Test with `--headful --slow` to debug
4. Common selector locations:
   - Product cards: `[data-testid="product-card"]`, `.product-tile`
   - Prices: `[class*="price"]`, `[data-price]`
   - Names: `h2`, `h3`, `[class*="title"]`

### Issue: Rate Limiting (429 errors)

**Symptoms:**
- "Too Many Requests" in logs
- Partial results

**Fixes:**
1. Increase base delay between requests
2. Add exponential backoff (already implemented)
3. Reduce concurrent requests
4. Check if IP is on rate limit list

### Issue: Authentication Expired

**Symptoms:**
- 401/403 errors
- "Login required" messages

**Fixes:**
1. For API-based scrapers, refresh API keys
2. For partner integrations, contact partner
3. Update credentials in Firebase config:
   ```bash
   firebase functions:config:set scrapers.rewe_api_key="NEW_KEY"
   ```

### Issue: SSL/Network Errors

**Symptoms:**
- "ECONNRESET", "ETIMEDOUT"
- SSL certificate errors

**Fixes:**
1. Check target site is accessible
2. Verify network/firewall settings
3. For SSL issues, update Node.js/certificates

## Escalation

If issue persists after troubleshooting:

1. **Check Monitoring Dashboard** for patterns across scrapers
2. **Create GitHub Issue** with:
   - Scraper name
   - Error messages
   - Steps attempted
   - Logs from last 5 runs

3. **Contact Partners** if integration-related

## Recovery Actions

### Re-run Failed Scraper

```bash
# Full re-run
pnpm --filter @pad/scrapers run cli run coop-ch

# Force refresh all data
pnpm --filter @pad/scrapers run cli run coop-ch --force-refresh
```

### Mark Stale Records

If scraper is down long-term:
```bash
# Mark venues as stale after 7 days
pnpm --filter @pad/database run cli mark-stale --scraper coop-ch --days 7
```

### Acknowledge Alert

```bash
# Via API
curl -X POST https://pad-api.planted.ch/admin/alerts/{alertId}/acknowledge \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
