import { describe, it, expect, vi, afterEach } from 'vitest'
import { createWatcher } from '../src/server/watcher.js'

const mockRegistry = {
  listProjects: vi.fn().mockResolvedValue([{ name: 'testdb' }])
}

describe('createWatcher', () => {
  it('returns an object with close()', () => {
    const watcher = createWatcher({ host: '127.0.0.1', port: 13306, user: 'test', password: '' }, mockRegistry, () => {})
    expect(watcher).toHaveProperty('close')
    expect(typeof watcher.close).toBe('function')
    watcher.close()
  })

  it('close() resolves without error', async () => {
    const watcher = createWatcher({ host: '127.0.0.1', port: 13306, user: 'test', password: '' }, mockRegistry, () => {})
    await expect(watcher.close()).resolves.toBeUndefined()
  })
})

describe('polling', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls onChange when hash changes', { timeout: 15000 }, async () => {
    const onChange = vi.fn()
    let callCount = 0
    const mockEnd = vi.fn()
    const mockQuery = vi.fn(async () => {
      callCount++
      if (callCount === 1) return [[{ latest: 'aaa' }]]
      return [[{ latest: 'bbb' }]]
    })
    const mockConn = { query: mockQuery, end: mockEnd }

    const registry = {
      listProjects: vi.fn().mockResolvedValue([{ name: 'testdb' }])
    }

    vi.resetModules()
    vi.doMock('mysql2/promise', () => ({
      default: { createConnection: vi.fn(async () => mockConn) }
    }))

    const { createWatcher: freshCreateWatcher } = await import('../src/server/watcher.js')
    const watcher = freshCreateWatcher({ host: '127.0.0.1', port: 13307, user: 'root', password: '' }, registry, onChange)

    await vi.waitFor(() => expect(onChange).toHaveBeenCalled(), { timeout: 10000 })
    await watcher.close()
    vi.doUnmock('mysql2/promise')
  })

  it('does not call onChange on first poll', async () => {
    const onChange = vi.fn()
    let callCount = 0
    const mockEnd = vi.fn()
    const mockQuery = vi.fn(async () => {
      callCount++
      if (callCount >= 2) throw new Error('stop')
      return [[{ latest: 'aaa' }]]
    })
    const mockConn = { query: mockQuery, end: mockEnd }

    const registry = {
      listProjects: vi.fn().mockResolvedValue([{ name: 'testdb' }])
    }

    vi.resetModules()
    vi.doMock('mysql2/promise', () => ({
      default: { createConnection: vi.fn(async () => mockConn) }
    }))

    const { createWatcher: freshCreateWatcher } = await import('../src/server/watcher.js')
    const watcher = freshCreateWatcher({ host: '127.0.0.1', port: 13308, user: 'root', password: '' }, registry, onChange)

    await new Promise((r) => setTimeout(r, 3000))
    expect(onChange).not.toHaveBeenCalled()
    await watcher.close()
    vi.doUnmock('mysql2/promise')
  })

  it('handles connection failure gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const onChange = vi.fn()
    const watcher = createWatcher({ host: '127.0.0.1', port: 13309, user: 'x', password: '' }, mockRegistry, onChange)

    await new Promise((r) => setTimeout(r, 1000))
    expect(onChange).not.toHaveBeenCalled()
    await watcher.close()
    consoleSpy.mockRestore()
  })

  it('handles query failure and retries', async () => {
    const onChange = vi.fn()
    let callCount = 0
    const mockEnd = vi.fn()
    const mockQuery = vi.fn(async () => {
      callCount++
      if (callCount === 1) throw new Error('query failed')
      if (callCount === 2) return [[{ latest: 'aaa' }]]
      return [[{ latest: 'bbb' }]]
    })
    const mockConn = { query: mockQuery, end: mockEnd }

    const registry = {
      listProjects: vi.fn().mockResolvedValue([{ name: 'testdb' }])
    }

    vi.resetModules()
    vi.doMock('mysql2/promise', () => ({
      default: { createConnection: vi.fn(async () => mockConn) }
    }))

    const { createWatcher: freshCreateWatcher } = await import('../src/server/watcher.js')
    const watcher = freshCreateWatcher({ host: '127.0.0.1', port: 13310, user: 'root', password: '' }, registry, onChange)

    await vi.waitFor(() => expect(onChange).toHaveBeenCalled(), { timeout: 10000 })
    await watcher.close()
    vi.doUnmock('mysql2/promise')
  })

  it('uses config defaults when fields are omitted', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const onChange = vi.fn()
    const watcher = createWatcher({}, mockRegistry, onChange)

    await new Promise((r) => setTimeout(r, 500))
    await watcher.close()
    consoleSpy.mockRestore()
  })

  it('includes project name in onChange event', { timeout: 15000 }, async () => {
    const onChange = vi.fn()
    let callCount = 0
    const mockEnd = vi.fn()
    const mockQuery = vi.fn(async () => {
      callCount++
      if (callCount === 1) return [[{ latest: 'aaa' }]]
      return [[{ latest: 'bbb' }]]
    })
    const mockConn = { query: mockQuery, end: mockEnd }

    const registry = {
      listProjects: vi.fn().mockResolvedValue([{ name: 'myproject' }])
    }

    vi.resetModules()
    vi.doMock('mysql2/promise', () => ({
      default: { createConnection: vi.fn(async () => mockConn) }
    }))

    const { createWatcher: freshCreateWatcher } = await import('../src/server/watcher.js')
    const watcher = freshCreateWatcher({ host: '127.0.0.1', port: 13311, user: 'root', password: '' }, registry, onChange)

    await vi.waitFor(() => expect(onChange).toHaveBeenCalled(), { timeout: 10000 })
    const event = JSON.parse(onChange.mock.calls[0][0])
    expect(event.project).toBe('myproject')
    await watcher.close()
    vi.doUnmock('mysql2/promise')
  })
})
