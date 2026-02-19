/** @vitest-environment jsdom */
import { describe, test, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/preact'
import '@testing-library/jest-dom/vitest'

globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.mock('../../src/client/hooks/useIssues.js', () => ({
  useIssues: vi.fn(() => ({ issues: [], loading: false }))
}))

vi.mock('../../src/client/router.js', () => ({
  selectIssue: vi.fn()
}))

import { useIssues } from '../../src/client/hooks/useIssues.js'
import { ThroughputChart } from '../../src/client/components/ThroughputChart.jsx'

afterEach(cleanup)
beforeEach(() => vi.clearAllMocks())

const closedIssue = (overrides = {}) => ({
  id: 'BD-1', title: 'Test', status: 'closed', issue_type: 'task',
  assignee: 'alice', created_at: '2026-02-10T10:00:00Z',
  updated_at: '2026-02-15T10:00:00Z', closed_at: '2026-02-15T10:00:00Z',
  ...overrides,
})

const openIssue = (overrides = {}) => ({
  id: 'BD-2', title: 'Open', status: 'open', issue_type: 'feature',
  assignee: null, created_at: '2026-02-10T10:00:00Z',
  updated_at: '2026-02-10T10:00:00Z', closed_at: null,
  ...overrides,
})

const issuesClosedOnDates = (dates) =>
  dates.map((d, i) => closedIssue({ id: `BD-${i}`, closed_at: `${d}T12:00:00Z` }))

describe('ThroughputChart', () => {
  test('shows loading state', () => {
    useIssues.mockReturnValue({ issues: [], loading: true })
    const { container } = render(<ThroughputChart />)
    expect(container.textContent).toContain('Loading...')
  })

  test('shows empty state when no closed issues', () => {
    useIssues.mockReturnValue({ issues: [openIssue()], loading: false })
    const { container } = render(<ThroughputChart />)
    expect(container.textContent).toContain('No closed issues yet')
  })

  test('renders chart with closed issues', () => {
    useIssues.mockReturnValue({
      issues: [closedIssue()],
      loading: false,
    })
    const { container } = render(<ThroughputChart />)
    expect(container.querySelector('.tp-root')).not.toBeNull()
    expect(container.querySelector('.tp-svg')).not.toBeNull()
  })

  test('shows total closed stat', () => {
    useIssues.mockReturnValue({
      issues: [
        closedIssue({ id: 'BD-1', closed_at: '2026-02-15T10:00:00Z' }),
        closedIssue({ id: 'BD-2', closed_at: '2026-02-16T10:00:00Z' }),
        closedIssue({ id: 'BD-3', closed_at: '2026-02-17T10:00:00Z' }),
      ],
      loading: false,
    })
    const { container } = render(<ThroughputChart />)
    const stats = [...container.querySelectorAll('.tp-stat')]
    const totalStat = stats.find(s => s.textContent.includes('Total closed'))
    expect(totalStat).not.toBeNull()
    expect(totalStat.querySelector('.tp-stat-value')).toHaveTextContent('3')
  })

  test('renders bucket toggle buttons', () => {
    useIssues.mockReturnValue({ issues: [closedIssue()], loading: false })
    const { container } = render(<ThroughputChart />)
    const btns = container.querySelectorAll('.tp-bucket-btn')
    expect(btns).toHaveLength(3)
    expect(btns[0]).toHaveTextContent('Day')
    expect(btns[1]).toHaveTextContent('Week')
    expect(btns[2]).toHaveTextContent('Month')
  })

  test('week is the default granularity', () => {
    useIssues.mockReturnValue({ issues: [closedIssue()], loading: false })
    const { container } = render(<ThroughputChart />)
    const active = container.querySelector('.tp-bucket-btn-active')
    expect(active).toHaveTextContent('Week')
  })

  test('switching granularity updates active button', () => {
    useIssues.mockReturnValue({ issues: [closedIssue()], loading: false })
    const { container } = render(<ThroughputChart />)
    fireEvent.click(container.querySelectorAll('.tp-bucket-btn')[0])
    expect(container.querySelector('.tp-bucket-btn-active')).toHaveTextContent('Day')
  })

  test('renders type legend for all types', () => {
    useIssues.mockReturnValue({ issues: [closedIssue()], loading: false })
    const { container } = render(<ThroughputChart />)
    const legend = container.querySelectorAll('.tp-legend-item')
    expect(legend).toHaveLength(4)
    const labels = [...legend].map(l => l.textContent)
    expect(labels).toContain('task')
    expect(labels).toContain('feature')
    expect(labels).toContain('bug')
    expect(labels).toContain('epic')
  })

  test('renders type breakdown rows', () => {
    useIssues.mockReturnValue({ issues: [closedIssue()], loading: false })
    const { container } = render(<ThroughputChart />)
    const rows = container.querySelectorAll('.tp-breakdown-row')
    expect(rows).toHaveLength(4)
  })

  test('breakdown shows correct count for issue type', () => {
    useIssues.mockReturnValue({
      issues: [
        closedIssue({ id: 'BD-1', issue_type: 'bug' }),
        closedIssue({ id: 'BD-2', issue_type: 'bug' }),
        closedIssue({ id: 'BD-3', issue_type: 'task' }),
      ],
      loading: false,
    })
    const { container } = render(<ThroughputChart />)
    const rows = [...container.querySelectorAll('.tp-breakdown-row')]
    const bugRow = rows.find(r => r.querySelector('.tp-breakdown-type')?.textContent === 'bug')
    expect(bugRow.querySelector('.tp-breakdown-count')).toHaveTextContent('2')
  })

  test('only counts issues with closed_at', () => {
    useIssues.mockReturnValue({
      issues: [closedIssue(), openIssue()],
      loading: false,
    })
    const { container } = render(<ThroughputChart />)
    const stats = [...container.querySelectorAll('.tp-stat')]
    const totalStat = stats.find(s => s.textContent.includes('Total closed'))
    expect(totalStat.querySelector('.tp-stat-value')).toHaveTextContent('1')
  })

  test('renders SVG bar groups for each bucket', () => {
    useIssues.mockReturnValue({
      issues: issuesClosedOnDates(['2026-02-10', '2026-02-11', '2026-02-17']),
      loading: false,
    })
    const { container } = render(<ThroughputChart />)
    const barGroups = container.querySelectorAll('.tp-bar-group')
    expect(barGroups.length).toBeGreaterThan(0)
  })

  test('renders moving average line when 3+ buckets', () => {
    useIssues.mockReturnValue({
      issues: issuesClosedOnDates([
        '2026-01-06', '2026-01-13', '2026-01-20', '2026-01-27',
      ]),
      loading: false,
    })
    const { container } = render(<ThroughputChart />)
    expect(container.querySelector('.tp-ma-line')).not.toBeNull()
  })

  test('shows moving average hint text', () => {
    useIssues.mockReturnValue({ issues: [closedIssue()], loading: false })
    const { container } = render(<ThroughputChart />)
    expect(container.querySelector('.tp-ma-hint-text')).toHaveTextContent('3-period moving average')
  })

  test('shows periods stat', () => {
    useIssues.mockReturnValue({ issues: [closedIssue()], loading: false })
    const { container } = render(<ThroughputChart />)
    const stats = [...container.querySelectorAll('.tp-stat')]
    const periodsStat = stats.find(s => s.textContent.includes('Periods'))
    expect(periodsStat).not.toBeNull()
  })

  test('renders gradient defs in SVG', () => {
    useIssues.mockReturnValue({ issues: [closedIssue()], loading: false })
    const { container } = render(<ThroughputChart />)
    expect(container.querySelector('#tp-grad-task')).not.toBeNull()
    expect(container.querySelector('#tp-grad-bug')).not.toBeNull()
    expect(container.querySelector('#tp-grad-feature')).not.toBeNull()
    expect(container.querySelector('#tp-grad-epic')).not.toBeNull()
  })

  test('renders glow filter in SVG defs', () => {
    useIssues.mockReturnValue({ issues: [closedIssue()], loading: false })
    const { container } = render(<ThroughputChart />)
    expect(container.querySelector('#tp-bar-glow')).not.toBeNull()
  })

  test('shows recent trend when 4+ buckets', () => {
    useIssues.mockReturnValue({
      issues: issuesClosedOnDates([
        '2026-01-06', '2026-01-13', '2026-01-20', '2026-01-27',
      ]),
      loading: false,
    })
    const { container } = render(<ThroughputChart />)
    const stats = [...container.querySelectorAll('.tp-stat')]
    const trendStat = stats.find(s => s.textContent.includes('Recent trend'))
    expect(trendStat).not.toBeNull()
  })

  test('hides recent trend when fewer than 4 buckets', () => {
    useIssues.mockReturnValue({
      issues: [closedIssue()],
      loading: false,
    })
    const { container } = render(<ThroughputChart />)
    const stats = [...container.querySelectorAll('.tp-stat')]
    const trendStat = stats.find(s => s.textContent.includes('Recent trend'))
    expect(trendStat).toBeUndefined()
  })
})
