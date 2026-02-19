import { useEffect, useState } from 'preact/hooks'
import { currentView, selectedIssueId, projectList, projectsLoading } from '../state.js'
import { initRouter, navigate, clearSelection, selectIssue } from '../router.js'
import { useProjects } from '../hooks/useProjects.js'
import { NavBar } from './NavBar.jsx'
import { UpdatedAt } from './UpdatedAt.jsx'
import { Board } from './Board.jsx'
import { ReadyQueue } from './ReadyQueue.jsx'
import { EpicExplorer } from './EpicExplorer.jsx'
import { DependencyGraph } from './DependencyGraph.jsx'
import { ActivityFeed } from './ActivityFeed.jsx'
import { ThroughputChart } from './ThroughputChart.jsx'
import { DetailPanel } from './DetailPanel.jsx'
import { SearchModal } from './SearchModal.jsx'

const getVisibleCards = () => Array.from(document.querySelectorAll('.card[data-card-id]'))

export const App = () => {
  const [showSearch, setShowSearch] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(-1)

  useProjects()

  useEffect(() => {
    initRouter()

    const focusCard = (cards, index) => {
      cards.forEach(c => c.classList.remove('card-focused'))
      cards[index]?.classList.add('card-focused')
      cards[index]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }

    const moveFocus = (delta) => {
      const cards = getVisibleCards()
      if (cards.length === 0) return

      setFocusedIndex(prev => {
        const next = Math.max(0, Math.min(cards.length - 1, prev + delta))
        focusCard(cards, next)
        return next
      })
    }

    const moveColumn = (delta) => {
      const cards = getVisibleCards()
      if (cards.length === 0) return

      const columns = Array.from(document.querySelectorAll('.column'))
      if (columns.length === 0) return

      setFocusedIndex(prev => {
        const focused = cards[prev]
        const currentCol = focused?.closest('.column')
        const colIndex = currentCol ? columns.indexOf(currentCol) : (delta > 0 ? -1 : columns.length)

        let targetCol = null
        let targetCards = []
        for (let i = colIndex + delta; i >= 0 && i < columns.length; i += delta) {
          const colCards = Array.from(columns[i].querySelectorAll('.card[data-card-id]'))
          if (colCards.length > 0) {
            targetCol = columns[i]
            targetCards = colCards
            break
          }
        }
        if (!targetCol) return prev

        const rowInCol = focused && currentCol ? Array.from(currentCol.querySelectorAll('.card[data-card-id]')).indexOf(focused) : 0
        const targetCard = targetCards[Math.min(rowInCol, targetCards.length - 1)]
        const newIndex = cards.indexOf(targetCard)
        if (newIndex === -1) return prev

        focusCard(cards, newIndex)
        return newIndex
      })
    }

    const handleKeyDown = (e) => {
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)
      if (isInput) return

      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowSearch(true)
        return
      }

      switch (e.key) {
        case 'j':
        case 'ArrowDown':
          e.preventDefault()
          moveFocus(1)
          break
        case 'k':
        case 'ArrowUp':
          e.preventDefault()
          moveFocus(-1)
          break
        case 'l':
        case 'ArrowRight':
          e.preventDefault()
          moveColumn(1)
          break
        case 'h':
        case 'ArrowLeft':
          e.preventDefault()
          moveColumn(-1)
          break
        case 'Enter': {
          const cards = getVisibleCards()
          const focused = cards.find(c => c.classList.contains('card-focused'))
          if (focused) {
            e.preventDefault()
            selectIssue(focused.dataset.cardId)
          }
          break
        }
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
        case 'a':
          navigate('activity')
          break
        case 't':
          navigate('throughput')
          break
        case 'Escape':
          clearSelection()
          setFocusedIndex(-1)
          getVisibleCards().forEach(c => c.classList.remove('card-focused'))
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const loading = projectsLoading.value
  const projects = projectList.value
  const view = currentView.value

  return (
    <div class="app">
      <NavBar currentView={view} onNavigate={navigate} />
      {loading ? (
        <main class="content">
          <p class="text-secondary">Loading projects...</p>
        </main>
      ) : projects.length === 0 ? (
        <main class="content">
          <div class="flex flex-col items-center justify-center" style="height: 100%; gap: var(--space-4)">
            <p class="text-secondary">No beads projects found</p>
            <button class="filter-btn" onClick={() => window.location.reload()}>Refresh</button>
          </div>
        </main>
      ) : (
        <>
          <main class={`content${view === 'board' ? ' content-board' : ''}`}>
            {view === 'board' && <Board />}
            {view === 'ready' && <ReadyQueue />}
            {view === 'epics' && <EpicExplorer />}
            {view === 'deps' && <DependencyGraph />}
            {view === 'activity' && <ActivityFeed />}
            {view === 'throughput' && <ThroughputChart />}
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
        </>
      )}
      <UpdatedAt />
    </div>
  )
}
