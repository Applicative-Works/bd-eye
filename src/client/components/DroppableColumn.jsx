import { useState, useCallback } from 'preact/hooks'
import { useDroppable } from '@dnd-kit/core'
import { wipLimits } from '../state.js'

const WipLimitEditor = ({ columnKey, count }) => {
  const [editing, setEditing] = useState(false)
  const limit = wipLimits.value[columnKey] ?? null
  const exceeded = limit !== null && count >= limit

  const handleSubmit = useCallback((e) => {
    e.preventDefault()
    const raw = e.target.elements.limit.value.trim()
    const val = raw === '' ? null : parseInt(raw, 10)
    wipLimits.value = { ...wipLimits.value, [columnKey]: Number.isNaN(val) ? null : val }
    setEditing(false)
  }, [columnKey])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') setEditing(false)
    e.stopPropagation()
  }, [])

  if (editing) {
    return (
      <form class="wip-edit-form" onSubmit={handleSubmit}>
        <input
          name="limit"
          type="number"
          min="1"
          class="wip-edit-input"
          defaultValue={limit ?? ''}
          placeholder="#"
          autoFocus
          onBlur={() => setEditing(false)}
          onKeyDown={handleKeyDown}
        />
      </form>
    )
  }

  return (
    <button
      class={`wip-count${exceeded ? ' wip-exceeded' : ''}${limit !== null ? ' wip-has-limit' : ''}`}
      onClick={(e) => { e.stopPropagation(); setEditing(true) }}
      title={limit !== null ? `WIP limit: ${limit} (click to edit)` : 'Click to set WIP limit'}
    >
      {limit !== null ? `${count}/${limit}` : count}
    </button>
  )
}

export const DroppableCell = ({ id, children }) => {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div class={`swim-cell${isOver ? ' swim-cell-drop-active' : ''}`} ref={setNodeRef}>
      {children}
    </div>
  )
}

export const DroppableColumn = ({ col, count, headerExtra, children }) => {
  const { setNodeRef, isOver } = useDroppable({ id: col.key })
  const limit = wipLimits.value[col.key] ?? null
  const exceeded = limit !== null && count >= limit

  return (
    <div class={`column${isOver ? ' column-drop-active' : ''}${exceeded ? ' column-wip-exceeded' : ''}`} ref={setNodeRef}>
      <div class={`column-header${exceeded ? ' column-header-exceeded' : ''}`}>
        <span class="column-header-label">
          {col.label} <WipLimitEditor columnKey={col.key} count={count} />
        </span>
        {headerExtra}
      </div>
      <div class="column-cards">
        {children}
      </div>
    </div>
  )
}
