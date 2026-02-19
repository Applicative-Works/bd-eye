/** @vitest-environment jsdom */
import { describe, test, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/preact'
import '@testing-library/jest-dom/vitest'

vi.mock('@dnd-kit/core', () => ({
  useDroppable: vi.fn(() => ({ setNodeRef: () => {}, isOver: false })),
}))

vi.mock('../../src/client/state.js', async () => {
  const { signal } = await import('@preact/signals')
  return {
    wipLimits: signal({ open: null, in_progress: null, closed: null }),
  }
})

import { useDroppable } from '@dnd-kit/core'
import { wipLimits } from '../../src/client/state.js'
import { DroppableColumn } from '../../src/client/components/DroppableColumn.jsx'

afterEach(cleanup)
beforeEach(() => {
  vi.clearAllMocks()
  wipLimits.value = { open: null, in_progress: null, closed: null }
})

const defaultCol = { key: 'open', label: 'Open' }

describe('DroppableColumn', () => {
  test.each([
    [{ key: 'open', label: 'Open' }, 3, 'Open 3'],
    [{ key: 'in_progress', label: 'In Progress' }, 12, 'In Progress 12'],
    [{ key: 'done', label: 'Done' }, 0, 'Done 0'],
  ])('renders label and count for %j', (col, count, expected) => {
    const { container } = render(<DroppableColumn col={col} count={count} />)
    expect(container.querySelector('.column-header')).toHaveTextContent(expected)
  })

  test('renders children', () => {
    const { container } = render(
      <DroppableColumn col={defaultCol} count={1}>
        <div data-testid="child">card</div>
      </DroppableColumn>
    )
    expect(container.querySelector('[data-testid="child"]')).toBeInTheDocument()
  })

  test('renders headerExtra', () => {
    const { container } = render(
      <DroppableColumn col={defaultCol} count={0} headerExtra={<span data-testid="extra">+</span>} />
    )
    expect(container.querySelector('[data-testid="extra"]')).toBeInTheDocument()
  })

  test('calls useDroppable with column key', () => {
    render(<DroppableColumn col={{ key: 'todo', label: 'Todo' }} count={0} />)
    expect(useDroppable).toHaveBeenCalledWith({ id: 'todo' })
  })

  test('does not have drop-active class by default', () => {
    const { container } = render(<DroppableColumn col={defaultCol} count={0} />)
    expect(container.querySelector('.column')).not.toHaveClass('column-drop-active')
  })

  test('has drop-active class when isOver is true', () => {
    useDroppable.mockReturnValueOnce({ setNodeRef: () => {}, isOver: true })
    const { container } = render(<DroppableColumn col={defaultCol} count={0} />)
    expect(container.querySelector('.column-drop-active')).toBeInTheDocument()
  })

  test('shows count/limit when WIP limit is set', () => {
    wipLimits.value = { open: 5, in_progress: null, closed: null }
    const { container } = render(<DroppableColumn col={defaultCol} count={3} />)
    expect(container.querySelector('.wip-count')).toHaveTextContent('3/5')
  })

  test('shows just count when no WIP limit', () => {
    const { container } = render(<DroppableColumn col={defaultCol} count={3} />)
    expect(container.querySelector('.wip-count')).toHaveTextContent('3')
  })

  test('adds exceeded class when count meets limit', () => {
    wipLimits.value = { open: 3, in_progress: null, closed: null }
    const { container } = render(<DroppableColumn col={defaultCol} count={3} />)
    expect(container.querySelector('.column-wip-exceeded')).toBeInTheDocument()
    expect(container.querySelector('.column-header-exceeded')).toBeInTheDocument()
    expect(container.querySelector('.wip-exceeded')).toBeInTheDocument()
  })

  test('adds exceeded class when count exceeds limit', () => {
    wipLimits.value = { open: 2, in_progress: null, closed: null }
    const { container } = render(<DroppableColumn col={defaultCol} count={5} />)
    expect(container.querySelector('.column-wip-exceeded')).toBeInTheDocument()
  })

  test('no exceeded class when count is below limit', () => {
    wipLimits.value = { open: 10, in_progress: null, closed: null }
    const { container } = render(<DroppableColumn col={defaultCol} count={3} />)
    expect(container.querySelector('.column-wip-exceeded')).toBeNull()
    expect(container.querySelector('.wip-exceeded')).toBeNull()
  })

  test('clicking wip count shows edit input', () => {
    const { container } = render(<DroppableColumn col={defaultCol} count={3} />)
    fireEvent.click(container.querySelector('.wip-count'))
    expect(container.querySelector('.wip-edit-input')).toBeInTheDocument()
  })

  test('submitting edit updates wipLimits', () => {
    const { container } = render(<DroppableColumn col={defaultCol} count={3} />)
    fireEvent.click(container.querySelector('.wip-count'))
    const input = container.querySelector('.wip-edit-input')
    input.value = '5'
    fireEvent.submit(container.querySelector('.wip-edit-form'))
    expect(wipLimits.value.open).toBe(5)
  })

  test('submitting empty clears the limit', () => {
    wipLimits.value = { open: 5, in_progress: null, closed: null }
    const { container } = render(<DroppableColumn col={defaultCol} count={3} />)
    fireEvent.click(container.querySelector('.wip-count'))
    const input = container.querySelector('.wip-edit-input')
    input.value = ''
    fireEvent.submit(container.querySelector('.wip-edit-form'))
    expect(wipLimits.value.open).toBeNull()
  })

  test('escape key closes edit without saving', () => {
    wipLimits.value = { open: 5, in_progress: null, closed: null }
    const { container } = render(<DroppableColumn col={defaultCol} count={3} />)
    fireEvent.click(container.querySelector('.wip-count'))
    const input = container.querySelector('.wip-edit-input')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(container.querySelector('.wip-edit-input')).toBeNull()
    expect(wipLimits.value.open).toBe(5)
  })
})
