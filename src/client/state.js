import { signal, computed } from '@preact/signals'

export const currentView = signal('board')
export const selectedIssueId = signal(null)
export const filters = signal({
  priority: [],
  type: [],
  assignee: [],
  label: [],
  blockedOnly: false,
  readyOnly: false
})
export const columnMode = signal('status')
export const closedDays = signal(null)
export const lastUpdated = signal(null)
export const columnSortOrders = signal({ open: 'priority', in_progress: 'priority', closed: 'priority' })
export const swimlaneGrouping = signal(null)

const storedWipLimits = (() => {
  try { return JSON.parse(localStorage.getItem('wipLimits')) } catch { return null }
})()
export const wipLimits = signal(storedWipLimits || { open: null, in_progress: null, closed: null })
wipLimits.subscribe(v => localStorage.setItem('wipLimits', JSON.stringify(v)))
