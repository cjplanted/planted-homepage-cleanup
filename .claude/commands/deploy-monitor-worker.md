---
argument-hint: --task=<status|report>
description: MONITOR-WORKER - Progress tracking and final report generation
---

# Deploy Monitor Worker - Progress Tracking

You are the MONITOR-WORKER for the deployment testing initiative.

## CRITICAL: Token Efficiency

**Focus on ONE task only.** Complete it, log result, exit.

**DO:**
- Generate concise status summary (status task)
- Generate comprehensive final report (report task)
- Read only necessary portions of progress file
- Exit immediately after

**DON'T:**
- Perform any deployments or verifications
- Modify code or configuration
- Read entire progress file unnecessarily

## Your Job

Provide status updates and generate final reports for the deployment testing process.

## Available Tasks

| Task | Description | When to Use |
|------|-------------|-------------|
| `status` | Current progress summary | On-demand status check |
| `report` | Final comprehensive report | After 5 cycles complete |

## Task: status

**Goal:** Provide a concise summary of current deployment test progress

**Workflow:**

1. **Read Progress File (first 100 lines)**
   ```bash
   Read deployTestProgress.md with limit=100
   ```

2. **Parse Current State**
   - current_cycle (1-5)
   - current_phase
   - Cycle results (PASS/FAIL/IN_PROGRESS)
   - Last error (if any)

3. **Generate Status Summary**
   Print to user:
   ```
   === Deployment Test Status ===

   Current Cycle: N/5
   Current Phase: GITHUB_VERIFYING

   Cycle Results:
   ✓ Cycle 1: PASS (2m 34s)
   ✓ Cycle 2: PASS (2m 41s)
   ⟳ Cycle 3: IN_PROGRESS
   ○ Cycle 4: PENDING
   ○ Cycle 5: PENDING

   Last Action: GitHub Actions workflow running

   Overall Progress: 2/5 cycles complete (40%)
   ```

4. **Exit**
   - Do not log to progress file (this is a read-only task)

## Task: report

**Goal:** Generate comprehensive final report after all 5 cycles complete

**Workflow:**

1. **Read Full Progress File**
   ```bash
   Read deployTestProgress.md
   ```

2. **Verify All Cycles Complete**
   - Check that cycles 1-5 all have status PASS
   - If any cycle is not PASS: report incomplete test run

3. **Calculate Metrics**

   **Overall Metrics:**
   - Total duration (start to end)
   - Average cycle duration
   - Success rate (should be 100%)
   - Total commits created: 5
   - Total deployments: 10 (5 GitHub Pages + 5 Firebase)

   **Per-Cycle Metrics:**
   - Cycle duration
   - GitHub Pages deployment time
   - Firebase deployment time
   - Commit SHA
   - Workflow run ID

   **Reliability Metrics:**
   - Number of retries (if any)
   - Number of rollbacks (if any)
   - Error types encountered
   - Recovery success rate

4. **Generate Final Report**

   Create section in deployTestProgress.md:
   ```markdown
   ## FINAL REPORT

   **Test Run Completed:** YYYY-MM-DD HH:MM:SS
   **Status:** SUCCESS ✓

   ### Summary
   - Total Cycles: 5/5 PASS
   - Total Duration: Xm Ys
   - Average Cycle Duration: Xm Ys
   - Total Deployments: 10 (5 GitHub Pages + 5 Firebase)
   - Success Rate: 100%

   ### Cycle Breakdown

   | Cycle | Status | Duration | GitHub Pages | Firebase | Commit SHA |
   |-------|--------|----------|--------------|----------|------------|
   | 1 | PASS ✓ | 2m 34s | 1m 45s | 49s | abc1234 |
   | 2 | PASS ✓ | 2m 41s | 1m 50s | 51s | def5678 |
   | 3 | PASS ✓ | 2m 38s | 1m 48s | 50s | ghi9012 |
   | 4 | PASS ✓ | 2m 45s | 1m 52s | 53s | jkl3456 |
   | 5 | PASS ✓ | 2m 39s | 1m 49s | 50s | mno7890 |

   ### Performance Analysis
   - Fastest Cycle: 3 (2m 38s)
   - Slowest Cycle: 4 (2m 45s)
   - Average GitHub Pages Deploy: 1m 49s
   - Average Firebase Deploy: 51s

   ### Reliability
   - Retries: 0
   - Rollbacks: 0
   - Errors Encountered: 0
   - Recovery Success Rate: N/A (no failures)

   ### Deployment URLs Verified
   - GitHub Pages: https://cjplanted.github.io/planted-homepage-cleanup/ch-de/
   - Firebase Functions: https://us-central1-planted-availability.cloudfunctions.net/

   ### Conclusions
   - ✓ Automated deployment pipeline is reliable
   - ✓ Both GitHub Pages and Firebase deploy successfully
   - ✓ Average deployment time: ~2m 40s per cycle
   - ✓ No manual intervention required

   ### Recommendations
   1. Deployment pipeline is production-ready
   2. Consider setting up automated monitoring
   3. Document deployment workflow for team

   ---
   **Report Generated:** YYYY-MM-DD HH:MM:SS
   ```

5. **Print Summary to User**
   ```
   === DEPLOYMENT TEST COMPLETE ===

   ✓ All 5 cycles completed successfully

   Total Duration: Xm Ys
   Average Cycle: Xm Ys
   Success Rate: 100%

   See deployTestProgress.md for full report.
   ```

6. **Exit**

## Incomplete Test Run Report

If test run is aborted or incomplete:

```markdown
## INCOMPLETE TEST RUN REPORT

**Test Run Status:** ABORTED / INCOMPLETE
**Cycles Completed:** N/5

### Summary
- Successful Cycles: N
- Failed Cycles: M
- Aborted at Cycle: X

### Failure Analysis
- Cycle X: FAIL
  - Error Type: WORKFLOW
  - Error: GitHub Actions workflow failed
  - Recovery Action: Rollback executed
  - Reason: Build error in Astro

### Recommendations
1. Fix underlying issue: <specific error>
2. Re-run deployment tests after fix
3. Review error logs in GitHub Actions

---
**Report Generated:** YYYY-MM-DD HH:MM:SS
```

## Metrics to Track

**Timing Metrics:**
- Cycle start/end timestamps
- Phase durations
- Total test run duration

**Deployment Metrics:**
- GitHub Pages deployment time
- Firebase deployment time
- Workflow execution time

**Reliability Metrics:**
- Retry attempts
- Rollback count
- Error types
- Recovery success rate

## Report Formats

**Progress Format (for status task):**
- Concise, emoji-based
- Shows current state at a glance
- Suitable for frequent checks

**Final Report Format (for report task):**
- Comprehensive markdown table
- Detailed metrics
- Analysis and recommendations
- Permanent record in progress file

## Safety Rules

1. NEVER modify progress file during status task (read-only)
2. ALWAYS verify all cycles complete before generating final report
3. ALWAYS include timestamp in reports
4. ALWAYS calculate metrics accurately
5. Include recommendations based on results

## Quick Commands

```bash
# Get current timestamp
date -u +"%Y-%m-%d %H:%M:%S"

# Count PASS cycles
grep "status: PASS" deployTestProgress.md | wc -l

# Calculate average duration
# (This would require parsing durations and doing math)
```

## Usage Examples

```bash
# Check current status
/deploy-monitor-worker --task=status

# Generate final report (after 5 cycles complete)
/deploy-monitor-worker --task=report
```

## Output Locations

- **Status Output:** Printed to user (not logged)
- **Final Report:** Appended to deployTestProgress.md
- **Report Summary:** Printed to user
