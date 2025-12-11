# Writing Documentation

Use this skill after deploying features or making significant changes to ensure documentation stays current.

## When to Use

- After deploying a new feature
- After removing/deprecating functionality
- After changing API endpoints, ports, or URLs
- After modifying package structure
- After updating workflows or processes

## Documentation Files to Update

Always check these files when making changes:

| File | Location | Contains |
|------|----------|----------|
| `USER-GUIDE.md` | `planted-availability-db/` | User-facing instructions, workflows, CLI commands |
| `TECHNICAL-DOCUMENTATION.md` | `planted-availability-db/` | Architecture, API reference, deployment info |
| `README.md` | `planted-availability-db/` | Project overview, package list, quick start |
| `CLAUDE.md` | `planted-availability-db/` | Claude Code instructions, package structure |
| `SYSTEM_OVERVIEW.md` | `planted-availability-db/` | Package status table, system components |
| `project-scope.md` | Root | Original project scope, repository structure |
| Skill files | `.claude/skills/` | Feature-specific knowledge bases |

## Documentation Checklist

### After Adding a Feature:
- [ ] Add feature description to USER-GUIDE.md (appropriate section)
- [ ] Add technical details to TECHNICAL-DOCUMENTATION.md
- [ ] Update package tables if new packages added
- [ ] Add keyboard shortcuts if applicable
- [ ] Add CLI commands if applicable
- [ ] Update relevant skills or create new skill file

### After Removing/Deprecating:
- [ ] Remove ALL references from documentation (use grep to find them)
- [ ] Update package structure diagrams
- [ ] Update package status tables
- [ ] Remove from example commands
- [ ] Clean up any "v1/v2" or "legacy" language
- [ ] Verify no broken internal references

### After Changing Configuration:
- [ ] Update port numbers everywhere (dev, prod URLs)
- [ ] Update environment variables sections
- [ ] Update deployment commands
- [ ] Update example curl/API calls

## Search Commands for Finding References

```bash
# Find all references to a term in documentation
grep -r "search-term" planted-availability-db/*.md .claude/skills/**/*.md

# Find references with context
grep -rn "search-term" --include="*.md" -B 2 -A 2

# Find files containing a pattern (useful for deprecation)
grep -l "old-pattern" planted-availability-db/*.md
```

## Common Patterns to Watch

### Version References
When removing versioned features (v1, v2, etc.):
- Remove "v1 (Legacy)" / "v2 (New)" language
- Consolidate to single current version
- Update all port references consistently
- Remove comparison tables between versions

### Package References
When modifying packages:
- Update `packages/` structure diagrams
- Update `@pad/package-name` references
- Update status tables (✅ Working, ⚠️ Partial, ❌ Not Working)
- Update filter commands (`pnpm --filter @pad/...`)

### URL/Port References
Standard ports for this project:
- Website: `localhost:4321`
- Admin Dashboard: `localhost:5173`
- Production: `https://get-planted-db.web.app`
- API: `europe-west6-get-planted-db.cloudfunctions.net`

## Verification Steps

After updating documentation:

1. **Search for orphaned references:**
   ```bash
   grep -rE "removed-feature|old-name" planted-availability-db/*.md
   ```

2. **Check git diff for completeness:**
   ```bash
   git diff --stat planted-availability-db/*.md
   ```

3. **Verify no broken links:**
   - Internal markdown links still work
   - File paths in examples exist
   - URLs are current

## Example: Feature Deployment Documentation Update

After deploying "Chain Assignment" feature:

1. USER-GUIDE.md: Add to Review Queue section
2. TECHNICAL-DOCUMENTATION.md: Document API endpoint
3. README.md: No changes (high-level)
4. Create skill if complex enough

## Lesson Learned

The Dashboard V1 removal (December 2024) found v1 references in **8 different files** across the codebase. Key insight: Documentation sprawl is real - a single feature can be referenced in many places. Always do a comprehensive grep search before considering documentation updates complete.

## Related Skills

- `/scraper-improvements` - Scraper-specific knowledge base
- `admin-dashboard-qa` - Dashboard testing workflow
