import { useState, useEffect, useCallback } from 'preact/hooks'
import { Badge } from './Badge.jsx'
import { selectIssue } from '../router.js'
import { useLiveUpdates } from '../hooks/useLiveUpdates.js'

const statusIcon = (status) => {
  if (status === 'closed') return '✓'
  if (status === 'in_progress') return '◉'
  return '○'
}

const statusIconColor = (status) => {
  if (status === 'closed') return 'var(--color-success)'
  if (status === 'in_progress') return 'var(--color-warning)'
  return 'var(--color-text-tertiary)'
}

/**
 * @param {{ epic: any, isExpanded: boolean, children_: any[], onToggle: () => void, onSelectIssue: (id: string) => void }} props
 */
const EpicRow = ({ epic, isExpanded, children_, onToggle, onSelectIssue }) => {
  const pct = epic.child_count > 0
    ? Math.round((epic.closed_count / epic.child_count) * 100)
    : 0

  return (
    <div class="epic-group">
      <div class="epic-header" onClick={onToggle}>
        <span class="epic-chevron">{isExpanded ? '▼' : '▶'}</span>
        <span class="text-sm">🎯</span>
        <span class="font-mono text-xs text-tertiary">{epic.id}</span>
        <span class="text-sm font-medium flex-1 truncate">{epic.title}</span>
        <span class="text-xs text-tertiary">
          ({epic.closed_count}/{epic.child_count} closed)
        </span>
        <div class="epic-progress" title={`${pct}% complete`}>
          <div class="epic-progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <Badge class={`badge-p${epic.priority}`}>P{epic.priority}</Badge>
      </div>

      {isExpanded && children_.length > 0 && (
        <div class="epic-children">
          {children_.map((child, i) => (
            <div
              key={child.id}
              class="epic-child"
              onClick={() => onSelectIssue(child.id)}
            >
              <span class="epic-tree-line">
                {i === children_.length - 1 ? '└─' : '├─'}
              </span>
              <span style={{ color: statusIconColor(child.status) }}>
                {statusIcon(child.status)}
              </span>
              <span class="font-mono text-xs text-tertiary">{child.id}</span>
              <span class="text-sm flex-1 truncate">{child.title}</span>
              <Badge class={`badge-p${child.priority}`}>P{child.priority}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export const EpicExplorer = () => {
  const [epics, setEpics] = useState([])
  const [expanded, setExpanded] = useState(new Set())
  const [children, setChildren] = useState({})
  const [loading, setLoading] = useState(true)

  const fetchEpics = useCallback(async () => {
    const res = await fetch('/api/epics')
    const { data } = await res.json()
    setEpics(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchEpics() }, [fetchEpics])
  useLiveUpdates(fetchEpics)

  const toggleExpand = async (epicId) => {
    const next = new Set(expanded)
    if (next.has(epicId)) {
      next.delete(epicId)
    } else {
      next.add(epicId)
      if (!children[epicId]) {
        const res = await fetch(`/api/epics/${epicId}/children`)
        const { data } = await res.json()
        setChildren(prev => ({ ...prev, [epicId]: data }))
      }
    }
    setExpanded(next)
  }

  if (loading) return <p class="text-secondary p-6">Loading...</p>

  if (epics.length === 0) return (
    <div class="flex items-center justify-center" style="height: 100%">
      <p class="text-secondary">No epics found</p>
    </div>
  )

  return (
    <div class="epic-explorer">
      <h2 class="text-lg font-semibold" style="margin-bottom: var(--space-4)">
        Epics ({epics.length})
      </h2>
      {epics.map(epic => (
        <EpicRow
          key={epic.id}
          epic={epic}
          isExpanded={expanded.has(epic.id)}
          children_={children[epic.id] || []}
          onToggle={() => toggleExpand(epic.id)}
          onSelectIssue={selectIssue}
        />
      ))}
    </div>
  )
}
