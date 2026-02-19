import { useState, useEffect, useRef } from 'preact/hooks'
import { Markdown } from './Markdown.jsx'
import { CopyableId } from './CopyableId.jsx'
import { AssigneePicker } from './AssigneePicker.jsx'
import { apiUrl } from '../projectUrl.js'
import { cycleTimeThresholds } from '../state.js'
import { formatDuration, issueAgeMs, durationTier } from '../cycleTime.js'

/**
 * @typedef {Object} Comment
 * @property {string} id
 * @property {string} issue_id
 * @property {string} author
 * @property {string} text
 * @property {string} created_at
 */

/**
 * @typedef {Object} Issue
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {string} status
 * @property {string} priority
 * @property {string} type
 * @property {string|null} assignee
 * @property {string|null} acceptance_criteria
 * @property {string|null} design
 * @property {string|null} notes
 * @property {string[]} labels
 * @property {string} created_at
 * @property {string} updated_at
 * @property {Comment[]} comments
 */

/**
 * @typedef {Object} Dependencies
 * @property {Issue[]} blockedBy
 * @property {Issue[]} blocks
 */

/**
 * @param {{ issueId: string, onClose: () => void, onSelectIssue: (id: string) => void }} props
 */
export const DetailPanel = ({ issueId, onClose, onSelectIssue }) => {
  const [issue, setIssue] = useState(null)
  const [dependencies, setDependencies] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showAssigneePicker, setShowAssigneePicker] = useState(false)
  const [assignees, setAssignees] = useState([])
  const assigneeRef = useRef(null)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError(null)

      try {
        const [issueRes, depsRes] = await Promise.all([
          fetch(apiUrl(`/issues/${issueId}`)),
          fetch(apiUrl(`/issues/${issueId}/dependencies`))
        ])

        if (!issueRes.ok) throw new Error('Failed to fetch issue')
        if (!depsRes.ok) throw new Error('Failed to fetch dependencies')

        const issueData = await issueRes.json()
        const depsData = await depsRes.json()

        setIssue(issueData.data)
        setDependencies(depsData.data)
        setShowAssigneePicker(false)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [issueId])

  useEffect(() => {
    fetch(apiUrl('/issues'))
      .then(r => r.json())
      .then(({ data }) => {
        const names = [...new Set(data.filter(i => i.assignee).map(i => i.assignee))].sort()
        setAssignees(names)
      })
      .catch(() => {})
  }, [])

  const handleAssigneeChange = async (_, assignee) => {
    setIssue(prev => ({ ...prev, assignee }))
    try {
      const res = await fetch(apiUrl(`/issues/${issueId}/assignee`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignee })
      })
      if (!res.ok) throw new Error('Update failed')
    } catch { /* SSE will refresh */ }
  }

  if (loading) {
    return (
      <div class='panel'>
        <div class='panel-header'>
          <button class='panel-close' onClick={onClose}>×</button>
        </div>
        <div class='panel-body'>
          <p class='text-secondary'>Loading...</p>
        </div>
      </div>
    )
  }

  if (error || !issue) {
    return (
      <div class='panel'>
        <div class='panel-header'>
          <button class='panel-close' onClick={onClose}>×</button>
        </div>
        <div class='panel-body'>
          <p class='text-secondary'>{error || 'Issue not found'}</p>
        </div>
      </div>
    )
  }

  const hasDependencies = dependencies?.blockedBy?.length > 0 || dependencies?.blocks?.length > 0

  return (
    <div class='panel'>
      <div class='panel-header'>
        <CopyableId id={issue.id} class='font-mono text-xl' />
        <span class={`badge badge-p${issue.priority}`}>P{issue.priority}</span>
        <span class={`badge badge-${issue.status.replace(' ', '-')}`}>{issue.status}</span>
        <span class={`badge badge-${issue.issue_type}`}>{issue.issue_type}</span>
        <button class='panel-close' onClick={onClose}>×</button>
      </div>

      <div class='panel-body'>
        <h1 class='text-2xl font-semibold' style='margin-bottom: 16px'>{issue.title}</h1>

        <div class='flex gap-2 items-center flex-wrap text-sm' style='margin-bottom: 24px'>
          <span class='text-secondary'>
            Assignee: <span
              ref={assigneeRef}
              class='text-primary detail-assignee-clickable'
              role='button'
              tabindex={0}
              onClick={() => setShowAssigneePicker(true)}
            >{issue.assignee || 'unassigned'}</span>
          </span>
          {showAssigneePicker && (
            <AssigneePicker
              assignees={assignees}
              currentAssignee={issue.assignee}
              onSelect={(a) => handleAssigneeChange(issueId, a)}
              anchorRef={assigneeRef}
              onClose={() => setShowAssigneePicker(false)}
            />
          )}
          {issue.labels?.length > 0 && (
            <>
              <span class='text-tertiary'>•</span>
              {issue.labels.map(label => (
                <span key={label} class='badge-pill badge-label'>{label}</span>
              ))}
            </>
          )}
          <span class='text-tertiary'>•</span>
          <span class='text-tertiary'>
            Created {formatDate(issue.created_at)}
          </span>
          {issue.updated_at !== issue.created_at && (
            <>
              <span class='text-tertiary'>•</span>
              <span class='text-tertiary'>
                Updated {formatDate(issue.updated_at)}
              </span>
            </>
          )}
        </div>

        <TimingSection issue={issue} />

        {issue.description && (
          <div class='panel-section'>
            <div class='panel-section-title'>Description</div>
            <Markdown text={issue.description} />
          </div>
        )}

        {hasDependencies && (
          <div class='panel-section'>
            <div class='panel-section-title'>Dependencies</div>

            {dependencies.blockedBy?.length > 0 && (
              <div style='margin-bottom: 12px'>
                <div class='text-xs font-semibold' style='color: var(--color-blocked-border); margin-bottom: 4px'>
                  Blocked by
                </div>
                {dependencies.blockedBy.map(dep => (
                  <div key={dep.id} class='dep-item' onClick={() => onSelectIssue(dep.id)}>
                    <span class='font-mono text-xs'>{dep.id}</span>
                    <span class='flex-1'>{dep.title}</span>
                    <span class={`badge badge-${dep.status.toLowerCase().replace(' ', '-')}`}>
                      {dep.status}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {dependencies.blocks?.length > 0 && (
              <div>
                <div class='text-xs font-semibold' style='color: var(--color-ready-border); margin-bottom: 4px'>
                  Blocks
                </div>
                {dependencies.blocks.map(dep => (
                  <div key={dep.id} class='dep-item' onClick={() => onSelectIssue(dep.id)}>
                    <span class='font-mono text-xs'>{dep.id}</span>
                    <span class='flex-1'>{dep.title}</span>
                    <span class={`badge badge-${dep.status.toLowerCase().replace(' ', '-')}`}>
                      {dep.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {issue.acceptance_criteria && (
          <div class='panel-section'>
            <div class='panel-section-title'>Acceptance Criteria</div>
            <Markdown text={issue.acceptance_criteria} />
          </div>
        )}

        {issue.design && (
          <div class='panel-section'>
            <div class='panel-section-title'>Design</div>
            <Markdown text={issue.design} />
          </div>
        )}

        {issue.notes && (
          <div class='panel-section'>
            <div class='panel-section-title'>Notes</div>
            <Markdown text={issue.notes} />
          </div>
        )}

        {issue.comments?.length > 0 && (
          <div class='panel-section'>
            <div class='panel-section-title'>Comments ({issue.comments.length})</div>
            <div>
              {issue.comments.map(comment => (
                <div key={comment.id} class='comment'>
                  <div class='comment-header'>
                    <span class='comment-author'>{comment.author}</span>
                    <span>•</span>
                    <span>{formatDate(comment.created_at)}</span>
                  </div>
                  <Markdown text={comment.text} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const TimingSection = ({ issue }) => {
  const ageMs = issueAgeMs(issue)
  if (ageMs <= 0) return null

  const thresholds = cycleTimeThresholds.value
  const tier = durationTier(ageMs, thresholds)
  const isClosed = issue.status === 'closed'
  const label = isClosed ? 'Cycle time' : 'Age'
  const medianStr = thresholds ? formatDuration(thresholds.median) : null

  return (
    <div class='panel-section'>
      <div class='detail-timing'>
        <span class={`detail-timing-value detail-timing-${tier}`}>
          {label}: {formatDuration(ageMs)}
        </span>
        {medianStr && (
          <span class='text-tertiary text-sm'>
            (median: {medianStr})
          </span>
        )}
      </div>
    </div>
  )
}

const formatDate = (dateStr) => {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now - date
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
  return `${Math.floor(diffDays / 365)} years ago`
}
