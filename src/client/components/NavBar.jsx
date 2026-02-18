import { useState, useEffect, useRef } from 'preact/hooks'

const TABS = [
  { id: 'board', label: 'Board' },
  { id: 'ready', label: 'Ready' },
  { id: 'epics', label: 'Epics' },
  { id: 'deps', label: 'Deps' }
]

/** @param {{ currentView: string, currentBoard: string | null, boards: { id: string, name: string }[], onNavigate: (view: string) => void, onSwitchBoard: (boardId: string) => void }} props */
export const NavBar = ({ currentView, currentBoard, boards, onNavigate, onSwitchBoard }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    const handleEscape = (e) => {
      if (e.key === 'Escape') setDropdownOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  const handleTabClick = (e, viewId) => {
    e.preventDefault()
    onNavigate(viewId)
  }

  const handleBoardSelect = (boardId) => {
    setDropdownOpen(false)
    onSwitchBoard(boardId)
  }

  const boardLabel = currentBoard || 'Select board'

  return (
    <header class="nav-bar">
      <span class="nav-title font-semibold">bd-eye</span>

      {boards.length > 0 && (
        <div class="board-switcher" ref={dropdownRef}>
          <button
            class={`board-switcher-btn${dropdownOpen ? ' board-switcher-btn-open' : ''}`}
            onClick={() => setDropdownOpen(!dropdownOpen)}
            type="button"
          >
            <span class="board-switcher-label">{boardLabel}</span>
            <span class="board-switcher-chevron">{dropdownOpen ? '▴' : '▾'}</span>
          </button>
          {dropdownOpen && (
            <div class="board-switcher-dropdown">
              {boards.map(board => (
                <div
                  key={board.id}
                  class={`board-switcher-option${board.id === currentBoard ? ' board-switcher-option-active' : ''}`}
                  onClick={() => handleBoardSelect(board.id)}
                >
                  {board.name}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <nav class="nav-tabs">
        {TABS.map(tab => (
          <a
            key={tab.id}
            href={currentBoard ? `#/${currentBoard}/${tab.id}` : `#/${tab.id}`}
            class={currentView === tab.id ? 'nav-tab nav-tab-active' : 'nav-tab'}
            onClick={(e) => handleTabClick(e, tab.id)}
          >
            {tab.label}
          </a>
        ))}
      </nav>

      <div class="ml-auto nav-search-hint">
        <span class="text-tertiary text-sm font-mono">⌘K</span>
      </div>
    </header>
  )
}
