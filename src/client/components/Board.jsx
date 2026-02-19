import { useState } from 'preact/hooks'
import { DndContext, DragOverlay, PointerSensor, pointerWithin, useSensor, useSensors } from '@dnd-kit/core'
import { Card } from './Card.jsx'
import { DroppableColumn } from './DroppableColumn.jsx'
import { FilterBar } from './FilterBar.jsx'
import { SortControl } from './SortControl.jsx'
import { selectIssue } from '../router.js'
import { useIssues } from '../hooks/useIssues.js'
import { useFilteredIssues } from '../hooks/useFilteredIssues.js'
import { closedDays, columnSortOrders } from '../state.js'

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

export const Board = () => {
  const { issues, loading } = useIssues('/api/issues')
  const { issues: blockedList } = useIssues('/api/issues/blocked')

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const [activeId, setActiveId] = useState(null)
  const [optimisticMoves, setOptimisticMoves] = useState(new Map())

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
      const res = await fetch(`/api/issues/${issueId}/status`, {
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

    // Clear optimistic state after a short delay to let SSE refresh arrive
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
