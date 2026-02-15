/**
 * @param {{ class?: string, children: any }} props
 */
export const Badge = ({ class: cls = '', children }) => (
  <span class={`badge ${cls}`}>{children}</span>
);

/**
 * @param {{ class?: string, children: any }} props
 */
export const PillBadge = ({ class: cls = '', children }) => (
  <span class={`badge-pill ${cls}`}>{children}</span>
);
