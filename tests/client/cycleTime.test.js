import { describe, test, expect, vi, afterEach, beforeEach } from 'vitest'
import { formatDuration, issueAgeMs, computeThresholds, durationTier } from '../../src/client/cycleTime.js'

const HOUR = 3600000
const DAY = 86400000
const WEEK = 7 * DAY

describe('formatDuration', () => {
  test.each([
    [0, '< 1h'],
    [30 * 60000, '< 1h'],
    [HOUR, '1h'],
    [6 * HOUR, '6h'],
    [23 * HOUR, '23h'],
    [DAY, '1d'],
    [3 * DAY, '3d'],
    [13 * DAY, '13d'],
    [14 * DAY, '2w'],
    [6 * WEEK, '6w'],
  ])('formats %d ms as "%s"', (ms, expected) => {
    expect(formatDuration(ms)).toBe(expected)
  })
})

describe('issueAgeMs', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  test('returns 0 when no created_at', () => {
    expect(issueAgeMs({})).toBe(0)
  })

  test('returns now - created_at for open issues', () => {
    vi.setSystemTime(new Date('2026-02-10T12:00:00Z'))
    const issue = { status: 'open', created_at: '2026-02-07T12:00:00Z' }
    expect(issueAgeMs(issue)).toBe(3 * DAY)
  })

  test('returns closed_at - created_at for closed issues', () => {
    const issue = {
      status: 'closed',
      created_at: '2026-02-01T00:00:00Z',
      closed_at: '2026-02-06T00:00:00Z',
    }
    expect(issueAgeMs(issue)).toBe(5 * DAY)
  })

  test('falls back to age for closed without closed_at', () => {
    vi.setSystemTime(new Date('2026-02-10T00:00:00Z'))
    const issue = { status: 'closed', created_at: '2026-02-05T00:00:00Z' }
    expect(issueAgeMs(issue)).toBe(5 * DAY)
  })
})

describe('computeThresholds', () => {
  const makeIssues = (cycleDays) =>
    cycleDays.map((d, i) => ({
      created_at: '2026-01-01T00:00:00Z',
      closed_at: new Date(new Date('2026-01-01T00:00:00Z').getTime() + d * DAY).toISOString(),
    }))

  test('returns null with fewer than 3 closed issues', () => {
    expect(computeThresholds(makeIssues([1, 2]))).toBeNull()
  })

  test('computes median and p75', () => {
    const issues = makeIssues([1, 2, 3, 4, 5, 6, 7, 8])
    const result = computeThresholds(issues)
    expect(result).not.toBeNull()
    expect(result.median).toBe(5 * DAY)
    expect(result.p75).toBe(7 * DAY)
  })

  test('uses last 30 issues', () => {
    const days = Array.from({ length: 40 }, (_, i) => i + 1)
    const result = computeThresholds(makeIssues(days))
    expect(result).not.toBeNull()
    expect(result.median).toBe(26 * DAY)
  })
})

describe('durationTier', () => {
  const thresholds = { median: 3 * DAY, p75: 7 * DAY }

  test('returns normal when no thresholds', () => {
    expect(durationTier(10 * DAY, null)).toBe('normal')
  })

  test('returns normal below median', () => {
    expect(durationTier(2 * DAY, thresholds)).toBe('normal')
  })

  test('returns warning above median', () => {
    expect(durationTier(5 * DAY, thresholds)).toBe('warning')
  })

  test('returns danger above p75', () => {
    expect(durationTier(10 * DAY, thresholds)).toBe('danger')
  })
})
