import { useState, useEffect, useRef } from 'preact/hooks'
import { createPortal } from 'preact/compat'
import { currentUser } from '../state.js'

/**
 * @param {{ assignees: string[], currentAssignee: string | null, onSelect: (assignee: string | null) => void, anchorRef: { current: HTMLElement | null }, onClose: () => void }} props
 */
export const AssigneePicker = ({ assignees, currentAssignee, onSelect, anchorRef, onClose }) => {
  const popoverRef = useRef(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [filter, setFilter] = useState('')
  const filterRef = useRef(null)

  const me = currentUser.value
  const showFilter = assignees.length > 8

  const options = buildOptions(assignees, currentAssignee, me, filter)

  useEffect(() => {
    if (showFilter) filterRef.current?.focus()
  }, [showFilter])

  useEffect(() => {
    const anchor = anchorRef.current
    const popover = popoverRef.current
    if (!anchor || !popover) return

    const rect = anchor.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceRight = window.innerWidth - rect.left

    popover.style.left = spaceRight < 200
      ? `${rect.right - Math.min(popover.offsetWidth, 200)}px`
      : `${rect.left}px`

    popover.style.top = spaceBelow < 200
      ? `${rect.top - popover.offsetHeight - 4}px`
      : `${rect.bottom + 4}px`
  })

  useEffect(() => {
    const handleMouseDown = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) onClose()
    }
    const handleScroll = () => onClose()
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('scroll', handleScroll, true)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('scroll', handleScroll, true)
    }
  }, [onClose])

  const handleKeyDown = (e) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(i => Math.min(i + 1, options.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(i => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (options[selectedIndex]) {
          onSelect(options[selectedIndex].value)
          onClose()
        }
        break
      case 'Escape':
        e.preventDefault()
        onClose()
        break
    }
  }

  useEffect(() => {
    setSelectedIndex(0)
  }, [filter])

  return createPortal(
    <div class="assignee-picker" ref={popoverRef} onKeyDown={handleKeyDown} role="listbox">
      {showFilter && (
        <input
          ref={filterRef}
          class="assignee-picker-filter"
          type="text"
          placeholder="Filter..."
          value={filter}
          onInput={e => setFilter(e.target.value)}
          aria-label="Filter assignees"
        />
      )}
      <div class="assignee-picker-list">
        {options.map((opt, i) => (
          <div
            key={opt.key}
            class={`assignee-picker-item${i === selectedIndex ? ' assignee-picker-item-active' : ''}${opt.isCurrent ? ' assignee-picker-item-current' : ''}${opt.separator ? ' assignee-picker-item-separator' : ''}`}
            role="option"
            aria-selected={opt.isCurrent}
            onClick={() => { onSelect(opt.value); onClose() }}
            onMouseEnter={() => setSelectedIndex(i)}
          >
            {opt.isCurrent && <span class="assignee-picker-check">✓</span>}
            {opt.label}
          </div>
        ))}
        {options.length === 0 && (
          <div class="assignee-picker-empty">No assignees in this project yet</div>
        )}
      </div>
    </div>,
    document.body
  )
}

const buildOptions = (assignees, currentAssignee, me, filter) => {
  const pinned = []

  if (me && me !== currentAssignee) {
    pinned.push({ key: '__me', label: `Assign to me (${me})`, value: me, isCurrent: false, separator: false })
  }
  pinned.push({ key: '__unassigned', label: 'Unassigned', value: null, isCurrent: currentAssignee === null, separator: pinned.length > 0 })

  const filtered = filter
    ? assignees.filter(a => a.toLowerCase().includes(filter.toLowerCase()))
    : assignees

  const rest = filtered
    .filter(a => a !== me)
    .map((a, i) => ({
      key: a,
      label: a,
      value: a,
      isCurrent: a === currentAssignee,
      separator: i === 0,
    }))

  return [...pinned, ...rest]
}
