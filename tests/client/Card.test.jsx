/** @vitest-environment jsdom */
import { describe, test, expect, vi, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/preact'
import '@testing-library/jest-dom/vitest'

vi.mock('@dnd-kit/core', () => ({
  useDraggable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => {},
    transform: null,
  })),
}))

import { Card } from '../../src/client/components/Card.jsx'

afterEach(cleanup)

const baseIssue = {
  id: 'PROJ-1',
  title: 'Fix login bug',
  status: 'open',
  priority: 1,
  issue_type: 'bug',
  assignee: 'Dan',
  labels: [],
  blocked_by_count: 0,
  blocks_count: 0,
}

const issueWith = (overrides) => ({ ...baseIssue, ...overrides })

describe('Card', () => {
  test('renders issue title', () => {
    const { container } = render(<Card issue={baseIssue} />)
    expect(container.querySelector('.line-clamp-2')).toHaveTextContent('Fix login bug')
  })

  test('renders issue id', () => {
    const { container } = render(<Card issue={baseIssue} />)
    expect(container.querySelector('.font-mono')).toHaveTextContent('PROJ-1')
  })

  test.each([
    [1, 'P1', 'badge-p1'],
    [2, 'P2', 'badge-p2'],
    [3, 'P3', 'badge-p3'],
  ])('renders priority %d as "%s" with class "%s"', (priority, text, cls) => {
    const { container } = render(<Card issue={issueWith({ priority })} />)
    const badge = container.querySelector(`.${cls}`)
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent(text)
  })

  test('renders issue type as pill badge', () => {
    const { container } = render(<Card issue={issueWith({ issue_type: 'story' })} />)
    expect(container.querySelector('.badge-story')).toHaveTextContent('story')
  })

  test('renders assignee', () => {
    const { container } = render(<Card issue={issueWith({ assignee: 'Alice' })} />)
    expect(container.textContent).toContain('Alice')
  })

  test('renders "unassigned" when no assignee', () => {
    const { container } = render(<Card issue={issueWith({ assignee: null })} />)
    expect(container.textContent).toContain('unassigned')
  })

  test.each([
    [['frontend', 'urgent'], 2],
    [['backend'], 1],
    [[], 0],
  ])('renders labels %j (%d label badges)', (labels, expectedCount) => {
    const { container } = render(<Card issue={issueWith({ labels })} />)
    expect(container.querySelectorAll('.badge-label')).toHaveLength(expectedCount)
  })

  test('calls onClick with issue id when clicked', () => {
    const onClick = vi.fn()
    const { container } = render(<Card issue={baseIssue} onClick={onClick} />)
    fireEvent.click(container.querySelector('.card'))
    expect(onClick).toHaveBeenCalledWith('PROJ-1')
  })

  test('does not throw when clicked without onClick handler', () => {
    const { container } = render(<Card issue={baseIssue} />)
    expect(() => fireEvent.click(container.querySelector('.card'))).not.toThrow()
  })

  test('shows blocked_by indicator when blocked_by_count > 0', () => {
    const { container } = render(<Card issue={issueWith({ blocked_by_count: 2 })} />)
    expect(container.textContent).toContain('\u2b062')
  })

  test('shows blocks indicator when blocks_count > 0', () => {
    const { container } = render(<Card issue={issueWith({ blocks_count: 3 })} />)
    expect(container.textContent).toContain('\u2b073')
  })

  test('hides dependency indicators when both counts are 0', () => {
    const { container } = render(<Card issue={baseIssue} />)
    expect(container.textContent).not.toContain('\u2b06')
    expect(container.textContent).not.toContain('\u2b07')
  })

  test('has card-blocked class when blocked_by_count > 0', () => {
    const { container } = render(<Card issue={issueWith({ blocked_by_count: 1 })} />)
    expect(container.firstChild).toHaveClass('card-blocked')
  })

  test('has card-ready class when open and not blocked', () => {
    const { container } = render(<Card issue={issueWith({ status: 'open', blocked_by_count: 0 })} />)
    expect(container.firstChild).toHaveClass('card-ready')
  })

  test('has card-dragging class when isDragging', () => {
    const { container } = render(<Card issue={baseIssue} isDragging={true} />)
    expect(container.firstChild).toHaveClass('card-dragging')
  })
})
