/** @vitest-environment jsdom */
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/preact'
import '@testing-library/jest-dom/vitest'
import { signal } from '@preact/signals'

const currentView = signal('board')
const selectedIssueId = signal(null)

vi.mock('../../src/client/state.js', () => ({
  get currentView() { return currentView },
  get selectedIssueId() { return selectedIssueId },
}))

vi.mock('../../src/client/router.js', () => ({
  initRouter: vi.fn(),
  navigate: vi.fn(),
  clearSelection: vi.fn(),
  selectIssue: vi.fn(),
}))

vi.mock('../../src/client/components/NavBar.jsx', () => ({
  NavBar: ({ currentView }) => <div data-testid="navbar">NavBar: {currentView}</div>,
}))

vi.mock('../../src/client/components/Board.jsx', () => ({
  Board: () => <div data-testid="board">Board</div>,
}))

vi.mock('../../src/client/components/ReadyQueue.jsx', () => ({
  ReadyQueue: () => <div data-testid="ready-queue">ReadyQueue</div>,
}))

vi.mock('../../src/client/components/EpicExplorer.jsx', () => ({
  EpicExplorer: () => <div data-testid="epic-explorer">EpicExplorer</div>,
}))

vi.mock('../../src/client/components/DependencyGraph.jsx', () => ({
  DependencyGraph: () => <div data-testid="dep-graph">DependencyGraph</div>,
}))

vi.mock('../../src/client/components/DetailPanel.jsx', () => ({
  DetailPanel: ({ issueId }) => <div data-testid="detail-panel">DetailPanel: {issueId}</div>,
}))

vi.mock('../../src/client/components/SearchModal.jsx', () => ({
  SearchModal: () => <div data-testid="search-modal">SearchModal</div>,
}))

import { App } from '../../src/client/components/App.jsx'
import { initRouter, navigate, clearSelection } from '../../src/client/router.js'

beforeEach(() => {
  currentView.value = 'board'
  selectedIssueId.value = null
  vi.clearAllMocks()
})

afterEach(cleanup)

describe('App', () => {
  test('calls initRouter on mount', () => {
    render(<App />)
    expect(initRouter).toHaveBeenCalled()
  })

  test('renders NavBar with current view', () => {
    render(<App />)
    expect(screen.getByTestId('navbar')).toHaveTextContent('NavBar: board')
  })

  test.each([
    ['board', 'board', ['ready-queue', 'epic-explorer', 'dep-graph']],
    ['ready', 'ready-queue', ['board', 'epic-explorer', 'dep-graph']],
    ['epics', 'epic-explorer', ['board', 'ready-queue', 'dep-graph']],
    ['deps', 'dep-graph', ['board', 'ready-queue', 'epic-explorer']],
  ])('view="%s" renders %s and hides others', (view, visibleTestId, hiddenTestIds) => {
    currentView.value = view
    render(<App />)
    expect(screen.getByTestId(visibleTestId)).toBeInTheDocument()
    hiddenTestIds.forEach(id => expect(screen.queryByTestId(id)).not.toBeInTheDocument())
  })

  test('shows DetailPanel when selectedIssueId is set', () => {
    selectedIssueId.value = 'PROJ-42'
    render(<App />)
    expect(screen.getByTestId('detail-panel')).toHaveTextContent('DetailPanel: PROJ-42')
  })

  test('hides DetailPanel when selectedIssueId is null', () => {
    selectedIssueId.value = null
    render(<App />)
    expect(screen.queryByTestId('detail-panel')).not.toBeInTheDocument()
  })

  test('does not show SearchModal by default', () => {
    render(<App />)
    expect(screen.queryByTestId('search-modal')).not.toBeInTheDocument()
  })

  test('shows SearchModal on Cmd+K', () => {
    const { container } = render(<App />)
    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    expect(screen.getByTestId('search-modal')).toBeInTheDocument()
  })

  test.each([
    ['b', 'board'],
    ['r', 'ready'],
    ['e', 'epics'],
    ['d', 'deps'],
  ])('key "%s" navigates to %s', (key, view) => {
    render(<App />)
    window.dispatchEvent(new KeyboardEvent('keydown', { key }))
    expect(navigate).toHaveBeenCalledWith(view)
  })

  test('Escape key calls clearSelection', () => {
    render(<App />)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(clearSelection).toHaveBeenCalled()
  })

  test('keyboard shortcuts are ignored when input is focused', () => {
    render(<App />)
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b' }))
    expect(navigate).not.toHaveBeenCalled()
    document.body.removeChild(input)
  })
})
