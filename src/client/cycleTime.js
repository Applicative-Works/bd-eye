const HOUR = 3600000
const DAY = 86400000
const WEEK = 7 * DAY

export const formatDuration = (ms) => {
  if (ms < HOUR) return '< 1h'
  if (ms < DAY) return `${Math.floor(ms / HOUR)}h`
  if (ms < 2 * WEEK) return `${Math.floor(ms / DAY)}d`
  return `${Math.floor(ms / WEEK)}w`
}

export const issueAgeMs = (issue) => {
  if (!issue.created_at) return 0
  const created = new Date(issue.created_at).getTime()
  if (issue.status === 'closed' && issue.closed_at) {
    return new Date(issue.closed_at).getTime() - created
  }
  return Date.now() - created
}

export const computeThresholds = (closedIssues) => {
  const cycleTimes = closedIssues
    .filter(i => i.closed_at && i.created_at)
    .map(i => new Date(i.closed_at).getTime() - new Date(i.created_at).getTime())
    .filter(ms => ms > 0)
    .sort((a, b) => a - b)
    .slice(-30)

  if (cycleTimes.length < 3) return null

  const median = cycleTimes[Math.floor(cycleTimes.length / 2)]
  const p75 = cycleTimes[Math.floor(cycleTimes.length * 0.75)]
  return { median, p75 }
}

export const durationTier = (ms, thresholds) => {
  if (!thresholds) return 'normal'
  if (ms > thresholds.p75) return 'danger'
  if (ms > thresholds.median) return 'warning'
  return 'normal'
}
