import { watch } from 'chokidar'
import { dirname, join, basename } from 'node:path'

/**
 * @param {string} dbPath
 * @param {() => void} onChange
 * @returns {{ close: () => Promise<void> }}
 */
const watchSqliteDb = (dbPath, onChange) => {
  const dir = dirname(dbPath)
  const stem = basename(dbPath, '.db')
  const walFile = join(dir, `${stem}.db-wal`)
  const shmFile = join(dir, `${stem}.db-shm`)

  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer

  const debounced = () => {
    clearTimeout(timer)
    timer = setTimeout(onChange, 500)
  }

  const watcher = watch([dbPath, walFile, shmFile], {
    ignoreInitial: true,
    awaitWriteFinish: false
  })

  watcher.on('change', debounced)
  watcher.on('add', debounced)

  return {
    close: async () => {
      clearTimeout(timer)
      await watcher.close()
    }
  }
}

/**
 * @param {{ host?: string, port?: number, user?: string, password?: string, database?: string }} config
 * @param {() => void} onChange
 * @returns {{ close: () => Promise<void> }}
 */
const watchDoltDb = (config, onChange) => {
  let lastHash = ''
  let stopped = false

  const poll = async () => {
    try {
      const mysql = (await import('mysql2/promise')).default
      const conn = await mysql.createConnection({
        host: config.host ?? '127.0.0.1',
        port: config.port ?? 3306,
        user: config.user ?? 'root',
        password: config.password ?? '',
        database: config.database ?? 'beads'
      })

      while (!stopped) {
        try {
          const [rows] = await conn.query("SELECT DOLT_HASHOF_DB() AS hash")
          const hash = /** @type {any[]} */ (rows)[0]?.hash ?? ''
          if (lastHash && hash !== lastHash) onChange()
          lastHash = hash
        } catch { /* query failed, retry next cycle */ }
        await new Promise((r) => setTimeout(r, 2000))
      }

      await conn.end()
    } catch (err) {
      console.error('Dolt watcher connection failed:', err instanceof Error ? err.message : err)
    }
  }

  poll()

  return {
    close: async () => { stopped = true }
  }
}

/**
 * @param {'sqlite' | 'dolt'} dbType
 * @param {string | { host?: string, port?: number, user?: string, password?: string, database?: string }} pathOrConfig
 * @param {() => void} onChange
 * @returns {{ close: () => Promise<void> }}
 */
export const createWatcher = (dbType, pathOrConfig, onChange) => {
  if (dbType === 'dolt') {
    return watchDoltDb(/** @type {any} */ (pathOrConfig), onChange)
  }
  return watchSqliteDb(/** @type {string} */ (pathOrConfig), onChange)
}
