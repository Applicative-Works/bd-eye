import { Hono } from 'hono'

/** @param {{ listProjects: () => Promise<{ name: string, issueCount: number }[]> }} registry */
export const projectRoutes = (registry) => {
  const router = new Hono()

  router.get('/projects', async (c) => {
    const data = await registry.listProjects()
    return c.json({ data })
  })

  return router
}
