import { Card } from './Card.jsx'
import { FilterBar } from './FilterBar.jsx'
import { selectIssue } from '../router.js'
import { useIssues } from '../hooks/useIssues.js'
import { useFilteredIssues } from '../hooks/useFilteredIssues.js'
import { closedDays } from '../state.js'

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

export const Board = () => {
  const { issues, loading } = useIssues('/api/issues')
  const { issues: blockedList } = useIssues('/api/issues/blocked')

  const blockedMap = new Map(blockedList.map(i => [i.id, i.blocked_by_count]))

  const enriched = issues.map(i => ({
    ...i,
    blocked_by_count: blockedMap.get(i.id) ?? 0
  }))

  const filtered = useFilteredIssues(enriched)

  const columns = [
    { key: 'open', label: 'Open' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'closed', label: 'Closed' }
  ]

  const sorted = Object.fromEntries(
    columns.map(col => [
      col.key,
      filtered
        .filter(i => i.status === col.key)
        .sort((a, b) => a.priority - b.priority || new Date(a.created_at) - new Date(b.created_at))
    ])
  )

  const grouped = {
    ...sorted,
    closed: closedWithinDays(sorted.closed, closedDays.value)
  }

  if (loading) return <p class="text-secondary">Loading...</p>

  return (
    <>
      <FilterBar issues={enriched} />
      <div class="board">
        {columns.map(col => (
          <div class="column" key={col.key}>
            <div class="column-header">
              <span>{col.label} ({grouped[col.key].length})</span>
              {col.key === 'closed' && <ClosedRecencyToggle />}
            </div>
            <div class="column-cards">
              {grouped[col.key].map(issue => (
                <Card key={issue.id} issue={issue} onClick={selectIssue} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
