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
const attachLabels = (db, issues) => {
  if (issues.length === 0) return issues
  const map = labelMap(db.allLabels())
  return issues.map((issue) => ({ ...issue, labels: map.get(issue.id) ?? [] }))
}

/** @param {import('../db.js').Db} db */
export const issueRoutes = (db) => {
  const router = new Hono()

  router.get('/issues', (c) => {
    const status = c.req.query('status')
    const priority = c.req.query('priority')
    const type = c.req.query('type')
    const assignee = c.req.query('assignee')

    let issues = db.allIssues()

    if (status) issues = issues.filter((i) => i.status === status)
    if (priority) issues = issues.filter((i) => i.priority === Number(priority))
    if (type) issues = issues.filter((i) => i.issue_type === type)
    if (assignee) issues = issues.filter((i) => i.assignee === assignee)

    const data = attachLabels(db, issues)
    return c.json({ data, count: data.length })
  })

  router.get('/issues/ready', (c) => {
    const data = attachLabels(db, db.readyIssues())
    return c.json({ data, count: data.length })
  })

  router.get('/issues/blocked', (c) => {
    const data = attachLabels(db, db.blockedIssues())
    return c.json({ data, count: data.length })
  })

  router.get('/issues/:id', (c) => {
    const issue = db.issueById(c.req.param('id'))
    if (!issue) return c.json({ error: 'Not found' }, 404)

    const [labelled] = attachLabels(db, [issue])
    const comments = db.commentsFor(issue.id)
    return c.json({ data: { ...labelled, comments } })
  })

  router.get('/issues/:id/dependencies', (c) => {
    const data = db.dependenciesFor(c.req.param('id'))
    return c.json({ data })
  })

  router.get('/epics', (c) => {
    const epics = db.epics()
    const data = epics.map((epic) => {
      const children = db.epicChildren(epic.id)
      const closed_count = children.filter((ch) => ch.status === 'closed').length
      return { ...epic, child_count: children.length, closed_count }
    })
    return c.json({ data })
  })

  router.get('/epics/:id/children', (c) => {
    const data = attachLabels(db, db.epicChildren(c.req.param('id')))
    return c.json({ data, count: data.length })
  })

  router.get('/labels', (c) => {
    return c.json({ data: db.labels() })
  })

  router.get('/search', (c) => {
    const q = c.req.query('q')
    if (!q) return c.json({ data: [], count: 0 })
    const data = attachLabels(db, db.searchIssues(q))
    return c.json({ data, count: data.length })
  })

  router.get('/health', (c) => c.json({ status: 'ok' }))

  return router
}
