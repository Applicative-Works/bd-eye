import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPoolEnd = vi.fn()
const mockPoolQuery = vi.fn().mockResolvedValue([[]])
const mockPool = { query: mockPoolQuery, end: mockPoolEnd }

const mockConnQuery = vi.fn()
const mockConnEnd = vi.fn()
const mockConn = { query: mockConnQuery, end: mockConnEnd }

vi.mock('mysql2/promise', () => ({
  default: {
    createPool: vi.fn(() => mockPool),
    createConnection: vi.fn(async () => mockConn)
  }
}))

vi.mock('../src/server/db-dolt.js', () => ({
  openDoltDb: vi.fn(async (config) => ({
    name: config.database,
    close: vi.fn()
  }))
}))

const { createRegistry } = await import('../src/server/db-registry.js')
const { openDoltDb } = await import('../src/server/db-dolt.js')

const baseConfig = { host: '127.0.0.1', port: 3306, user: 'root', password: '' }

describe('createRegistry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPoolQuery.mockResolvedValue([[]])
  })

  describe('connectionFor', () => {
    it('creates a new connection on first call', async () => {
      const registry = createRegistry(baseConfig)
      const db = await registry.connectionFor('project-a')
      expect(openDoltDb).toHaveBeenCalledWith({ ...baseConfig, database: 'project-a' })
      expect(db.name).toBe('project-a')
      await registry.closeAll()
    })

    it('returns cached connection on subsequent calls', async () => {
      const registry = createRegistry(baseConfig)
      const db1 = await registry.connectionFor('project-a')
      const db2 = await registry.connectionFor('project-a')
      expect(db1).toBe(db2)
      expect(openDoltDb).toHaveBeenCalledTimes(1)
      await registry.closeAll()
    })

    it('creates separate connections for different names', async () => {
      const registry = createRegistry(baseConfig)
      const dbA = await registry.connectionFor('project-a')
      const dbB = await registry.connectionFor('project-b')
      expect(dbA).not.toBe(dbB)
      expect(openDoltDb).toHaveBeenCalledTimes(2)
      await registry.closeAll()
    })
  })

  describe('listProjects', () => {
    it('returns databases with issues tables', async () => {
      mockConnQuery
        .mockResolvedValueOnce([[{ Database: 'project-a' }, { Database: 'project-b' }, { Database: 'information_schema' }]])
        .mockResolvedValueOnce([[{ cnt: 42 }]])
        .mockResolvedValueOnce([[{ cnt: 7 }]])

      const registry = createRegistry(baseConfig)
      const projects = await registry.listProjects()

      expect(projects).toEqual([
        { name: 'project-a', issueCount: 42 },
        { name: 'project-b', issueCount: 7 }
      ])
      expect(mockConnEnd).toHaveBeenCalled()
    })

    it('filters out system databases', async () => {
      mockConnQuery
        .mockResolvedValueOnce([[
          { Database: 'information_schema' },
          { Database: 'mysql' },
          { Database: 'sys' },
          { Database: 'performance_schema' },
          { Database: 'myproject' }
        ]])
        .mockResolvedValueOnce([[{ cnt: 10 }]])

      const registry = createRegistry(baseConfig)
      const projects = await registry.listProjects()

      expect(projects).toEqual([{ name: 'myproject', issueCount: 10 }])
    })

    it('skips databases without issues table', async () => {
      mockConnQuery
        .mockResolvedValueOnce([[{ Database: 'has-issues' }, { Database: 'no-issues' }]])
        .mockResolvedValueOnce([[{ cnt: 5 }]])
        .mockRejectedValueOnce(new Error("Table 'no-issues.issues' doesn't exist"))

      const registry = createRegistry(baseConfig)
      const projects = await registry.listProjects()

      expect(projects).toEqual([{ name: 'has-issues', issueCount: 5 }])
    })
  })

  describe('closeAll', () => {
    it('closes all cached connections', async () => {
      const registry = createRegistry(baseConfig)
      const dbA = await registry.connectionFor('project-a')
      const dbB = await registry.connectionFor('project-b')

      await registry.closeAll()

      expect(dbA.close).toHaveBeenCalled()
      expect(dbB.close).toHaveBeenCalled()
    })

    it('clears the cache after closing', async () => {
      const registry = createRegistry(baseConfig)
      await registry.connectionFor('project-a')
      await registry.closeAll()

      await registry.connectionFor('project-a')
      expect(openDoltDb).toHaveBeenCalledTimes(2)
    })
  })
})
