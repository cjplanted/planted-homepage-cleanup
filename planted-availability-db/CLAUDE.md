# Claude Code Instructions

Project-specific instructions for Claude Code when working on the Planted Availability Database.

## Git Commit Policy

**Commit frequently** - Do not accumulate large amounts of uncommitted changes.

### When to Commit

1. **After completing each feature or task** - Don't wait until everything is done
2. **After fixing a bug** - Commit the fix immediately
3. **After updating documentation** - Commit docs separately from code
4. **After adding new files** - Especially new packages or modules
5. **Before switching to a different task** - Ensure current work is saved

### Commit Message Format

Use semantic commit prefixes:

```
feat:     New features (feat(scope): description)
fix:      Bug fixes
docs:     Documentation only
chore:    Maintenance, config, dependencies
refactor: Code restructuring without behavior change
test:     Adding or updating tests
style:    Formatting, whitespace (no code change)
perf:     Performance improvements
```

### Commit Grouping

- **One commit per logical unit of work**
- Group related changes together (e.g., all API endpoints for a feature)
- Separate concerns: code vs docs vs config
- Keep commits atomic and reviewable

### Example Workflow

```
1. Implement feature X API endpoints → commit
2. Add feature X frontend components → commit
3. Update documentation for feature X → commit
4. Fix bug discovered during testing → commit
```

## Project Structure

This is a monorepo with the following packages:

- `packages/core` - Shared types and utilities
- `packages/database` - Firestore collections
- `packages/api` - Firebase Cloud Functions
- `packages/scrapers` - Discovery agents
- `packages/admin-dashboard` - Legacy admin UI (v1)
- `packages/admin-dashboard-v2` - New workflow-focused admin UI
- `packages/client-sdk` - Public SDK

## Development Commands

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run admin dashboard v2
cd packages/admin-dashboard-v2 && pnpm dev

# Deploy functions
firebase deploy --only functions
```

## Documentation

When making significant changes, update:

- `TECHNICAL-DOCUMENTATION.md` - Architecture and API reference
- `USER-GUIDE.md` - User-facing instructions
- `README.md` - Project overview
- Package-specific READMEs as needed
