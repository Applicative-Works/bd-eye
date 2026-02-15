import mysql from 'mysql2/promise'

const ALIVE = "status <> 'tombstone' AND deleted_at IS NULL"

/** @param {{ host?: string, port?: number, user?: string, password?: string, database?: string }} config */
export const openDoltDb = async (config) => {
  const pool = mysql.createPool({
    host: config.host ?? '127.0.0.1',
    port: config.port ?? 3306,
    user: config.user ?? 'root',
    password: config.password ?? '',
    database: config.database ?? 'beads',
    waitForConnections: true,
    connectionLimit: 5
  })

  await pool.query('SELECT 1')

  /** @param {string} sql @param {any[]} [params] */
  const queryAll = async (sql, params) => {
    const [rows] = await pool.query(sql, params)
    return /** @type {any[]} */ (rows)
  }

  /** @param {string} sql @param {any[]} [params] */
  const queryOne = async (sql, params) => {
    const rows = await queryAll(sql, params)
    return rows[0]
  }

  return /** @type {import('./db.js').Db} */ ({
    allIssues: () =>
      queryAll(`SELECT * FROM issues WHERE ${ALIVE} ORDER BY priority, created_at`),

    issueById: (id) =>
      queryOne(`SELECT * FROM issues WHERE id = ? AND ${ALIVE}`, [id]),

    readyIssues: () =>
      queryAll(`SELECT * FROM ready_issues WHERE ${ALIVE} ORDER BY priority, created_at`),

    blockedIssues: () =>
      queryAll(`SELECT * FROM blocked_issues WHERE ${ALIVE} ORDER BY blocked_by_count DESC, priority, created_at`),

    dependenciesFor: async (issueId) => ({
      blockedBy: await queryAll(
        `SELECT i.* FROM issues i
         JOIN dependencies d ON i.id = d.depends_on_id
         WHERE d.issue_id = ? AND d.type = 'blocks' AND ${ALIVE}`,
        [issueId]
      ),
      blocks: await queryAll(
        `SELECT i.* FROM issues i
         JOIN dependencies d ON i.id = d.issue_id
         WHERE d.depends_on_id = ? AND d.type = 'blocks' AND ${ALIVE}`,
        [issueId]
      )
    }),

    epics: () =>
      queryAll(`SELECT * FROM issues WHERE issue_type = 'epic' AND ${ALIVE} ORDER BY priority, created_at`),

    epicChildren: (epicId) =>
      queryAll(
        `SELECT i.* FROM issues i
         JOIN dependencies d ON i.id = d.issue_id
         WHERE d.depends_on_id = ? AND d.type = 'parent-child' AND ${ALIVE}
         ORDER BY i.priority, i.created_at`,
        [epicId]
      ),

    labels: async () => {
      const rows = await queryAll('SELECT DISTINCT label FROM labels ORDER BY label')
      return rows.map((/** @type {{ label: string }} */ r) => r.label)
    },

    commentsFor: (issueId) =>
      queryAll('SELECT * FROM comments WHERE issue_id = ? ORDER BY created_at', [issueId]),

    allLabels: () =>
      queryAll('SELECT issue_id, label FROM labels ORDER BY issue_id, label'),

    searchIssues: (query) => {
      const pattern = `%${query}%`
      return queryAll(
        `SELECT * FROM issues
         WHERE ${ALIVE}
           AND (title LIKE ? OR description LIKE ? OR notes LIKE ?)
         ORDER BY priority, created_at`,
        [pattern, pattern, pattern]
      )
    },

    close: async () => { await pool.end() }
  })
}
