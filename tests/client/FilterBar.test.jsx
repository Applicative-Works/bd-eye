/** @vitest-environment jsdom */
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/preact'
import '@testing-library/jest-dom/vitest'
import { filters } from '../../src/client/state.js'
import { FilterBar } from '../../src/client/components/FilterBar.jsx'

const defaultFilters = {
  priority: [],
  type: [],
  assignee: [],
  label: [],
  blockedOnly: false,
  readyOnly: false
}

const mockIssues = [
  { assignee: 'Alice' },
  { assignee: 'Bob' },
  { assignee: 'Alice' },
  { assignee: null },
]

beforeEach(() => {
  filters.value = { ...defaultFilters }
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
    render(<FilterBar issues={mockIssues} />)
    expect(screen.getByText(new RegExp(`^${label}`))).toBeInTheDocument()
  })

  test.each([
    ['Blocked only'],
    ['Ready only'],
  ])('renders %s toggle button', (label) => {
    render(<FilterBar issues={mockIssues} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  test('opens priority dropdown when clicked', () => {
    render(<FilterBar issues={mockIssues} />)
    fireEvent.click(screen.getByText(/^Priority/))
    expect(screen.getByText('P0')).toBeInTheDocument()
  })

  test('closes priority dropdown when another dropdown is opened', () => {
    render(<FilterBar issues={mockIssues} />)
    fireEvent.click(screen.getByText(/^Priority/))
    expect(screen.getByText('P0')).toBeInTheDocument()
    fireEvent.click(screen.getByText(/^Type/))
    expect(screen.queryByText('P0')).not.toBeInTheDocument()
    expect(screen.getByText('bug')).toBeInTheDocument()
  })

  test('closes dropdown on Escape key', () => {
    render(<FilterBar issues={mockIssues} />)
    fireEvent.click(screen.getByText(/^Priority/))
    expect(screen.getByText('P0')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByText('P0')).not.toBeInTheDocument()
  })

  test('closes dropdown on click outside', () => {
    render(<FilterBar issues={mockIssues} />)
    fireEvent.click(screen.getByText(/^Priority/))
    expect(screen.getByText('P0')).toBeInTheDocument()
    fireEvent.mouseDown(document.body)
    expect(screen.queryByText('P0')).not.toBeInTheDocument()
  })

  test('selecting a priority filter updates the signal', () => {
    render(<FilterBar issues={mockIssues} />)
    fireEvent.click(screen.getByText(/^Priority/))
    fireEvent.click(screen.getByText('P1'))
    expect(filters.value.priority).toEqual([1])
  })

  test('deselecting a priority filter removes it from the signal', () => {
    filters.value = { ...defaultFilters, priority: [2] }
    const { container } = render(<FilterBar issues={mockIssues} />)
    fireEvent.click(screen.getByText(/^Priority/))
    const dropdown = container.querySelector('.filter-dropdown')
    const checkbox = dropdown.querySelector('input[type="checkbox"]:checked')
    fireEvent.click(checkbox)
    expect(filters.value.priority).toEqual([])
  })

  test('selecting a type filter updates the signal', () => {
    render(<FilterBar issues={mockIssues} />)
    fireEvent.click(screen.getByText(/^Type/))
    fireEvent.click(screen.getByText('bug'))
    expect(filters.value.type).toEqual(['bug'])
  })

  test('shows assignees derived from issues', () => {
    render(<FilterBar issues={mockIssues} />)
    fireEvent.click(screen.getByText(/^Assignee/))
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  test('fetches labels on mount', async () => {
    render(<FilterBar issues={mockIssues} />)
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/labels')
    })
    fireEvent.click(screen.getByText(/^Label/))
    expect(screen.getByText('frontend')).toBeInTheDocument()
    expect(screen.getByText('backend')).toBeInTheDocument()
  })

  test.each([
    ['blockedOnly', 'Blocked only'],
    ['readyOnly', 'Ready only'],
  ])('toggling %s updates signal and shows chip', (key, label) => {
    render(<FilterBar issues={mockIssues} />)
    fireEvent.click(screen.getByText(label))
    expect(filters.value[key]).toBe(true)
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

  test('clear all resets all filters', () => {
    filters.value = { ...defaultFilters, priority: [1], type: ['bug'], blockedOnly: true }
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
    render(<FilterBar issues={mockIssues} />)
    expect(screen.getByText(/Priority \(2\)/)).toBeInTheDocument()
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
    render(<FilterBar issues={mockIssues} />)
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled())
    fireEvent.click(screen.getByText(/^Label/))
  })
})
