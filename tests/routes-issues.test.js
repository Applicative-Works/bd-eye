import { describe, it, expect, beforeAll } from 'vitest'
import { Hono } from 'hono'
import { issueRoutes } from '../src/server/routes/issues.js'

const issues = [
  { id: 'issue-4', title: 'Epic one', description: 'An epic', design: '', acceptance_criteria: '', notes: '', status: 'open', priority: 0, issue_type: 'epic', assignee: null, created_at: '2024-01-04', updated_at: '2024-01-04', closed_at: null, metadata: '{}' },
  { id: 'issue-1', title: 'First issue', description: 'Description one', design: '', acceptance_criteria: '', notes: 'Some notes', status: 'open', priority: 1, issue_type: 'task', assignee: null, created_at: '2024-01-01', updated_at: '2024-01-01', closed_at: null, metadata: '{}' },
  { id: 'issue-3', title: 'Third issue', description: 'Description three', design: '', acceptance_criteria: '', notes: '', status: 'closed', priority: 1, issue_type: 'feature', assignee: 'bob', created_at: '2024-01-03', updated_at: '2024-01-03', closed_at: '2024-01-10', metadata: '{}' },
  { id: 'issue-2', title: 'Second issue', description: 'Description two', design: '', acceptance_criteria: '', notes: '', status: 'open', priority: 2, issue_type: 'bug', assignee: 'alice', created_at: '2024-01-02', updated_at: '2024-01-02', closed_at: null, metadata: '{}' },
  { id: 'issue-5', title: 'Blocked task', description: 'This is blocked', design: '', acceptance_criteria: '', notes: '', status: 'open', priority: 2, issue_type: 'task', assignee: null, created_at: '2024-01-05', updated_at: '2024-01-05', closed_at: null, metadata: '{}' },
]

const labels = [
  { issue_id: 'issue-1', label: 'backend' },
  { issue_id: 'issue-1', label: 'urgent' },
  { issue_id: 'issue-2', label: 'frontend' },
]

const comments = [
  { id: 1, issue_id: 'issue-1', author: 'alice', text: 'Looks good', created_at: '2024-01-02' },
  { id: 2, issue_id: 'issue-1', author: 'bob', text: 'Agreed', created_at: '2024-01-03' },
]

const db = {
  allIssues: async () => [...issues],
  issueById: async (id) => issues.find((i) => i.id === id),
  readyIssues: async () => issues.filter((i) => i.id !== 'issue-5'),
  blockedIssues: async () => [{ ...issues.find((i) => i.id === 'issue-5'), blocked_by_count: 1 }],
  dependenciesFor: async (id) => {
    if (id === 'issue-5') return { blockedBy: [issues.find((i) => i.id === 'issue-1')], blocks: [] }
    if (id === 'issue-1') return { blockedBy: [], blocks: [issues.find((i) => i.id === 'issue-5')] }
    return { blockedBy: [], blocks: [] }
  },
  epics: async () => issues.filter((i) => i.issue_type === 'epic'),
  epicChildren: async (epicId) => {
    if (epicId === 'issue-4') return [issues.find((i) => i.id === 'issue-2')]
    return []
  },
  labels: async () => ['backend', 'frontend', 'urgent'],
  commentsFor: async (issueId) => comments.filter((c) => c.issue_id === issueId),
  allLabels: async () => [...labels],
  searchIssues: async (query) => {
    const q = query.toLowerCase()
    return issues.filter((i) =>
      i.id.toLowerCase().includes(q) ||
      i.title.toLowerCase().includes(q) ||
      i.description.toLowerCase().includes(q) ||
      i.notes.toLowerCase().includes(q)
    )
  },
  updateIssueStatus: async () => {},
  updateIssueAssignee: async () => {},
  close: async () => {},
}

const dbFor = async () => db

let app

beforeAll(() => {
  app = new Hono()
  app.route('/api/projects/:project', issueRoutes(dbFor))
})

const get = async (path) => {
  const res = await app.request(`/api/projects/testdb${path}`)
  return { status: res.status, body: await res.json() }
}

describe('GET /health', () => {
  it('returns ok', async () => {
    const { body } = await get('/health')
    expect(body).toEqual({ status: 'ok' })
  })
})

describe('GET /issues', () => {
  it('returns all issues with labels', async () => {
    const { body } = await get('/issues')
    expect(body.count).toBe(5)
    const issue1 = body.data.find((i) => i.id === 'issue-1')
    expect(issue1.labels).toEqual(['backend', 'urgent'])
  })

  it.each([
    ['status', 'open', ['issue-4', 'issue-1', 'issue-2', 'issue-5']],
    ['status', 'closed', ['issue-3']],
    ['priority', '1', ['issue-1', 'issue-3']],
    ['type', 'bug', ['issue-2']],
    ['assignee', 'alice', ['issue-2']],
  ])('filters by %s=%s', async (param, value, expectedIds) => {
    const { body } = await get(`/issues?${param}=${value}`)
    expect(body.data.map((i) => i.id)).toEqual(expectedIds)
    expect(body.count).toBe(expectedIds.length)
  })

  it('returns empty when filter matches nothing', async () => {
    const { body } = await get('/issues?assignee=nobody')
    expect(body).toEqual({ data: [], count: 0 })
  })
})

describe('GET /issues/ready', () => {
  it('returns unblocked issues', async () => {
    const { body } = await get('/issues/ready')
    const ids = body.data.map((i) => i.id)
    expect(ids).not.toContain('issue-5')
    expect(ids).toContain('issue-1')
  })

  it('attaches labels to ready issues', async () => {
    const { body } = await get('/issues/ready')
    const issue1 = body.data.find((i) => i.id === 'issue-1')
    expect(issue1.labels).toEqual(['backend', 'urgent'])
  })
})

describe('GET /issues/blocked', () => {
  it('returns blocked issues with blocked_by_count', async () => {
    const { body } = await get('/issues/blocked')
    expect(body.data.length).toBeGreaterThan(0)
    const blocked = body.data.find((i) => i.id === 'issue-5')
    expect(blocked).toBeDefined()
    expect(blocked.blocked_by_count).toBe(1)
  })

  it('attaches labels to blocked issues', async () => {
    const { body } = await get('/issues/blocked')
    body.data.forEach((i) => {
      expect(i).toHaveProperty('labels')
      expect(Array.isArray(i.labels)).toBe(true)
    })
  })
})

describe('GET /issues/:id', () => {
  it('returns a single issue with labels and comments', async () => {
    const { body } = await get('/issues/issue-1')
    expect(body.data.id).toBe('issue-1')
    expect(body.data.labels).toEqual(['backend', 'urgent'])
    expect(body.data.comments).toHaveLength(2)
    expect(body.data.comments[0].author).toBe('alice')
    expect(body.data.comments[1].author).toBe('bob')
  })

  it('returns 404 for non-existent issue', async () => {
    const { status, body } = await get('/issues/nonexistent')
    expect(status).toBe(404)
    expect(body.error).toBe('Not found')
  })

  it('returns issue without labels as empty array', async () => {
    const { body } = await get('/issues/issue-3')
    expect(body.data.labels).toEqual([])
  })
})

describe('GET /issues/:id/dependencies', () => {
  it('returns blockedBy and blocks for an issue', async () => {
    const { body } = await get('/issues/issue-5/dependencies')
    expect(body.data.blockedBy).toHaveLength(1)
    expect(body.data.blockedBy[0].id).toBe('issue-1')
    expect(body.data.blocks).toHaveLength(0)
  })

  it('returns the reverse direction for the blocker', async () => {
    const { body } = await get('/issues/issue-1/dependencies')
    expect(body.data.blockedBy).toHaveLength(0)
    expect(body.data.blocks).toHaveLength(1)
    expect(body.data.blocks[0].id).toBe('issue-5')
  })

  it('returns empty arrays for issue with no dependencies', async () => {
    const { body } = await get('/issues/issue-3/dependencies')
    expect(body.data).toEqual({ blockedBy: [], blocks: [] })
  })
})

describe('GET /epics', () => {
  it('returns epics with child_count and closed_count', async () => {
    const { body } = await get('/epics')
    expect(body.data).toHaveLength(1)
    const epic = body.data[0]
    expect(epic.id).toBe('issue-4')
    expect(epic.issue_type).toBe('epic')
    expect(epic.child_count).toBe(1)
    expect(epic.closed_count).toBe(0)
  })
})

describe('GET /epics/:id/children', () => {
  it('returns children of an epic with labels', async () => {
    const { body } = await get('/epics/issue-4/children')
    expect(body.count).toBe(1)
    expect(body.data[0].id).toBe('issue-2')
    expect(body.data[0].labels).toEqual(['frontend'])
  })

  it('returns empty for epic with no children', async () => {
    const { body } = await get('/epics/issue-1/children')
    expect(body).toEqual({ data: [], count: 0 })
  })
})

describe('GET /labels', () => {
  it('returns distinct labels sorted alphabetically', async () => {
    const { body } = await get('/labels')
    expect(body.data).toEqual(['backend', 'frontend', 'urgent'])
  })
})

describe('GET /search', () => {
  it('returns matching issues by title', async () => {
    const { body } = await get('/search?q=First')
    expect(body.count).toBe(1)
    expect(body.data[0].id).toBe('issue-1')
  })

  it('returns matching issues by description', async () => {
    const { body } = await get('/search?q=blocked')
    expect(body.count).toBe(1)
    expect(body.data[0].id).toBe('issue-5')
  })

  it('attaches labels to search results', async () => {
    const { body } = await get('/search?q=First')
    expect(body.data[0].labels).toEqual(['backend', 'urgent'])
  })

  it('returns empty when no query is provided', async () => {
    const { body } = await get('/search')
    expect(body).toEqual({ data: [], count: 0 })
  })

  it('returns empty when query matches nothing', async () => {
    const { body } = await get('/search?q=zzzznonexistent')
    expect(body).toEqual({ data: [], count: 0 })
  })
})

const patch = async (path, body) => {
  const res = await app.request(`/api/projects/testdb${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  return { status: res.status, body: await res.json() }
}

describe('PATCH /issues/:id/assignee', () => {
  it('updates assignee and returns ok', async () => {
    const { status, body } = await patch('/issues/issue-1/assignee', { assignee: 'alice' })
    expect(status).toBe(200)
    expect(body).toEqual({ ok: true })
  })

  it('accepts null to unassign', async () => {
    const { status, body } = await patch('/issues/issue-2/assignee', { assignee: null })
    expect(status).toBe(200)
    expect(body).toEqual({ ok: true })
  })

  it('returns 404 for non-existent issue', async () => {
    const { status, body } = await patch('/issues/nonexistent/assignee', { assignee: 'alice' })
    expect(status).toBe(404)
    expect(body.error).toBe('Not found')
  })

  it('returns 400 for invalid assignee type', async () => {
    const { status, body } = await patch('/issues/issue-1/assignee', { assignee: 123 })
    expect(status).toBe(400)
    expect(body.error).toBe('Invalid assignee')
  })
})
