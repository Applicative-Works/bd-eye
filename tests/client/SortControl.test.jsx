/** @vitest-environment jsdom */
import { describe, test, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/preact'
import '@testing-library/jest-dom/vitest'
import { signal } from '@preact/signals'
import { SortControl } from '../../src/client/components/SortControl.jsx'

afterEach(cleanup)

const makeSortOrders = (overrides = {}) =>
  signal({ open: 'priority', in_progress: 'priority', closed: 'priority', ...overrides })

describe('SortControl', () => {
  test('renders sort button', () => {
    const sortOrders = makeSortOrders()
    const { container } = render(<SortControl columnKey="open" sortOrders={sortOrders} />)
    expect(container.querySelector('.sort-btn')).toBeInTheDocument()
  })

  test('dropdown is hidden by default', () => {
    const sortOrders = makeSortOrders()
    const { container } = render(<SortControl columnKey="open" sortOrders={sortOrders} />)
    expect(container.querySelector('.sort-dropdown')).not.toBeInTheDocument()
  })

  test('clicking button opens dropdown', () => {
    const sortOrders = makeSortOrders()
    const { container } = render(<SortControl columnKey="open" sortOrders={sortOrders} />)
    fireEvent.click(container.querySelector('.sort-btn'))
    expect(container.querySelector('.sort-dropdown')).toBeInTheDocument()
  })

  test('dropdown shows all sort options', () => {
    const sortOrders = makeSortOrders()
    const { container } = render(<SortControl columnKey="open" sortOrders={sortOrders} />)
    fireEvent.click(container.querySelector('.sort-btn'))
    expect(screen.getByText('Priority')).toBeInTheDocument()
    expect(screen.getByText('Age (oldest)')).toBeInTheDocument()
    expect(screen.getByText('Assignee')).toBeInTheDocument()
    expect(screen.getByText('Type')).toBeInTheDocument()
  })

  test('active sort option has active class', () => {
    const sortOrders = makeSortOrders({ open: 'age' })
    const { container } = render(<SortControl columnKey="open" sortOrders={sortOrders} />)
    fireEvent.click(container.querySelector('.sort-btn'))
    expect(screen.getByText('Age (oldest)')).toHaveClass('sort-option-active')
    expect(screen.getByText('Priority')).not.toHaveClass('sort-option-active')
  })

  test('clicking option updates sort order and closes dropdown', () => {
    const sortOrders = makeSortOrders()
    const { container } = render(<SortControl columnKey="open" sortOrders={sortOrders} />)
    fireEvent.click(container.querySelector('.sort-btn'))
    fireEvent.click(screen.getByText('Assignee'))
    expect(sortOrders.value.open).toBe('assignee')
    expect(container.querySelector('.sort-dropdown')).not.toBeInTheDocument()
  })

  test('sort button has active class when non-default sort', () => {
    const sortOrders = makeSortOrders({ open: 'type' })
    const { container } = render(<SortControl columnKey="open" sortOrders={sortOrders} />)
    expect(container.querySelector('.sort-btn')).toHaveClass('sort-btn-active')
  })

  test('sort button has no active class for default sort', () => {
    const sortOrders = makeSortOrders()
    const { container } = render(<SortControl columnKey="open" sortOrders={sortOrders} />)
    expect(container.querySelector('.sort-btn')).not.toHaveClass('sort-btn-active')
  })

  test('each column uses its own sort order', () => {
    const sortOrders = makeSortOrders({ open: 'age', closed: 'priority' })
    const { container } = render(<SortControl columnKey="open" sortOrders={sortOrders} />)
    expect(container.querySelector('.sort-btn')).toHaveClass('sort-btn-active')
  })

  test('clicking outside closes dropdown', () => {
    const sortOrders = makeSortOrders()
    const { container } = render(<SortControl columnKey="open" sortOrders={sortOrders} />)
    fireEvent.click(container.querySelector('.sort-btn'))
    expect(container.querySelector('.sort-dropdown')).toBeInTheDocument()
    fireEvent.mouseDown(document.body)
    expect(container.querySelector('.sort-dropdown')).not.toBeInTheDocument()
  })
})
