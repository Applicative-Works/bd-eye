# bd-eye

Kanban board for beads issue tracker, backed by Dolt databases.

## Stack
- Frontend: Preact + signals, hash router, Vite dev server (port 5174)
- Backend: Hono, Dolt via mysql2/promise (port 3307)
- Tests: Vitest

## Dev commands
- `npm test` — run all tests
- `DOLT_PORT=3307 npm run dev` — start dev server
- `mysql -h 127.0.0.1 -P 3307 -u root` — query dolt directly

## Architecture

### Server (`src/server/`)
- `index.js` — Hono app, SSE broadcast, static serving
- `db.js` — Db typedef and dolt config
- `db-dolt.js` — mysql2/promise implementation of Db interface
- `db-registry.js` — multi-project connection pool (one pool per dolt database)
- `watcher.js` — polls `MAX(updated_at)` per project, fires SSE on change
- `routes/issues.js` — CRUD for issues, epics, labels, search, dependencies
- `routes/projects.js` — lists available dolt databases

### Client (`src/client/`)
- `main.jsx` — Preact entry point
- `state.js` — Preact signals for all app state (project, view, filters, sort orders, WIP limits)
- `router.js` — hash-based router with localStorage view persistence
- `projectUrl.js` — builds API URLs scoped to current project
- `hooks/` — `useIssues`, `useProjects`, `useLiveUpdates`, `useFilteredIssues`
- `components/` — App, NavBar, Board, Card, DetailPanel, ReadyQueue, EpicExplorer, DependencyGraph, ActivityFeed, ThroughputChart, SearchModal, FilterBar, SortControl, ProjectSwitcher

### Key patterns
- State is Preact signals; localStorage persistence via `signal.subscribe()`
- SSE for live updates: watcher detects changes → server broadcasts → `useLiveUpdates` refetches
- `changedIds` signal tracks which cards were updated, triggering amber flash animation
- Multi-project: dolt `--data-dir` at `~/.dolt-data`, each beads project is a separate database
- `metadata` column on issues is JSON (dolt returns parsed object, empty = `{}`)

### Tests (`tests/`)
- Server tests: `db.test.js`, `db-dolt.test.js`, `db-registry.test.js`, `watcher.test.js`, `routes-*.test.js`
- Client tests: one `*.test.jsx` per component plus `router.test.js`, `state.test.js`, hooks
- Run with `npm test` (vitest)

## Beads workflow

When working on a beads issue:

1. `bd update <id> --status=in_progress` before starting work
2. Commit code with a meaningful message
3. `bd close <id>` when done
4. `bd export && bd sync` to update the JSONL and sync

# Agent Instructions

This project uses **bd** (beads) for issue tracking. Run `bd onboard` to get started.

## Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --status in_progress  # Claim work
bd close <id>         # Complete work
bd sync               # Sync with git
```

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
