/** @vitest-environment jsdom */
import { describe, test, expect, vi, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/preact'
import '@testing-library/jest-dom/vitest'
import { FilterChip } from '../../src/client/components/FilterChip.jsx'

afterEach(cleanup)

describe('FilterChip', () => {
  test('renders the label', () => {
    const { container } = render(<FilterChip label="Priority: High" onRemove={() => {}} />)
    expect(container.querySelector('span')).toHaveTextContent('Priority: High')
  })

  test('renders a remove button with x character', () => {
    const { container } = render(<FilterChip label="test" onRemove={() => {}} />)
    const button = container.querySelector('button')
    expect(button).toHaveTextContent('\u00d7')
    expect(button).toHaveClass('filter-chip-remove')
  })

  test('calls onRemove when button is clicked', () => {
    const onRemove = vi.fn()
    const { container } = render(<FilterChip label="test" onRemove={onRemove} />)
    fireEvent.click(container.querySelector('button'))
    expect(onRemove).toHaveBeenCalledOnce()
  })

  test.each([
    ['Status: Open'],
    ['Assignee: Dan'],
    ['Label: frontend'],
  ])('renders label "%s"', (label) => {
    const { container } = render(<FilterChip label={label} onRemove={() => {}} />)
    expect(container.querySelector('span')).toHaveTextContent(label)
  })

  test('has filter-chip container class', () => {
    const { container } = render(<FilterChip label="x" onRemove={() => {}} />)
    expect(container.querySelector('.filter-chip')).toBeInTheDocument()
  })
})
