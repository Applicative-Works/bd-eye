import { describe, it, expect, vi, afterEach } from 'vitest'
import { createWatcher } from '../src/server/watcher.js'

describe('createWatcher', () => {
  it('returns an object with close()', () => {
    const watcher = createWatcher({ host: '127.0.0.1', port: 13306, user: 'test', password: '', database: 'testdb' }, () => {})
    expect(watcher).toHaveProperty('close')
    expect(typeof watcher.close).toBe('function')
    watcher.close()
  })

  it('close() resolves without error', async () => {
    const watcher = createWatcher({ host: '127.0.0.1', port: 13306, user: 'test', password: '', database: 'testdb' }, () => {})
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
      if (callCount === 1) return [[{ hash: 'aaa' }]]
      return [[{ hash: 'bbb' }]]
    })
    const mockConn = { query: mockQuery, end: mockEnd }

    vi.resetModules()
    vi.doMock('mysql2/promise', () => ({
      default: { createConnection: vi.fn(async () => mockConn) }
    }))

    const { createWatcher: freshCreateWatcher } = await import('../src/server/watcher.js')
    const watcher = freshCreateWatcher({ host: '127.0.0.1', port: 13307, user: 'root', password: '', database: 'test' }, onChange)

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
      return [[{ hash: 'aaa' }]]
    })
    const mockConn = { query: mockQuery, end: mockEnd }

    vi.resetModules()
    vi.doMock('mysql2/promise', () => ({
      default: { createConnection: vi.fn(async () => mockConn) }
    }))

    const { createWatcher: freshCreateWatcher } = await import('../src/server/watcher.js')
    const watcher = freshCreateWatcher({ host: '127.0.0.1', port: 13308, user: 'root', password: '', database: 'test' }, onChange)

    await new Promise((r) => setTimeout(r, 3000))
    expect(onChange).not.toHaveBeenCalled()
    await watcher.close()
    vi.doUnmock('mysql2/promise')
  })

  it('handles connection failure gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const onChange = vi.fn()
    const watcher = createWatcher({ host: '127.0.0.1', port: 13309, user: 'x', password: '', database: 'x' }, onChange)

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
      if (callCount === 2) return [[{ hash: 'aaa' }]]
      return [[{ hash: 'bbb' }]]
    })
    const mockConn = { query: mockQuery, end: mockEnd }

    vi.resetModules()
    vi.doMock('mysql2/promise', () => ({
      default: { createConnection: vi.fn(async () => mockConn) }
    }))

    const { createWatcher: freshCreateWatcher } = await import('../src/server/watcher.js')
    const watcher = freshCreateWatcher({ host: '127.0.0.1', port: 13310, user: 'root', password: '', database: 'test' }, onChange)

    await vi.waitFor(() => expect(onChange).toHaveBeenCalled(), { timeout: 10000 })
    await watcher.close()
    vi.doUnmock('mysql2/promise')
  })

  it('uses config defaults when fields are omitted', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const onChange = vi.fn()
    const watcher = createWatcher({}, onChange)

    await new Promise((r) => setTimeout(r, 500))
    await watcher.close()
    consoleSpy.mockRestore()
  })
})
