import { currentView, selectedIssueId } from './state.js'

const ROUTES = {
  '': 'board',
  '#/board': 'board',
  '#/ready': 'ready',
  '#/epics': 'epics',
  '#/deps': 'deps',
  '#/activity': 'activity',
  '#/throughput': 'throughput',
}

export const initRouter = () => {
  const onHashChange = () => {
    const hash = window.location.hash
    const url = new URL(window.location.href)
    const issueParam = url.searchParams.get('issue') ||
                       new URLSearchParams(hash.split('?')[1] || '').get('issue')

    const basePath = hash.split('?')[0]
    if (basePath === '' || basePath === '#/') {
      const stored = currentView.value
      if (stored && stored !== 'board') {
        window.location.hash = `/${stored}`
        return
      }
    }
    currentView.value = ROUTES[basePath] ?? 'board'
    selectedIssueId.value = issueParam ?? null
  }

  window.addEventListener('hashchange', onHashChange)
  onHashChange()
}

export const navigate = (view) => {
  window.location.hash = `/${view}`
}

export const selectIssue = (id) => {
  const base = window.location.hash.split('?')[0]
  window.location.hash = id ? `${base}?issue=${id}` : base
}

export const clearSelection = () => {
  const base = window.location.hash.split('?')[0]
  window.location.hash = base
}
