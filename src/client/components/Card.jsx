import { useRef, useEffect } from 'preact/hooks';
import { useDraggable } from '@dnd-kit/core';
import { Badge, PillBadge } from './Badge.jsx';
import { CopyableId } from './CopyableId.jsx';
import { changedIds } from '../state.js';

/**
 * @typedef {{
 *   id: string
 *   title: string
 *   status: string
 *   priority: number
 *   issue_type: string
 *   assignee: string | null
 *   labels?: string[]
 *   blocked_by_count?: number
 *   blocks_count?: number
 *   updated_at?: string
 * }} CardIssue
 */

const ageInDays = (dateStr) => {
  if (!dateStr) return 0
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

const ageClass = (days) => {
  if (days >= 14) return 'card-age-stale'
  if (days >= 7) return 'card-age-old'
  if (days >= 3) return 'card-age-aging'
  return ''
}

/**
 * @param {{ issue: CardIssue, onClick?: (id: string) => void, isDragging?: boolean, isOverlay?: boolean }} props
 */
export const Card = ({ issue, onClick, isDragging = false, isOverlay = false }) => {
  const {
    id,
    title,
    status,
    priority,
    issue_type,
    assignee,
    labels = [],
    blocked_by_count = 0,
    blocks_count = 0,
  } = issue;

  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id,
    data: { issue },
    disabled: isOverlay,
  });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  const cardRef = useRef(null)
  const isHighlighted = changedIds.value.has(id)

  useEffect(() => {
    if (!isHighlighted || !cardRef.current) return
    const el = cardRef.current
    el.classList.remove('card-highlighted')
    void el.offsetWidth
    el.classList.add('card-highlighted')
    const cleanup = () => {
      el.classList.remove('card-highlighted')
      changedIds.value = new Set([...changedIds.value].filter(x => x !== id))
    }
    el.addEventListener('animationend', cleanup, { once: true })
    return () => el.removeEventListener('animationend', cleanup)
  }, [isHighlighted, id])

  const days = status !== 'closed' ? ageInDays(issue.updated_at) : 0

  const cardClass = [
    'card',
    blocked_by_count > 0 ? 'card-blocked' : status === 'open' && blocked_by_count === 0 ? 'card-ready' : '',
    ageClass(days),
    isDragging ? 'card-dragging' : '',
  ].filter(Boolean).join(' ');

  const handleClick = () => {
    if (onClick) {
      onClick(id);
    }
  };

  return (
    <div
      class={cardClass}
      ref={el => { cardRef.current = el; if (!isOverlay) setNodeRef(el) }}
      style={style}
      data-card-id={id}
      onClick={handleClick}
      {...(isOverlay ? {} : { ...listeners, ...attributes })}
    >
      <div class='flex items-center justify-between'>
        <Badge class={`badge-p${priority}`}>P{priority}</Badge>
        <CopyableId id={id} class='font-mono text-xs text-tertiary' />
      </div>

      <div class='font-medium text-sm line-clamp-2'>{title}</div>

      <div class='flex flex-wrap gap-1'>
        <PillBadge class={`badge-${issue_type}`}>{issue_type}</PillBadge>
        {labels.map((label) => (
          <PillBadge key={label} class='badge-label'>
            {label}
          </PillBadge>
        ))}
      </div>

      <div class='flex items-center justify-between'>
        <span class={`text-xs ${assignee ? 'text-secondary' : 'text-tertiary'}`}>
          {assignee || 'unassigned'}
        </span>
        {(blocked_by_count > 0 || blocks_count > 0) && (
          <div class='flex items-center gap-2'>
            {blocked_by_count > 0 && (
              <span
                class='text-xs'
                style={{ color: 'var(--color-blocked-icon)' }}
              >
                ⬆{blocked_by_count}
              </span>
            )}
            {blocks_count > 0 && (
              <span
                class='text-xs'
                style={{ color: 'var(--color-blocking-text)' }}
              >
                ⬇{blocks_count}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
