/** @vitest-environment jsdom */
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/preact'
import '@testing-library/jest-dom/vitest'
import { signal } from '@preact/signals'

const closedDaysSignal = signal(null)
const filtersSignal = signal({ priority: [], type: [], assignee: [], label: [], blockedOnly: false, readyOnly: false })
const columnSortOrdersSignal = signal({ open: 'priority', in_progress: 'priority', closed: 'priority' })

vi.mock('../../src/client/hooks/useIssues.js', () => ({
  useIssues: vi.fn()
}))

vi.mock('../../src/client/hooks/useFilteredIssues.js', () => ({
  useFilteredIssues: vi.fn((issues) => issues)
}))

vi.mock('../../src/client/router.js', () => ({
  selectIssue: vi.fn(),
  navigate: vi.fn(),
  clearSelection: vi.fn(),
  initRouter: vi.fn(),
}))

vi.mock('../../src/client/state.js', () => ({
  get selectedIssueId() { return signal(null) },
  get currentView() { return signal('board') },
  get filters() { return filtersSignal },
  get closedDays() { return closedDaysSignal },
  get columnMode() { return signal('status') },
  get columnSortOrders() { return columnSortOrdersSignal },
}))

vi.mock('../../src/client/components/SortControl.jsx', () => ({
  SortControl: ({ columnKey }) => <div data-testid={`sort-control-${columnKey}`}>Sort</div>,
}))

let capturedDndProps = {}

vi.mock('@dnd-kit/core', () => ({
  DndContext: (props) => {
    capturedDndProps = props
    return <div data-testid="dnd-context">{props.children}</div>
  },
  DragOverlay: ({ children }) => <div data-testid="drag-overlay">{children}</div>,
  PointerSensor: vi.fn(),
  pointerWithin: vi.fn(),
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn(() => []),
}))

vi.mock('../../src/client/components/Card.jsx', () => ({
  Card: ({ issue, onClick, isDragging, isOverlay }) => (
    <div data-testid={`card-${issue.id}`} data-dragging={isDragging} data-overlay={isOverlay}
      onClick={() => onClick?.(issue.id)}>
      {issue.title}
    </div>
  ),
}))

vi.mock('../../src/client/components/DroppableColumn.jsx', () => ({
  DroppableColumn: ({ col, count, children, headerExtra }) => (
    <div data-testid={`column-${col.key}`}>
      <span>{col.label} ({count})</span>
      {headerExtra}
      {children}
    </div>
  ),
}))

vi.mock('../../src/client/components/FilterBar.jsx', () => ({
  FilterBar: ({ issues }) => <div data-testid="filter-bar" data-count={issues.length} />,
}))

import { Board } from '../../src/client/components/Board.jsx'
import { useIssues } from '../../src/client/hooks/useIssues.js'

const makeIssues = () => [
  { id: 'P-1', title: 'Open task', status: 'open', priority: 1, issue_type: 'task', assignee: 'Dan', labels: [], created_at: '2025-01-01T00:00:00Z' },
  { id: 'P-2', title: 'In progress task', status: 'in_progress', priority: 2, issue_type: 'bug', assignee: null, labels: [], created_at: '2025-01-02T00:00:00Z' },
  { id: 'P-3', title: 'Closed task', status: 'closed', priority: 1, issue_type: 'feature', assignee: 'Alice', labels: [], created_at: '2025-01-03T00:00:00Z', closed_at: new Date().toISOString() },
]

afterEach(cleanup)

beforeEach(() => {
  vi.clearAllMocks()
  capturedDndProps = {}
  closedDaysSignal.value = null
  columnSortOrdersSignal.value = { open: 'priority', in_progress: 'priority', closed: 'priority' }
  globalThis.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }))
  useIssues.mockImplementation((endpoint) => {
    if (endpoint === '/api/issues') {
      return { issues: makeIssues(), loading: false, refetch: vi.fn() }
    }
    return { issues: [], loading: false, refetch: vi.fn() }
  })
})

describe('Board', () => {
  test('shows loading state', () => {
    useIssues.mockReturnValue({ issues: [], loading: true, refetch: vi.fn() })
    render(<Board />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  test('renders three columns', () => {
    render(<Board />)
    expect(screen.getByTestId('column-open')).toBeInTheDocument()
    expect(screen.getByTestId('column-in_progress')).toBeInTheDocument()
    expect(screen.getByTestId('column-closed')).toBeInTheDocument()
  })

  test.each([
    ['open', 'Open task'],
    ['in_progress', 'In progress task'],
    ['closed', 'Closed task'],
  ])('places issue in %s column', (colKey, title) => {
    render(<Board />)
    const column = screen.getByTestId(`column-${colKey}`)
    expect(column).toHaveTextContent(title)
  })

  test.each([
    ['open', 'Open (1)'],
    ['in_progress', 'In Progress (1)'],
    ['closed', 'Closed (1)'],
  ])('column %s shows correct header with count', (colKey, headerText) => {
    render(<Board />)
    expect(screen.getByTestId(`column-${colKey}`)).toHaveTextContent(headerText)
  })

  test('renders filter bar with enriched issues', () => {
    render(<Board />)
    expect(screen.getByTestId('filter-bar')).toBeInTheDocument()
  })

  test('renders DndContext wrapper', () => {
    render(<Board />)
    expect(screen.getByTestId('dnd-context')).toBeInTheDocument()
  })

  test('enriches issues with blocked_by_count from blocked endpoint', () => {
    useIssues.mockImplementation((endpoint) => {
      if (endpoint === '/api/issues') {
        return { issues: makeIssues(), loading: false, refetch: vi.fn() }
      }
      if (endpoint === '/api/issues/blocked') {
        return { issues: [{ id: 'P-1', blocked_by_count: 3 }], loading: false, refetch: vi.fn() }
      }
      return { issues: [], loading: false, refetch: vi.fn() }
    })
    render(<Board />)
    expect(screen.getByTestId('card-P-1')).toBeInTheDocument()
  })

  test('calls useIssues with correct endpoints', () => {
    render(<Board />)
    expect(useIssues).toHaveBeenCalledWith('/api/issues')
    expect(useIssues).toHaveBeenCalledWith('/api/issues/blocked')
  })
})

describe('recency toggle', () => {
  test('renders all recency buttons', () => {
    render(<Board />)
    expect(screen.getByText('1d')).toBeInTheDocument()
    expect(screen.getByText('3d')).toBeInTheDocument()
    expect(screen.getByText('7d')).toBeInTheDocument()
    expect(screen.getByText('All')).toBeInTheDocument()
  })

  test('clicking recency button updates closedDays signal', () => {
    render(<Board />)
    fireEvent.click(screen.getByText('3d'))
    expect(closedDaysSignal.value).toBe(3)
  })

  test('clicking All sets closedDays to null', () => {
    closedDaysSignal.value = 7
    render(<Board />)
    fireEvent.click(screen.getByText('All'))
    expect(closedDaysSignal.value).toBe(null)
  })

  test('filters closed issues by recency', () => {
    const now = Date.now()
    useIssues.mockImplementation((endpoint) => {
      if (endpoint === '/api/issues') {
        return {
          issues: [
            { id: 'R-1', title: 'Recent', status: 'closed', priority: 1, issue_type: 'task', assignee: null, labels: [], created_at: '2025-01-01T00:00:00Z', closed_at: new Date(now - 6 * 3600000).toISOString() },
            { id: 'R-2', title: 'Old', status: 'closed', priority: 1, issue_type: 'task', assignee: null, labels: [], created_at: '2025-01-01T00:00:00Z', closed_at: new Date(now - 5 * 86400000).toISOString() },
          ],
          loading: false,
          refetch: vi.fn()
        }
      }
      return { issues: [], loading: false, refetch: vi.fn() }
    })

    closedDaysSignal.value = 1
    render(<Board />)
    const closedCol = screen.getByTestId('column-closed')
    expect(closedCol).toHaveTextContent('Recent')
    expect(closedCol).not.toHaveTextContent('Old')
  })
})

describe('drag and drop handlers', () => {
  test('onDragStart sets active id', () => {
    render(<Board />)
    act(() => capturedDndProps.onDragStart({ active: { id: 'P-1' } }))
    const cards = screen.getAllByTestId('card-P-1')
    const mainCard = cards.find(c => c.dataset.overlay !== 'true')
    expect(mainCard.dataset.dragging).toBe('true')
  })

  test('onDragCancel clears active id', () => {
    render(<Board />)
    act(() => capturedDndProps.onDragStart({ active: { id: 'P-1' } }))
    const getMainCard = () => screen.getAllByTestId('card-P-1').find(c => c.dataset.overlay !== 'true')
    expect(getMainCard().dataset.dragging).toBe('true')
    act(() => capturedDndProps.onDragCancel())
    expect(screen.getByTestId('card-P-1').dataset.dragging).toBe('false')
  })

  test('onDragEnd with no over does nothing', async () => {
    render(<Board />)
    await act(async () => capturedDndProps.onDragEnd({ active: { id: 'P-1' }, over: null }))
    expect(globalThis.fetch).not.toHaveBeenCalledWith(expect.stringContaining('/status'), expect.anything())
  })

  test('onDragEnd to same column does not patch', async () => {
    render(<Board />)
    await act(async () => capturedDndProps.onDragEnd({ active: { id: 'P-1' }, over: { id: 'open' } }))
    expect(globalThis.fetch).not.toHaveBeenCalledWith(expect.stringContaining('/status'), expect.anything())
  })

  test('onDragEnd to different column patches status', async () => {
    render(<Board />)
    await act(async () => capturedDndProps.onDragEnd({ active: { id: 'P-1' }, over: { id: 'in_progress' } }))
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/issues/P-1/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress' })
    })
  })

  test('onDragEnd reverts optimistic move on failure', async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve({ ok: false }))
    render(<Board />)
    await act(async () => capturedDndProps.onDragEnd({ active: { id: 'P-1' }, over: { id: 'closed' } }))
    const openCol = screen.getByTestId('column-open')
    expect(openCol).toHaveTextContent('Open task')
  })

  test('onDragEnd with unknown issue does nothing', async () => {
    render(<Board />)
    await act(async () => capturedDndProps.onDragEnd({ active: { id: 'UNKNOWN' }, over: { id: 'closed' } }))
    expect(globalThis.fetch).not.toHaveBeenCalledWith(expect.stringContaining('/status'), expect.anything())
  })
})

describe('sort controls', () => {
  test('renders sort control for each column', () => {
    render(<Board />)
    expect(screen.getByTestId('sort-control-open')).toBeInTheDocument()
    expect(screen.getByTestId('sort-control-in_progress')).toBeInTheDocument()
    expect(screen.getByTestId('sort-control-closed')).toBeInTheDocument()
  })

  test('sort by age orders oldest first', () => {
    useIssues.mockImplementation((endpoint) => {
      if (endpoint === '/api/issues') {
        return {
          issues: [
            { id: 'S-1', title: 'Newer', status: 'open', priority: 1, issue_type: 'task', assignee: null, labels: [], created_at: '2025-06-01T00:00:00Z' },
            { id: 'S-2', title: 'Older', status: 'open', priority: 1, issue_type: 'task', assignee: null, labels: [], created_at: '2025-01-01T00:00:00Z' },
          ],
          loading: false, refetch: vi.fn()
        }
      }
      return { issues: [], loading: false, refetch: vi.fn() }
    })
    columnSortOrdersSignal.value = { open: 'age', in_progress: 'priority', closed: 'priority' }
    render(<Board />)
    const cards = screen.getByTestId('column-open').querySelectorAll('[data-testid^="card-"]')
    expect(cards[0]).toHaveTextContent('Older')
    expect(cards[1]).toHaveTextContent('Newer')
  })

  test('sort by assignee orders alphabetically', () => {
    useIssues.mockImplementation((endpoint) => {
      if (endpoint === '/api/issues') {
        return {
          issues: [
            { id: 'S-1', title: 'Dan card', status: 'open', priority: 1, issue_type: 'task', assignee: 'Dan', labels: [], created_at: '2025-01-01T00:00:00Z' },
            { id: 'S-2', title: 'Alice card', status: 'open', priority: 1, issue_type: 'task', assignee: 'Alice', labels: [], created_at: '2025-01-01T00:00:00Z' },
          ],
          loading: false, refetch: vi.fn()
        }
      }
      return { issues: [], loading: false, refetch: vi.fn() }
    })
    columnSortOrdersSignal.value = { open: 'assignee', in_progress: 'priority', closed: 'priority' }
    render(<Board />)
    const cards = screen.getByTestId('column-open').querySelectorAll('[data-testid^="card-"]')
    expect(cards[0]).toHaveTextContent('Alice card')
    expect(cards[1]).toHaveTextContent('Dan card')
  })

  test('sort by type groups by issue type', () => {
    useIssues.mockImplementation((endpoint) => {
      if (endpoint === '/api/issues') {
        return {
          issues: [
            { id: 'S-1', title: 'A task', status: 'open', priority: 1, issue_type: 'task', assignee: null, labels: [], created_at: '2025-01-01T00:00:00Z' },
            { id: 'S-2', title: 'A bug', status: 'open', priority: 1, issue_type: 'bug', assignee: null, labels: [], created_at: '2025-01-01T00:00:00Z' },
          ],
          loading: false, refetch: vi.fn()
        }
      }
      return { issues: [], loading: false, refetch: vi.fn() }
    })
    columnSortOrdersSignal.value = { open: 'type', in_progress: 'priority', closed: 'priority' }
    render(<Board />)
    const cards = screen.getByTestId('column-open').querySelectorAll('[data-testid^="card-"]')
    expect(cards[0]).toHaveTextContent('A bug')
    expect(cards[1]).toHaveTextContent('A task')
  })
})

describe('priority sorting', () => {
  test('sorts issues within a column by priority then created_at', () => {
    useIssues.mockImplementation((endpoint) => {
      if (endpoint === '/api/issues') {
        return {
          issues: [
            { id: 'P-B', title: 'Second', status: 'open', priority: 2, issue_type: 'task', assignee: null, labels: [], created_at: '2025-01-01T00:00:00Z' },
            { id: 'P-A', title: 'First', status: 'open', priority: 1, issue_type: 'task', assignee: null, labels: [], created_at: '2025-01-01T00:00:00Z' },
            { id: 'P-C', title: 'Third', status: 'open', priority: 2, issue_type: 'task', assignee: null, labels: [], created_at: '2025-01-02T00:00:00Z' },
          ],
          loading: false,
          refetch: vi.fn()
        }
      }
      return { issues: [], loading: false, refetch: vi.fn() }
    })
    render(<Board />)
    const openCol = screen.getByTestId('column-open')
    const cards = openCol.querySelectorAll('[data-testid^="card-"]')
    expect(cards[0]).toHaveTextContent('First')
    expect(cards[1]).toHaveTextContent('Second')
    expect(cards[2]).toHaveTextContent('Third')
  })
})
