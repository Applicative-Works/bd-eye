import { useState } from 'preact/hooks'
import { DndContext, DragOverlay, PointerSensor, pointerWithin, useSensor, useSensors } from '@dnd-kit/core'
import { Card } from './Card.jsx'
import { DroppableColumn, DroppableCell } from './DroppableColumn.jsx'
import { FilterBar } from './FilterBar.jsx'
import { SortControl } from './SortControl.jsx'
import { selectIssue } from '../router.js'
import { useIssues } from '../hooks/useIssues.js'
import { useFilteredIssues } from '../hooks/useFilteredIssues.js'
import { apiUrl } from '../projectUrl.js'
import { closedDays, columnSortOrders, swimlaneGrouping } from '../state.js'

const RECENCY_OPTIONS = [
  { label: '1d', days: 1 },
  { label: '3d', days: 3 },
  { label: '7d', days: 7 },
  { label: 'All', days: null }
]

const closedWithinDays = (issues, days) => {
  if (days === null) return issues
  const cutoff = Date.now() - days * 86400000
  return issues.filter(i => new Date(i.closed_at).getTime() >= cutoff)
}

const ClosedRecencyToggle = () => (
  <div class="recency-toggle">
    {RECENCY_OPTIONS.map(opt => (
      <button
        key={opt.label}
        class={`recency-btn${closedDays.value === opt.days ? ' recency-btn-active' : ''}`}
        onClick={() => { closedDays.value = opt.days }}
      >
        {opt.label}
      </button>
    ))}
  </div>
)

const SORT_COMPARATORS = {
  priority: (a, b) => a.priority - b.priority || new Date(a.created_at) - new Date(b.created_at),
  age: (a, b) => new Date(a.created_at) - new Date(b.created_at),
  assignee: (a, b) => (a.assignee || '').localeCompare(b.assignee || '') || a.priority - b.priority,
  type: (a, b) => (a.issue_type || '').localeCompare(b.issue_type || '') || a.priority - b.priority,
}

const COLUMNS = [
  { key: 'open', label: 'Open' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'closed', label: 'Closed' }
]

const PRIORITY_LABELS = { 0: 'P0 — Critical', 1: 'P1 — High', 2: 'P2 — Medium', 3: 'P3 — Low', 4: 'P4 — Backlog' }
const PRIORITY_COLORS = { 0: '#ef4444', 1: '#f97316', 2: '#eab308', 3: '#22c55e', 4: '#6b7280' }

const groupKey = (issue, grouping) => {
  if (grouping === 'assignee') return issue.assignee || 'Unassigned'
  if (grouping === 'priority') return String(issue.priority ?? 4)
  if (grouping === 'type') return issue.issue_type || 'other'
  if (grouping === 'label') {
    const labels = issue.labels ?? []
    return labels.length > 0 ? labels[0] : 'Unlabelled'
  }
  return 'all'
}

const groupLabel = (key, grouping) => {
  if (grouping === 'priority') return PRIORITY_LABELS[key] || `P${key}`
  if (grouping === 'assignee' && key === 'Unassigned') return 'Unassigned'
  if (grouping === 'label' && key === 'Unlabelled') return 'Unlabelled'
  return key
}

const sortGroupKeys = (keys, grouping) => {
  const sentinel = grouping === 'assignee' ? 'Unassigned'
    : grouping === 'label' ? 'Unlabelled'
    : null
  return [...keys].sort((a, b) => {
    if (a === sentinel) return 1
    if (b === sentinel) return -1
    if (grouping === 'priority') return Number(a) - Number(b)
    return a.localeCompare(b)
  })
}

const buildSwimlanes = (columnIssues, grouping) => {
  const lanes = new Map()
  for (const colKey of ['open', 'in_progress', 'closed']) {
    for (const issue of columnIssues[colKey]) {
      const gk = groupKey(issue, grouping)
      if (!lanes.has(gk)) lanes.set(gk, { open: [], in_progress: [], closed: [] })
      lanes.get(gk)[colKey].push(issue)
    }
  }
  const sortedKeys = sortGroupKeys([...lanes.keys()], grouping)
  return sortedKeys.map(k => ({ key: k, label: groupLabel(k, grouping), issues: lanes.get(k) }))
}

const SwimlaneRow = ({ lane, grouping, columns, activeId, collapsed, onToggle }) => {
  const totalCount = columns.reduce((n, col) => n + lane.issues[col.key].length, 0)
  return (
    <div class={`swim-row${collapsed ? ' swim-row-collapsed' : ''}`} role="rowgroup" aria-label={`${lane.label} — ${totalCount} issues`}>
      <div class="swim-row-header" role="rowheader" onClick={onToggle}>
        <button class="swim-chevron" aria-expanded={!collapsed} aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${lane.label} lane`}>
          {collapsed ? '▸' : '▾'}
        </button>
        <div class="swim-row-label">
          {grouping === 'priority' && <span class="swim-priority-dot" style={{ background: PRIORITY_COLORS[lane.key] }} />}
          <span class="swim-row-name">{lane.label}</span>
          <span class="swim-row-count">{totalCount} {totalCount === 1 ? 'issue' : 'issues'}</span>
        </div>
      </div>
      {!collapsed && columns.map(col => (
        <DroppableCell key={`${lane.key}:${col.key}`} id={col.key}>
          {lane.issues[col.key].length === 0
            ? <div class="swim-cell-empty">No issues</div>
            : lane.issues[col.key].map(issue => (
                <Card key={issue.id} issue={issue} onClick={selectIssue} isDragging={activeId === issue.id} />
              ))
          }
        </DroppableCell>
      ))}
    </div>
  )
}

export const Board = () => {
  const { issues, loading } = useIssues('/issues')
  const { issues: blockedList } = useIssues('/issues/blocked')

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const [activeId, setActiveId] = useState(null)
  const [optimisticMoves, setOptimisticMoves] = useState(new Map())
  const [collapsedLanes, setCollapsedLanes] = useState(new Set())

  const blockedMap = new Map(blockedList.map(i => [i.id, i.blocked_by_count]))

  const enriched = issues.map(i => ({
    ...i,
    blocked_by_count: blockedMap.get(i.id) ?? 0
  }))

  const filtered = useFilteredIssues(enriched)

  const effectiveStatus = (issue) => optimisticMoves.get(issue.id) ?? issue.status

  const sortOrders = columnSortOrders.value
  const sorted = Object.fromEntries(
    COLUMNS.map(col => [
      col.key,
      filtered
        .filter(i => effectiveStatus(i) === col.key)
        .sort(SORT_COMPARATORS[sortOrders[col.key]] || SORT_COMPARATORS.priority)
    ])
  )

  const grouped = {
    ...sorted,
    closed: closedWithinDays(sorted.closed, closedDays.value)
  }

  const activeIssue = activeId ? enriched.find(i => i.id === activeId) : null
  const grouping = swimlaneGrouping.value
  const lanes = grouping ? buildSwimlanes(grouped, grouping) : null

  const toggleLane = (laneKey) => {
    setCollapsedLanes(prev => {
      const next = new Set(prev)
      next.has(laneKey) ? next.delete(laneKey) : next.add(laneKey)
      return next
    })
  }

  const handleDragStart = ({ active }) => {
    setActiveId(active.id)
  }

  const handleDragEnd = async ({ active, over }) => {
    setActiveId(null)

    if (!over) return

    const issueId = active.id
    const newStatus = over.id
    const issue = enriched.find(i => i.id === issueId)
    if (!issue) return

    const currentStatus = optimisticMoves.get(issueId) ?? issue.status
    if (currentStatus === newStatus) return

    setOptimisticMoves(prev => {
      const next = new Map(prev)
      next.set(issueId, newStatus)
      return next
    })

    try {
      const res = await fetch(apiUrl(`/issues/${issueId}/status`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })
      if (!res.ok) throw new Error('Update failed')
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
    }, 3000)
  }

  const handleDragCancel = () => {
    setActiveId(null)
  }

  if (loading) return <p class="text-secondary">Loading...</p>

  const columnHeaders = (
    <div class="swim-col-headers">
      <div class="swim-row-header-spacer" />
      {COLUMNS.map(col => (
        <div key={col.key} class="swim-col-header">
          <span class="swim-col-label">{col.label}</span>
          <span class="swim-col-count">{grouped[col.key].length}</span>
          <div class="column-header-controls">
            <SortControl columnKey={col.key} sortOrders={columnSortOrders} />
            {col.key === 'closed' && <ClosedRecencyToggle />}
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <>
      <FilterBar issues={enriched} />
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {lanes ? (
          <div class="board-swimlane" role="grid" aria-label={`Kanban board grouped by ${grouping}`}>
            {columnHeaders}
            {lanes.map(lane => (
              <SwimlaneRow
                key={lane.key}
                lane={lane}
                grouping={grouping}
                columns={COLUMNS}
                activeId={activeId}
                collapsed={collapsedLanes.has(lane.key)}
                onToggle={() => toggleLane(lane.key)}
              />
            ))}
          </div>
        ) : (
          <div class="board">
            {COLUMNS.map(col => (
              <DroppableColumn
                key={col.key}
                col={col}
                count={grouped[col.key].length}
                headerExtra={
                  <div class="column-header-controls">
                    <SortControl columnKey={col.key} sortOrders={columnSortOrders} />
                    {col.key === 'closed' && <ClosedRecencyToggle />}
                  </div>
                }
              >
                {grouped[col.key].map(issue => (
                  <Card
                    key={issue.id}
                    issue={issue}
                    onClick={selectIssue}
                    isDragging={activeId === issue.id}
                  />
                ))}
              </DroppableColumn>
            ))}
          </div>
        )}
        <DragOverlay>
          {activeIssue ? (
            <div class="card-drag-overlay">
              <Card issue={activeIssue} isOverlay />
              {activeIssue.blocked_by_count > 0 && (
                <div class="drag-blocked-warning">Blocked issue</div>
              )}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </>
  )
}
