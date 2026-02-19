/**
 * @param {{ host?: string, port?: number, user?: string, password?: string }} config
 * @param {{ listProjects: () => Promise<{ name: string }[]> }} registry
 * @param {(event: string) => void} onChange
 * @returns {{ close: () => Promise<void> }}
 */
export const createWatcher = (config, registry, onChange) => {
  /** @type {Map<string, string>} */
  const lastHashes = new Map()
  let stopped = false

  const poll = async () => {
    try {
      const mysql = (await import('mysql2/promise')).default
      const conn = await mysql.createConnection({
        host: config.host ?? '127.0.0.1',
        port: config.port ?? 3306,
        user: config.user ?? 'root',
        password: config.password ?? ''
      })

      while (!stopped) {
        try {
          const projects = await registry.listProjects()
          for (const { name } of projects) {
            try {
              const [rows] = await conn.query(`SELECT DOLT_HASHOF_DB('${name}') AS hash`)
              const hash = /** @type {any[]} */ (rows)[0]?.hash ?? ''
              const lastHash = lastHashes.get(name) ?? ''
              if (lastHash && hash !== lastHash) onChange(JSON.stringify({ project: name }))
              lastHashes.set(name, hash)
            } catch { /* skip individual db errors */ }
          }
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
