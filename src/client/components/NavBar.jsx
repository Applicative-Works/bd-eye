const TABS = [
  { id: 'board', label: 'Board' },
  { id: 'ready', label: 'Ready' },
  { id: 'epics', label: 'Epics' },
  { id: 'deps', label: 'Deps' },
  { id: 'activity', label: 'Activity' }
]

/** @param {{ currentView: string, onNavigate: (view: string) => void }} props */
export const NavBar = ({ currentView, onNavigate }) => {
  const handleTabClick = (e, viewId) => {
    e.preventDefault()
    onNavigate(viewId)
  }

  return (
    <header class="nav-bar">
      <span class="nav-title font-semibold">Beady Eye</span>

      <nav class="nav-tabs">
        {TABS.map(tab => (
          <a
            key={tab.id}
            href={`#/${tab.id}`}
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
