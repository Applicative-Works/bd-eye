import { existsSync, readdirSync, statSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { homedir } from 'node:os'

/**
 * @typedef {{
 *   id: string
 *   title: string
 *   description: string
 *   design: string
 *   acceptance_criteria: string
 *   notes: string
 *   status: string
 *   priority: number
 *   issue_type: string
 *   assignee: string | null
 *   created_at: string
 *   updated_at: string
 *   closed_at: string | null
 *   metadata: string
 * }} Issue
 */

/**
 * @typedef {Issue & { blocked_by_count: number }} BlockedIssue
 */

/**
 * @typedef {{
 *   id: number
 *   issue_id: string
 *   author: string
 *   text: string
 *   created_at: string
 * }} Comment
 */

/**
 * @typedef {{
 *   allIssues: () => Promise<Issue[]>
 *   issueById: (id: string) => Promise<Issue | undefined>
 *   readyIssues: () => Promise<Issue[]>
 *   blockedIssues: () => Promise<BlockedIssue[]>
 *   dependenciesFor: (issueId: string) => Promise<{ blockedBy: Issue[], blocks: Issue[] }>
 *   epics: () => Promise<Issue[]>
 *   epicChildren: (epicId: string) => Promise<Issue[]>
 *   labels: () => Promise<string[]>
 *   commentsFor: (issueId: string) => Promise<Comment[]>
 *   searchIssues: (query: string) => Promise<Issue[]>
 *   allLabels: () => Promise<{ issue_id: string, label: string }[]>
 *   updateIssueStatus: (id: string, status: string) => Promise<void>
 *   close: () => Promise<void>
 * }} Db
 */

/** @param {string} dir */
const findBeadsDb = (dir) => {
  const beadsDir = join(dir, '.beads')
  if (existsSync(beadsDir)) {
    const dbs = readdirSync(beadsDir).filter((/** @type {string} */ f) => f.endsWith('.db'))
    if (dbs.length > 0) return join(beadsDir, dbs[0])
  }
  const parent = dirname(dir)
  if (parent === dir) return undefined
  return findBeadsDb(parent)
}

export const resolveDbPath = () => {
  if (process.env.BEADS_DB) return resolve(process.env.BEADS_DB)
  const found = findBeadsDb(process.cwd())
  if (found) return found
  return join(homedir(), '.beads', 'default.db')
}

const hasDoltEnv = () =>
  ['DOLT_HOST', 'DOLT_PORT', 'DOLT_USER', 'DOLT_PASSWORD', 'DOLT_DATABASE'].some((k) => k in process.env)

/** @param {string} path @returns {'sqlite' | 'dolt'} */
export const detectDbType = (path) => {
  if (hasDoltEnv()) return 'dolt'
  try {
    if (statSync(path).isDirectory() && existsSync(join(path, '.dolt'))) return 'dolt'
  } catch { /* not a directory */ }
  return 'sqlite'
}

const SYSTEM_DBS = new Set(['information_schema', 'mysql', 'sys', 'performance_schema'])

/** @param {{ host: string, port: number, user: string, password: string }} config */
const discoverDoltDatabase = async (config) => {
  const mysql = (await import('mysql2/promise')).default
  const conn = await mysql.createConnection(config)
  try {
    const [rows] = await conn.query('SHOW DATABASES')
    const userDbs = /** @type {any[]} */ (rows).map((r) => r.Database).filter((d) => !SYSTEM_DBS.has(d))
    if (userDbs.length === 1) return userDbs[0]
    if (userDbs.length === 0) throw new Error('no user databases found on Dolt server')
    throw new Error(`multiple databases found (${userDbs.join(', ')}), set DOLT_DATABASE to choose one`)
  } finally {
    await conn.end()
  }
}

/** @param {string} [dbPath] @returns {{ host: string, port: number, user: string, password: string, database: string }} */
export const doltConfig = (dbPath) => ({
  host: process.env.DOLT_HOST ?? '127.0.0.1',
  port: Number(process.env.DOLT_PORT ?? 3306),
  user: process.env.DOLT_USER ?? 'root',
  password: process.env.DOLT_PASSWORD ?? '',
  database: process.env.DOLT_DATABASE ?? (dbPath ? basename(dbPath) : '')
})

/** @param {string} [path] @returns {Promise<{ db: Db, dbType: 'sqlite' | 'dolt', dbPath: string }>} */
export const openDb = async (path) => {
  if (!path && hasDoltEnv()) {
    const config = doltConfig()
    if (!config.database) {
      config.database = await discoverDoltDatabase(config)
    }
    const { openDoltDb } = await import('./db-dolt.js')
    const db = await openDoltDb(config)
    return { db, dbType: /** @type {const} */ ('dolt'), dbPath: `dolt://${config.host}:${config.port}/${config.database}` }
  }

  const dbPath = path ?? resolveDbPath()
  const dbType = detectDbType(dbPath)

  if (dbType === 'dolt') {
    const { openDoltDb } = await import('./db-dolt.js')
    const db = await openDoltDb(doltConfig(dbPath))
    return { db, dbType, dbPath }
  }

  const { openSqliteDb } = await import('./db-sqlite.js')
  const db = await openSqliteDb(dbPath)
  return { db, dbType, dbPath }
}
