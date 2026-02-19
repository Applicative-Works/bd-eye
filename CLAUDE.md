# bd-eye

Kanban board for beads issue tracker, backed by Dolt databases.

## Stack
- Frontend: Preact + signals, hash router, Vite dev server (port 5174)
- Backend: Hono, Dolt via mysql2/promise (port 3307)
- Tests: Vitest

## Beads workflow

When working on a beads issue:

1. `bd update <id> --status=in_progress` before starting work
2. Commit code with a meaningful message
3. Record the commit hash on the issue:
   ```bash
   HASH=$(git rev-parse --short HEAD)
   bd update <id> --metadata "{\"commits\":[\"$HASH\"]}"
   ```
   If the issue already has commits in metadata, append to the array rather than replacing it.
4. `bd close <id>` when done
5. `bd export && bd sync` to update the JSONL and sync

## Dev commands
- `npm test` — run all tests
- `DOLT_PORT=3307 npm run dev` — start dev server
- `mysql -h 127.0.0.1 -P 3307 -u root` — query dolt directly
