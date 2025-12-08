# PAD Operational Runbooks

This directory contains runbooks for common operational issues.

## Runbook Index

| Runbook | Description |
|---------|-------------|
| [Scraper Failures](./scraper-failures.md) | Diagnosing and fixing scraper issues |
| [Database Operations](./database-operations.md) | Firestore maintenance and troubleshooting |
| [API Issues](./api-issues.md) | API performance and error debugging |
| [Deployment](./deployment.md) | Deployment and rollback procedures |

## Quick Reference

### Check System Health
```bash
# View scraper health
pnpm --filter @pad/scrapers run cli health

# Check recent scraper runs
pnpm --filter @pad/scrapers run cli runs --last 10

# Verify API is responding
curl https://pad-api.planted.ch/health
```

### Common Emergency Actions

**Pause All Scrapers:**
```bash
firebase functions:config:set scrapers.enabled=false
```

**Clear API Cache:**
```bash
curl -X POST https://pad-api.planted.ch/admin/cache/clear \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Rollback Deployment:**
```bash
firebase hosting:rollback
firebase functions:rollback
```
