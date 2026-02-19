/** @vitest-environment jsdom */
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/preact'
import '@testing-library/jest-dom/vitest'

vi.mock('../../src/client/components/Markdown.jsx', () => ({
  Markdown: ({ text }) => <div data-testid="markdown">{text}</div>
}))

import { DetailPanel } from '../../src/client/components/DetailPanel.jsx'

const baseIssue = {
  id: 'PROJ-42',
  title: 'Implement caching',
  description: 'Add Redis cache',
  status: 'open',
  priority: 1,
  issue_type: 'feature',
  assignee: 'Dan',
  labels: ['backend', 'perf'],
  acceptance_criteria: 'Cache hit rate > 90%',
  design: 'Use Redis cluster',
  notes: 'Check memory limits',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-02T00:00:00Z',
  comments: [
    { id: 'c1', author: 'Alice', text: 'Looks good', created_at: '2025-01-01T12:00:00Z' },
    { id: 'c2', author: 'Bob', text: 'Agreed', created_at: '2025-01-02T12:00:00Z' },
  ],
}

const baseDeps = {
  blockedBy: [
    { id: 'PROJ-10', title: 'Setup Redis', status: 'in_progress' },
  ],
  blocks: [
    { id: 'PROJ-50', title: 'Deploy to prod', status: 'open' },
  ],
}

const mockFetchSuccess = (issueData = baseIssue, depsData = baseDeps) => {
  global.fetch = vi.fn((url) => {
    if (url.includes('/dependencies')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: depsData }) })
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: issueData }) })
  })
}

const mockFetchFailure = (message = 'Failed to fetch issue') => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: false }))
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(cleanup)

describe('DetailPanel', () => {
  test('shows loading state initially', () => {
    global.fetch = vi.fn(() => new Promise(() => {}))
    render(<DetailPanel issueId="PROJ-42" onClose={() => {}} onSelectIssue={() => {}} />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  test('shows error message on fetch failure', async () => {
    mockFetchFailure()
    render(<DetailPanel issueId="PROJ-42" onClose={() => {}} onSelectIssue={() => {}} />)
    await waitFor(() => expect(screen.getByText('Failed to fetch issue')).toBeInTheDocument())
  })

  test('shows "Issue not found" when issue data is null', async () => {
    global.fetch = vi.fn((url) => {
      if (url.includes('/dependencies')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: baseDeps }) })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: null }) })
    })
    render(<DetailPanel issueId="PROJ-42" onClose={() => {}} onSelectIssue={() => {}} />)
    await waitFor(() => expect(screen.getByText('Issue not found')).toBeInTheDocument())
  })

  test('renders issue id, title, and badges after loading', async () => {
    mockFetchSuccess()
    const { container } = render(<DetailPanel issueId="PROJ-42" onClose={() => {}} onSelectIssue={() => {}} />)
    await waitFor(() => expect(screen.getByText('PROJ-42')).toBeInTheDocument())
    expect(screen.getByText('Implement caching')).toBeInTheDocument()
    expect(screen.getByText('P1')).toBeInTheDocument()
    const header = container.querySelector('.panel-header')
    expect(header).toHaveTextContent('open')
    expect(header).toHaveTextContent('feature')
  })

  test('renders assignee name', async () => {
    mockFetchSuccess()
    render(<DetailPanel issueId="PROJ-42" onClose={() => {}} onSelectIssue={() => {}} />)
    await waitFor(() => expect(screen.getByText('Dan')).toBeInTheDocument())
  })

  test('renders "unassigned" when assignee is null', async () => {
    mockFetchSuccess({ ...baseIssue, assignee: null })
    render(<DetailPanel issueId="PROJ-42" onClose={() => {}} onSelectIssue={() => {}} />)
    await waitFor(() => expect(screen.getByText('unassigned')).toBeInTheDocument())
  })

  test('renders labels', async () => {
    mockFetchSuccess()
    render(<DetailPanel issueId="PROJ-42" onClose={() => {}} onSelectIssue={() => {}} />)
    await waitFor(() => expect(screen.getByText('backend')).toBeInTheDocument())
    expect(screen.getByText('perf')).toBeInTheDocument()
  })

  test.each([
    ['Description', 'Add Redis cache'],
    ['Acceptance Criteria', 'Cache hit rate > 90%'],
    ['Design', 'Use Redis cluster'],
    ['Notes', 'Check memory limits'],
  ])('renders %s section with markdown', async (sectionTitle, markdownContent) => {
    mockFetchSuccess()
    render(<DetailPanel issueId="PROJ-42" onClose={() => {}} onSelectIssue={() => {}} />)
    await waitFor(() => expect(screen.getByText(sectionTitle)).toBeInTheDocument())
    expect(screen.getByText(markdownContent)).toBeInTheDocument()
  })

  test('does not render optional sections when fields are null', async () => {
    mockFetchSuccess({
      ...baseIssue,
      description: null,
      acceptance_criteria: null,
      design: null,
      notes: null,
      comments: [],
    }, { blockedBy: [], blocks: [] })
    render(<DetailPanel issueId="PROJ-42" onClose={() => {}} onSelectIssue={() => {}} />)
    await waitFor(() => expect(screen.getByText('Implement caching')).toBeInTheDocument())
    expect(screen.queryByText('Description')).not.toBeInTheDocument()
    expect(screen.queryByText('Acceptance Criteria')).not.toBeInTheDocument()
    expect(screen.queryByText('Design')).not.toBeInTheDocument()
    expect(screen.queryByText('Notes')).not.toBeInTheDocument()
  })

  test('renders dependency sections', async () => {
    mockFetchSuccess()
    render(<DetailPanel issueId="PROJ-42" onClose={() => {}} onSelectIssue={() => {}} />)
    await waitFor(() => expect(screen.getByText('Dependencies')).toBeInTheDocument())
    expect(screen.getByText('Blocked by')).toBeInTheDocument()
    expect(screen.getByText('Setup Redis')).toBeInTheDocument()
    expect(screen.getByText('Blocks')).toBeInTheDocument()
    expect(screen.getByText('Deploy to prod')).toBeInTheDocument()
  })

  test('clicking a dependency calls onSelectIssue', async () => {
    mockFetchSuccess()
    const onSelectIssue = vi.fn()
    render(<DetailPanel issueId="PROJ-42" onClose={() => {}} onSelectIssue={onSelectIssue} />)
    await waitFor(() => expect(screen.getByText('Setup Redis')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Setup Redis'))
    expect(onSelectIssue).toHaveBeenCalledWith('PROJ-10')
  })

  test('renders comments with authors', async () => {
    mockFetchSuccess()
    render(<DetailPanel issueId="PROJ-42" onClose={() => {}} onSelectIssue={() => {}} />)
    await waitFor(() => expect(screen.getByText('Comments (2)')).toBeInTheDocument())
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Looks good')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('Agreed')).toBeInTheDocument()
  })

  test('close button calls onClose', async () => {
    mockFetchSuccess()
    const onClose = vi.fn()
    render(<DetailPanel issueId="PROJ-42" onClose={onClose} onSelectIssue={() => {}} />)
    await waitFor(() => expect(screen.getByText('PROJ-42')).toBeInTheDocument())
    fireEvent.click(screen.getAllByText('×')[0])
    expect(onClose).toHaveBeenCalled()
  })

  test('fetches both issue and dependencies in parallel', async () => {
    mockFetchSuccess()
    render(<DetailPanel issueId="PROJ-42" onClose={() => {}} onSelectIssue={() => {}} />)
    await waitFor(() => expect(screen.getByText('PROJ-42')).toBeInTheDocument())
    expect(global.fetch).toHaveBeenCalledWith('/api/issues/PROJ-42')
    expect(global.fetch).toHaveBeenCalledWith('/api/issues/PROJ-42/dependencies')
  })

  test('does not render dependencies section when empty', async () => {
    mockFetchSuccess(baseIssue, { blockedBy: [], blocks: [] })
    render(<DetailPanel issueId="PROJ-42" onClose={() => {}} onSelectIssue={() => {}} />)
    await waitFor(() => expect(screen.getByText('PROJ-42')).toBeInTheDocument())
    expect(screen.queryByText('Dependencies')).not.toBeInTheDocument()
  })
})
