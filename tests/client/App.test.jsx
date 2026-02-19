/** @vitest-environment jsdom */
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/preact'
import '@testing-library/jest-dom/vitest'
import { signal } from '@preact/signals'

const currentView = signal('board')
const selectedIssueId = signal(null)

const lastUpdated = signal(null)

vi.mock('../../src/client/state.js', () => ({
  get currentView() { return currentView },
  get selectedIssueId() { return selectedIssueId },
  get lastUpdated() { return lastUpdated },
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

vi.mock('../../src/client/components/UpdatedAt.jsx', () => ({
  UpdatedAt: () => <div data-testid="updated-at" />,
}))

import { App } from '../../src/client/components/App.jsx'
import { initRouter, navigate, clearSelection, selectIssue } from '../../src/client/router.js'

const addFakeCards = (...ids) => {
  ids.forEach(id => {
    const card = document.createElement('div')
    card.className = 'card'
    card.dataset.cardId = id
    card.scrollIntoView = vi.fn()
    document.body.appendChild(card)
  })
}

const removeFakeCards = () => {
  document.querySelectorAll('.card[data-card-id]').forEach(c => c.remove())
}

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

  test('j key focuses next card', () => {
    render(<App />)
    addFakeCards('P-1', 'P-2', 'P-3')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j' }))
    expect(document.querySelector('[data-card-id="P-1"]')).toHaveClass('card-focused')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j' }))
    expect(document.querySelector('[data-card-id="P-2"]')).toHaveClass('card-focused')
    expect(document.querySelector('[data-card-id="P-1"]')).not.toHaveClass('card-focused')
    removeFakeCards()
  })

  test('k key focuses previous card', () => {
    render(<App />)
    addFakeCards('P-1', 'P-2', 'P-3')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j' }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j' }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k' }))
    expect(document.querySelector('[data-card-id="P-1"]')).toHaveClass('card-focused')
    removeFakeCards()
  })

  test('j does not go past last card', () => {
    render(<App />)
    addFakeCards('P-1', 'P-2')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j' }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j' }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j' }))
    expect(document.querySelector('[data-card-id="P-2"]')).toHaveClass('card-focused')
    removeFakeCards()
  })

  test('Enter opens detail panel for focused card', () => {
    render(<App />)
    addFakeCards('P-1', 'P-2')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j' }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(selectIssue).toHaveBeenCalledWith('P-1')
    removeFakeCards()
  })

  test('Enter does nothing when no card is focused', () => {
    render(<App />)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(selectIssue).not.toHaveBeenCalled()
  })

  test('Escape clears card focus', () => {
    render(<App />)
    addFakeCards('P-1')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j' }))
    expect(document.querySelector('[data-card-id="P-1"]')).toHaveClass('card-focused')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(document.querySelector('[data-card-id="P-1"]')).not.toHaveClass('card-focused')
    removeFakeCards()
  })
})
