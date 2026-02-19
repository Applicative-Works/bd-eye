import { filters, currentUser } from '../state.js'

export const useFilteredIssues = (issues) => {
  const f = filters.value
  const me = currentUser.value
  return issues.filter(issue => {
    if (f.priority.length && !f.priority.includes(issue.priority)) return false
    if (f.type.length && !f.type.includes(issue.issue_type)) return false
    if (f.assignee.length && !f.assignee.includes(issue.assignee)) return false
    if (f.label.length && !issue.labels?.some(l => f.label.includes(l))) return false
    if (f.blockedOnly && !(issue.blocked_by_count > 0)) return false
    if (f.readyOnly && issue.blocked_by_count > 0) return false
    if (f.assignedToMe && me && issue.assignee !== me) return false
    return true
  })
}
