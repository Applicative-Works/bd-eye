import { useState, useEffect } from 'preact/hooks'
import { useIssues } from '../hooks/useIssues.js'
import { Badge, PillBadge } from './Badge.jsx'
import { selectIssue } from '../router.js'

export const ReadyQueue = () => {
  const { issues, loading } = useIssues('/api/issues/ready')
  const [selectedIdx, setSelectedIdx] = useState(-1)

  useEffect(() => {
    const handleKey = (e) => {
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)
      if (isInput) return

      switch (e.key) {
        case 'j':
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIdx(i => Math.min(i + 1, issues.length - 1))
          break
        case 'k':
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIdx(i => Math.max(i - 1, 0))
          break
        case 'Enter':
          if (issues[selectedIdx]) selectIssue(issues[selectedIdx].id)
          break
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [issues, selectedIdx])

  if (loading) return <p class="text-secondary p-6">Loading...</p>

  if (issues.length === 0) return (
    <div class="flex items-center justify-center" style="height: 100%">
      <p class="text-secondary">All issues are either blocked or closed — nothing ready to work on</p>
    </div>
  )

  return (
    <div class="ready-queue">
      <h2 class="text-lg font-semibold" style="margin-bottom: var(--space-4)">
        Ready Issues ({issues.length})
      </h2>
      <table class="ready-table">
        <thead>
          <tr>
            <th>Priority</th>
            <th>ID</th>
            <th>Title</th>
            <th>Type</th>
            <th>Assignee</th>
            <th>Labels</th>
          </tr>
        </thead>
        <tbody>
          {issues.map((issue, i) => (
            <tr
              key={issue.id}
              class={`ready-row ${i === selectedIdx ? 'ready-row-active' : ''}`}
              onClick={() => selectIssue(issue.id)}
            >
              <td><Badge class={`badge-p${issue.priority}`}>P{issue.priority}</Badge></td>
              <td class="font-mono text-xs">{issue.id}</td>
              <td class="text-sm">{issue.title}</td>
              <td><PillBadge class={`badge-${issue.issue_type}`}>{issue.issue_type}</PillBadge></td>
              <td class="text-xs text-secondary">{issue.assignee || 'unassigned'}</td>
              <td>
                <div class="flex flex-wrap gap-1">
                  {(issue.labels || []).map(l => (
                    <PillBadge key={l} class="badge-label">{l}</PillBadge>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
