import { existsSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { homedir } from 'node:os'
import Database from 'better-sqlite3'

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
 *   allIssues: () => Issue[]
 *   issueById: (id: string) => Issue | undefined
 *   readyIssues: () => Issue[]
 *   blockedIssues: () => BlockedIssue[]
 *   dependenciesFor: (issueId: string) => { blockedBy: Issue[], blocks: Issue[] }
 *   epics: () => Issue[]
 *   epicChildren: (epicId: string) => Issue[]
 *   labels: () => string[]
 *   commentsFor: (issueId: string) => Comment[]
 *   searchIssues: (query: string) => Issue[]
 *   allLabels: () => { issue_id: string, label: string }[]
 *   close: () => void
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

const ALIVE = "status <> 'tombstone' AND deleted_at IS NULL"

/** @param {string} [path] @returns {Db} */
export const openDb = (path) => {
  const db = new Database(path ?? resolveDbPath(), { readonly: true })
  db.pragma('journal_mode = WAL')

  const stmts = {
    allIssues: db.prepare(
      `SELECT * FROM issues WHERE ${ALIVE} ORDER BY priority, created_at`
    ),

    issueById: db.prepare(
      `SELECT * FROM issues WHERE id = ? AND ${ALIVE}`
    ),

    readyIssues: db.prepare(
      `SELECT * FROM ready_issues WHERE ${ALIVE} ORDER BY priority, created_at`
    ),

    blockedIssues: db.prepare(
      `SELECT * FROM blocked_issues WHERE ${ALIVE} ORDER BY blocked_by_count DESC, priority, created_at`
    ),

    blockedBy: db.prepare(
      `SELECT i.* FROM issues i
       JOIN dependencies d ON i.id = d.depends_on_id
       WHERE d.issue_id = ? AND d.type = 'blocks' AND ${ALIVE}`
    ),

    blocks: db.prepare(
      `SELECT i.* FROM issues i
       JOIN dependencies d ON i.id = d.issue_id
       WHERE d.depends_on_id = ? AND d.type = 'blocks' AND ${ALIVE}`
    ),

    epics: db.prepare(
      `SELECT * FROM issues WHERE issue_type = 'epic' AND ${ALIVE} ORDER BY priority, created_at`
    ),

    epicChildren: db.prepare(
      `SELECT i.* FROM issues i
       JOIN dependencies d ON i.id = d.issue_id
       WHERE d.depends_on_id = ? AND d.type = 'parent-child' AND ${ALIVE}
       ORDER BY i.priority, i.created_at`
    ),

    labels: db.prepare(
      'SELECT DISTINCT label FROM labels ORDER BY label'
    ),

    allLabels: db.prepare(
      'SELECT issue_id, label FROM labels ORDER BY issue_id, label'
    ),

    commentsFor: db.prepare(
      'SELECT * FROM comments WHERE issue_id = ? ORDER BY created_at'
    ),

    searchIssues: db.prepare(
      `SELECT * FROM issues
       WHERE ${ALIVE}
         AND (title LIKE ? OR description LIKE ? OR notes LIKE ?)
       ORDER BY priority, created_at`
    )
  }

  return {
    allIssues: () => /** @type {Issue[]} */ (stmts.allIssues.all()),

    issueById: (id) => /** @type {Issue | undefined} */ (stmts.issueById.get(id)),

    readyIssues: () => /** @type {Issue[]} */ (stmts.readyIssues.all()),

    blockedIssues: () => /** @type {BlockedIssue[]} */ (stmts.blockedIssues.all()),

    dependenciesFor: (issueId) => ({
      blockedBy: /** @type {Issue[]} */ (stmts.blockedBy.all(issueId)),
      blocks: /** @type {Issue[]} */ (stmts.blocks.all(issueId))
    }),

    epics: () => /** @type {Issue[]} */ (stmts.epics.all()),

    epicChildren: (epicId) => /** @type {Issue[]} */ (stmts.epicChildren.all(epicId)),

    labels: () => stmts.labels.all().map((/** @type {{ label: string }} */ r) => r.label),

    commentsFor: (issueId) => /** @type {Comment[]} */ (stmts.commentsFor.all(issueId)),

    allLabels: () =>
      /** @type {{ issue_id: string, label: string }[]} */ (stmts.allLabels.all()),

    searchIssues: (query) => {
      const pattern = `%${query}%`
      return /** @type {Issue[]} */ (stmts.searchIssues.all(pattern, pattern, pattern))
    },

    close: () => db.close()
  }
}
