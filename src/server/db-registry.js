import mysql from 'mysql2/promise'
import { SYSTEM_DBS } from './db.js'
import { openDoltDb } from './db-dolt.js'

/** @param {{ host: string, port: number, user: string, password: string }} baseConfig */
export const createRegistry = (baseConfig) => {
  /** @type {Map<string, import('./db.js').Db>} */
  const pools = new Map()

  /** @param {string} name */
  const connectionFor = async (name) => {
    const existing = pools.get(name)
    if (existing) return existing
    const db = await openDoltDb({ ...baseConfig, database: name })
    pools.set(name, db)
    return db
  }

  const listProjects = async () => {
    const conn = await mysql.createConnection(baseConfig)
    try {
      const [rows] = await conn.query('SHOW DATABASES')
      const candidates = /** @type {any[]} */ (rows)
        .map((r) => r.Database)
        .filter((d) => !SYSTEM_DBS.has(d))

      const projects = []
      for (const name of candidates) {
        try {
          const [countRows] = await conn.query(`SELECT COUNT(*) AS cnt FROM \`${name}\`.issues`)
          projects.push({ name, issueCount: /** @type {any[]} */ (countRows)[0].cnt })
        } catch {
          continue
        }
      }
      return projects
    } finally {
      await conn.end()
    }
  }

  const closeAll = async () => {
    const closing = [...pools.values()].map((db) => db.close())
    pools.clear()
    await Promise.all(closing)
  }

  return { connectionFor, listProjects, closeAll }
}
