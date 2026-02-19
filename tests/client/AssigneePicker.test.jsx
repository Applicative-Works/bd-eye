/** @vitest-environment jsdom */
import { describe, test, expect, vi, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/preact'
import '@testing-library/jest-dom/vitest'

vi.mock('../../src/client/state.js', () => ({
  currentUser: { value: 'Dan' }
}))

import { AssigneePicker } from '../../src/client/components/AssigneePicker.jsx'

afterEach(cleanup)

const renderPicker = (overrides = {}) => {
  const anchor = document.createElement('span')
  anchor.getBoundingClientRect = () => ({ top: 100, bottom: 120, left: 50, right: 150, width: 100, height: 20 })
  document.body.appendChild(anchor)

  const defaults = {
    assignees: ['Alice', 'Bob', 'Carol'],
    currentAssignee: 'Alice',
    onSelect: vi.fn(),
    anchorRef: { current: anchor },
    onClose: vi.fn(),
  }

  const props = { ...defaults, ...overrides }
  const result = render(<AssigneePicker {...props} />)
  return { ...result, ...props, anchor }
}

describe('AssigneePicker', () => {
  test('renders "Assign to me" when currentUser differs from assignee', () => {
    const { anchor } = renderPicker()
    const picker = document.querySelector('.assignee-picker')
    expect(picker.textContent).toContain('Assign to me (Dan)')
    anchor.remove()
  })

  test('does not render "Assign to me" when currentUser is the assignee', () => {
    const { anchor } = renderPicker({ currentAssignee: 'Dan' })
    const picker = document.querySelector('.assignee-picker')
    expect(picker.textContent).not.toContain('Assign to me')
    anchor.remove()
  })

  test('renders Unassigned option', () => {
    const { anchor } = renderPicker()
    const picker = document.querySelector('.assignee-picker')
    expect(picker.textContent).toContain('Unassigned')
    anchor.remove()
  })

  test('renders assignee names excluding current user', () => {
    const { anchor } = renderPicker()
    const picker = document.querySelector('.assignee-picker')
    expect(picker.textContent).toContain('Alice')
    expect(picker.textContent).toContain('Bob')
    expect(picker.textContent).toContain('Carol')
    expect(picker.querySelectorAll('.assignee-picker-item').length).toBe(5)
    anchor.remove()
  })

  test('marks current assignee', () => {
    const { anchor } = renderPicker({ currentAssignee: 'Bob' })
    const current = document.querySelector('.assignee-picker-item-current')
    expect(current).not.toBeNull()
    expect(current.textContent).toContain('Bob')
    anchor.remove()
  })

  test('calls onSelect and onClose when item is clicked', () => {
    const { onSelect, onClose, anchor } = renderPicker()
    const items = document.querySelectorAll('.assignee-picker-item')
    const bobItem = [...items].find(el => el.textContent.includes('Bob'))
    fireEvent.click(bobItem)
    expect(onSelect).toHaveBeenCalledWith('Bob')
    expect(onClose).toHaveBeenCalled()
    anchor.remove()
  })

  test('calls onSelect with null when Unassigned is clicked', () => {
    const { onSelect, anchor } = renderPicker()
    const items = document.querySelectorAll('.assignee-picker-item')
    const unassigned = [...items].find(el => el.textContent === 'Unassigned')
    fireEvent.click(unassigned)
    expect(onSelect).toHaveBeenCalledWith(null)
    anchor.remove()
  })

  test('calls onClose on Escape', () => {
    const { onClose, anchor } = renderPicker()
    const picker = document.querySelector('.assignee-picker')
    fireEvent.keyDown(picker, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
    anchor.remove()
  })

  test('arrow keys move selection', () => {
    const { anchor } = renderPicker()
    const picker = document.querySelector('.assignee-picker')
    fireEvent.keyDown(picker, { key: 'ArrowDown' })
    const active = document.querySelector('.assignee-picker-item-active')
    expect(active).not.toBeNull()
    anchor.remove()
  })

  test('still shows Assign to me and Unassigned when no other assignees', () => {
    const { anchor } = renderPicker({ assignees: [], currentAssignee: null })
    const picker = document.querySelector('.assignee-picker')
    expect(picker.textContent).toContain('Assign to me (Dan)')
    expect(picker.textContent).toContain('Unassigned')
    expect(picker.querySelectorAll('.assignee-picker-item').length).toBe(2)
    anchor.remove()
  })

  test('does not show filter for small lists', () => {
    const { anchor } = renderPicker()
    expect(document.querySelector('.assignee-picker-filter')).toBeNull()
    anchor.remove()
  })

  test('shows filter for lists with more than 8 users', () => {
    const names = Array.from({ length: 10 }, (_, i) => `User${i}`)
    const { anchor } = renderPicker({ assignees: names })
    expect(document.querySelector('.assignee-picker-filter')).not.toBeNull()
    anchor.remove()
  })

  test('closes on mousedown outside', () => {
    const { onClose, anchor } = renderPicker()
    fireEvent.mouseDown(document.body)
    expect(onClose).toHaveBeenCalled()
    anchor.remove()
  })
})
