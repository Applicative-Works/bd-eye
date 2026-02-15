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
 * }} CardIssue
 */

/**
 * @param {{ issue: CardIssue, onClick?: (id: string) => void }} props
 */
export const Card = ({ issue, onClick }) => {
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

  const cardClass = blocked_by_count > 0
    ? 'card card-blocked'
    : status === 'open' && blocked_by_count === 0
    ? 'card card-ready'
    : 'card';

  const handleClick = () => {
    if (onClick) {
      onClick(id);
    }
  };

  return (
    <div class={cardClass} onClick={handleClick}>
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
