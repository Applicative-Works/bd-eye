import { useDraggable } from '@dnd-kit/core';
import { Badge, PillBadge } from './Badge.jsx';

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
      ref={isOverlay ? undefined : setNodeRef}
      style={style}
      onClick={handleClick}
      {...(isOverlay ? {} : { ...listeners, ...attributes })}
    >
      <div class='flex items-center justify-between'>
        <Badge class={`badge-p${priority}`}>P{priority}</Badge>
        <span class='font-mono text-xs text-tertiary'>{id}</span>
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
