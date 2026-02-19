/** @vitest-environment jsdom */
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/preact'
import '@testing-library/jest-dom/vitest'

vi.mock('../../src/client/hooks/useLiveUpdates.js', () => ({
  useLiveUpdates: vi.fn()
}))

vi.mock('../../src/client/router.js', () => ({
  selectIssue: vi.fn(),
  navigate: vi.fn(),
  clearSelection: vi.fn(),
  initRouter: vi.fn(),
}))

import { EpicExplorer } from '../../src/client/components/EpicExplorer.jsx'
import { selectIssue } from '../../src/client/router.js'

const epics = [
  { id: 'EPIC-1', title: 'Auth System', priority: 1, child_count: 5, closed_count: 3 },
  { id: 'EPIC-2', title: 'Dashboard', priority: 2, child_count: 0, closed_count: 0 },
]

const epicChildren = [
  { id: 'PROJ-1', title: 'Login form', status: 'closed', priority: 1 },
  { id: 'PROJ-2', title: 'OAuth flow', status: 'in_progress', priority: 2 },
  { id: 'PROJ-3', title: 'Session mgmt', status: 'open', priority: 3 },
]

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(cleanup)

const setupFetch = (epicData = epics, childData = epicChildren) => {
  global.fetch = vi.fn((url) => {
    if (url === '/api/epics') {
      return Promise.resolve({ json: () => Promise.resolve({ data: epicData }) })
    }
    if (url.includes('/children')) {
      return Promise.resolve({ json: () => Promise.resolve({ data: childData }) })
    }
    return Promise.resolve({ json: () => Promise.resolve({ data: [] }) })
  })
}

describe('EpicExplorer', () => {
  test('shows loading state initially', () => {
    global.fetch = vi.fn(() => new Promise(() => {}))
    render(<EpicExplorer />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  test('shows empty state when no epics', async () => {
    setupFetch([])
    render(<EpicExplorer />)
    await waitFor(() => expect(screen.getByText('No epics found')).toBeInTheDocument())
  })

  test('renders epic list with titles and progress', async () => {
    setupFetch()
    render(<EpicExplorer />)
    await waitFor(() => expect(screen.getByText('Epics (2)')).toBeInTheDocument())
    expect(screen.getByText('Auth System')).toBeInTheDocument()
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('(3/5 closed)')).toBeInTheDocument()
    expect(screen.getByText('(0/0 closed)')).toBeInTheDocument()
  })

  test('renders epic ids', async () => {
    setupFetch()
    render(<EpicExplorer />)
    await waitFor(() => expect(screen.getByText('EPIC-1')).toBeInTheDocument())
    expect(screen.getByText('EPIC-2')).toBeInTheDocument()
  })

  test('renders priority badges', async () => {
    setupFetch()
    render(<EpicExplorer />)
    await waitFor(() => expect(screen.getByText('P1')).toBeInTheDocument())
    expect(screen.getByText('P2')).toBeInTheDocument()
  })

  test('shows collapsed chevrons initially', async () => {
    setupFetch()
    render(<EpicExplorer />)
    await waitFor(() => expect(screen.getAllByText('▶')).toHaveLength(2))
  })

  test('expands epic on click and fetches children', async () => {
    setupFetch()
    render(<EpicExplorer />)
    await waitFor(() => expect(screen.getByText('Auth System')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Auth System'))

    await waitFor(() => expect(screen.getByText('Login form')).toBeInTheDocument())
    expect(screen.getByText('OAuth flow')).toBeInTheDocument()
    expect(screen.getByText('Session mgmt')).toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledWith('/api/epics/EPIC-1/children')
  })

  test('collapses epic on second click', async () => {
    setupFetch()
    render(<EpicExplorer />)
    await waitFor(() => expect(screen.getByText('Auth System')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Auth System'))
    await waitFor(() => expect(screen.getByText('Login form')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Auth System'))
    await waitFor(() => expect(screen.queryByText('Login form')).not.toBeInTheDocument())
  })

  test.each([
    ['closed', '✓'],
    ['in_progress', '◉'],
    ['open', '○'],
  ])('child with status "%s" shows icon "%s"', async (status, icon) => {
    const children = [{ id: 'PROJ-1', title: `Task ${status}`, status, priority: 1 }]
    setupFetch([epics[0]], children)

    render(<EpicExplorer />)
    await waitFor(() => expect(screen.getByText('Auth System')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Auth System'))
    await waitFor(() => expect(screen.getByText(icon)).toBeInTheDocument())
  })

  test('clicking a child issue calls selectIssue', async () => {
    setupFetch([epics[0]])
    render(<EpicExplorer />)
    await waitFor(() => expect(screen.getByText('Auth System')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Auth System'))
    await waitFor(() => expect(screen.getByText('Login form')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Login form'))
    expect(selectIssue).toHaveBeenCalledWith('PROJ-1')
  })

  test('does not re-fetch children when re-expanding', async () => {
    setupFetch([epics[0]])
    render(<EpicExplorer />)
    await waitFor(() => expect(screen.getByText('Auth System')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Auth System'))
    await waitFor(() => expect(screen.getByText('Login form')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Auth System'))
    await waitFor(() => expect(screen.queryByText('Login form')).not.toBeInTheDocument())

    fireEvent.click(screen.getByText('Auth System'))
    await waitFor(() => expect(screen.getByText('Login form')).toBeInTheDocument())

    const childFetchCalls = global.fetch.mock.calls.filter(([url]) => url.includes('/children'))
    expect(childFetchCalls).toHaveLength(1)
  })

  test('renders progress bar fill based on closed ratio', async () => {
    setupFetch()
    const { container } = render(<EpicExplorer />)
    await waitFor(() => expect(screen.getByText('Auth System')).toBeInTheDocument())
    const fills = container.querySelectorAll('.epic-progress-fill')
    expect(fills[0].style.width).toBe('60%')
    expect(fills[1].style.width).toBe('0%')
  })
})
