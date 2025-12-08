# Deployment Runbook

## Pre-Deployment Checklist

- [ ] All tests passing: `pnpm test`
- [ ] Build successful: `pnpm build`
- [ ] Type checks pass: `pnpm typecheck`
- [ ] Linting clean: `pnpm lint`
- [ ] Environment variables set for target environment
- [ ] Database migrations ready (if any)
- [ ] Changelog updated

## Deployment Commands

### Full Deployment

```bash
# Build all packages
pnpm build

# Deploy everything to Firebase
firebase deploy
```

### Selective Deployment

```bash
# API only
firebase deploy --only functions:pad-api

# Hosting (admin dashboard) only
firebase deploy --only hosting

# Firestore rules and indexes
firebase deploy --only firestore
```

### Scrapers Deployment

Scrapers run on Cloud Scheduler. Update schedule:

```bash
# View current schedules
gcloud scheduler jobs list

# Update a schedule
gcloud scheduler jobs update http scraper-coop-ch \
  --schedule="0 6,18 * * *" \
  --uri="https://pad-api.planted.ch/scraper/run/coop-ch"
```

## Environment Configuration

### View Current Config

```bash
firebase functions:config:get
```

### Set Configuration

```bash
# API settings
firebase functions:config:set api.min_instances=2
firebase functions:config:set api.memory=512MB
firebase functions:config:set api.timeout=60

# Scraper settings
firebase functions:config:set scrapers.enabled=true
firebase functions:config:set scrapers.max_concurrent=3

# Alerts
firebase functions:config:set alerts.slack_webhook="https://hooks.slack.com/..."
firebase functions:config:set alerts.email_recipients="ops@planted.ch"
```

### Environment-Specific Configs

```bash
# Production
firebase use production
firebase functions:config:set env.name=production

# Staging
firebase use staging
firebase functions:config:set env.name=staging
```

## Rollback Procedures

### Rollback Functions

```bash
# List recent deployments
firebase functions:list

# Rollback to previous version
firebase functions:rollback pad-api

# Rollback to specific version
firebase functions:rollback pad-api --version 5
```

### Rollback Hosting

```bash
# List releases
firebase hosting:releases:list

# Rollback to previous
firebase hosting:rollback

# Rollback to specific version
firebase hosting:clone VERSION_ID:live
```

### Rollback Firestore Rules

```bash
# Rules are versioned in Git
git checkout HEAD~1 -- firestore.rules
firebase deploy --only firestore:rules
```

## Database Migrations

### Pre-Migration

1. Create backup:
   ```bash
   gcloud firestore export gs://pad-backups/pre-migration-$(date +%Y%m%d)
   ```

2. Test migration on staging first

### Run Migration

```bash
pnpm --filter @pad/database run migrate --env production
```

### Post-Migration Verification

```bash
# Verify data integrity
pnpm --filter @pad/database run verify-migration

# Check for errors
firebase functions:log --only pad-migrate
```

## Blue-Green Deployment

For zero-downtime releases:

1. **Deploy to inactive slot:**
   ```bash
   firebase hosting:channel:deploy preview --expires 2h
   ```

2. **Test preview:**
   - URL: `https://pad-preview--planted-pad.web.app`
   - Run smoke tests

3. **Promote to live:**
   ```bash
   firebase hosting:clone preview:live
   ```

4. **Verify live:**
   - Check health endpoint
   - Run smoke tests on production

## Post-Deployment

### Verification Steps

1. Check health endpoint:
   ```bash
   curl https://pad-api.planted.ch/health
   ```

2. Test key endpoints:
   ```bash
   curl "https://pad-api.planted.ch/v1/venues/nearby?lat=47.3&lng=8.5"
   ```

3. Monitor error rates for 15 minutes

4. Check scraper still running:
   ```bash
   pnpm --filter @pad/scrapers run cli health
   ```

### Monitoring

Watch these dashboards after deployment:

- Firebase Console: Functions metrics
- Cloud Monitoring: Custom dashboards
- Slack: Error alerts channel

## Hotfix Process

For urgent fixes:

1. Create hotfix branch from main:
   ```bash
   git checkout -b hotfix/issue-description main
   ```

2. Make minimal fix, test locally

3. Fast-track review (1 approver)

4. Deploy directly:
   ```bash
   pnpm build
   firebase deploy --only functions:pad-api
   ```

5. Merge to main and develop branches

6. Create incident report

## Scheduled Maintenance

1. Announce maintenance window (24h notice minimum)

2. Enable maintenance mode:
   ```bash
   firebase functions:config:set api.maintenance=true
   firebase deploy --only functions
   ```

3. Perform maintenance

4. Disable maintenance mode:
   ```bash
   firebase functions:config:set api.maintenance=false
   firebase deploy --only functions
   ```

5. Verify system health

6. Announce completion
