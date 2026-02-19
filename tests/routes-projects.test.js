import { describe, it, expect, vi } from 'vitest'
import { Hono } from 'hono'
import { projectRoutes } from '../src/server/routes/projects.js'

const mockRegistry = {
  listProjects: vi.fn()
}

const app = new Hono()
app.route('/api', projectRoutes(mockRegistry))

const get = async (path) => {
  const res = await app.request(`/api${path}`)
  return { status: res.status, body: await res.json() }
}

describe('GET /projects', () => {
  it('returns project list from registry', async () => {
    mockRegistry.listProjects.mockResolvedValueOnce([
      { name: 'project-a', issueCount: 42 },
      { name: 'project-b', issueCount: 7 }
    ])

    const { status, body } = await get('/projects')

    expect(status).toBe(200)
    expect(body.data).toEqual([
      { name: 'project-a', issueCount: 42 },
      { name: 'project-b', issueCount: 7 }
    ])
  })

  it('returns empty array when no projects exist', async () => {
    mockRegistry.listProjects.mockResolvedValueOnce([])

    const { body } = await get('/projects')

    expect(body.data).toEqual([])
  })
})
