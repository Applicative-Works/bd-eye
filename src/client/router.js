import { currentView, selectedIssueId, currentBoard, filters } from './state.js'

const VIEWS = new Set(['board', 'ready', 'epics', 'deps'])

export const initRouter = () => {
  const onHashChange = () => {
    const hash = window.location.hash
    const url = new URL(window.location.href)
    const issueParam = url.searchParams.get('issue') ||
                       new URLSearchParams(hash.split('?')[1] || '').get('issue')

    const basePath = hash.split('?')[0]
    // Parse #/:boardName/:view
    const parts = basePath.replace('#/', '').split('/')

    if (parts.length >= 2 && VIEWS.has(parts[1])) {
      const newBoard = parts[0]
      const prevBoard = currentBoard.value
      currentBoard.value = newBoard
      currentView.value = parts[1]

      // Reset filters on board switch
      if (prevBoard && prevBoard !== newBoard) {
        filters.value = {
          priority: [],
          type: [],
          assignee: [],
          label: [],
          blockedOnly: false,
          readyOnly: false
        }
        selectedIssueId.value = null
      }

      // Track last-used board
      if (newBoard) {
        fetch(`/api/boards/${newBoard}/use`, { method: 'POST' }).catch(() => {})
      }
    } else if (parts.length === 1 && VIEWS.has(parts[0])) {
      // Legacy route: #/board -> redirect to #/:lastBoard/board
      currentView.value = parts[0]
    } else if (parts.length === 1 && parts[0] && !VIEWS.has(parts[0])) {
      // Just a board name with no view: #/my-project -> #/my-project/board
      currentBoard.value = parts[0]
      currentView.value = 'board'
      window.location.hash = `/${parts[0]}/board`
      return
    }

    selectedIssueId.value = issueParam ?? null
  }

  window.addEventListener('hashchange', onHashChange)
  onHashChange()
}

export const navigate = (view) => {
  const board = currentBoard.value
  if (board) {
    window.location.hash = `/${board}/${view}`
  }
}

export const navigateToBoard = (boardId, view) => {
  window.location.hash = `/${boardId}/${view || currentView.value || 'board'}`
}

export const selectIssue = (id) => {
  const base = window.location.hash.split('?')[0]
  window.location.hash = id ? `${base}?issue=${id}` : base
}

export const clearSelection = () => {
  const base = window.location.hash.split('?')[0]
  window.location.hash = base
}
