import { existsSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
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

/** @param {string} path @returns {'sqlite' | 'dolt'} */
export const detectDbType = (path) => {
  try {
    if (statSync(path).isDirectory() && existsSync(join(path, '.dolt'))) return 'dolt'
  } catch { /* not a directory */ }
  return 'sqlite'
}

/** @returns {{ host: string, port: number, user: string, password: string, database: string }} */
export const doltConfig = () => ({
  host: process.env.DOLT_HOST ?? '127.0.0.1',
  port: Number(process.env.DOLT_PORT ?? 3306),
  user: process.env.DOLT_USER ?? 'root',
  password: process.env.DOLT_PASSWORD ?? '',
  database: process.env.DOLT_DATABASE ?? 'beads'
})

/** @param {string} [path] @returns {Promise<{ db: Db, dbType: 'sqlite' | 'dolt', dbPath: string }>} */
export const openDb = async (path) => {
  const dbPath = path ?? resolveDbPath()
  const dbType = detectDbType(dbPath)

  if (dbType === 'dolt') {
    const { openDoltDb } = await import('./db-dolt.js')
    const db = await openDoltDb(doltConfig())
    return { db, dbType, dbPath }
  }

  const { openSqliteDb } = await import('./db-sqlite.js')
  const db = await openSqliteDb(dbPath)
  return { db, dbType, dbPath }
}
