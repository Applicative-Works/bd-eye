import { signal } from '@preact/signals'

export const currentProject = signal(localStorage.getItem('bd-eye.lastProject') || null)
export const projectList = signal([])
export const projectsLoading = signal(true)
currentProject.subscribe(v => { if (v) localStorage.setItem('bd-eye.lastProject', v) })

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
export const changedIds = signal(/** @type {Set<string>} */ (new Set()))
export const columnSortOrders = signal({ open: 'priority', in_progress: 'priority', closed: 'priority' })
export const swimlaneGrouping = signal(null)

const storedWipLimits = (() => {
  try { return JSON.parse(localStorage.getItem('wipLimits')) } catch { return null }
})()
export const wipLimits = signal(storedWipLimits || { open: null, in_progress: null, closed: null })
wipLimits.subscribe(v => localStorage.setItem('wipLimits', JSON.stringify(v)))
