import { signal, computed } from '@preact/signals'

export const currentBoard = signal(null)
export const boards = signal([])
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

/** @type {import('@preact/signals').ReadonlySignal<string>} */
export const apiBase = computed(() =>
  currentBoard.value ? `/api/boards/${currentBoard.value}` : '/api/boards/_'
)
