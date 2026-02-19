import { describe, it, expect, vi, afterEach } from 'vitest'
import { doltConfig, openDb } from '../src/server/db.js'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('doltConfig', () => {
  it('returns defaults when no env vars are set', () => {
    expect(doltConfig()).toEqual({
      host: '127.0.0.1',
      port: 3306,
      user: 'root',
      password: '',
      database: '',
    })
  })

  it.each([
    ['DOLT_HOST', 'host', 'custom-host', 'custom-host'],
    ['DOLT_PORT', 'port', '3307', 3307],
    ['DOLT_USER', 'user', 'admin', 'admin'],
    ['DOLT_PASSWORD', 'password', 'secret', 'secret'],
    ['DOLT_DATABASE', 'database', 'custom_db', 'custom_db'],
  ])('respects %s env var', (envVar, configKey, envValue, expected) => {
    vi.stubEnv(envVar, envValue)
    expect(doltConfig()[configKey]).toBe(expected)
  })
})

describe('openDb', () => {
  it('opens Dolt with env config', async () => {
    const mockDb = { close: vi.fn() }
    vi.doMock('../src/server/db-dolt.js', () => ({
      openDoltDb: vi.fn(() => mockDb),
    }))

    vi.stubEnv('DOLT_DATABASE', 'testdb')
    vi.stubEnv('DOLT_PORT', '3307')

    const { openDb: mockedOpenDb } = await import('../src/server/db.js')
    const result = await mockedOpenDb()

    expect(result.db).toBe(mockDb)
    expect(result.dbPath).toMatch(/dolt:\/\//)
    expect(result.config.database).toBe('testdb')
    expect(result.config.port).toBe(3307)
  })

  it('auto-discovers database when DOLT_DATABASE is not set', async () => {
    const mockDb = { close: vi.fn() }
    const mockQuery = vi.fn().mockResolvedValue([[{ Database: 'myproject' }]])
    const mockEnd = vi.fn()

    vi.doMock('mysql2/promise', () => ({
      default: { createConnection: vi.fn(() => ({ query: mockQuery, end: mockEnd })) }
    }))
    vi.doMock('../src/server/db-dolt.js', () => ({
      openDoltDb: vi.fn(() => mockDb),
    }))

    const { openDb: mockedOpenDb } = await import('../src/server/db.js')
    const result = await mockedOpenDb()

    expect(result.config.database).toBe('myproject')
    expect(result.db).toBe(mockDb)
  })
})
