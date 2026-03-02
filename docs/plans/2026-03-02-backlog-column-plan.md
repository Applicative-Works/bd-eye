# Backlog Column Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Backlog column to the Kanban board that shows tickets with a `backlog` label or future `defer_until` date, with drag-to-defer and graduated defer visual nudge.

**Architecture:** Pure frontend column routing (no new status values). Backend gets two new label CRUD endpoints. Cards with expired defer dates get an amber visual nudge.

**Tech Stack:** Hono (backend), Preact + dnd-kit (frontend), Vitest (tests), mysql2/promise (db)

---

### Task 1: Add `addLabel` and `removeLabel` to Db typedef

**Files:**
- Modify: `src/server/db.js:36-50` (Db typedef)

**Step 1: Add methods to Db typedef**

Add after `updateIssueAssignee` in the typedef:

```js
 *   addLabel: (issueId: string, label: string) => Promise<void>
 *   removeLabel: (issueId: string, label: string) => Promise<void>
```

**Step 2: Commit**

```bash
git add src/server/db.js
git commit -m "Add addLabel and removeLabel to Db typedef"
```

---

### Task 2: Implement `addLabel` and `removeLabel` in db-dolt.js

**Files:**
- Modify: `src/server/db-dolt.js:89-107` (before `close`)
- Test: `tests/db-dolt.test.js`

**Step 1: Write failing tests**

Add to `tests/db-dolt.test.js` inside the top-level describe, after the `close` describe block:

```js
  describe('addLabel', () => {
    it('executes INSERT IGNORE into labels', async () => {
      await db.addLabel('i-1', 'backlog')
      const [sql, params] = mockQuery.mock.calls.at(-1)
      expect(sql).toMatch(/INSERT IGNORE INTO labels/)
      expect(params).toEqual(['i-1', 'backlog'])
    })
  })

  describe('removeLabel', () => {
    it('executes DELETE from labels', async () => {
      await db.removeLabel('i-1', 'backlog')
      const [sql, params] = mockQuery.mock.calls.at(-1)
      expect(sql).toMatch(/DELETE FROM labels/)
      expect(params).toEqual(['i-1', 'backlog'])
    })
  })
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- tests/db-dolt.test.js`
Expected: FAIL — `db.addLabel is not a function`

**Step 3: Implement in db-dolt.js**

Add before the `close` method (before line 107):

```js
    addLabel: async (issueId, label) => {
      await pool.query('INSERT IGNORE INTO labels (issue_id, label) VALUES (?, ?)', [issueId, label])
    },

    removeLabel: async (issueId, label) => {
      await pool.query('DELETE FROM labels WHERE issue_id = ? AND label = ?', [issueId, label])
    },
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- tests/db-dolt.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/db-dolt.js tests/db-dolt.test.js
git commit -m "Implement addLabel and removeLabel in db-dolt"
```

---

### Task 3: Add label CRUD route endpoints

**Files:**
- Modify: `src/server/routes/issues.js:128-132` (before health endpoint)
- Test: `tests/routes-issues.test.js`

**Step 1: Write failing tests**

Add `addLabel` and `removeLabel` stubs to the mock `db` object in `tests/routes-issues.test.js` (around line 53):

```js
  addLabel: vi.fn(),
  removeLabel: vi.fn(),
```

Add a `post` helper after the existing `patch` helper (around line 248):

```js
const post = async (path, body) => {
  const res = await app.request(`/api/projects/testdb${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  return { status: res.status, body: await res.json() }
}

const del = async (path) => {
  const res = await app.request(`/api/projects/testdb${path}`, { method: 'DELETE' })
  return { status: res.status, body: await res.json() }
}
```

Add test describes at the end:

```js
describe('POST /issues/:id/labels', () => {
  it('adds a label and returns ok', async () => {
    const { status, body } = await post('/issues/issue-1/labels', { label: 'backlog' })
    expect(status).toBe(200)
    expect(body).toEqual({ ok: true })
    expect(db.addLabel).toHaveBeenCalledWith('issue-1', 'backlog')
  })

  it('returns 404 for non-existent issue', async () => {
    const { status, body } = await post('/issues/nonexistent/labels', { label: 'backlog' })
    expect(status).toBe(404)
    expect(body.error).toBe('Not found')
  })

  it('returns 400 when label is missing', async () => {
    const { status, body } = await post('/issues/issue-1/labels', {})
    expect(status).toBe(400)
    expect(body.error).toBe('Invalid label')
  })
})

describe('DELETE /issues/:id/labels/:label', () => {
  it('removes a label and returns ok', async () => {
    const { status, body } = await del('/issues/issue-1/labels/backlog')
    expect(status).toBe(200)
    expect(body).toEqual({ ok: true })
    expect(db.removeLabel).toHaveBeenCalledWith('issue-1', 'backlog')
  })

  it('returns 404 for non-existent issue', async () => {
    const { status, body } = await del('/issues/nonexistent/labels/backlog')
    expect(status).toBe(404)
    expect(body.error).toBe('Not found')
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- tests/routes-issues.test.js`
Expected: FAIL — 404 (routes don't exist yet)

**Step 3: Implement route endpoints**

Add in `src/server/routes/issues.js` before the `router.get('/health', ...)` line:

```js
  router.post('/issues/:id/labels', async (c) => {
    const db = /** @type {import('../db.js').Db} */ (c.get('db'))
    const id = c.req.param('id')
    const { label } = await c.req.json()
    if (!label || typeof label !== 'string') return c.json({ error: 'Invalid label' }, 400)
    const issue = await db.issueById(id)
    if (!issue) return c.json({ error: 'Not found' }, 404)
    await db.addLabel(id, label)
    return c.json({ ok: true })
  })

  router.delete('/issues/:id/labels/:label', async (c) => {
    const db = /** @type {import('../db.js').Db} */ (c.get('db'))
    const id = c.req.param('id')
    const label = c.req.param('label')
    const issue = await db.issueById(id)
    if (!issue) return c.json({ error: 'Not found' }, 404)
    await db.removeLabel(id, label)
    return c.json({ ok: true })
  })
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- tests/routes-issues.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/routes/issues.js tests/routes-issues.test.js
git commit -m "Add POST/DELETE label endpoints"
```

---

### Task 4: Add Backlog column routing in Board.jsx

**Files:**
- Modify: `src/client/components/Board.jsx:49-53` (COLUMNS), `Board.jsx:170-180` (column routing)
- Test: `tests/client/Board.test.jsx`

**Step 1: Write failing tests**

In `tests/client/Board.test.jsx`, update `columnSortOrdersSignal` initial value (line 9) to include backlog:

```js
const columnSortOrdersSignal = signal({ backlog: 'priority', open: 'priority', in_progress: 'priority', closed: 'priority' })
```

And the `beforeEach` reset (line 104):

```js
columnSortOrdersSignal.value = { backlog: 'priority', open: 'priority', in_progress: 'priority', closed: 'priority' }
```

Add test cases after the `priority sorting` describe:

```js
describe('backlog column', () => {
  test('renders backlog column', () => {
    render(<Board />)
    expect(screen.getByTestId('column-backlog')).toBeInTheDocument()
  })

  test('routes issue with backlog label to backlog column', () => {
    useIssues.mockImplementation((endpoint) => {
      if (endpoint === '/issues') {
        return {
          issues: [
            { id: 'B-1', title: 'Backlogged', status: 'open', priority: 2, issue_type: 'task', assignee: null, labels: ['backlog'], created_at: '2025-01-01T00:00:00Z' },
            { id: 'B-2', title: 'Active', status: 'open', priority: 1, issue_type: 'task', assignee: null, labels: [], created_at: '2025-01-01T00:00:00Z' },
          ],
          loading: false, refetch: vi.fn()
        }
      }
      return { issues: [], loading: false, refetch: vi.fn() }
    })
    render(<Board />)
    expect(screen.getByTestId('column-backlog')).toHaveTextContent('Backlogged')
    expect(screen.getByTestId('column-open')).toHaveTextContent('Active')
    expect(screen.getByTestId('column-open')).not.toHaveTextContent('Backlogged')
  })

  test('routes issue with future defer_until to backlog column', () => {
    const futureDate = new Date(Date.now() + 7 * 86400000).toISOString()
    useIssues.mockImplementation((endpoint) => {
      if (endpoint === '/issues') {
        return {
          issues: [
            { id: 'D-1', title: 'Deferred', status: 'open', priority: 2, issue_type: 'task', assignee: null, labels: [], defer_until: futureDate, created_at: '2025-01-01T00:00:00Z' },
          ],
          loading: false, refetch: vi.fn()
        }
      }
      return { issues: [], loading: false, refetch: vi.fn() }
    })
    render(<Board />)
    expect(screen.getByTestId('column-backlog')).toHaveTextContent('Deferred')
    expect(screen.getByTestId('column-open')).not.toHaveTextContent('Deferred')
  })

  test('routes issue with expired defer_until to backlog column (graduated)', () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString()
    useIssues.mockImplementation((endpoint) => {
      if (endpoint === '/issues') {
        return {
          issues: [
            { id: 'D-2', title: 'Graduated', status: 'open', priority: 2, issue_type: 'task', assignee: null, labels: ['backlog'], defer_until: pastDate, created_at: '2025-01-01T00:00:00Z' },
          ],
          loading: false, refetch: vi.fn()
        }
      }
      return { issues: [], loading: false, refetch: vi.fn() }
    })
    render(<Board />)
    expect(screen.getByTestId('column-backlog')).toHaveTextContent('Graduated')
  })

  test('issue with only expired defer_until and no backlog label goes to open', () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString()
    useIssues.mockImplementation((endpoint) => {
      if (endpoint === '/issues') {
        return {
          issues: [
            { id: 'D-3', title: 'Expired no label', status: 'open', priority: 2, issue_type: 'task', assignee: null, labels: [], defer_until: pastDate, created_at: '2025-01-01T00:00:00Z' },
          ],
          loading: false, refetch: vi.fn()
        }
      }
      return { issues: [], loading: false, refetch: vi.fn() }
    })
    render(<Board />)
    expect(screen.getByTestId('column-open')).toHaveTextContent('Expired no label')
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- tests/client/Board.test.jsx`
Expected: FAIL — no `column-backlog` testid

**Step 3: Implement column routing**

In `src/client/components/Board.jsx`, update `COLUMNS` (line 49):

```js
const COLUMNS = [
  { key: 'backlog', label: 'Backlog' },
  { key: 'open', label: 'Open' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'closed', label: 'Closed' }
]
```

Add a routing helper after the COLUMNS definition:

```js
const isBacklogged = (issue) => {
  if (issue.status !== 'open') return false
  if ((issue.labels ?? []).includes('backlog')) return true
  if (issue.defer_until && new Date(issue.defer_until) > new Date()) return true
  return false
}

const columnFor = (issue) => {
  const status = issue._effectiveStatus ?? issue.status
  if (status === 'open') return isBacklogged(issue) ? 'backlog' : 'open'
  return status
}
```

Replace the column routing logic (around line 173-180). Change:

```js
  const sorted = Object.fromEntries(
    COLUMNS.map(col => [
      col.key,
      filtered
        .filter(i => effectiveStatus(i) === col.key)
        .sort(SORT_COMPARATORS[sortOrders[col.key]] || SORT_COMPARATORS.priority)
    ])
  )
```

To:

```js
  const withEffective = filtered.map(i => ({ ...i, _effectiveStatus: effectiveStatus(i) }))
  const sorted = Object.fromEntries(
    COLUMNS.map(col => [
      col.key,
      withEffective
        .filter(i => columnFor(i) === col.key)
        .sort(SORT_COMPARATORS[sortOrders[col.key]] || SORT_COMPARATORS.priority)
    ])
  )
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- tests/client/Board.test.jsx`
Expected: PASS

**Step 5: Update existing tests that check column count/headers**

The test `'renders three columns'` (line 122) now needs to check for four columns. Update:

```js
  test('renders four columns', () => {
    render(<Board />)
    expect(screen.getByTestId('column-backlog')).toBeInTheDocument()
    expect(screen.getByTestId('column-open')).toBeInTheDocument()
    expect(screen.getByTestId('column-in_progress')).toBeInTheDocument()
    expect(screen.getByTestId('column-closed')).toBeInTheDocument()
  })
```

The test `'column headers in swimlane mode'` (line 427) needs updating:

```js
    const headers = [...container.querySelectorAll('.swim-col-label')].map(h => h.textContent)
    expect(headers).toEqual(['Backlog', 'Open', 'In Progress', 'Closed'])
```

The sort control test (line 281) needs a backlog entry:

```js
  test('renders sort control for each column', () => {
    render(<Board />)
    expect(screen.getByTestId('sort-control-backlog')).toBeInTheDocument()
    expect(screen.getByTestId('sort-control-open')).toBeInTheDocument()
    expect(screen.getByTestId('sort-control-in_progress')).toBeInTheDocument()
    expect(screen.getByTestId('sort-control-closed')).toBeInTheDocument()
  })
```

**Step 6: Run full test suite**

Run: `npm test`
Expected: PASS

**Step 7: Commit**

```bash
git add src/client/components/Board.jsx tests/client/Board.test.jsx
git commit -m "Add Backlog column with label and defer routing"
```

---

### Task 5: Update drag handler for backlog transitions

**Files:**
- Modify: `src/client/components/Board.jsx:199-240` (handleDragEnd)
- Test: `tests/client/Board.test.jsx`

**Step 1: Write failing tests**

Add to the `'drag and drop handlers'` describe in `tests/client/Board.test.jsx`:

```js
  test('drag to backlog adds backlog label via POST', async () => {
    render(<Board />)
    await act(async () => capturedDndProps.onDragEnd({ active: { id: 'P-1' }, over: { id: 'backlog' } }))
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/projects/test-project/issues/P-1/labels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'backlog' })
    })
  })

  test('drag from backlog to open removes backlog label via DELETE', async () => {
    useIssues.mockImplementation((endpoint) => {
      if (endpoint === '/issues') {
        return {
          issues: [
            { id: 'BL-1', title: 'Backlogged item', status: 'open', priority: 2, issue_type: 'task', assignee: null, labels: ['backlog'], created_at: '2025-01-01T00:00:00Z' },
          ],
          loading: false, refetch: vi.fn()
        }
      }
      return { issues: [], loading: false, refetch: vi.fn() }
    })
    render(<Board />)
    await act(async () => capturedDndProps.onDragEnd({ active: { id: 'BL-1' }, over: { id: 'open' } }))
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/projects/test-project/issues/BL-1/labels/backlog', {
      method: 'DELETE',
    })
  })

  test('drag from backlog to in_progress removes label and patches status', async () => {
    useIssues.mockImplementation((endpoint) => {
      if (endpoint === '/issues') {
        return {
          issues: [
            { id: 'BL-2', title: 'Backlogged item', status: 'open', priority: 2, issue_type: 'task', assignee: null, labels: ['backlog'], created_at: '2025-01-01T00:00:00Z' },
          ],
          loading: false, refetch: vi.fn()
        }
      }
      return { issues: [], loading: false, refetch: vi.fn() }
    })
    render(<Board />)
    await act(async () => capturedDndProps.onDragEnd({ active: { id: 'BL-2' }, over: { id: 'in_progress' } }))
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/projects/test-project/issues/BL-2/labels/backlog', {
      method: 'DELETE',
    })
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/projects/test-project/issues/BL-2/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress' })
    })
  })
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- tests/client/Board.test.jsx`
Expected: FAIL — fetch not called with label endpoints

**Step 3: Update handleDragEnd**

Replace `handleDragEnd` in Board.jsx (the function starting around line 203). The key change is branching based on whether the drag involves the backlog column:

```js
  const handleDragEnd = async ({ active, over }) => {
    setActiveId(null)

    if (!over) return

    const issueId = active.id
    const newColumn = over.id
    const issue = enriched.find(i => i.id === issueId)
    if (!issue) return

    const currentColumn = columnFor({ ...issue, _effectiveStatus: optimisticMoves.get(issueId) ?? issue.status })
    if (currentColumn === newColumn) return

    setOptimisticMoves(prev => {
      const next = new Map(prev)
      next.set(issueId, newColumn === 'backlog' ? 'open' : newColumn)
      return next
    })

    try {
      const fromBacklog = currentColumn === 'backlog'
      const toBacklog = newColumn === 'backlog'
      const hasBacklogLabel = (issue.labels ?? []).includes('backlog')

      if (toBacklog) {
        const res = await fetch(apiUrl(`/issues/${issueId}/labels`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label: 'backlog' })
        })
        if (!res.ok) throw new Error('Update failed')
      } else if (fromBacklog) {
        if (hasBacklogLabel) {
          await fetch(apiUrl(`/issues/${issueId}/labels/backlog`), { method: 'DELETE' })
        }
        if (newColumn !== 'open') {
          const res = await fetch(apiUrl(`/issues/${issueId}/status`), {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newColumn })
          })
          if (!res.ok) throw new Error('Update failed')
        }
      } else {
        const res = await fetch(apiUrl(`/issues/${issueId}/status`), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newColumn })
        })
        if (!res.ok) throw new Error('Update failed')
      }
    } catch {
      setOptimisticMoves(prev => {
        const next = new Map(prev)
        next.delete(issueId)
        return next
      })
    }

    setTimeout(() => {
      setOptimisticMoves(prev => {
        const next = new Map(prev)
        next.delete(issueId)
        return next
      })
    }, 5000)
  }
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- tests/client/Board.test.jsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/client/components/Board.jsx tests/client/Board.test.jsx
git commit -m "Update drag handler for backlog transitions"
```

---

### Task 6: Add graduated defer visual nudge to Card

**Files:**
- Modify: `src/client/components/Card.jsx:23,81-85` (CardIssue typedef, card class)
- Modify: `src/styles/variables.css` (new colour variables)
- Modify: `src/styles/main.css` (new card-deferred-expired class)
- Test: `tests/client/Card.test.jsx`

**Step 1: Write failing tests**

Add to `tests/client/Card.test.jsx`:

```js
  test('has card-defer-expired class when defer_until is in the past', () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString()
    const { container } = render(<Card issue={issueWith({ defer_until: pastDate })} />)
    expect(container.firstChild).toHaveClass('card-defer-expired')
  })

  test('does not have card-defer-expired class when defer_until is in the future', () => {
    const futureDate = new Date(Date.now() + 7 * 86400000).toISOString()
    const { container } = render(<Card issue={issueWith({ defer_until: futureDate })} />)
    expect(container.firstChild).not.toHaveClass('card-defer-expired')
  })

  test('does not have card-defer-expired class when no defer_until', () => {
    const { container } = render(<Card issue={baseIssue} />)
    expect(container.firstChild).not.toHaveClass('card-defer-expired')
  })

  test('shows defer expired tooltip when defer_until is in the past', () => {
    const pastDate = new Date('2026-02-15T00:00:00Z').toISOString()
    const { container } = render(<Card issue={issueWith({ defer_until: pastDate })} />)
    expect(container.firstChild.getAttribute('title')).toMatch(/Deferred until.*expired/)
  })
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- tests/client/Card.test.jsx`
Expected: FAIL — no `card-defer-expired` class

**Step 3: Add `defer_until` to CardIssue typedef**

In `src/client/components/Card.jsx`, add to the typedef (around line 22):

```js
 *   defer_until?: string | null
```

**Step 4: Add defer expired logic to card class and title**

In Card.jsx, add after the `const tier = ...` line (around line 79):

```js
  const deferExpired = issue.defer_until && new Date(issue.defer_until) < new Date()
```

Update the cardClass construction (around line 81):

```js
  const cardClass = [
    'card',
    blocked_by_count > 0 ? 'card-blocked' : status === 'open' && blocked_by_count === 0 ? 'card-ready' : '',
    isDragging ? 'card-dragging' : '',
    deferExpired ? 'card-defer-expired' : '',
  ].filter(Boolean).join(' ');
```

Add a title attribute to the card div (the opening `<div` around line 94). Add to the props:

```js
      title={deferExpired ? `Deferred until ${new Date(issue.defer_until).toLocaleDateString()} — expired` : undefined}
```

**Step 5: Add CSS**

In `src/styles/variables.css`, add after the ready colour variables:

```css
  --color-defer-expired-bg: #3d2e08;
  --color-defer-expired-border: #d97706;
```

In `src/styles/main.css`, add after `.card-ready`:

```css
.card-defer-expired {
  border-left: 3px solid var(--color-defer-expired-border);
  background: linear-gradient(
    90deg,
    var(--color-defer-expired-bg) 0%,
    transparent 30%
  );
}
```

**Step 6: Run tests to verify they pass**

Run: `npm test -- tests/client/Card.test.jsx`
Expected: PASS

**Step 7: Run full test suite**

Run: `npm test`
Expected: PASS

**Step 8: Commit**

```bash
git add src/client/components/Card.jsx src/styles/variables.css src/styles/main.css tests/client/Card.test.jsx
git commit -m "Add graduated defer visual nudge on cards"
```

---

### Task 7: Update state.js default sort orders

**Files:**
- Modify: `src/client/state.js`

**Step 1: Check and update columnSortOrders default**

The `columnSortOrders` signal needs a `backlog` key. Find the signal initialisation in `src/client/state.js` and add `backlog: 'priority'` to the default object.

**Step 2: Run full test suite**

Run: `npm test`
Expected: PASS

**Step 3: Commit**

```bash
git add src/client/state.js
git commit -m "Add backlog to default column sort orders"
```

---

### Task 8: Close beads issues

**Step 1: Close completed beads**

```bash
bd close bd-eye-89m bd-eye-xxz bd-eye-ncp
```

**Step 2: Final test run**

Run: `npm test`
Expected: PASS — all tests green

**Step 3: Push**

```bash
git push
```
