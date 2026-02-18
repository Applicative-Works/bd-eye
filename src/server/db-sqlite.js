import Database from 'better-sqlite3'

const ALIVE = "status <> 'tombstone' AND deleted_at IS NULL"

/** @param {string} path @returns {Promise<import('./db.js').Db>} */
export const openSqliteDb = async (path) => {
  const db = new Database(path)
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
    ),

    updateStatus: db.prepare(
      `UPDATE issues SET status = ?, updated_at = ?, closed_at = ? WHERE id = ?`
    )
  }

  return {
    allIssues: async () => /** @type {import('./db.js').Issue[]} */ (stmts.allIssues.all()),

    issueById: async (id) => /** @type {import('./db.js').Issue | undefined} */ (stmts.issueById.get(id)),

    readyIssues: async () => /** @type {import('./db.js').Issue[]} */ (stmts.readyIssues.all()),

    blockedIssues: async () => /** @type {import('./db.js').BlockedIssue[]} */ (stmts.blockedIssues.all()),

    dependenciesFor: async (issueId) => ({
      blockedBy: /** @type {import('./db.js').Issue[]} */ (stmts.blockedBy.all(issueId)),
      blocks: /** @type {import('./db.js').Issue[]} */ (stmts.blocks.all(issueId))
    }),

    epics: async () => /** @type {import('./db.js').Issue[]} */ (stmts.epics.all()),

    epicChildren: async (epicId) => /** @type {import('./db.js').Issue[]} */ (stmts.epicChildren.all(epicId)),

    labels: async () => stmts.labels.all().map((/** @type {{ label: string }} */ r) => r.label),

    commentsFor: async (issueId) => /** @type {import('./db.js').Comment[]} */ (stmts.commentsFor.all(issueId)),

    allLabels: async () =>
      /** @type {{ issue_id: string, label: string }[]} */ (stmts.allLabels.all()),

    searchIssues: async (query) => {
      const pattern = `%${query}%`
      return /** @type {import('./db.js').Issue[]} */ (stmts.searchIssues.all(pattern, pattern, pattern))
    },

    updateIssueStatus: async (id, status) => {
      const now = new Date().toISOString()
      const closedAt = status === 'closed' ? now : null
      stmts.updateStatus.run(status, now, closedAt, id)
    },

    close: async () => db.close()
  }
}
