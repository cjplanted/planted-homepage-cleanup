# Commit-Deploy Testing Manual

Comprehensive test cases for the commit-deploy skill workflow.

---

## Test Case Categories

- **TC-CD-001 to TC-CD-003:** Phase 1 (Pre-commit verification)
- **TC-CD-004:** Phase 2 (Commit creation)
- **TC-CD-005:** Phase 3 (Push to remote)
- **TC-CD-006 to TC-CD-007:** Phase 4 (GitHub Actions monitoring)
- **TC-CD-008:** Phase 5 (Deployment verification)
- **TC-CD-009:** Phase 6 (Post-deploy verification)
- **TC-CD-010:** End-to-end recursive test

---

## TC-CD-001: Build Verification (Astro)

**Phase:** 1 - Pre-commit Verification
**Component:** Astro build system
**Type:** Unit test

### Preconditions
- Working directory: `planted-website/`
- Astro source files exist in `planted-astro/src/`

### Test Command
```bash
cd planted-astro && pnpm build
```

### Verification Steps
1. Command executes without errors
2. Exit code is 0
3. `dist/` directory created in `planted-astro/`
4. No build warnings related to critical issues

### Expected Result
- Build completes successfully
- Console shows: `✓ built in XXXms`
- `planted-astro/dist/` contains HTML files

### Pass Criteria
- Exit code: 0
- `dist/` directory exists and contains files
- No error messages in output

---

## TC-CD-002: TypeScript Verification

**Phase:** 1 - Pre-commit Verification
**Component:** TypeScript compiler
**Type:** Unit test

### Preconditions
- TypeScript source files in `planted-astro/src/`
- `tsconfig.json` configured

### Test Command
```bash
cd planted-astro && npx tsc --noEmit
```

### Verification Steps
1. Command runs to completion
2. No TypeScript errors reported
3. Exit code is 0

### Expected Result
- No output (silence means success)
- Zero type errors

### Pass Criteria
- Exit code: 0
- No error output
- No warnings about type issues

---

## TC-CD-003: Secrets Detection

**Phase:** 1 - Pre-commit Verification
**Component:** Git staging area
**Type:** Security check

### Preconditions
- Changes staged with `git add`

### Test Command
```bash
git diff --cached --name-only
```

### Verification Steps
1. List all staged files
2. Check for sensitive files:
   - `.env`
   - `.env.local`
   - `credentials.json`
   - `serviceAccountKey.json`
   - Files containing API keys
3. Warn user if secrets detected

### Expected Result
- No sensitive files in staging area
- If detected, block commit and warn user

### Pass Criteria
- Staged files do NOT include secret files
- User warned if secrets detected

---

## TC-CD-004: Semantic Commit Creation

**Phase:** 2 - Commit Creation
**Component:** Git commit
**Type:** Integration test

### Preconditions
- Changes staged
- Build passes
- No secrets detected

### Test Command
```bash
git commit -m "$(cat <<'EOF'
feat(test): Add test commit for verification

This is a test commit to verify semantic commit message formatting.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

### Verification Steps
1. Commit created successfully
2. Message follows semantic format: `<type>(<scope>): <subject>`
3. Includes Claude Code footer
4. Body explains WHY

### Verify Commit
```bash
git log -1 --pretty=format:"%s%n%n%b"
```

### Expected Result
```
feat(test): Add test commit for verification

This is a test commit to verify semantic commit message formatting.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

### Pass Criteria
- Commit created (exit code 0)
- Subject starts with valid type (`feat`, `fix`, etc.)
- Includes scope in parentheses
- Footer present

---

## TC-CD-005: Push to Remote

**Phase:** 3 - Push to Remote
**Component:** Git push
**Type:** Integration test

### Preconditions
- Commit created locally
- Git remote configured (origin)
- Network access to GitHub

### Test Command
```bash
git push origin main
```

### Verification Steps
1. Push completes without errors
2. Remote updated successfully
3. Local and remote in sync

### Verify Push
```bash
git status
```

Expected output:
```
On branch main
Your branch is up to date with 'origin/main'.

nothing to commit, working tree clean
```

### Expected Result
- Push succeeds
- No merge conflicts
- Remote matches local

### Pass Criteria
- Exit code: 0
- `git status` shows "up to date with origin/main"
- Latest commit on remote matches local HEAD

---

## TC-CD-006: GitHub Actions Workflow Detection

**Phase:** 4 - GitHub Actions Monitoring
**Component:** GitHub CLI
**Type:** Integration test

### Preconditions
- `gh` CLI installed and authenticated
- Push triggered workflow
- Workflow file exists: `.github/workflows/deploy.yml`

### Test Command
```bash
gh run list --workflow=deploy.yml --limit 1 --json databaseId,status,conclusion,displayTitle
```

### Verification Steps
1. Command returns JSON
2. Latest run corresponds to pushed commit
3. Status is `queued` or `in_progress`

### Expected Result
```json
[
  {
    "conclusion": null,
    "databaseId": 12345678,
    "displayTitle": "feat(test): Add test commit for verification",
    "status": "in_progress"
  }
]
```

### Pass Criteria
- Exit code: 0
- Valid JSON returned
- `displayTitle` matches commit message
- `status` is `queued` or `in_progress`

---

## TC-CD-007: GitHub Actions Workflow Completion

**Phase:** 4 - GitHub Actions Monitoring
**Component:** GitHub Actions
**Type:** Integration test

### Preconditions
- Workflow running (from TC-CD-006)

### Test Command
```bash
gh run watch --exit-status
```

### Verification Steps
1. Command streams workflow logs
2. All jobs complete successfully
3. Command exits with code 0

### Expected Result
- Live logs streamed to console
- No failed jobs
- Final status: `success`

### Pass Criteria
- Exit code: 0 (workflow succeeded)
- Conclusion: `success`
- No failed jobs in output

### Timeout
- Maximum wait: 10 minutes
- If timeout exceeded, workflow likely failed

---

## TC-CD-008: Deployment URL Health Check

**Phase:** 5 - Deployment Verification
**Component:** GitHub Pages CDN
**Type:** Integration test

### Preconditions
- GitHub Actions workflow completed successfully
- CDN propagation complete (wait 30-60s)

### Test Command
```bash
curl -I https://cjplanted.github.io/planted-homepage-cleanup/ch-de/
```

### Verification Steps
1. HTTP request succeeds
2. Response status: 200 OK
3. Content-Type: text/html

### Expected Result
```
HTTP/2 200
content-type: text/html; charset=utf-8
cache-control: max-age=600
```

### Pass Criteria
- HTTP status: 200
- No 404, 5xx errors
- Content-Type indicates HTML

---

## TC-CD-009: Post-Deploy Console Error Check

**Phase:** 6 - Post-Deploy Verification
**Component:** Chrome DevTools MCP
**Type:** Integration test

### Preconditions
- Chrome debug mode running: `scripts\chrome-debug.bat`
- MCP server connected: `/mcp` shows `chrome-devtools: connected`
- Deployment accessible (TC-CD-008 passed)

### Test Commands (via MCP)
```javascript
// Navigate to deployment
navigate_page("https://cjplanted.github.io/planted-homepage-cleanup/ch-de/")

// Wait for page load
wait_for("main", 5000)

// Capture screenshot
take_screenshot()

// Check console messages
list_console_messages()

// Check network requests
list_network_requests()
```

### Verification Steps
1. Page loads successfully
2. Screenshot shows rendered page
3. No critical console errors
4. No failed network requests (excluding third-party)

### Expected Result
- Screenshot shows homepage correctly rendered
- Console messages: Only info/debug (no errors/exceptions)
- Network requests: All 2xx or 3xx status codes

### Pass Criteria
- Page navigates without error
- Zero critical console errors (exceptions, uncaught errors)
- Zero failed API requests (4xx/5xx to own domain)
- Screenshot matches expected UI

---

## TC-CD-010: End-to-End Recursive Test (5 Cycles)

**Phase:** All phases (recursive)
**Component:** Complete workflow
**Type:** System test

### Overview
Execute 5 complete deployment cycles to verify workflow stability and reliability.

### Safe Change Location
File: `planted-astro/src/layouts/Layout.astro`

Add timestamp comment:
```html
<!-- Deploy test: cycle N, YYYY-MM-DDTHH:MM:SSZ -->
```

### Cycle Definition

For each cycle (1-5):

#### 1. Make Safe Change
```bash
# Edit Layout.astro to add/update timestamp comment
# Example: <!-- Deploy test: cycle 1, 2025-12-19T10:30:00Z -->
```

#### 2. Pre-commit Verification
```bash
cd planted-astro && pnpm build
cd planted-astro && npx tsc --noEmit
git status
```

#### 3. Commit
```bash
git add planted-astro/src/layouts/Layout.astro
git commit -m "$(cat <<'EOF'
test(deploy): Deployment test cycle N/5

Automated deployment workflow verification.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

#### 4. Push and Monitor
```bash
git push origin main
gh run watch --exit-status
```

#### 5. Verify Deployment
```bash
sleep 30
curl -I https://cjplanted.github.io/planted-homepage-cleanup/ch-de/
```

#### 6. Record Results
Update `deployTestProgress.md`:
- Cycle number
- Timestamp
- Duration
- Status (PASS/FAIL)
- Notes

### Success Criteria per Cycle
- [ ] Build succeeds
- [ ] Commit created with semantic message
- [ ] Push succeeds
- [ ] GitHub Actions workflow: `success`
- [ ] HTTP 200 from deployment URL
- [ ] Cycle duration < 5 minutes

### Overall Success
- **5/5 cycles PASS**
- No manual intervention required
- All timings within expected range

### Failure Handling
If cycle fails:
1. Analyze failure logs
2. Attempt automatic recovery (retry push, revert if needed)
3. Log failure reason
4. Decide: continue to next cycle or abort test

### Expected Cycle Duration
- Typical: 2-4 minutes per cycle
- Max acceptable: 10 minutes per cycle

### Report Format
After 5 cycles, generate report using `TEST-REPORT-TEMPLATE.md`:
- Total cycles: 5
- Passed: X
- Failed: Y
- Average duration: Z minutes
- Pass rate: X/5 (XX%)

---

## Firebase Deployment Tests

### TC-CD-011: Firebase Build Verification

**Phase:** 1 - Pre-commit Verification
**Component:** Firebase Cloud Functions build
**Type:** Unit test

### Test Command
```bash
cd planted-availability-db && pnpm build
```

### Verification Steps
1. All packages compile successfully
2. No TypeScript errors in `packages/api`
3. Cloud Functions build output in `packages/api/lib/`

### Pass Criteria
- Exit code: 0
- No compilation errors
- `lib/` directory contains compiled JS

---

### TC-CD-012: Firebase Deploy

**Phase:** 5 - Deployment Verification
**Component:** Firebase CLI
**Type:** Integration test

### Test Command
```bash
cd planted-availability-db && firebase deploy --only functions
```

### Verification Steps
1. Deploy command succeeds
2. All functions updated
3. No deployment errors

### Expected Result
```
✔ Deploy complete!

Functions deployed:
- api (us-central1)
```

### Pass Criteria
- Exit code: 0
- All functions show "deployed" status
- No warnings or errors

---

### TC-CD-013: Firebase Smoke Tests

**Phase:** 6 - Post-Deploy Verification
**Component:** Firebase Functions
**Type:** Integration test

### Test Command
```bash
cd planted-availability-db && npm run smoke-test
```

### Verification Steps
1. Health check endpoint responds
2. Critical API endpoints accessible
3. No 5xx errors

### Expected Result
```
✓ Health check: OK
✓ Nearby API: OK
✓ Venue API: OK

All smoke tests passed.
```

### Pass Criteria
- All tests pass
- No 5xx errors
- Response times < 3s

---

## Test Execution Order

### Quick Verification (Individual Phases)
1. TC-CD-001: Build check
2. TC-CD-002: TypeScript check
3. TC-CD-004: Commit creation
4. TC-CD-005: Push to remote
5. TC-CD-006: Workflow detection
6. TC-CD-007: Workflow completion
7. TC-CD-008: Deployment health check
8. TC-CD-009: Console error check

### Full System Test
- TC-CD-010: 5-cycle recursive test

### Firebase-Specific Tests
- TC-CD-011: Firebase build
- TC-CD-012: Firebase deploy
- TC-CD-013: Smoke tests

---

## Test Data and Cleanup

### Safe Test Changes
**File:** `planted-astro/src/layouts/Layout.astro`
**Change:** Add/update HTML comment with timestamp
**Rationale:** Minimal change, no functional impact, easy to identify

### Cleanup After Tests
After TC-CD-010 completes:

```bash
# Optional: Squash test commits
git rebase -i HEAD~5

# Or leave them (shows deployment history)
```

### Rollback Test
To verify rollback procedures (from `ROLLBACK-GUIDE.md`):

```bash
git revert HEAD --no-edit
git push origin main
gh run watch --exit-status
```

---

## Reporting

After executing tests, create report using `TEST-REPORT-TEMPLATE.md`.

Include:
- Test case ID and status
- Duration of each phase
- Any errors encountered
- Screenshots (for TC-CD-009)
- Final pass/fail determination
