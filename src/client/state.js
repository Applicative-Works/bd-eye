import { signal } from '@preact/signals'

export const currentProject = signal(localStorage.getItem('bd-eye.lastProject') || null)
export const projectList = signal([])
export const projectsLoading = signal(true)
currentProject.subscribe(v => { if (v) localStorage.setItem('bd-eye.lastProject', v) })

export const currentView = signal(localStorage.getItem('bd-eye.lastView') || 'board')
currentView.subscribe(v => { if (v) localStorage.setItem('bd-eye.lastView', v) })
export const selectedIssueId = signal(null)
const defaultFilters = { priority: [], type: [], assignee: [], label: [], blockedOnly: false, readyOnly: false, assignedToMe: false }
const storedFilters = (() => {
  try { return JSON.parse(localStorage.getItem('bd-eye.filters')) } catch { return null }
})()
export const filters = signal(storedFilters || defaultFilters)
filters.subscribe(v => localStorage.setItem('bd-eye.filters', JSON.stringify(v)))
export const columnMode = signal('status')
export const closedDays = signal(null)
export const lastUpdated = signal(null)
export const changedIds = signal(/** @type {Set<string>} */ (new Set()))
const storedSortOrders = (() => {
  try { return JSON.parse(localStorage.getItem('bd-eye.sortOrders')) } catch { return null }
})()
export const columnSortOrders = signal(storedSortOrders || { open: 'priority', in_progress: 'priority', closed: 'priority' })
columnSortOrders.subscribe(v => localStorage.setItem('bd-eye.sortOrders', JSON.stringify(v)))
export const swimlaneGrouping = signal(null)
export const cycleTimeThresholds = signal(null)
export const currentUser = signal(null)

const storedWipLimits = (() => {
  try { return JSON.parse(localStorage.getItem('wipLimits')) } catch { return null }
})()
export const wipLimits = signal(storedWipLimits || { open: null, in_progress: null, closed: null })
wipLimits.subscribe(v => localStorage.setItem('wipLimits', JSON.stringify(v)))
