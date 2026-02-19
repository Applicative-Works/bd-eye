import { currentProject } from './state.js'

export const apiUrl = (path) => `/api/projects/${currentProject.value}${path}`
