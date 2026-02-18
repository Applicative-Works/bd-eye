import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockQuery = vi.fn()
const mockEnd = vi.fn()
const mockPool = { query: mockQuery, end: mockEnd }

vi.mock('mysql2/promise', () => ({
  default: { createPool: vi.fn(() => mockPool) }
}))

const { openDoltDb } = await import('../src/server/db-dolt.js')

const config = { host: '127.0.0.1', port: 3306, user: 'root', password: '', database: 'testdb' }

describe('openDoltDb', () => {
  let db

  beforeEach(async () => {
    vi.clearAllMocks()
    mockQuery.mockResolvedValue([[]])
    db = await openDoltDb(config)
  })

  describe('query methods returning arrays', () => {
    const rows = [{ id: 'i-1', title: 'Test' }, { id: 'i-2', title: 'Other' }]

    it.each([
      ['allIssues', [], /SELECT \* FROM issues ORDER BY/],
      ['readyIssues', [], /SELECT \* FROM ready_issues ORDER BY/],
      ['blockedIssues', [], /SELECT \* FROM blocked_issues ORDER BY/],
      ['epics', [], /issue_type = 'epic'/],
      ['allLabels', [], /SELECT issue_id, label FROM labels/],
    ])('%s() executes correct SQL pattern', async (method, args, pattern) => {
      mockQuery.mockResolvedValueOnce([rows])
      const result = await db[method](...args)
      expect(result).toEqual(rows)
      const sql = mockQuery.mock.calls.at(-1)[0]
      expect(sql).toMatch(pattern)
    })
  })

  describe('query methods with id parameter', () => {
    it.each([
      ['issueById', 'i-1', /SELECT \* FROM issues WHERE id = \?/],
      ['epicChildren', 'epic-1', /d\.depends_on_id = \?.*parent-child/s],
      ['commentsFor', 'i-1', /SELECT \* FROM comments WHERE issue_id = \?/],
    ])('%s(id) passes id as parameter', async (method, id, pattern) => {
      const rows = [{ id, title: 'Test' }]
      mockQuery.mockResolvedValue([rows])
      const result = await db[method](id)
      const [sql, params] = mockQuery.mock.calls.at(-1)
      expect(sql).toMatch(pattern)
      expect(params).toContain(id)
      if (method === 'issueById') {
        expect(result).toEqual(rows[0])
      } else {
        expect(result).toEqual(rows)
      }
    })
  })

  describe('dependenciesFor', () => {
    it('returns blockedBy and blocks arrays', async () => {
      const blockers = [{ id: 'b-1' }]
      const blocking = [{ id: 'b-2' }]
      mockQuery
        .mockResolvedValueOnce([blockers])
        .mockResolvedValueOnce([blocking])
      const result = await db.dependenciesFor('i-1')
      expect(result).toEqual({ blockedBy: blockers, blocks: blocking })
      const [sql1, params1] = mockQuery.mock.calls.at(-2)
      expect(sql1).toMatch(/d\.depends_on_id/)
      expect(sql1).toMatch(/d\.issue_id = \?/)
      expect(params1).toContain('i-1')
      const [sql2, params2] = mockQuery.mock.calls.at(-1)
      expect(sql2).toMatch(/d\.depends_on_id = \?/)
      expect(params2).toContain('i-1')
    })
  })

  describe('labels', () => {
    it('returns flat array of label strings', async () => {
      mockQuery.mockResolvedValueOnce([[{ label: 'backend' }, { label: 'urgent' }]])
      const result = await db.labels()
      expect(result).toEqual(['backend', 'urgent'])
      expect(mockQuery.mock.calls.at(-1)[0]).toMatch(/SELECT DISTINCT label FROM labels/)
    })
  })

  describe('searchIssues', () => {
    it('wraps query in LIKE wildcards', async () => {
      const rows = [{ id: 'i-1', title: 'Matching' }]
      mockQuery.mockResolvedValueOnce([rows])
      const result = await db.searchIssues('test')
      expect(result).toEqual(rows)
      const [sql, params] = mockQuery.mock.calls.at(-1)
      expect(sql).toMatch(/title LIKE \?/)
      expect(sql).toMatch(/description LIKE \?/)
      expect(sql).toMatch(/notes LIKE \?/)
      expect(params).toEqual(['%test%', '%test%', '%test%'])
    })
  })

  describe('config defaults', () => {
    it('uses fallback values for omitted config fields', async () => {
      const { createPool } = (await import('mysql2/promise')).default
      createPool.mockClear()
      await openDoltDb({})
      expect(createPool).toHaveBeenCalledWith(expect.objectContaining({
        host: '127.0.0.1',
        port: 3306,
        user: 'root',
        password: ''
      }))
    })
  })

  describe('close', () => {
    it('calls pool.end()', async () => {
      await db.close()
      expect(mockEnd).toHaveBeenCalledOnce()
    })
  })
})
