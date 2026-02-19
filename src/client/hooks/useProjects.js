import { useEffect } from 'preact/hooks'
import { currentProject, projectList, projectsLoading } from '../state.js'

export const useProjects = () => {
  useEffect(() => {
    fetch('/api/projects')
      .then(res => res.json())
      .then(({ data }) => {
        projectList.value = data
        const saved = currentProject.value
        const match = data.find(p => p.name === saved)
        const sorted = [...data].sort((a, b) => a.name.localeCompare(b.name))
        currentProject.value = match ? saved : (sorted[0]?.name || null)
      })
      .catch(() => {
        projectList.value = []
        currentProject.value = null
      })
      .finally(() => {
        projectsLoading.value = false
      })
  }, [])

  return { projects: projectList.value, loading: projectsLoading.value }
}
