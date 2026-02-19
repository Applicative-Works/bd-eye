/** @vitest-environment jsdom */
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/preact'
import '@testing-library/jest-dom/vitest'

vi.mock('../../src/client/projectUrl.js', () => ({
  apiUrl: (path) => `/api/projects/test-project${path}`
}))

import { filters, swimlaneGrouping, currentUser } from '../../src/client/state.js'
import { FilterBar } from '../../src/client/components/FilterBar.jsx'

const defaultFilters = {
  priority: [],
  type: [],
  assignee: [],
  label: [],
  blockedOnly: false,
  readyOnly: false,
  assignedToMe: false
}

const mockIssues = [
  { assignee: 'Alice' },
  { assignee: 'Bob' },
  { assignee: 'Alice' },
  { assignee: null },
]

const filterBtn = (container, label) =>
  [...container.querySelectorAll('.filter-btn')].find(b => b.textContent.match(new RegExp(`^${label}`)))

beforeEach(() => {
  filters.value = { ...defaultFilters }
  swimlaneGrouping.value = null
  currentUser.value = 'Dan'
  globalThis.fetch = vi.fn(() =>
    Promise.resolve({ json: () => Promise.resolve({ data: ['frontend', 'backend', 'urgent'] }) })
  )
})

afterEach(cleanup)

describe('FilterBar', () => {
  test.each([
    ['Priority'],
    ['Type'],
    ['Assignee'],
    ['Label'],
  ])('renders %s dropdown button', (label) => {
    const { container } = render(<FilterBar issues={mockIssues} />)
    expect(filterBtn(container, label)).toBeInTheDocument()
  })

  test('renders segmented control with All, Blocked, Ready', () => {
    const { container } = render(<FilterBar issues={mockIssues} />)
    const segBtns = container.querySelectorAll('.filter-seg-btn')
    expect(segBtns).toHaveLength(3)
    expect(segBtns[0]).toHaveTextContent('All')
    expect(segBtns[1]).toHaveTextContent('Blocked')
    expect(segBtns[2]).toHaveTextContent('Ready')
  })

  test('renders Mine chip when currentUser is set', () => {
    render(<FilterBar issues={mockIssues} />)
    expect(screen.getByText('Mine')).toBeInTheDocument()
  })

  test('does not render Mine chip when currentUser is null', () => {
    currentUser.value = null
    render(<FilterBar issues={mockIssues} />)
    expect(screen.queryByText('Mine')).not.toBeInTheDocument()
  })

  test('opens priority dropdown when clicked', () => {
    const { container } = render(<FilterBar issues={mockIssues} />)
    fireEvent.click(filterBtn(container, 'Priority'))
    expect(screen.getByText('P0')).toBeInTheDocument()
  })

  test('closes priority dropdown when another dropdown is opened', () => {
    const { container } = render(<FilterBar issues={mockIssues} />)
    fireEvent.click(filterBtn(container, 'Priority'))
    expect(screen.getByText('P0')).toBeInTheDocument()
    fireEvent.click(filterBtn(container, 'Type'))
    expect(screen.queryByText('P0')).not.toBeInTheDocument()
    expect(screen.getByText('bug')).toBeInTheDocument()
  })

  test('closes dropdown on Escape key', () => {
    const { container } = render(<FilterBar issues={mockIssues} />)
    fireEvent.click(filterBtn(container, 'Priority'))
    expect(screen.getByText('P0')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByText('P0')).not.toBeInTheDocument()
  })

  test('closes dropdown on click outside', () => {
    const { container } = render(<FilterBar issues={mockIssues} />)
    fireEvent.click(filterBtn(container, 'Priority'))
    expect(screen.getByText('P0')).toBeInTheDocument()
    fireEvent.mouseDown(document.body)
    expect(screen.queryByText('P0')).not.toBeInTheDocument()
  })

  test('selecting a priority filter updates the signal', () => {
    const { container } = render(<FilterBar issues={mockIssues} />)
    fireEvent.click(filterBtn(container, 'Priority'))
    fireEvent.click(screen.getByText('P1'))
    expect(filters.value.priority).toEqual([1])
  })

  test('deselecting a priority filter removes it from the signal', () => {
    filters.value = { ...defaultFilters, priority: [2] }
    const { container } = render(<FilterBar issues={mockIssues} />)
    fireEvent.click(filterBtn(container, 'Priority'))
    const dropdown = container.querySelector('.filter-dropdown')
    const checkbox = dropdown.querySelector('input[type="checkbox"]:checked')
    fireEvent.click(checkbox)
    expect(filters.value.priority).toEqual([])
  })

  test('selecting a type filter updates the signal', () => {
    const { container } = render(<FilterBar issues={mockIssues} />)
    fireEvent.click(filterBtn(container, 'Type'))
    fireEvent.click(screen.getByText('bug'))
    expect(filters.value.type).toEqual(['bug'])
  })

  test('shows assignees derived from issues', () => {
    const { container } = render(<FilterBar issues={mockIssues} />)
    fireEvent.click(filterBtn(container, 'Assignee'))
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  test('fetches labels on mount', async () => {
    const { container } = render(<FilterBar issues={mockIssues} />)
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/projects/test-project/labels')
    })
    fireEvent.click(filterBtn(container, 'Label'))
    expect(screen.getByText('frontend')).toBeInTheDocument()
    expect(screen.getByText('backend')).toBeInTheDocument()
  })

  test('clicking Blocked segment sets blockedOnly', () => {
    const { container } = render(<FilterBar issues={mockIssues} />)
    const segBtns = container.querySelectorAll('.filter-seg-btn')
    fireEvent.click(segBtns[1])
    expect(filters.value.blockedOnly).toBe(true)
    expect(filters.value.readyOnly).toBe(false)
  })

  test('clicking Ready segment sets readyOnly', () => {
    const { container } = render(<FilterBar issues={mockIssues} />)
    const segBtns = container.querySelectorAll('.filter-seg-btn')
    fireEvent.click(segBtns[2])
    expect(filters.value.readyOnly).toBe(true)
    expect(filters.value.blockedOnly).toBe(false)
  })

  test('clicking All segment clears both blocked and ready', () => {
    filters.value = { ...defaultFilters, blockedOnly: true }
    const { container } = render(<FilterBar issues={mockIssues} />)
    const segBtns = container.querySelectorAll('.filter-seg-btn')
    fireEvent.click(segBtns[0])
    expect(filters.value.blockedOnly).toBe(false)
    expect(filters.value.readyOnly).toBe(false)
  })

  test('clicking Mine toggles assignedToMe', () => {
    const { container } = render(<FilterBar issues={mockIssues} />)
    const mineBtn = container.querySelector('.filter-mine')
    fireEvent.click(mineBtn)
    expect(filters.value.assignedToMe).toBe(true)
    fireEvent.click(mineBtn)
    expect(filters.value.assignedToMe).toBe(false)
  })

  test('shows filter chips for active filters', () => {
    filters.value = { ...defaultFilters, priority: [0], type: ['bug'] }
    render(<FilterBar issues={mockIssues} />)
    expect(screen.getByText('P0')).toBeInTheDocument()
    expect(screen.getByText('bug')).toBeInTheDocument()
  })

  test('shows "Clear all" button when filters are active', () => {
    filters.value = { ...defaultFilters, priority: [1] }
    render(<FilterBar issues={mockIssues} />)
    expect(screen.getByText('Clear all')).toBeInTheDocument()
  })

  test('clear all resets all filters including assignedToMe', () => {
    filters.value = { ...defaultFilters, priority: [1], type: ['bug'], blockedOnly: true, assignedToMe: true }
    render(<FilterBar issues={mockIssues} />)
    fireEvent.click(screen.getByText('Clear all'))
    expect(filters.value).toEqual(defaultFilters)
  })

  test('does not show "Clear all" when no filters active', () => {
    render(<FilterBar issues={mockIssues} />)
    expect(screen.queryByText('Clear all')).not.toBeInTheDocument()
  })

  test('dropdown button shows selection count', () => {
    filters.value = { ...defaultFilters, priority: [1, 2] }
    const { container } = render(<FilterBar issues={mockIssues} />)
    expect(filterBtn(container, 'Priority')).toHaveTextContent(/Priority \(2\)/)
  })

  test('removing a filter chip updates the signal', () => {
    filters.value = { ...defaultFilters, priority: [1, 2] }
    render(<FilterBar issues={mockIssues} />)
    const chip = screen.getByText('P1').closest('.filter-chip')
    fireEvent.click(chip.querySelector('.filter-chip-remove'))
    expect(filters.value.priority).toEqual([2])
  })

  test('removing a boolean filter chip resets it', () => {
    filters.value = { ...defaultFilters, blockedOnly: true }
    const { container } = render(<FilterBar issues={mockIssues} />)
    const chips = container.querySelectorAll('.filter-chip')
    const blockedChip = [...chips].find(c => c.textContent.includes('Blocked only'))
    fireEvent.click(blockedChip.querySelector('.filter-chip-remove'))
    expect(filters.value.blockedOnly).toBe(false)
  })

  test('handles label fetch failure gracefully', async () => {
    globalThis.fetch = vi.fn(() => Promise.reject(new Error('fail')))
    const { container } = render(<FilterBar issues={mockIssues} />)
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled())
    fireEvent.click(filterBtn(container, 'Label'))
  })
})

describe('GroupByControl', () => {
  test('renders group-by buttons', () => {
    const { container } = render(<FilterBar issues={mockIssues} />)
    const btns = container.querySelectorAll('.group-by-btn')
    expect(btns).toHaveLength(5)
    expect(btns[0]).toHaveTextContent('None')
    expect(btns[1]).toHaveTextContent('Assignee')
    expect(btns[2]).toHaveTextContent('Priority')
    expect(btns[3]).toHaveTextContent('Type')
    expect(btns[4]).toHaveTextContent('Label')
  })

  test('None is active by default', () => {
    const { container } = render(<FilterBar issues={mockIssues} />)
    const active = container.querySelector('.group-by-btn-active')
    expect(active).toHaveTextContent('None')
  })

  test('clicking a grouping option updates the signal', () => {
    const { container } = render(<FilterBar issues={mockIssues} />)
    const btns = container.querySelectorAll('.group-by-btn')
    fireEvent.click(btns[1])
    expect(swimlaneGrouping.value).toBe('assignee')
    expect(btns[1]).toHaveClass('group-by-btn-active')
  })

  test('clicking None clears grouping', () => {
    swimlaneGrouping.value = 'assignee'
    const { container } = render(<FilterBar issues={mockIssues} />)
    const btns = container.querySelectorAll('.group-by-btn')
    fireEvent.click(btns[0])
    expect(swimlaneGrouping.value).toBeNull()
  })
})
