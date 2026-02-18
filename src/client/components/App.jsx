import { useEffect, useState } from 'preact/hooks'
import { currentView, selectedIssueId, currentBoard, boards, apiBase } from '../state.js'
import { initRouter, navigate, navigateToBoard, clearSelection, selectIssue } from '../router.js'
import { NavBar } from './NavBar.jsx'
import { Board } from './Board.jsx'
import { ReadyQueue } from './ReadyQueue.jsx'
import { EpicExplorer } from './EpicExplorer.jsx'
import { DependencyGraph } from './DependencyGraph.jsx'
import { DetailPanel } from './DetailPanel.jsx'
import { SearchModal } from './SearchModal.jsx'

export const App = () => {
  const [showSearch, setShowSearch] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fetch board list, then initialize router
    fetch('/api/boards')
      .then((r) => r.json())
      .then(({ data, lastUsedBoard }) => {
        boards.value = data

        // Initialize router first to parse any existing hash
        initRouter()

        // If no board was set from URL, redirect to last-used or first board
        if (!currentBoard.value && data.length > 0) {
          const target = (lastUsedBoard && data.some((b) => b.id === lastUsedBoard))
            ? lastUsedBoard
            : data[0].id
          navigateToBoard(target, currentView.value || 'board')
        }

        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
        initRouter()
      })

    const handleKeyDown = (e) => {
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)
      if (isInput) return

      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowSearch(true)
        return
      }

      switch (e.key) {
        case 'b':
          navigate('board')
          break
        case 'r':
          navigate('ready')
          break
        case 'e':
          navigate('epics')
          break
        case 'd':
          navigate('deps')
          break
        case 'Escape':
          clearSelection()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  if (loading) {
    return (
      <div class="app">
        <div class="flex items-center justify-center" style="height: 100%">
          <p class="text-secondary">Loading boards...</p>
        </div>
      </div>
    )
  }

  const boardList = boards.value
  const board = currentBoard.value
  const view = currentView.value

  // Empty state: no boards found
  if (boardList.length === 0) {
    return (
      <div class="app">
        <header class="nav-bar">
          <span class="nav-title font-semibold">bd-eye</span>
        </header>
        <main class="content">
          <div class="empty-state">
            <h2 class="text-xl font-semibold">No beads projects found</h2>
            <p class="text-secondary" style="margin-top: var(--space-3)">
              No <code>.beads/</code> databases were found in <code>~/workspace</code>.
            </p>
            <p class="text-secondary" style="margin-top: var(--space-2)">
              Run <code>bd init</code> in a project directory to get started.
            </p>
            <p class="text-tertiary text-sm" style="margin-top: var(--space-4)">
              Configure scan roots in <code>~/.bd-eye.json</code>
            </p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div class="app">
      <NavBar
        currentView={view}
        currentBoard={board}
        boards={boardList}
        onNavigate={navigate}
        onSwitchBoard={(boardId) => navigateToBoard(boardId)}
      />
      <main class={`content${view === 'board' ? ' content-board' : ''}`}>
        {board && view === 'board' && <Board />}
        {board && view === 'ready' && <ReadyQueue />}
        {board && view === 'epics' && <EpicExplorer />}
        {board && view === 'deps' && <DependencyGraph />}
      </main>
      {selectedIssueId.value && (
        <DetailPanel
          issueId={selectedIssueId.value}
          onClose={clearSelection}
          onSelectIssue={selectIssue}
        />
      )}
      {showSearch && (
        <SearchModal
          onClose={() => setShowSearch(false)}
          onSelect={(id) => selectIssue(id)}
        />
      )}
    </div>
  )
}
