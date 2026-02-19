/** @vitest-environment jsdom */
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/preact'
import '@testing-library/jest-dom/vitest'

vi.mock('../../src/client/hooks/useIssues.js', () => ({
  useIssues: vi.fn(),
}))

vi.mock('../../src/client/router.js', () => ({
  selectIssue: vi.fn(),
}))

import { useIssues } from '../../src/client/hooks/useIssues.js'
import { selectIssue } from '../../src/client/router.js'
import { ReadyQueue } from '../../src/client/components/ReadyQueue.jsx'

const mockIssues = [
  { id: 'PROJ-1', title: 'Fix login bug', priority: 1, issue_type: 'bug', assignee: 'Alice', labels: ['frontend'] },
  { id: 'PROJ-2', title: 'Add dashboard', priority: 2, issue_type: 'feature', assignee: null, labels: [] },
  { id: 'PROJ-3', title: 'Refactor auth', priority: 0, issue_type: 'task', assignee: 'Bob', labels: ['backend', 'urgent'] },
]

beforeEach(() => {
  vi.clearAllMocks()
  useIssues.mockReturnValue({ issues: mockIssues, loading: false })
})

afterEach(cleanup)

describe('ReadyQueue', () => {
  test('shows loading state', () => {
    useIssues.mockReturnValue({ issues: [], loading: true })
    render(<ReadyQueue />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  test('shows empty state message when no issues', () => {
    useIssues.mockReturnValue({ issues: [], loading: false })
    render(<ReadyQueue />)
    expect(screen.getByText(/nothing ready to work on/)).toBeInTheDocument()
  })

  test('calls useIssues with ready endpoint', () => {
    render(<ReadyQueue />)
    expect(useIssues).toHaveBeenCalledWith('/api/issues/ready')
  })

  test('renders heading with issue count', () => {
    render(<ReadyQueue />)
    expect(screen.getByText('Ready Issues (3)')).toBeInTheDocument()
  })

  test('renders table headers', () => {
    render(<ReadyQueue />)
    ;['Priority', 'ID', 'Title', 'Type', 'Assignee', 'Labels'].forEach(header => {
      expect(screen.getByText(header)).toBeInTheDocument()
    })
  })

  test.each([
    ['PROJ-1', 'Fix login bug'],
    ['PROJ-2', 'Add dashboard'],
    ['PROJ-3', 'Refactor auth'],
  ])('renders issue %s with title %s', (id, title) => {
    render(<ReadyQueue />)
    expect(screen.getByText(id)).toBeInTheDocument()
    expect(screen.getByText(title)).toBeInTheDocument()
  })

  test('renders "unassigned" for issues without assignee', () => {
    render(<ReadyQueue />)
    expect(screen.getByText('unassigned')).toBeInTheDocument()
  })

  test('renders labels as badges', () => {
    render(<ReadyQueue />)
    expect(screen.getByText('frontend')).toBeInTheDocument()
    expect(screen.getByText('backend')).toBeInTheDocument()
    expect(screen.getByText('urgent')).toBeInTheDocument()
  })

  test('clicking a row calls selectIssue', () => {
    render(<ReadyQueue />)
    fireEvent.click(screen.getByText('Fix login bug'))
    expect(selectIssue).toHaveBeenCalledWith('PROJ-1')
  })

  test.each([
    ['j'],
    ['ArrowDown'],
  ])('pressing %s moves selection down', (key) => {
    render(<ReadyQueue />)
    fireEvent.keyDown(window, { key })
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows[0]).toHaveClass('ready-row-active')
  })

  test('pressing k after j returns to first row', () => {
    render(<ReadyQueue />)
    fireEvent.keyDown(window, { key: 'j' })
    fireEvent.keyDown(window, { key: 'j' })
    fireEvent.keyDown(window, { key: 'k' })
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows[0]).toHaveClass('ready-row-active')
  })

  test('ArrowUp does not go below index 0', () => {
    render(<ReadyQueue />)
    fireEvent.keyDown(window, { key: 'j' })
    fireEvent.keyDown(window, { key: 'ArrowUp' })
    fireEvent.keyDown(window, { key: 'ArrowUp' })
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows[0]).toHaveClass('ready-row-active')
    expect(rows[1]).not.toHaveClass('ready-row-active')
  })

  test('Enter on selected row calls selectIssue', () => {
    render(<ReadyQueue />)
    fireEvent.keyDown(window, { key: 'j' })
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(selectIssue).toHaveBeenCalledWith('PROJ-1')
  })

  test('keyboard navigation ignores input elements', () => {
    const { container } = render(<ReadyQueue />)
    const input = document.createElement('input')
    container.appendChild(input)
    input.focus()
    fireEvent.keyDown(window, { key: 'j' })
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows[0]).not.toHaveClass('ready-row-active')
  })
})
