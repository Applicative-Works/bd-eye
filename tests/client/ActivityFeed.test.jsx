/** @vitest-environment jsdom */
import { describe, test, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, cleanup } from '@testing-library/preact'
import '@testing-library/jest-dom/vitest'

vi.mock('../../src/client/hooks/useIssues.js', () => ({
  useIssues: vi.fn(() => ({ issues: [], loading: false }))
}))

vi.mock('../../src/client/router.js', () => ({
  selectIssue: vi.fn()
}))

import { useIssues } from '../../src/client/hooks/useIssues.js'
import { selectIssue } from '../../src/client/router.js'
import { ActivityFeed } from '../../src/client/components/ActivityFeed.jsx'

afterEach(cleanup)
beforeEach(() => vi.clearAllMocks())

const issue = (overrides = {}) => ({
  id: 'BD-1', title: 'Test issue', status: 'open', issue_type: 'task',
  assignee: null, created_at: '2026-02-19T10:00:00Z',
  updated_at: '2026-02-19T10:00:00Z', closed_at: null,
  ...overrides
})

describe('ActivityFeed', () => {
  test('shows loading state', () => {
    useIssues.mockReturnValue({ issues: [], loading: true })
    const { container } = render(<ActivityFeed />)
    expect(container.textContent).toContain('Loading...')
  })

  test('shows empty state when no issues', () => {
    useIssues.mockReturnValue({ issues: [], loading: false })
    const { container } = render(<ActivityFeed />)
    expect(container.querySelector('.feed-empty')).toHaveTextContent('No recent activity')
  })

  test('derives open event from created_at', () => {
    useIssues.mockReturnValue({ issues: [issue()], loading: false })
    const { container } = render(<ActivityFeed />)
    const entries = container.querySelectorAll('.feed-entry')
    expect(entries).toHaveLength(1)
    expect(entries[0].querySelector('.feed-title')).toHaveTextContent('Test issue')
  })

  test('derives in_progress event from updated_at', () => {
    useIssues.mockReturnValue({
      issues: [issue({
        status: 'in_progress',
        updated_at: '2026-02-19T11:00:00Z'
      })],
      loading: false
    })
    const { container } = render(<ActivityFeed />)
    const entries = container.querySelectorAll('.feed-entry')
    expect(entries).toHaveLength(2)
  })

  test('derives closed event from closed_at', () => {
    useIssues.mockReturnValue({
      issues: [issue({
        status: 'closed',
        closed_at: '2026-02-19T12:00:00Z',
        updated_at: '2026-02-19T11:00:00Z'
      })],
      loading: false
    })
    const { container } = render(<ActivityFeed />)
    const entries = container.querySelectorAll('.feed-entry')
    expect(entries).toHaveLength(2)
  })

  test('shows event count in header', () => {
    useIssues.mockReturnValue({
      issues: [issue(), issue({ id: 'BD-2', title: 'Second' })],
      loading: false
    })
    const { container } = render(<ActivityFeed />)
    expect(container.querySelector('.feed-header-count')).toHaveTextContent('2 events')
  })

  test('sorts events by timestamp descending', () => {
    useIssues.mockReturnValue({
      issues: [
        issue({ id: 'BD-1', created_at: '2026-02-19T08:00:00Z' }),
        issue({ id: 'BD-2', created_at: '2026-02-19T10:00:00Z' })
      ],
      loading: false
    })
    const { container } = render(<ActivityFeed />)
    const ids = [...container.querySelectorAll('.feed-id')].map(el => el.textContent)
    expect(ids[0]).toBe('BD-2')
    expect(ids[1]).toBe('BD-1')
  })

  test('shows type glyph for each event', () => {
    useIssues.mockReturnValue({
      issues: [issue({ issue_type: 'bug' })],
      loading: false
    })
    const { container } = render(<ActivityFeed />)
    expect(container.querySelector('.feed-glyph')).toHaveTextContent('\u2B21')
  })

  test('shows assignee when present', () => {
    useIssues.mockReturnValue({
      issues: [issue({ assignee: 'alice' })],
      loading: false
    })
    const { container } = render(<ActivityFeed />)
    expect(container.querySelector('.feed-assignee')).toHaveTextContent('alice')
  })

  test('does not show assignee when null', () => {
    useIssues.mockReturnValue({ issues: [issue()], loading: false })
    const { container } = render(<ActivityFeed />)
    expect(container.querySelector('.feed-assignee')).toBeNull()
  })

  test('first entry has pulse dot', () => {
    useIssues.mockReturnValue({ issues: [issue()], loading: false })
    const { container } = render(<ActivityFeed />)
    expect(container.querySelector('.feed-dot-pulse')).not.toBeNull()
  })

  test('clicking entry calls selectIssue', () => {
    useIssues.mockReturnValue({ issues: [issue()], loading: false })
    const { container } = render(<ActivityFeed />)
    container.querySelector('.feed-entry').click()
    expect(selectIssue).toHaveBeenCalledWith('BD-1')
  })

  test('shows status transition badges', () => {
    useIssues.mockReturnValue({
      issues: [issue({
        status: 'in_progress',
        updated_at: '2026-02-19T11:00:00Z'
      })],
      loading: false
    })
    const { container } = render(<ActivityFeed />)
    const transitions = container.querySelectorAll('.feed-transition')
    expect(transitions.length).toBeGreaterThan(0)
  })

  test('shows relative time', () => {
    const now = new Date()
    useIssues.mockReturnValue({
      issues: [issue({ created_at: new Date(now - 3600000).toISOString() })],
      loading: false
    })
    const { container } = render(<ActivityFeed />)
    expect(container.querySelector('.feed-time')).toHaveTextContent('1h ago')
  })

  test('renders timeline line', () => {
    useIssues.mockReturnValue({ issues: [issue()], loading: false })
    const { container } = render(<ActivityFeed />)
    expect(container.querySelector('.feed-list')).not.toBeNull()
  })
})
