/** @vitest-environment jsdom */
import { describe, test, expect, vi, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/preact'
import '@testing-library/jest-dom/vitest'
import { NavBar } from '../../src/client/components/NavBar.jsx'

afterEach(cleanup)

const TABS = [
  { id: 'board', label: 'Board' },
  { id: 'ready', label: 'Ready' },
  { id: 'epics', label: 'Epics' },
  { id: 'deps', label: 'Deps' },
]

describe('NavBar', () => {
  test('renders the title', () => {
    const { container } = render(<NavBar currentView="board" onNavigate={() => {}} />)
    expect(container.querySelector('.nav-title')).toHaveTextContent('bd-eye')
  })

  test('renders keyboard shortcut hint', () => {
    const { container } = render(<NavBar currentView="board" onNavigate={() => {}} />)
    expect(container.querySelector('.nav-search-hint')).toHaveTextContent('\u2318K')
  })

  test.each(TABS.map(t => [t.id, t.label]))(
    'renders tab "%s" with label "%s"',
    (_id, label) => {
      const { container } = render(<NavBar currentView="board" onNavigate={() => {}} />)
      const tabs = [...container.querySelectorAll('.nav-tab, .nav-tab-active')]
      expect(tabs.some(t => t.textContent === label)).toBe(true)
    }
  )

  test.each(TABS.map(t => [t.id, t.label]))(
    'marks tab "%s" as active when it is the current view',
    (id, label) => {
      const { container } = render(<NavBar currentView={id} onNavigate={() => {}} />)
      const activeTab = container.querySelector('.nav-tab-active')
      expect(activeTab).toHaveTextContent(label)
    }
  )

  test('non-active tabs do not have active class', () => {
    const { container } = render(<NavBar currentView="board" onNavigate={() => {}} />)
    const inactiveTabs = [...container.querySelectorAll('a.nav-tab:not(.nav-tab-active)')]
    expect(inactiveTabs).toHaveLength(3)
    const labels = inactiveTabs.map(t => t.textContent)
    expect(labels).toContain('Ready')
    expect(labels).toContain('Epics')
    expect(labels).toContain('Deps')
  })

  test.each(TABS.map(t => [t.id, t.label]))(
    'calls onNavigate with "%s" when tab "%s" is clicked',
    (id, label) => {
      const onNavigate = vi.fn()
      const { container } = render(<NavBar currentView="board" onNavigate={onNavigate} />)
      const tab = [...container.querySelectorAll('a')].find(a => a.textContent === label)
      fireEvent.click(tab)
      expect(onNavigate).toHaveBeenCalledWith(id)
    }
  )

  test.each(TABS.map(t => [t.id, t.label]))(
    'tab "%s" has correct href',
    (id, label) => {
      const { container } = render(<NavBar currentView="board" onNavigate={() => {}} />)
      const tab = [...container.querySelectorAll('a')].find(a => a.textContent === label)
      expect(tab).toHaveAttribute('href', `#/${id}`)
    }
  )
})
