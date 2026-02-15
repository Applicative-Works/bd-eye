import { watch } from 'chokidar'
import { dirname, join, basename } from 'node:path'

/**
 * @param {string} dbPath - path to the .beads/*.db file
 * @param {() => void} onChange - callback when DB changes
 * @returns {{ close: () => Promise<void> }}
 */
export const watchDb = (dbPath, onChange) => {
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
