import { readFileSync } from 'node:fs'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { logger } from 'hono/logger'
import { openDb, doltConfig } from './db.js'
import { issueRoutes } from './routes/issues.js'
import { createWatcher } from './watcher.js'

const app = new Hono()

app.use(logger())

/** @type {Set<(event: string) => void>} */
const sseClients = new Set()

app.get('/api/events', (c) =>
  streamSSE(c, async (stream) => {
    /** @type {(event: string) => void} */
    const send = (event) => {
      stream.writeSSE({ data: event }).catch(() => {})
    }

    sseClients.add(send)

    const keepalive = setInterval(() => {
      stream.write(':keepalive\n\n').catch(() => {})
    }, 30_000)

    await new Promise((resolve) => {
      stream.onAbort(() => {
        clearInterval(keepalive)
        sseClients.delete(send)
        resolve(undefined)
      })
    })
  })
)

const broadcast = (event) => {
  for (const send of sseClients) {
    send(event)
  }
}

const { db, dbType, dbPath } = await openDb()

const watcherConfig = dbType === 'dolt' ? doltConfig(dbPath) : dbPath
const watcher = createWatcher(dbType, watcherConfig, () => broadcast('refresh'))

app.route('/api', issueRoutes(db))

app.use('/assets/*', serveStatic({ root: './dist' }))

const indexHtml = readFileSync('./dist/index.html', 'utf-8')
app.get('/', (c) => c.html(indexHtml))

const port = Number(process.env.PORT ?? 3333)

serve({ fetch: app.fetch, port }, () => {
  console.log(`bd-eye listening on http://localhost:${port}`)
  console.log(`database: ${dbType} @ ${dbPath}`)
})

const shutdown = async () => {
  await watcher.close()
  await db.close()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
