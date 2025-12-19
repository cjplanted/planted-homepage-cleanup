---
name: commit-deploy
description: Use this skill when committing code changes and deploying to GitHub Pages or Firebase. Orchestrates a comprehensive commit-deploy-verify workflow with build verification, semantic commits, push monitoring, GitHub Actions tracking, and post-deploy health checks.
---

# Commit-Deploy Workflow

This skill implements a rigorous 6-phase workflow for committing changes and deploying to production environments (GitHub Pages and Firebase Cloud Functions).

## When This Skill Activates

**Triggers on requests to:**
- Commit and deploy changes
- Push to production
- Deploy to GitHub Pages
- Deploy Firebase Functions
- Create production release
- Verify deployment status

## Deployment Targets

| Target | URL | Deployment Method | Verification |
|--------|-----|-------------------|--------------|
| GitHub Pages | https://cjplanted.github.io/planted-homepage-cleanup/ | Git push triggers workflow | HTTP check + Chrome DevTools |
| Firebase Functions | Cloud Functions endpoints | `firebase deploy --only functions` | Smoke tests |
| Astro Preview | Built files inspection | `pnpm build` | Build success |

## Workflow Overview

```
┌─────────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│  1. PRE-COMMIT      │────▶│  2. COMMIT CREATION  │────▶│  3. PUSH TO REMOTE  │
│  VERIFICATION       │     │  (Semantic message)  │     │   (git push)        │
└─────────────────────┘     └──────────────────────┘     └─────────────────────┘
                                                                   │
┌─────────────────────┐     ┌──────────────────────┐              │
│  6. POST-DEPLOY     │◀────│  5. DEPLOYMENT       │◀─────────────┘
│  VERIFICATION       │     │  VERIFICATION        │              │
└─────────────────────┘     └──────────────────────┘              │
         ▲                           ▲                            │
         │                           │          ┌─────────────────▼──┐
         │                           └──────────│  4. GITHUB ACTIONS │
         │                                      │  MONITORING        │
         └──────────────────────────────────────│  (gh run watch)    │
                                                └────────────────────┘
```

---

## Phase 1: Pre-Commit Verification

**Goal:** Ensure code builds and passes checks before committing

### Checks Required

#### 1. Build Verification (Astro)
```bash
cd planted-astro && pnpm build
```
- Must complete without errors
- Verify dist/ directory created
- Check for build warnings

#### 2. TypeScript Check
```bash
cd planted-astro && npx tsc --noEmit
```
- Zero TypeScript errors
- Verify types are correct

#### 3. Firebase Build (if applicable)
```bash
cd planted-availability-db && pnpm build
```
- All packages compile successfully
- No TypeScript errors in Cloud Functions

#### 4. Git Status Check
```bash
git status
```
- Identify all modified files
- Check for untracked files
- Verify no conflicts

#### 5. Secrets Detection
- Scan for `.env` files in staged changes
- Warn if `credentials.json` or API keys detected
- Block commit if secrets found

### Pass Criteria
- All builds succeed (exit code 0)
- No TypeScript errors
- No secrets in staged files
- Git status clean (no conflicts)

---

## Phase 2: Commit Creation

**Goal:** Create semantic commit with proper formatting

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

### Semantic Commit Types

| Type | Use When |
|------|----------|
| `feat` | New feature or capability added |
| `fix` | Bug fix or correction |
| `docs` | Documentation only changes |
| `style` | Code style/formatting (no logic change) |
| `refactor` | Code restructuring (no behavior change) |
| `perf` | Performance improvement |
| `test` | Adding or updating tests |
| `build` | Build system or dependency changes |
| `ci` | CI/CD pipeline changes |
| `chore` | Maintenance tasks |

### Commit Process

1. **Analyze Changes**
   ```bash
   git diff --staged
   git diff HEAD
   ```

2. **Determine Semantic Type**
   - Review changed files
   - Identify primary purpose
   - Choose appropriate prefix

3. **Generate Commit Message**
   - Subject: Concise (50 chars max)
   - Body: Explain WHY, not WHAT
   - Focus on user impact

4. **Stage Files**
   ```bash
   git add <files>
   ```

5. **Create Commit with HEREDOC**
   ```bash
   git commit -m "$(cat <<'EOF'
   feat(locator): Add postal code search for DACH region

   Implements postal code database lookup for Germany, Austria, and Switzerland.
   Improves user experience by allowing ZIP code-based venue search.

   🤖 Generated with [Claude Code](https://claude.com/claude-code)

   Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
   EOF
   )"
   ```

### Pass Criteria
- Commit created successfully
- Message follows semantic format
- Includes Claude Code footer
- Git log shows commit

---

## Phase 3: Push to Remote

**Goal:** Push commits to GitHub and trigger deployment workflows

### Push Commands

```bash
# Push to main branch
git push origin main

# Verify push succeeded
git status
```

### Verification Steps

1. **Check Push Success**
   - Command exits with code 0
   - Git status shows "up to date with origin/main"

2. **Confirm Remote State**
   ```bash
   git log origin/main -1
   ```
   - Latest commit matches local HEAD

### Pass Criteria
- Push completes without errors
- Remote matches local state
- No merge conflicts

---

## Phase 4: GitHub Actions Monitoring

**Goal:** Track deployment workflow execution in real-time

### GitHub CLI Commands

#### 1. Get Latest Workflow Run
```bash
gh run list --workflow=deploy.yml --limit 1 --json databaseId,status,conclusion,displayTitle
```

Output format:
```json
[
  {
    "conclusion": null,
    "databaseId": 12345678,
    "displayTitle": "feat(locator): Add postal code search",
    "status": "in_progress"
  }
]
```

#### 2. Watch Workflow Execution
```bash
gh run watch --exit-status
```
- Streams live logs
- Exits with 0 on success, non-zero on failure
- Auto-detects latest run

#### 3. View Failure Logs (if needed)
```bash
gh run view <run-id> --log-failed
```
- Shows only failed job logs
- Useful for debugging

### Status Monitoring

**Possible Statuses:**
- `queued` - Waiting to start
- `in_progress` - Currently running
- `completed` - Finished

**Possible Conclusions:**
- `success` - All jobs passed
- `failure` - One or more jobs failed
- `cancelled` - Manually cancelled
- `skipped` - Workflow skipped

### Timeout Configuration
- Maximum wait time: **10 minutes**
- Poll interval: 5 seconds (handled by `gh run watch`)

### Pass Criteria
- Workflow status: `completed`
- Conclusion: `success`
- No failed jobs

---

## Phase 5: Deployment Verification

**Goal:** Confirm deployment completed and is accessible

### GitHub Pages Verification

#### 1. Check Deployment Status
```bash
gh run list --workflow=deploy.yml --limit 1 --json conclusion
```
Expected: `"conclusion": "success"`

#### 2. Wait for GitHub Pages
- Allow 30-60 seconds for CDN propagation
- GitHub Pages updates may lag workflow completion

#### 3. HTTP Health Check
```bash
curl -I https://cjplanted.github.io/planted-homepage-cleanup/ch-de/
```

Expected response:
```
HTTP/2 200
content-type: text/html
```

### Firebase Verification

#### 1. Deploy Functions
```bash
cd planted-availability-db && firebase deploy --only functions
```

#### 2. Run Smoke Tests
```bash
cd planted-availability-db && npm run smoke-test
```
- Tests critical endpoints
- Verifies functions deployed correctly

### Pass Criteria
- HTTP 200 from deployment URL
- No 404 or 5xx errors
- Firebase functions respond correctly
- Smoke tests pass

---

## Phase 6: Post-Deploy Verification

**Goal:** Deep verification using Chrome DevTools MCP

### Prerequisites
- Chrome debug mode running (`scripts\chrome-debug.bat`)
- MCP server connected (`/mcp` shows `chrome-devtools: connected`)

### MCP-Based Verification

#### 1. Navigate and Screenshot
```javascript
// MCP tool calls
navigate_page("https://cjplanted.github.io/planted-homepage-cleanup/ch-de/")
wait_for("main", 5000)
take_screenshot()
```

#### 2. Console Error Check
```javascript
list_console_messages()
```

Filter for:
- **Critical:** JavaScript exceptions, uncaught errors
- **Warnings:** Deprecation notices
- **Network:** Failed requests (4xx, 5xx)

#### 3. Network Request Audit
```javascript
list_network_requests()
```

Check for:
- Failed API calls
- Slow requests (>3s)
- Missing resources (404s)

#### 4. Visual Verification
- Page renders correctly
- No broken images
- CSS loads properly
- Layout intact

### Pass Criteria
- No critical console errors
- No failed network requests (excluding third-party)
- Page renders correctly
- Screenshot shows expected state

---

## Complete Workflow Example

### GitHub Pages Deployment

```bash
# Phase 1: Pre-commit verification
cd planted-astro && pnpm build
cd planted-astro && npx tsc --noEmit
git status

# Phase 2: Commit creation
git add .
git commit -m "$(cat <<'EOF'
feat(homepage): Update hero section copy

Refines messaging to emphasize sustainability and taste.
Aligns with brand voice guidelines.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"

# Phase 3: Push to remote
git push origin main

# Phase 4: Monitor GitHub Actions
gh run watch --exit-status

# Phase 5: Deployment verification
sleep 30
curl -I https://cjplanted.github.io/planted-homepage-cleanup/ch-de/

# Phase 6: Post-deploy verification (using MCP)
# Navigate, screenshot, check console errors
```

### Firebase Deployment

```bash
# Phase 1: Pre-commit verification
cd planted-availability-db && pnpm build

# Phase 2-3: Commit and push (same as above)

# Phase 4: Firebase deploy
cd planted-availability-db
firebase deploy --only functions

# Phase 5: Smoke tests
npm run smoke-test

# Phase 6: API health check
curl https://us-central1-planted-dev.cloudfunctions.net/api/health
```

---

## Rollback Procedures

See `ROLLBACK-GUIDE.md` for detailed recovery steps.

### Quick Rollback (GitHub Pages)

```bash
# Revert last commit
git revert HEAD --no-edit
git push origin main

# Watch rollback deployment
gh run watch --exit-status
```

### Quick Rollback (Firebase)

```bash
# Redeploy previous version
firebase deploy --only functions

# Or use Firebase Console to roll back specific functions
```

---

## Error Handling

### Build Failures (Phase 1)
- **Action:** Fix build errors, re-run verification
- **Do NOT proceed** to commit if build fails

### Push Failures (Phase 3)
- **Common cause:** Merge conflicts, network issues
- **Action:** Pull latest changes, resolve conflicts, retry push

### GitHub Actions Failures (Phase 4)
- **Action:** View logs with `gh run view <id> --log-failed`
- **Decision:** Fix issue and revert, or fix issue and push new commit

### Deployment Failures (Phase 5)
- **Action:** Check GitHub Pages status, verify CDN propagation
- **Timeout:** If >10 min, investigate workflow logs

### Post-Deploy Errors (Phase 6)
- **Action:** If critical errors found, perform rollback
- **Otherwise:** Create bug fix commit

---

## Testing This Skill

See `TESTING-MANUAL.md` for comprehensive test cases including:
- TC-CD-001 through TC-CD-010 (all phases)
- Recursive self-test (5 deployment cycles)

---

## Key Commands Reference

### Git Commands
```bash
git status                          # Check working tree
git add <files>                     # Stage changes
git commit -m "message"             # Create commit
git push origin main                # Push to remote
git log -1                          # View last commit
git revert HEAD --no-edit           # Revert last commit
```

### GitHub CLI Commands
```bash
gh run list --workflow=deploy.yml --limit 1       # Latest run
gh run watch --exit-status                        # Watch execution
gh run view <id> --log-failed                     # View failure logs
gh workflow run deploy.yml                        # Manual trigger
```

### Build Commands
```bash
# Astro
cd planted-astro && pnpm build
cd planted-astro && npx tsc --noEmit

# Firebase
cd planted-availability-db && pnpm build
cd planted-availability-db && firebase deploy --only functions
```

### Verification Commands
```bash
# HTTP health check
curl -I https://cjplanted.github.io/planted-homepage-cleanup/ch-de/

# Chrome debug mode
scripts\chrome-debug.bat

# MCP status
/mcp
```

---

## Reference Documents

- `TESTING-MANUAL.md` - Test case library
- `TEST-REPORT-TEMPLATE.md` - Report format
- `ROLLBACK-GUIDE.md` - Recovery procedures
- `CLAUDE.md` (root) - Project instructions
- `planted-availability-db/CLAUDE.md` - Git commit policy

---

## Success Criteria Summary

A deployment is considered successful when:
- ✅ All builds pass (Phase 1)
- ✅ Semantic commit created (Phase 2)
- ✅ Push succeeds (Phase 3)
- ✅ GitHub Actions completes with success (Phase 4)
- ✅ HTTP 200 from deployment URL (Phase 5)
- ✅ No critical console/network errors (Phase 6)

If any phase fails, follow error handling procedures or rollback.
