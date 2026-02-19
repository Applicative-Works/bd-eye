/** @vitest-environment jsdom */
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/preact'
import '@testing-library/jest-dom/vitest'
import { SearchModal } from '../../src/client/components/SearchModal.jsx'

const mockResults = [
  { id: 'PROJ-1', title: 'Fix login bug', priority: 1, status: 'open' },
  { id: 'PROJ-2', title: 'Add dashboard', priority: 2, status: 'in_progress' },
  { id: 'PROJ-3', title: 'Refactor auth', priority: 3, status: 'done' },
]

beforeEach(() => {
  vi.useFakeTimers()
  globalThis.fetch = vi.fn(() =>
    Promise.resolve({ json: () => Promise.resolve({ data: mockResults }) })
  )
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const renderModal = (overrides = {}) =>
  render(<SearchModal onClose={vi.fn()} onSelect={vi.fn()} {...overrides} />)

describe('SearchModal', () => {
  test('renders search input with placeholder', () => {
    renderModal()
    expect(screen.getByPlaceholderText('Search issues...')).toBeInTheDocument()
  })

  test('input is focused on mount', () => {
    renderModal()
    expect(screen.getByPlaceholderText('Search issues...')).toHaveFocus()
  })

  test('calls onClose when overlay is clicked', () => {
    const onClose = vi.fn()
    renderModal({ onClose })
    fireEvent.click(screen.getByPlaceholderText('Search issues...').closest('.search-overlay'))
    expect(onClose).toHaveBeenCalled()
  })

  test('does not call onClose when modal body is clicked', () => {
    const onClose = vi.fn()
    renderModal({ onClose })
    fireEvent.click(screen.getByPlaceholderText('Search issues...').closest('.search-modal'))
    expect(onClose).not.toHaveBeenCalled()
  })

  test('calls onClose on Escape key', () => {
    const onClose = vi.fn()
    renderModal({ onClose })
    fireEvent.keyDown(screen.getByPlaceholderText('Search issues...').closest('.search-overlay'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  test('debounces search by 300ms', async () => {
    renderModal()
    fireEvent.input(screen.getByPlaceholderText('Search issues...'), { target: { value: 'fix' } })
    expect(globalThis.fetch).not.toHaveBeenCalled()
    vi.advanceTimersByTime(300)
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/search?q=fix')
    })
  })

  test('renders search results after typing', async () => {
    renderModal()
    fireEvent.input(screen.getByPlaceholderText('Search issues...'), { target: { value: 'fix' } })
    vi.advanceTimersByTime(300)
    await waitFor(() => {
      expect(screen.getByText('Fix login bug')).toBeInTheDocument()
      expect(screen.getByText('Add dashboard')).toBeInTheDocument()
    })
  })

  test('shows "No issues found" for empty results', async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve({ json: () => Promise.resolve({ data: [] }) })
    )
    renderModal()
    fireEvent.input(screen.getByPlaceholderText('Search issues...'), { target: { value: 'xyz' } })
    vi.advanceTimersByTime(300)
    await waitFor(() => {
      expect(screen.getByText('No issues found')).toBeInTheDocument()
    })
  })

  test('does not show "No issues found" when query is empty', () => {
    renderModal()
    expect(screen.queryByText('No issues found')).not.toBeInTheDocument()
  })

  test('Enter on selected result calls onSelect and onClose', async () => {
    const onSelect = vi.fn()
    const onClose = vi.fn()
    renderModal({ onSelect, onClose })
    fireEvent.input(screen.getByPlaceholderText('Search issues...'), { target: { value: 'fix' } })
    vi.advanceTimersByTime(300)
    await waitFor(() => {
      expect(screen.getByText('Fix login bug')).toBeInTheDocument()
    })
    fireEvent.keyDown(screen.getByPlaceholderText('Search issues...').closest('.search-overlay'), { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledWith('PROJ-1')
    expect(onClose).toHaveBeenCalled()
  })

  test('clicking a result calls onSelect and onClose', async () => {
    const onSelect = vi.fn()
    const onClose = vi.fn()
    renderModal({ onSelect, onClose })
    fireEvent.input(screen.getByPlaceholderText('Search issues...'), { target: { value: 'fix' } })
    vi.advanceTimersByTime(300)
    await waitFor(() => {
      expect(screen.getByText('Add dashboard')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Add dashboard'))
    expect(onSelect).toHaveBeenCalledWith('PROJ-2')
    expect(onClose).toHaveBeenCalled()
  })

  test('ArrowDown moves selection to next result', async () => {
    renderModal()
    fireEvent.input(screen.getByPlaceholderText('Search issues...'), { target: { value: 'fix' } })
    vi.advanceTimersByTime(300)
    await waitFor(() => {
      expect(screen.getByText('Fix login bug')).toBeInTheDocument()
    })
    fireEvent.keyDown(screen.getByPlaceholderText('Search issues...').closest('.search-overlay'), { key: 'ArrowDown' })
    expect(screen.getByText('Add dashboard').closest('.search-result')).toHaveClass('search-result-active')
  })

  test('ArrowUp moves selection to previous result', async () => {
    renderModal()
    fireEvent.input(screen.getByPlaceholderText('Search issues...'), { target: { value: 'fix' } })
    vi.advanceTimersByTime(300)
    await waitFor(() => {
      expect(screen.getByText('Fix login bug')).toBeInTheDocument()
    })
    fireEvent.keyDown(screen.getByPlaceholderText('Search issues...').closest('.search-overlay'), { key: 'ArrowDown' })
    fireEvent.keyDown(screen.getByPlaceholderText('Search issues...').closest('.search-overlay'), { key: 'ArrowUp' })
    expect(screen.getByText('Fix login bug').closest('.search-result')).toHaveClass('search-result-active')
  })

  test('renders footer with keyboard hints', () => {
    renderModal()
    expect(screen.getByText('↑↓ navigate')).toBeInTheDocument()
    expect(screen.getByText('↵ select')).toBeInTheDocument()
    expect(screen.getByText('esc close')).toBeInTheDocument()
  })
})
