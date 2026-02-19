const TABS = [
  { id: 'board', label: 'Board' },
  { id: 'ready', label: 'Ready' },
  { id: 'epics', label: 'Epics' },
  { id: 'deps', label: 'Deps' }
]

const MutedPostHorn = () => (
  <svg
    class="nav-logo"
    viewBox="0 0 40 24"
    width="34"
    height="20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="11" cy="15" r="6.5" stroke="currentColor" stroke-width="2" />
    <line x1="4.5" y1="9" x2="17.5" y2="9" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    <line x1="17.5" y1="9" x2="25" y2="5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    <line x1="17.5" y1="9" x2="25" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    <path
      d="M25 5 L34 2 L34 18 L25 15 Z"
      stroke="currentColor"
      stroke-width="2"
      stroke-linejoin="round"
    />
    <line x1="30" y1="4" x2="30" y2="16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
  </svg>
)

/** @param {{ currentView: string, onNavigate: (view: string) => void }} props */
export const NavBar = ({ currentView, onNavigate }) => {
  const handleTabClick = (e, viewId) => {
    e.preventDefault()
    onNavigate(viewId)
  }

  return (
    <header class="nav-bar">
      <div class="nav-brand">
        <MutedPostHorn />
        <span class="nav-title font-semibold">Beady Eye</span>
      </div>

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
