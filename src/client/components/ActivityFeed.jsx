import { useIssues } from '../hooks/useIssues.js'
import { CopyableId } from './CopyableId.jsx'
import { selectIssue } from '../router.js'

const TYPE_GLYPH = { bug: '\u2B21', feature: '\u25C8', task: '\u2B24', epic: '\u25C6' }

const relativeTime = (dateStr) => {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const deriveEvents = (issues) => {
  const events = []
  for (const issue of issues) {
    if (issue.created_at) {
      events.push({
        id: issue.id, title: issue.title, issue_type: issue.issue_type,
        assignee: issue.assignee, from: null, to: 'open',
        timestamp: issue.created_at,
      })
    }
    if (issue.status === 'in_progress' && issue.updated_at && issue.updated_at !== issue.created_at) {
      events.push({
        id: issue.id, title: issue.title, issue_type: issue.issue_type,
        assignee: issue.assignee, from: 'open', to: 'in_progress',
        timestamp: issue.updated_at,
      })
    }
    if (issue.closed_at) {
      events.push({
        id: issue.id, title: issue.title, issue_type: issue.issue_type,
        assignee: issue.assignee,
        from: issue.status === 'closed' ? (issue.updated_at !== issue.closed_at ? 'in_progress' : 'open') : 'open',
        to: 'closed', timestamp: issue.closed_at,
      })
    }
  }
  return events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
}

const statusColor = (s) => ({
  open: 'var(--color-open-border)',
  in_progress: 'var(--color-in-progress-border)',
  closed: 'var(--color-closed-border)',
})[s] || 'var(--color-border)'

const typeColor = (t) => ({
  bug: 'var(--color-type-bug)',
  feature: 'var(--color-type-feature)',
  task: 'var(--color-type-task)',
  epic: 'var(--color-type-epic)',
})[t] || 'var(--color-text-tertiary)'

const statusLabel = (s) => ({
  open: 'open', in_progress: 'in progress', closed: 'closed',
})[s] || s

const StatusTransition = ({ from, to }) => {
  if (!from) {
    return <span class={`badge badge-${to}`} style="font-size:0.65rem;padding:1px 6px">{statusLabel(to)}</span>
  }
  return (
    <span class="feed-transition">
      <span class={`badge badge-${from}`} style="font-size:0.65rem;padding:1px 6px;opacity:0.6">{statusLabel(from)}</span>
      <span class="feed-transition-arrow">{'\u203A'}</span>
      <span class={`badge badge-${to}`} style="font-size:0.65rem;padding:1px 6px">{statusLabel(to)}</span>
    </span>
  )
}

const FeedEntry = ({ event, isFirst }) => (
  <div class={`feed-entry${isFirst ? ' feed-entry-first' : ''}`} onClick={() => selectIssue(event.id)}>
    <div class="feed-dot-col">
      <div
        class={`feed-dot${isFirst ? ' feed-dot-pulse' : ''}`}
        style={`background:${statusColor(event.to)};box-shadow:0 0 0 3px ${typeColor(event.issue_type)}22`}
      />
    </div>
    <div class="feed-row">
      <span class="feed-glyph" style={`color:${typeColor(event.issue_type)}`}>
        {TYPE_GLYPH[event.issue_type] || '\u2B24'}
      </span>
      <CopyableId id={event.id} class="feed-id font-mono" />
      <span class="feed-title">{event.title}</span>
      <StatusTransition from={event.from} to={event.to} />
      {event.assignee && <span class="feed-assignee">{event.assignee}</span>}
      <span class="feed-time">{relativeTime(event.timestamp)}</span>
    </div>
  </div>
)

export const ActivityFeed = () => {
  const { issues, loading } = useIssues('/issues')

  if (loading) return <p class="text-secondary">Loading...</p>

  const events = deriveEvents(issues)

  if (events.length === 0) {
    return <div class="feed-empty"><span>No recent activity</span></div>
  }

  return (
    <div class="feed">
      <div class="feed-header">
        <span class="feed-header-title">Activity</span>
        <span class="feed-header-count">{events.length} events</span>
      </div>
      <div class="feed-list">
        {events.map((event, i) => (
          <FeedEntry key={`${event.id}-${event.to}`} event={event} isFirst={i === 0} />
        ))}
      </div>
    </div>
  )
}
