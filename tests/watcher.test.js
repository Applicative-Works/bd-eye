import { describe, it, expect, vi, afterAll, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { rmSync } from 'node:fs'
import { createWatcher } from '../src/server/watcher.js'

const dir = mkdtempSync(join(tmpdir(), 'bd-eye-watcher-'))
const dbPath = join(dir, 'test.db')
writeFileSync(dbPath, '')

afterAll(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('createWatcher', () => {
  it.each([
    ['sqlite', dbPath],
    ['dolt', { host: '127.0.0.1', port: 13306, user: 'test', password: '', database: 'testdb' }]
  ])('returns an object with close() for %s type', (type, config) => {
    const watcher = createWatcher(type, config, () => {})
    expect(watcher).toHaveProperty('close')
    expect(typeof watcher.close).toBe('function')
    watcher.close()
  })

  it.each([
    ['sqlite', dbPath],
    ['dolt', { host: '127.0.0.1', port: 13306, user: 'test', password: '', database: 'testdb' }]
  ])('close() resolves without error for %s type', async (type, config) => {
    const watcher = createWatcher(type, config, () => {})
    await expect(watcher.close()).resolves.toBeUndefined()
  })
})

describe('watchSqliteDb debounce', () => {
  it('calls onChange after file modification', async () => {
    const onChange = vi.fn()
    const watcher = createWatcher('sqlite', dbPath, onChange)

    await new Promise((r) => setTimeout(r, 300))
    appendFileSync(dbPath, 'x')

    await vi.waitFor(() => expect(onChange).toHaveBeenCalled(), { timeout: 3000 })
    await watcher.close()
  })

  it('debounces rapid changes into a single callback', async () => {
    const onChange = vi.fn()
    const watcher = createWatcher('sqlite', dbPath, onChange)

    await new Promise((r) => setTimeout(r, 300))
    appendFileSync(dbPath, 'a')
    appendFileSync(dbPath, 'b')
    appendFileSync(dbPath, 'c')

    await vi.waitFor(() => expect(onChange).toHaveBeenCalled(), { timeout: 3000 })
    expect(onChange).toHaveBeenCalledTimes(1)
    await watcher.close()
  })
})

describe('watchDoltDb polling', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls onChange when hash changes', async () => {
    const onChange = vi.fn()
    let callCount = 0
    const mockEnd = vi.fn()
    const mockQuery = vi.fn(async () => {
      callCount++
      if (callCount === 1) return [[{ hash: 'aaa' }]]
      return [[{ hash: 'bbb' }]]
    })
    const mockConn = { query: mockQuery, end: mockEnd }

    vi.doMock('mysql2/promise', () => ({
      default: { createConnection: vi.fn(async () => mockConn) }
    }))

    const { createWatcher: freshCreateWatcher } = await import('../src/server/watcher.js')
    const watcher = freshCreateWatcher('dolt', { host: '127.0.0.1', port: 13307, user: 'root', password: '', database: 'test' }, onChange)

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

    vi.doMock('mysql2/promise', () => ({
      default: { createConnection: vi.fn(async () => mockConn) }
    }))

    const { createWatcher: freshCreateWatcher } = await import('../src/server/watcher.js')
    const watcher = freshCreateWatcher('dolt', { host: '127.0.0.1', port: 13308, user: 'root', password: '', database: 'test' }, onChange)

    await new Promise((r) => setTimeout(r, 3000))
    expect(onChange).not.toHaveBeenCalled()
    await watcher.close()
    vi.doUnmock('mysql2/promise')
  })

  it('handles connection failure gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const onChange = vi.fn()
    const watcher = createWatcher('dolt', { host: '127.0.0.1', port: 13309, user: 'x', password: '', database: 'x' }, onChange)

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

    vi.doMock('mysql2/promise', () => ({
      default: { createConnection: vi.fn(async () => mockConn) }
    }))

    const { createWatcher: freshCreateWatcher } = await import('../src/server/watcher.js')
    const watcher = freshCreateWatcher('dolt', { host: '127.0.0.1', port: 13310, user: 'root', password: '', database: 'test' }, onChange)

    await vi.waitFor(() => expect(onChange).toHaveBeenCalled(), { timeout: 10000 })
    await watcher.close()
    vi.doUnmock('mysql2/promise')
  })

  it('uses config defaults when fields are omitted', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const onChange = vi.fn()
    const watcher = createWatcher('dolt', {}, onChange)

    await new Promise((r) => setTimeout(r, 500))
    await watcher.close()
    consoleSpy.mockRestore()
  })
})
