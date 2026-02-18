import { useDroppable } from '@dnd-kit/core'

export const DroppableColumn = ({ col, count, headerExtra, children }) => {
  const { setNodeRef, isOver } = useDroppable({ id: col.key })

  return (
    <div class={`column${isOver ? ' column-drop-active' : ''}`} ref={setNodeRef}>
      <div class="column-header">
        <span>{col.label} ({count})</span>
        {headerExtra}
      </div>
      <div class="column-cards">
        {children}
      </div>
    </div>
  )
}
