import { readFileSync } from 'node:fs'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { logger } from 'hono/logger'
import { discoverBoards, openDb, doltConfig } from './db.js'
import { issueRoutes } from './routes/issues.js'
import { createWatcher } from './watcher.js'
import { loadConfig, saveConfig } from './config.js'

const app = new Hono()

app.use(logger())

// --- Board discovery and connection management ---

const config = loadConfig()
const boardInfos = discoverBoards(config.scanRoots, config.excludePaths)

/** @type {Map<string, import('./db.js').Db>} */
const boardDbs = new Map()
/** @type {Map<string, { dbType: string, dbPath: string }>} */
const boardMeta = new Map()
/** @type {Map<string, { close: () => Promise<void> }>} */
const boardWatchers = new Map()
/** @type {Map<string, Set<(event: string) => void>>} */
const boardSseClients = new Map()

// Open all discovered boards
for (const info of boardInfos) {
  try {
    const { db, dbType, dbPath } = await openDb(info.path)
    boardDbs.set(info.id, db)
    boardMeta.set(info.id, { dbType, dbPath })
    boardSseClients.set(info.id, new Set())

    const broadcast = (event) => {
      for (const send of boardSseClients.get(info.id)) {
        send(event)
      }
    }

    const watcherConfig = dbType === 'dolt' ? doltConfig(dbPath) : dbPath
    const watcher = createWatcher(dbType, watcherConfig, () => broadcast('refresh'))
    boardWatchers.set(info.id, watcher)

    console.log(`  board: ${info.id} (${dbType} @ ${dbPath})`)
  } catch (err) {
    console.error(`  failed to open board ${info.id}:`, err instanceof Error ? err.message : err)
  }
}

if (boardDbs.size === 0) {
  console.log('No beads projects found. Scan roots:', config.scanRoots.join(', '))
}

// --- API routes ---

// Board listing
app.get('/api/boards', (c) => {
  const boards = boardInfos
    .filter((b) => boardDbs.has(b.id))
    .map((b) => ({
      id: b.id,
      name: b.name,
      path: boardMeta.get(b.id)?.dbPath,
      type: boardMeta.get(b.id)?.dbType
    }))
  return c.json({ data: boards, lastUsedBoard: config.lastUsedBoard })
})

// Set last-used board
app.post('/api/boards/:boardId/use', (c) => {
  const boardId = c.req.param('boardId')
  if (!boardDbs.has(boardId)) return c.json({ error: 'Board not found' }, 404)
  saveConfig({ lastUsedBoard: boardId })
  config.lastUsedBoard = boardId
  return c.json({ ok: true })
})

// Per-board SSE events
app.get('/api/boards/:boardId/events', (c) => {
  const boardId = c.req.param('boardId')
  const clients = boardSseClients.get(boardId)
  if (!clients) return c.json({ error: 'Board not found' }, 404)

  return streamSSE(c, async (stream) => {
    /** @type {(event: string) => void} */
    const send = (event) => {
      stream.writeSSE({ data: event }).catch(() => {})
    }

    clients.add(send)

    const keepalive = setInterval(() => {
      stream.write(':keepalive\n\n').catch(() => {})
    }, 30_000)

    await new Promise((resolve) => {
      stream.onAbort(() => {
        clearInterval(keepalive)
        clients.delete(send)
        resolve(undefined)
      })
    })
  })
})

// Per-board issue routes
app.route(
  '/api/boards/:boardId',
  issueRoutes((boardId) => boardDbs.get(boardId))
)

// --- Static files ---

app.use('/assets/*', serveStatic({ root: './dist' }))

const indexHtml = readFileSync('./dist/index.html', 'utf-8')
app.get('/', (c) => c.html(indexHtml))

// --- Start server ---

const port = Number(process.env.PORT ?? 3333)

serve({ fetch: app.fetch, port }, () => {
  console.log(`bd-eye listening on http://localhost:${port}`)
  console.log(`${boardDbs.size} board(s) loaded`)
})

const shutdown = async () => {
  for (const [id, watcher] of boardWatchers) {
    await watcher.close()
  }
  for (const [id, db] of boardDbs) {
    await db.close()
  }
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
