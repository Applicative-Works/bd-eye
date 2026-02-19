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

/** @returns {{ host: string, port: number, user: string, password: string, database: string }} */
export const doltConfig = () => ({
  host: process.env.DOLT_HOST ?? '127.0.0.1',
  port: Number(process.env.DOLT_PORT ?? 3306),
  user: process.env.DOLT_USER ?? 'root',
  password: process.env.DOLT_PASSWORD ?? '',
  database: process.env.DOLT_DATABASE ?? ''
})

/** @returns {Promise<{ db: Db, config: { host: string, port: number, user: string, password: string, database: string }, dbPath: string }>} */
export const openDb = async () => {
  const config = doltConfig()
  if (!config.database) {
    config.database = await discoverDoltDatabase(config)
  }
  const { openDoltDb } = await import('./db-dolt.js')
  const db = await openDoltDb(config)
  const dbPath = `dolt://${config.host}:${config.port}/${config.database}`
  return { db, config, dbPath }
}
