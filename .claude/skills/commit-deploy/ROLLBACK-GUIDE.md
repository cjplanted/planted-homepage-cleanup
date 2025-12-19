# Rollback and Recovery Guide

Emergency procedures for reverting failed deployments and recovering from deployment issues.

---

## When to Rollback

Initiate rollback procedures if:
- ❌ **Critical errors** in production (console errors, broken functionality)
- ❌ **Failed deployment verification** (HTTP 5xx, broken pages)
- ❌ **Data corruption** or incorrect data displayed
- ❌ **Performance degradation** (page load >10s, timeouts)
- ❌ **Accessibility regression** (keyboard nav broken, screen readers fail)
- ❌ **Security vulnerability** introduced

**Do NOT rollback for:**
- ✅ Minor visual glitches (can be fixed forward)
- ✅ Third-party script warnings (not under our control)
- ✅ Non-critical console warnings
- ✅ Minor performance issues (<2s difference)

---

## Rollback Methods

### Method 1: Git Revert (Recommended)

**Use when:** Last commit caused the issue and needs to be undone

**Advantages:**
- Preserves commit history
- Creates new revert commit (audit trail)
- Safe and reversible
- Triggers automatic redeployment

**Steps:**

```bash
# 1. Verify current state
git log -1 --oneline

# 2. Revert the last commit
git revert HEAD --no-edit

# 3. Push revert commit (triggers deployment)
git push origin main

# 4. Monitor rollback deployment
gh run watch --exit-status

# 5. Verify rollback succeeded
curl -I https://cjplanted.github.io/planted-homepage-cleanup/ch-de/
```

**Timeline:** 2-4 minutes (same as normal deployment)

---

### Method 2: Git Reset (Dangerous)

**Use when:** Multiple commits need to be removed or revert is not clean

**⚠️ WARNING:** This rewrites history. Use with caution.

**Advantages:**
- Completely removes commits
- Clean history as if commits never happened

**Disadvantages:**
- Requires force push
- Can cause issues for other developers
- Harder to recover if mistakes made

**Steps:**

```bash
# 1. Check current position
git log --oneline -5

# 2. Reset to specific commit (before the bad commit)
git reset --hard <commit-sha>

# 3. Force push to remote (DANGEROUS)
git push --force origin main

# 4. Monitor deployment
gh run watch --exit-status
```

**⚠️ Only use if:**
- You are the only developer on the branch
- Commits have not been pulled by others
- Revert method is not feasible

---

### Method 3: Manual GitHub Pages Rollback

**Use when:** Git-based rollback is not possible or too slow

**Steps:**

1. **Navigate to GitHub Actions**
   - Go to: https://github.com/user/repo/actions
   - Find a successful previous deployment

2. **Re-run Previous Workflow**
   ```bash
   # Get list of recent successful runs
   gh run list --workflow=deploy.yml --status=success --limit=5

   # Re-run specific workflow
   gh run rerun <run-id>
   ```

3. **Monitor Re-deployment**
   ```bash
   gh run watch --exit-status
   ```

**Timeline:** 2-4 minutes

---

### Method 4: Firebase Function Rollback

**Use when:** Firebase functions deployment failed or caused issues

**Option A: Redeploy Previous Version**

```bash
# 1. Checkout previous version
git checkout <previous-commit-sha>

# 2. Build and deploy
cd planted-availability-db
pnpm build
firebase deploy --only functions

# 3. Return to main branch
git checkout main
```

**Option B: Firebase Console Rollback**

1. Go to Firebase Console: https://console.firebase.google.com
2. Navigate to Functions section
3. Select function to rollback
4. Click "Rollback" and select previous version
5. Confirm rollback

**Timeline:** 1-2 minutes

---

## Rollback Verification Checklist

After initiating rollback, verify:

### HTTP Health Check
```bash
curl -I https://cjplanted.github.io/planted-homepage-cleanup/ch-de/
```
Expected: `HTTP/2 200`

### Visual Verification (MCP)
```javascript
navigate_page("https://cjplanted.github.io/planted-homepage-cleanup/ch-de/")
wait_for("main", 5000)
take_screenshot()
```
Expected: Page renders correctly

### Console Error Check
```javascript
list_console_messages()
```
Expected: No critical errors

### Functionality Test
- Test critical user flows
- Verify navigation works
- Check forms submit correctly
- Confirm data displays properly

### Performance Check
- Page loads in <3s
- No timeouts
- Resources load correctly

---

## Recovery Workflows

### Scenario 1: Build Failure During Deployment

**Symptoms:**
- GitHub Actions workflow fails on build step
- Error: "Build failed with exit code 1"

**Recovery:**

```bash
# 1. Check workflow logs
gh run view <run-id> --log-failed

# 2. Identify build error
# Look for TypeScript errors, missing dependencies, etc.

# 3. Fix locally
cd planted-astro
pnpm build  # Reproduce error

# 4. Fix the issue and verify
# Edit files to fix error
pnpm build  # Should succeed

# 5. Commit fix
git add .
git commit -m "fix(build): Resolve TypeScript error in component"
git push origin main

# 6. Monitor new deployment
gh run watch --exit-status
```

---

### Scenario 2: GitHub Actions Workflow Stuck

**Symptoms:**
- Workflow running for >10 minutes
- Status shows "in_progress" but no progress
- Jobs appear hung

**Recovery:**

```bash
# 1. Cancel stuck workflow
gh run cancel <run-id>

# 2. Wait 30 seconds

# 3. Manually trigger new deployment
gh workflow run deploy.yml

# 4. Monitor new run
gh run watch --exit-status
```

---

### Scenario 3: Deployment Succeeded but Page Shows 404

**Symptoms:**
- GitHub Actions shows success
- URL returns 404 Not Found
- CDN not serving pages

**Recovery:**

```bash
# 1. Wait for CDN propagation (up to 60s)
sleep 60
curl -I https://cjplanted.github.io/planted-homepage-cleanup/ch-de/

# 2. If still 404, check GitHub Pages settings
gh api repos/:owner/:repo/pages
# Verify source branch and path

# 3. Force rebuild by pushing empty commit
git commit --allow-empty -m "chore: Trigger GitHub Pages rebuild"
git push origin main

# 4. Monitor deployment
gh run watch --exit-status
```

---

### Scenario 4: Critical Console Errors in Production

**Symptoms:**
- JavaScript exceptions in browser console
- Broken functionality
- User-reported errors

**Recovery:**

```bash
# 1. Immediate rollback via revert
git revert HEAD --no-edit
git push origin main
gh run watch --exit-status

# 2. Verify rollback resolved issue
# Use Chrome DevTools MCP to check console

# 3. Investigate root cause locally
git checkout <bad-commit-sha>
cd planted-astro
pnpm dev
# Reproduce and debug issue

# 4. Create fix on new branch
git checkout main
git checkout -b fix/critical-console-error
# Make fixes
pnpm build  # Verify fix

# 5. Test thoroughly before deploying
# Run all test cases from TESTING-MANUAL.md

# 6. Merge and deploy fix
git checkout main
git merge fix/critical-console-error
git push origin main
```

---

### Scenario 5: Firebase Functions Returning 5xx Errors

**Symptoms:**
- API endpoints return 500, 502, 503, 504
- Functions logs show errors
- User cannot access functionality

**Recovery:**

```bash
# 1. Check function logs
firebase functions:log --limit 50

# 2. Identify error source
# Look for exceptions, timeouts, memory issues

# 3. Rollback to previous version
git checkout <previous-working-commit>
cd planted-availability-db
pnpm build
firebase deploy --only functions

# 4. Verify functions working
npm run smoke-test

# 5. Return to main to fix issue
git checkout main
# Debug and fix issue

# 6. Test fix locally
pnpm build
# Use Firebase emulator to test
firebase emulators:start --only functions

# 7. Deploy fix
firebase deploy --only functions
npm run smoke-test
```

---

## Communication Protocol

During rollback incidents:

### Internal Communication
1. **Identify issue** - Document what's broken
2. **Initiate rollback** - Start recovery immediately
3. **Track progress** - Update status in Slack/email
4. **Verify resolution** - Confirm rollback succeeded
5. **Post-mortem** - Document what happened and why

### User Communication (if applicable)
- **During incident:** "We're experiencing technical difficulties and are working on a fix."
- **After rollback:** "Issue has been resolved. Thank you for your patience."
- **Timeline:** Provide ETA if known

---

## Rollback Testing

Test rollback procedures regularly to ensure they work when needed.

### Monthly Rollback Drill

```bash
# 1. Create safe test commit
echo "<!-- Rollback test -->" >> planted-astro/src/layouts/Layout.astro
git add planted-astro/src/layouts/Layout.astro
git commit -m "test: Rollback drill"
git push origin main

# 2. Wait for deployment
gh run watch --exit-status

# 3. Immediately revert
git revert HEAD --no-edit
git push origin main
gh run watch --exit-status

# 4. Verify rollback succeeded
curl -I https://cjplanted.github.io/planted-homepage-cleanup/ch-de/

# 5. Document drill results
# Record time taken, any issues encountered
```

---

## Prevention Strategies

Reduce need for rollbacks by:

### Pre-Deploy Checks
- ✅ Build verification (Phase 1 of deploy workflow)
- ✅ TypeScript type checking
- ✅ Secrets detection
- ✅ Unit tests passing

### Staging Environment
- Deploy to staging first (if available)
- Test thoroughly before production
- Use feature flags for risky changes

### Monitoring
- Set up error alerts (Sentry, LogRocket, etc.)
- Monitor Core Web Vitals
- Track deployment metrics

### Code Review
- Require PR review for critical changes
- Use automated checks (CI/CD)
- Test interactive flows manually

---

## Rollback Command Reference

### Git Commands
```bash
# Revert last commit
git revert HEAD --no-edit

# Revert specific commit
git revert <commit-sha> --no-edit

# Revert multiple commits
git revert <oldest-sha>^..<newest-sha>

# Reset to previous commit (DANGEROUS)
git reset --hard <commit-sha>
git push --force origin main

# Create empty commit to trigger rebuild
git commit --allow-empty -m "chore: Trigger rebuild"
```

### GitHub CLI Commands
```bash
# Cancel running workflow
gh run cancel <run-id>

# Rerun previous workflow
gh run rerun <run-id>

# List recent successful runs
gh run list --workflow=deploy.yml --status=success --limit=5

# View workflow logs
gh run view <run-id> --log
gh run view <run-id> --log-failed
```

### Firebase Commands
```bash
# Deploy previous version
firebase deploy --only functions

# View function logs
firebase functions:log --limit 50

# Test functions locally
firebase emulators:start --only functions
```

---

## Decision Tree

```
Is production broken?
├─ YES → Severity?
│   ├─ CRITICAL (site down, data loss) → Immediate rollback (Method 1 or 2)
│   ├─ HIGH (major feature broken) → Rollback within 5 minutes
│   └─ MEDIUM (minor issue) → Fix forward or rollback within 30 minutes
└─ NO → Monitor and fix forward
```

---

## Post-Rollback Actions

After successful rollback:

1. **Verify resolution**
   - Run all checks from deployment verification
   - Confirm issue no longer present

2. **Document incident**
   - What went wrong
   - Why it happened
   - How it was fixed
   - How to prevent in future

3. **Create post-mortem** (for critical incidents)
   - Timeline of events
   - Root cause analysis
   - Action items

4. **Update monitoring**
   - Add alerts for similar issues
   - Improve detection

5. **Fix the issue properly**
   - Create new branch
   - Implement fix
   - Test thoroughly
   - Deploy with full verification

---

## Emergency Contacts

**For critical production issues:**
- Primary: [Name] - [Contact]
- Secondary: [Name] - [Contact]
- On-call: Check rotation schedule

**External Services:**
- GitHub Status: https://www.githubstatus.com/
- Firebase Status: https://status.firebase.google.com/

---

## Reference Documents

- `SKILL.md` - Deployment workflow
- `TESTING-MANUAL.md` - Verification procedures
- `TEST-REPORT-TEMPLATE.md` - Incident documentation
- `CLAUDE.md` (root) - Project setup
