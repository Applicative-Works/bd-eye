import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { detectDbType, resolveDbPath, doltConfig, openDb } from '../src/server/db.js'

const tempDirs = []
const makeTempDir = () => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'bd-eye-db-test-')))
  tempDirs.push(dir)
  return dir
}

afterAll(() => {
  tempDirs.forEach(dir => rmSync(dir, { recursive: true, force: true }))
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('detectDbType', () => {
  it.each([
    ['a .db file path', () => {
      const dir = makeTempDir()
      const dbFile = join(dir, 'test.db')
      writeFileSync(dbFile, '')
      return dbFile
    }, 'sqlite'],
    ['a nonexistent path', () => '/no/such/path/test.db', 'sqlite'],
    ['a plain directory without .dolt', () => makeTempDir(), 'sqlite'],
    ['a directory with .dolt subdirectory', () => {
      const dir = makeTempDir()
      mkdirSync(join(dir, '.dolt'))
      return dir
    }, 'dolt'],
  ])('returns %s for %s', (_label, pathFn, expected) => {
    expect(detectDbType(pathFn())).toBe(expected)
  })

  it.each([
    'DOLT_HOST', 'DOLT_PORT', 'DOLT_USER', 'DOLT_PASSWORD', 'DOLT_DATABASE',
  ])('returns dolt when %s env var is set', (envVar) => {
    vi.stubEnv(envVar, 'any-value')
    expect(detectDbType('/no/such/path')).toBe('dolt')
  })
})

describe('resolveDbPath', () => {
  it('uses BEADS_DB env var when set', () => {
    const dir = makeTempDir()
    const dbPath = join(dir, 'custom.db')
    vi.stubEnv('BEADS_DB', dbPath)
    expect(resolveDbPath()).toBe(dbPath)
  })

  it('returns an absolute path even when BEADS_DB is relative', () => {
    vi.stubEnv('BEADS_DB', 'relative/path.db')
    const result = resolveDbPath()
    expect(result).toMatch(/^\//)
    expect(result).toContain('relative/path.db')
  })

  it('walks up the directory tree to find .beads/*.db', () => {
    const root = makeTempDir()
    const nested = join(root, 'a', 'b', 'c')
    mkdirSync(nested, { recursive: true })
    const beadsDir = join(root, '.beads')
    mkdirSync(beadsDir)
    writeFileSync(join(beadsDir, 'project.db'), '')

    const originalCwd = process.cwd()
    process.chdir(nested)
    try {
      vi.stubEnv('BEADS_DB', '')
      const result = resolveDbPath()
      expect(result).toBe(join(beadsDir, 'project.db'))
    } finally {
      process.chdir(originalCwd)
    }
  })

  it('falls back to ~/.beads/default.db when no .beads directory is found', () => {
    const dir = makeTempDir()
    const originalCwd = process.cwd()
    process.chdir(dir)
    try {
      vi.stubEnv('BEADS_DB', '')
      const result = resolveDbPath()
      expect(result).toMatch(/\.beads\/default\.db$/)
    } finally {
      process.chdir(originalCwd)
    }
  })
})

describe('doltConfig', () => {
  it('returns defaults when no env vars are set', () => {
    expect(doltConfig('/some/path/mydb')).toEqual({
      host: '127.0.0.1',
      port: 3306,
      user: 'root',
      password: '',
      database: 'mydb',
    })
  })

  it('derives database name from dbPath basename', () => {
    expect(doltConfig('/data/repos/my-project').database).toBe('my-project')
  })

  it('defaults database to empty string when no dbPath given', () => {
    expect(doltConfig().database).toBe('')
    expect(doltConfig(undefined).database).toBe('')
  })

  it.each([
    ['DOLT_HOST', 'host', 'custom-host', 'custom-host'],
    ['DOLT_PORT', 'port', '3307', 3307],
    ['DOLT_USER', 'user', 'admin', 'admin'],
    ['DOLT_PASSWORD', 'password', 'secret', 'secret'],
    ['DOLT_DATABASE', 'database', 'custom_db', 'custom_db'],
  ])('respects %s env var', (envVar, configKey, envValue, expected) => {
    vi.stubEnv(envVar, envValue)
    expect(doltConfig('/some/path')[configKey]).toBe(expected)
  })

  it('prefers DOLT_DATABASE over dbPath basename', () => {
    vi.stubEnv('DOLT_DATABASE', 'override_db')
    expect(doltConfig('/some/path/ignored').database).toBe('override_db')
  })
})

describe('openDb', () => {
  it('dispatches to SQLite for .db files', async () => {
    const dir = makeTempDir()
    const dbPath = join(dir, 'test.db')
    writeFileSync(dbPath, '')

    const mockDb = { close: vi.fn() }
    vi.doMock('../src/server/db-sqlite.js', () => ({
      openSqliteDb: vi.fn(() => mockDb),
    }))

    const { openDb: mockedOpenDb } = await import('../src/server/db.js')
    const result = await mockedOpenDb(dbPath)

    expect(result.dbType).toBe('sqlite')
    expect(result.dbPath).toBe(dbPath)
    expect(result.db).toBe(mockDb)
  })

  it('dispatches to Dolt for dolt directories', async () => {
    const dir = makeTempDir()
    mkdirSync(join(dir, '.dolt'))

    const mockDb = { close: vi.fn() }
    vi.doMock('../src/server/db-dolt.js', () => ({
      openDoltDb: vi.fn(() => mockDb),
    }))

    const { openDb: mockedOpenDb } = await import('../src/server/db.js')
    const result = await mockedOpenDb(dir)

    expect(result.dbType).toBe('dolt')
    expect(result.dbPath).toBe(dir)
    expect(result.db).toBe(mockDb)
  })
})
