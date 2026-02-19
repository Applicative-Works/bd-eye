import { useState, useRef, useEffect } from 'preact/hooks'

const SORT_OPTIONS = [
  { value: 'priority', label: 'Priority' },
  { value: 'age', label: 'Age (oldest)' },
  { value: 'updated', label: 'Last updated' },
  { value: 'assignee', label: 'Assignee' },
  { value: 'type', label: 'Type' },
]

const SortIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
    <line x1="1" y1="3" x2="11" y2="3" />
    <line x1="2" y1="6" x2="10" y2="6" />
    <line x1="3" y1="9" x2="9" y2="9" />
  </svg>
)

export const SortControl = ({ columnKey, sortOrders }) => {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const current = sortOrders.value[columnKey]
  const isNonDefault = current !== 'priority'

  const select = (value) => {
    sortOrders.value = { ...sortOrders.value, [columnKey]: value }
    setOpen(false)
  }

  return (
    <div class="sort-control" ref={ref}>
      <button
        class={`sort-btn${isNonDefault ? ' sort-btn-active' : ''}`}
        onClick={() => setOpen(!open)}
        title={`Sort: ${SORT_OPTIONS.find(o => o.value === current)?.label}`}
      >
        <SortIcon />
      </button>
      {open && (
        <div class="sort-dropdown">
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              class={`sort-option${current === opt.value ? ' sort-option-active' : ''}`}
              onClick={() => select(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
