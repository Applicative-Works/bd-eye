import { useEffect, useState } from 'preact/hooks'
import { currentView, selectedIssueId } from '../state.js'
import { initRouter, navigate, clearSelection, selectIssue } from '../router.js'
import { NavBar } from './NavBar.jsx'
import { UpdatedAt } from './UpdatedAt.jsx'
import { Board } from './Board.jsx'
import { ReadyQueue } from './ReadyQueue.jsx'
import { EpicExplorer } from './EpicExplorer.jsx'
import { DependencyGraph } from './DependencyGraph.jsx'
import { DetailPanel } from './DetailPanel.jsx'
import { SearchModal } from './SearchModal.jsx'

const getVisibleCards = () => Array.from(document.querySelectorAll('.card[data-card-id]'))

export const App = () => {
  const [showSearch, setShowSearch] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(-1)

  useEffect(() => {
    initRouter()

    const moveFocus = (delta) => {
      const cards = getVisibleCards()
      if (cards.length === 0) return

      setFocusedIndex(prev => {
        const next = Math.max(0, Math.min(cards.length - 1, prev + delta))
        cards.forEach(c => c.classList.remove('card-focused'))
        cards[next]?.classList.add('card-focused')
        cards[next]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        return next
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
          e.preventDefault()
          moveFocus(1)
          break
        case 'k':
          e.preventDefault()
          moveFocus(-1)
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

  const view = currentView.value

  return (
    <div class="app">
      <NavBar currentView={view} onNavigate={navigate} />
      <main class={`content${view === 'board' ? ' content-board' : ''}`}>
        {view === 'board' && <Board />}
        {view === 'ready' && <ReadyQueue />}
        {view === 'epics' && <EpicExplorer />}
        {view === 'deps' && <DependencyGraph />}
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
      <UpdatedAt />
    </div>
  )
}
