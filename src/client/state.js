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
