/** @vitest-environment jsdom */
import { describe, test, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/preact'
import '@testing-library/jest-dom/vitest'

vi.mock('@dnd-kit/core', () => ({
  useDroppable: vi.fn(() => ({ setNodeRef: () => {}, isOver: false })),
}))

import { useDroppable } from '@dnd-kit/core'
import { DroppableColumn } from '../../src/client/components/DroppableColumn.jsx'

afterEach(cleanup)

const defaultCol = { key: 'open', label: 'Open' }

describe('DroppableColumn', () => {
  test.each([
    [{ key: 'open', label: 'Open' }, 3, 'Open (3)'],
    [{ key: 'in_progress', label: 'In Progress' }, 12, 'In Progress (12)'],
    [{ key: 'done', label: 'Done' }, 0, 'Done (0)'],
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
})
