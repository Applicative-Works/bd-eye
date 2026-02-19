import { Hono } from 'hono'

/** @param {{ issue_id: string, label: string }[]} rows */
const labelMap = (rows) => {
  /** @type {Map<string, string[]>} */
  const map = new Map()
  for (const { issue_id, label } of rows) {
    const existing = map.get(issue_id)
    if (existing) existing.push(label)
    else map.set(issue_id, [label])
  }
  return map
}

/** @param {import('../db.js').Db} db @param {import('../db.js').Issue[]} issues */
const attachLabels = async (db, issues) => {
  if (issues.length === 0) return issues
  const map = labelMap(await db.allLabels())
  return issues.map((issue) => ({ ...issue, labels: map.get(issue.id) ?? [] }))
}

/** @param {(name: string) => Promise<import('../db.js').Db>} dbFor */
export const issueRoutes = (dbFor) => {
  const router = new Hono()

  router.use('/*', async (c, next) => {
    c.set('db', await dbFor(c.req.param('project')))
    await next()
  })

  router.get('/issues', async (c) => {
    const db = /** @type {import('../db.js').Db} */ (c.get('db'))
    const status = c.req.query('status')
    const priority = c.req.query('priority')
    const type = c.req.query('type')
    const assignee = c.req.query('assignee')

    let issues = await db.allIssues()

    if (status) issues = issues.filter((i) => i.status === status)
    if (priority) issues = issues.filter((i) => i.priority === Number(priority))
    if (type) issues = issues.filter((i) => i.issue_type === type)
    if (assignee) issues = issues.filter((i) => i.assignee === assignee)

    const data = await attachLabels(db, issues)
    return c.json({ data, count: data.length })
  })

  router.get('/issues/ready', async (c) => {
    const db = /** @type {import('../db.js').Db} */ (c.get('db'))
    const data = await attachLabels(db, await db.readyIssues())
    return c.json({ data, count: data.length })
  })

  router.get('/issues/blocked', async (c) => {
    const db = /** @type {import('../db.js').Db} */ (c.get('db'))
    const data = await attachLabels(db, await db.blockedIssues())
    return c.json({ data, count: data.length })
  })

  router.get('/issues/:id', async (c) => {
    const db = /** @type {import('../db.js').Db} */ (c.get('db'))
    const issue = await db.issueById(c.req.param('id'))
    if (!issue) return c.json({ error: 'Not found' }, 404)

    const [labelled] = await attachLabels(db, [issue])
    const comments = await db.commentsFor(issue.id)
    return c.json({ data: { ...labelled, comments } })
  })

  router.get('/issues/:id/dependencies', async (c) => {
    const db = /** @type {import('../db.js').Db} */ (c.get('db'))
    const data = await db.dependenciesFor(c.req.param('id'))
    return c.json({ data })
  })

  router.get('/epics', async (c) => {
    const db = /** @type {import('../db.js').Db} */ (c.get('db'))
    const epics = await db.epics()
    const data = await Promise.all(epics.map(async (epic) => {
      const children = await db.epicChildren(epic.id)
      const closed_count = children.filter((ch) => ch.status === 'closed').length
      return { ...epic, child_count: children.length, closed_count }
    }))
    return c.json({ data })
  })

  router.get('/epics/:id/children', async (c) => {
    const db = /** @type {import('../db.js').Db} */ (c.get('db'))
    const data = await attachLabels(db, await db.epicChildren(c.req.param('id')))
    return c.json({ data, count: data.length })
  })

  router.get('/labels', async (c) => {
    const db = /** @type {import('../db.js').Db} */ (c.get('db'))
    return c.json({ data: await db.labels() })
  })

  router.get('/search', async (c) => {
    const db = /** @type {import('../db.js').Db} */ (c.get('db'))
    const q = c.req.query('q')
    if (!q) return c.json({ data: [], count: 0 })
    const data = await attachLabels(db, await db.searchIssues(q))
    return c.json({ data, count: data.length })
  })

  router.patch('/issues/:id/status', async (c) => {
    const db = /** @type {import('../db.js').Db} */ (c.get('db'))
    const id = c.req.param('id')
    const { status } = await c.req.json()
    const valid = ['open', 'in_progress', 'closed']
    if (!valid.includes(status)) return c.json({ error: 'Invalid status' }, 400)
    const issue = await db.issueById(id)
    if (!issue) return c.json({ error: 'Not found' }, 404)
    await db.updateIssueStatus(id, status)
    return c.json({ ok: true })
  })

  router.get('/health', (c) => c.json({ status: 'ok' }))

  return router
}
