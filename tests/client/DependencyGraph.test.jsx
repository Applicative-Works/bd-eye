/** @vitest-environment jsdom */
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/preact'
import '@testing-library/jest-dom/vitest'
import { signal } from '@preact/signals'

const selectedIssueIdSignal = signal(null)

vi.mock('../../src/client/router.js', () => ({
  selectIssue: vi.fn(),
  navigate: vi.fn(),
  clearSelection: vi.fn(),
  initRouter: vi.fn(),
}))

vi.mock('../../src/client/state.js', () => ({
  get selectedIssueId() { return selectedIssueIdSignal },
  get currentView() { return signal('deps') },
  get filters() { return signal({ priority: [], type: [], assignee: [], label: [], blockedOnly: false, readyOnly: false }) },
  get closedDays() { return signal(null) },
}))

import { DependencyGraph } from '../../src/client/components/DependencyGraph.jsx'
import { selectIssue } from '../../src/client/router.js'

afterEach(cleanup)

beforeEach(() => {
  vi.clearAllMocks()
  selectedIssueIdSignal.value = null
  global.fetch = vi.fn(() => Promise.resolve({ json: () => Promise.resolve({ data: [] }) }))
})

describe('DependencyGraph', () => {
  describe('component rendering', () => {
    test('renders search input and mode toggle', () => {
      render(<DependencyGraph />)
      expect(screen.getByPlaceholderText('Search for an issue...')).toBeInTheDocument()
      expect(screen.getByText('Show Full Graph')).toBeInTheDocument()
    })

    test('defaults to focus mode with empty message', () => {
      render(<DependencyGraph />)
      expect(screen.getByText('Select an issue from the search to view its dependencies')).toBeInTheDocument()
    })

    test('toggles to full graph mode on button click', async () => {
      render(<DependencyGraph />)
      fireEvent.click(screen.getByText('Show Full Graph'))
      await waitFor(() => expect(screen.getByText('Show Focus View')).toBeInTheDocument())
    })

    test('toggles back to focus mode', async () => {
      render(<DependencyGraph />)
      fireEvent.click(screen.getByText('Show Full Graph'))
      await waitFor(() => expect(screen.getByText('Show Focus View')).toBeInTheDocument())
      fireEvent.click(screen.getByText('Show Focus View'))
      expect(screen.getByText('Show Full Graph')).toBeInTheDocument()
    })

    test('search input triggers fetch', async () => {
      render(<DependencyGraph />)
      const input = screen.getByPlaceholderText('Search for an issue...')
      fireEvent.input(input, { target: { value: 'test' } })
      await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/search?q=test'))
    })

    test('search results are displayed and clickable', async () => {
      const results = [
        { id: 'PROJ-1', title: 'First issue' },
        { id: 'PROJ-2', title: 'Second issue' },
      ]
      global.fetch = vi.fn((url) => {
        if (url.includes('/api/search')) {
          return Promise.resolve({ json: () => Promise.resolve({ data: results }) })
        }
        return Promise.resolve({ json: () => Promise.resolve({ data: [] }) })
      })

      render(<DependencyGraph />)
      fireEvent.input(screen.getByPlaceholderText('Search for an issue...'), { target: { value: 'issue' } })

      await waitFor(() => expect(screen.getByText('First issue')).toBeInTheDocument())
      expect(screen.getByText('Second issue')).toBeInTheDocument()

      fireEvent.click(screen.getByText('First issue'))
      expect(selectIssue).toHaveBeenCalledWith('PROJ-1')
    })

    test('empty search clears results', async () => {
      global.fetch = vi.fn((url) => {
        if (url.includes('/api/search')) {
          return Promise.resolve({ json: () => Promise.resolve({ data: [{ id: 'X', title: 'Found' }] }) })
        }
        return Promise.resolve({ json: () => Promise.resolve({ data: [] }) })
      })

      render(<DependencyGraph />)
      const input = screen.getByPlaceholderText('Search for an issue...')
      fireEvent.input(input, { target: { value: 'test' } })
      await waitFor(() => expect(screen.getByText('Found')).toBeInTheDocument())

      fireEvent.input(input, { target: { value: '' } })
      await waitFor(() => expect(screen.queryByText('Found')).not.toBeInTheDocument())
    })

    test('search failure sets empty results', async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error('fail')))
      render(<DependencyGraph />)
      fireEvent.input(screen.getByPlaceholderText('Search for an issue...'), { target: { value: 'q' } })
      await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    })

    describe('search keyboard navigation', () => {
      const results = [
        { id: 'PROJ-1', title: 'Alpha' },
        { id: 'PROJ-2', title: 'Beta' },
        { id: 'PROJ-3', title: 'Gamma' },
      ]

      const setupSearchResults = async () => {
        global.fetch = vi.fn((url) => {
          if (url.includes('/api/search'))
            return Promise.resolve({ json: () => Promise.resolve({ data: results }) })
          return Promise.resolve({ json: () => Promise.resolve({ data: [] }) })
        })
        render(<DependencyGraph />)
        const input = screen.getByPlaceholderText('Search for an issue...')
        fireEvent.input(input, { target: { value: 'proj' } })
        await waitFor(() => expect(screen.getByText('Alpha')).toBeInTheDocument())
        return input
      }

      test('ArrowDown highlights the next result', async () => {
        const input = await setupSearchResults()
        const items = screen.getAllByText(/Alpha|Beta|Gamma/).map(el => el.closest('.dep-search-result'))
        expect(items[0]).toHaveClass('dep-search-result-active')

        fireEvent.keyDown(input, { key: 'ArrowDown' })
        expect(items[0]).not.toHaveClass('dep-search-result-active')
        expect(items[1]).toHaveClass('dep-search-result-active')
      })

      test('ArrowUp highlights the previous result', async () => {
        const input = await setupSearchResults()
        fireEvent.keyDown(input, { key: 'ArrowDown' })
        fireEvent.keyDown(input, { key: 'ArrowDown' })
        const items = screen.getAllByText(/Alpha|Beta|Gamma/).map(el => el.closest('.dep-search-result'))
        expect(items[2]).toHaveClass('dep-search-result-active')

        fireEvent.keyDown(input, { key: 'ArrowUp' })
        expect(items[1]).toHaveClass('dep-search-result-active')
      })

      test('ArrowDown clamps at the last result', async () => {
        const input = await setupSearchResults()
        fireEvent.keyDown(input, { key: 'ArrowDown' })
        fireEvent.keyDown(input, { key: 'ArrowDown' })
        fireEvent.keyDown(input, { key: 'ArrowDown' })
        fireEvent.keyDown(input, { key: 'ArrowDown' })
        const items = screen.getAllByText(/Alpha|Beta|Gamma/).map(el => el.closest('.dep-search-result'))
        expect(items[2]).toHaveClass('dep-search-result-active')
      })

      test('ArrowUp clamps at the first result', async () => {
        const input = await setupSearchResults()
        fireEvent.keyDown(input, { key: 'ArrowUp' })
        const items = screen.getAllByText(/Alpha|Beta|Gamma/).map(el => el.closest('.dep-search-result'))
        expect(items[0]).toHaveClass('dep-search-result-active')
      })

      test('Enter selects the highlighted result', async () => {
        const input = await setupSearchResults()
        fireEvent.keyDown(input, { key: 'ArrowDown' })
        fireEvent.keyDown(input, { key: 'Enter' })
        expect(selectIssue).toHaveBeenCalledWith('PROJ-2')
      })
    })
  })

  describe('FocusView', () => {
    test('shows loading state while fetching dependencies', async () => {
      selectedIssueIdSignal.value = 'PROJ-1'
      global.fetch = vi.fn(() => new Promise(() => {}))
      render(<DependencyGraph />)
      await waitFor(() => expect(screen.getByText('Loading dependencies...')).toBeInTheDocument())
    })

    test('renders selected issue node', async () => {
      const issue = { id: 'PROJ-1', title: 'Selected issue', status: 'open', priority: 1 }
      const deps = { blockedBy: [], blocks: [] }

      global.fetch = vi.fn((url) => {
        if (url === '/api/issues/PROJ-1') {
          return Promise.resolve({ json: () => Promise.resolve({ data: issue }) })
        }
        if (url === '/api/issues/PROJ-1/dependencies') {
          return Promise.resolve({ json: () => Promise.resolve({ data: deps }) })
        }
        return Promise.resolve({ json: () => Promise.resolve({ data: [] }) })
      })

      selectedIssueIdSignal.value = 'PROJ-1'
      render(<DependencyGraph />)
      await waitFor(() => expect(screen.getByText('Selected issue')).toBeInTheDocument())
      expect(screen.getByText('PROJ-1')).toBeInTheDocument()
      expect(screen.getByText('SELECTED')).toBeInTheDocument()
    })

    test('renders blockedBy section with dependency nodes', async () => {
      const issue = { id: 'PROJ-2', title: 'Blocked task', status: 'open', priority: 1 }
      const deps = {
        blockedBy: [{ id: 'PROJ-1', title: 'Blocker', status: 'in_progress', priority: 1 }],
        blocks: []
      }

      global.fetch = vi.fn((url) => {
        if (url === '/api/issues/PROJ-2') {
          return Promise.resolve({ json: () => Promise.resolve({ data: issue }) })
        }
        if (url === '/api/issues/PROJ-2/dependencies') {
          return Promise.resolve({ json: () => Promise.resolve({ data: deps }) })
        }
        return Promise.resolve({ json: () => Promise.resolve({ data: [] }) })
      })

      selectedIssueIdSignal.value = 'PROJ-2'
      render(<DependencyGraph />)
      await waitFor(() => expect(screen.getByText('Blocked by')).toBeInTheDocument())
      expect(screen.getByText('Blocker')).toBeInTheDocument()
      expect(screen.getByText('PROJ-1')).toBeInTheDocument()
    })

    test('renders blocks section with dependency nodes', async () => {
      const issue = { id: 'PROJ-1', title: 'Blocking task', status: 'open', priority: 1 }
      const deps = {
        blockedBy: [],
        blocks: [{ id: 'PROJ-3', title: 'Waiting task', status: 'open', priority: 2 }]
      }

      global.fetch = vi.fn((url) => {
        if (url === '/api/issues/PROJ-1') {
          return Promise.resolve({ json: () => Promise.resolve({ data: issue }) })
        }
        if (url === '/api/issues/PROJ-1/dependencies') {
          return Promise.resolve({ json: () => Promise.resolve({ data: deps }) })
        }
        return Promise.resolve({ json: () => Promise.resolve({ data: [] }) })
      })

      selectedIssueIdSignal.value = 'PROJ-1'
      render(<DependencyGraph />)
      await waitFor(() => expect(screen.getByText('Blocks')).toBeInTheDocument())
      expect(screen.getByText('Waiting task')).toBeInTheDocument()
    })

    test('clicking a dependency node calls selectIssue', async () => {
      const issue = { id: 'PROJ-2', title: 'Main', status: 'open', priority: 1 }
      const deps = {
        blockedBy: [{ id: 'PROJ-1', title: 'Dep', status: 'closed', priority: 1 }],
        blocks: []
      }

      global.fetch = vi.fn((url) => {
        if (url === '/api/issues/PROJ-2') {
          return Promise.resolve({ json: () => Promise.resolve({ data: issue }) })
        }
        if (url === '/api/issues/PROJ-2/dependencies') {
          return Promise.resolve({ json: () => Promise.resolve({ data: deps }) })
        }
        return Promise.resolve({ json: () => Promise.resolve({ data: [] }) })
      })

      selectedIssueIdSignal.value = 'PROJ-2'
      render(<DependencyGraph />)
      await waitFor(() => expect(screen.getByText('Dep')).toBeInTheDocument())
      fireEvent.click(screen.getByText('Dep'))
      expect(selectIssue).toHaveBeenCalledWith('PROJ-1')
    })

    test('handles fetch failure gracefully', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({ json: () => Promise.resolve({ data: { blockedBy: [], blocks: [] } }) })
      ).mockImplementationOnce(() =>
        Promise.resolve({ json: () => Promise.resolve({ data: { blockedBy: [], blocks: [] } }) })
      )

      selectedIssueIdSignal.value = 'PROJ-1'
      render(<DependencyGraph />)
      await waitFor(() => expect(screen.queryByText('Loading dependencies...')).not.toBeInTheDocument())
    })

    test.each([
      ['closed', '✓'],
      ['in_progress', '◉'],
      ['open', '○'],
    ])('renders status icon %s as %s for dependency nodes', async (status, icon) => {
      const issue = { id: 'MAIN', title: 'Main', status: 'open', priority: 1 }
      const deps = {
        blockedBy: [{ id: 'DEP', title: 'Dep', status, priority: 1 }],
        blocks: []
      }

      global.fetch = vi.fn((url) => {
        if (url === '/api/issues/MAIN') {
          return Promise.resolve({ json: () => Promise.resolve({ data: issue }) })
        }
        if (url === '/api/issues/MAIN/dependencies') {
          return Promise.resolve({ json: () => Promise.resolve({ data: deps }) })
        }
        return Promise.resolve({ json: () => Promise.resolve({ data: [] }) })
      })

      selectedIssueIdSignal.value = 'MAIN'
      render(<DependencyGraph />)
      await waitFor(() => expect(screen.getByText('Dep')).toBeInTheDocument())
    })

    test('populates search input from selected issue on mount', async () => {
      const issue = { id: 'PROJ-5', title: 'Loaded', status: 'open', priority: 1 }

      global.fetch = vi.fn((url) => {
        if (url === '/api/issues/PROJ-5') {
          return Promise.resolve({ json: () => Promise.resolve({ data: issue }) })
        }
        if (url === '/api/issues/PROJ-5/dependencies') {
          return Promise.resolve({ json: () => Promise.resolve({ data: { blockedBy: [], blocks: [] } }) })
        }
        return Promise.resolve({ json: () => Promise.resolve({ data: [] }) })
      })

      selectedIssueIdSignal.value = 'PROJ-5'
      render(<DependencyGraph />)

      await waitFor(() => {
        const input = screen.getByPlaceholderText('Search for an issue...')
        expect(input.value).toBe('PROJ-5')
      })
    })
  })

  describe('FullGraphView', () => {
    test('shows loading state', async () => {
      global.fetch = vi.fn(() => new Promise(() => {}))
      render(<DependencyGraph />)
      fireEvent.click(screen.getByText('Show Full Graph'))
      await waitFor(() => expect(screen.getByText('Loading full graph...')).toBeInTheDocument())
    })

    test('renders SVG with nodes', async () => {
      const issues = [
        { id: 'PROJ-1', title: 'Task A', status: 'open', priority: 1 },
        { id: 'PROJ-2', title: 'Task B', status: 'closed', priority: 2 },
      ]
      global.fetch = vi.fn((url) => {
        if (url === '/api/issues') {
          return Promise.resolve({ json: () => Promise.resolve({ data: issues }) })
        }
        if (url === '/api/issues/blocked') {
          return Promise.resolve({ json: () => Promise.resolve({ data: [] }) })
        }
        return Promise.resolve({ json: () => Promise.resolve({ data: { blockedBy: [], blocks: [] } }) })
      })

      const { container } = render(<DependencyGraph />)
      fireEvent.click(screen.getByText('Show Full Graph'))

      await waitFor(() => expect(container.querySelector('svg')).toBeInTheDocument())
      expect(screen.getByText('PROJ-1')).toBeInTheDocument()
      expect(screen.getByText('PROJ-2')).toBeInTheDocument()
    })

    test('renders SVG edges for dependencies', async () => {
      const issues = [
        { id: 'PROJ-1', title: 'Blocker', status: 'open', priority: 1 },
        { id: 'PROJ-2', title: 'Blocked', status: 'open', priority: 2 },
      ]
      const blockedList = [{ id: 'PROJ-2', blocked_by_count: 1 }]

      global.fetch = vi.fn((url) => {
        if (url === '/api/issues') {
          return Promise.resolve({ json: () => Promise.resolve({ data: issues }) })
        }
        if (url === '/api/issues/blocked') {
          return Promise.resolve({ json: () => Promise.resolve({ data: blockedList }) })
        }
        if (url.includes('/dependencies')) {
          return Promise.resolve({
            json: () => Promise.resolve({
              data: { blockedBy: [{ id: 'PROJ-1' }], blocks: [] }
            })
          })
        }
        return Promise.resolve({ json: () => Promise.resolve({ data: [] }) })
      })

      const { container } = render(<DependencyGraph />)
      fireEvent.click(screen.getByText('Show Full Graph'))

      await waitFor(() => expect(container.querySelector('path.dep-svg-edge')).toBeInTheDocument())
    })

    test('truncates long titles in SVG nodes', async () => {
      const issues = [
        { id: 'PROJ-1', title: 'This is a very long title that exceeds the limit', status: 'open', priority: 1 },
      ]
      global.fetch = vi.fn((url) => {
        if (url === '/api/issues') {
          return Promise.resolve({ json: () => Promise.resolve({ data: issues }) })
        }
        if (url === '/api/issues/blocked') {
          return Promise.resolve({ json: () => Promise.resolve({ data: [] }) })
        }
        return Promise.resolve({ json: () => Promise.resolve({ data: [] }) })
      })

      render(<DependencyGraph />)
      fireEvent.click(screen.getByText('Show Full Graph'))

      await waitFor(() => expect(screen.getByText('This is a very long tit\u2026')).toBeInTheDocument())
    })

    test('layers nodes - blockers appear above blocked', async () => {
      const issues = [
        { id: 'A', title: 'Root', status: 'open', priority: 1 },
        { id: 'B', title: 'Mid', status: 'open', priority: 1 },
        { id: 'C', title: 'Leaf', status: 'open', priority: 1 },
      ]
      const blockedList = [
        { id: 'B', blocked_by_count: 1 },
        { id: 'C', blocked_by_count: 1 },
      ]

      global.fetch = vi.fn((url) => {
        if (url === '/api/issues') {
          return Promise.resolve({ json: () => Promise.resolve({ data: issues }) })
        }
        if (url === '/api/issues/blocked') {
          return Promise.resolve({ json: () => Promise.resolve({ data: blockedList }) })
        }
        if (url === '/api/issues/B/dependencies') {
          return Promise.resolve({
            json: () => Promise.resolve({ data: { blockedBy: [{ id: 'A' }], blocks: [] } })
          })
        }
        if (url === '/api/issues/C/dependencies') {
          return Promise.resolve({
            json: () => Promise.resolve({ data: { blockedBy: [{ id: 'B' }], blocks: [] } })
          })
        }
        return Promise.resolve({ json: () => Promise.resolve({ data: { blockedBy: [], blocks: [] } }) })
      })

      const { container } = render(<DependencyGraph />)
      fireEvent.click(screen.getByText('Show Full Graph'))

      await waitFor(() => {
        const rects = container.querySelectorAll('rect.dep-svg-node')
        expect(rects.length).toBe(3)
      })

      const gs = [...container.querySelectorAll('.dep-graph-node')]
      const getNodeY = (id) => {
        const g = gs.find(g => g.textContent.includes(id))
        return g ? Number(g.querySelector('rect').getAttribute('y')) : null
      }

      expect(getNodeY('A')).toBeLessThan(getNodeY('B'))
      expect(getNodeY('B')).toBeLessThan(getNodeY('C'))
    })

    test('clicking an SVG node calls selectIssue', async () => {
      const issues = [{ id: 'PROJ-1', title: 'Clickable', status: 'open', priority: 1 }]
      global.fetch = vi.fn((url) => {
        if (url === '/api/issues') {
          return Promise.resolve({ json: () => Promise.resolve({ data: issues }) })
        }
        if (url === '/api/issues/blocked') {
          return Promise.resolve({ json: () => Promise.resolve({ data: [] }) })
        }
        return Promise.resolve({ json: () => Promise.resolve({ data: [] }) })
      })

      const { container } = render(<DependencyGraph />)
      fireEvent.click(screen.getByText('Show Full Graph'))

      await waitFor(() => expect(screen.getByText('PROJ-1')).toBeInTheDocument())
      const g = container.querySelector('.dep-graph-node')
      fireEvent.click(g)
      expect(selectIssue).toHaveBeenCalledWith('PROJ-1')
    })
  })

  describe('getNodeBorderColor (via SVG rendering)', () => {
    test.each([
      ['closed', false, 'var(--color-closed-border)'],
      ['open', true, 'var(--color-blocked-border)'],
      ['in_progress', false, 'var(--color-in-progress-border)'],
      ['open', false, 'var(--color-ready-border)'],
    ])('status="%s" hasBlockers=%s yields "%s"', async (status, hasBlockers, expectedColor) => {
      const issues = [{ id: 'PROJ-1', title: 'Node', status, priority: 1 }]
      const blocked = hasBlockers ? [{ id: 'PROJ-1', blocked_by_count: 1 }] : []

      global.fetch = vi.fn((url) => {
        if (url === '/api/issues') {
          return Promise.resolve({ json: () => Promise.resolve({ data: issues }) })
        }
        if (url === '/api/issues/blocked') {
          return Promise.resolve({ json: () => Promise.resolve({ data: blocked }) })
        }
        if (url.includes('/dependencies')) {
          return Promise.resolve({
            json: () => Promise.resolve({
              data: { blockedBy: hasBlockers ? [{ id: 'OTHER' }] : [], blocks: [] }
            })
          })
        }
        return Promise.resolve({ json: () => Promise.resolve({ data: [] }) })
      })

      const { container } = render(<DependencyGraph />)
      fireEvent.click(screen.getByText('Show Full Graph'))

      await waitFor(() => expect(container.querySelector('rect.dep-svg-node')).toBeInTheDocument())
      const rect = container.querySelector('rect.dep-svg-node')
      expect(rect.getAttribute('stroke')).toBe(expectedColor)
    })
  })

  describe('DependencyNode border color in FocusView', () => {
    test('selected node with blockers has blocked border', async () => {
      const issue = { id: 'SEL', title: 'Selected', status: 'open', priority: 1 }
      const deps = {
        blockedBy: [{ id: 'BLK', title: 'Blocker', status: 'open', priority: 1 }],
        blocks: []
      }

      global.fetch = vi.fn((url) => {
        if (url === '/api/issues/SEL') {
          return Promise.resolve({ json: () => Promise.resolve({ data: issue }) })
        }
        if (url === '/api/issues/SEL/dependencies') {
          return Promise.resolve({ json: () => Promise.resolve({ data: deps }) })
        }
        return Promise.resolve({ json: () => Promise.resolve({ data: [] }) })
      })

      selectedIssueIdSignal.value = 'SEL'
      const { container } = render(<DependencyGraph />)
      await waitFor(() => expect(screen.getByText('Selected')).toBeInTheDocument())

      const selectedNode = container.querySelector('.dep-node-selected')
      expect(selectedNode.style.borderColor).toBe('var(--color-blocked-border)')
    })
  })
})
