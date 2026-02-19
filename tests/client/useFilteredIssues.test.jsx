/** @vitest-environment jsdom */
import { describe, test, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/preact'
import { useFilteredIssues } from '../../src/client/hooks/useFilteredIssues.js'
import { filters, currentUser } from '../../src/client/state.js'

const defaultFilters = {
  priority: [],
  type: [],
  assignee: [],
  label: [],
  blockedOnly: false,
  readyOnly: false,
  assignedToMe: false
}

const issues = [
  { id: 1, priority: 'P1', issue_type: 'bug', assignee: 'Alice', labels: ['frontend'], blocked_by_count: 0 },
  { id: 2, priority: 'P2', issue_type: 'story', assignee: 'Bob', labels: ['backend', 'api'], blocked_by_count: 2 },
  { id: 3, priority: 'P3', issue_type: 'task', assignee: 'Alice', labels: ['infra'], blocked_by_count: 0 },
  { id: 4, priority: 'P1', issue_type: 'bug', assignee: 'Carol', labels: null, blocked_by_count: 1 },
]

describe('useFilteredIssues', () => {
  beforeEach(() => {
    filters.value = { ...defaultFilters }
  })

  test('returns all issues when no filters are active', () => {
    const { result } = renderHook(() => useFilteredIssues(issues))
    expect(result.current).toHaveLength(4)
  })

  test.each([
    ['priority', { priority: ['P1'] }, [1, 4]],
    ['priority multiple', { priority: ['P1', 'P2'] }, [1, 2, 4]],
    ['type', { type: ['bug'] }, [1, 4]],
    ['type multiple', { type: ['bug', 'task'] }, [1, 3, 4]],
    ['assignee', { assignee: ['Alice'] }, [1, 3]],
    ['assignee multiple', { assignee: ['Alice', 'Carol'] }, [1, 3, 4]],
    ['label', { label: ['frontend'] }, [1]],
    ['label matches any', { label: ['backend', 'infra'] }, [2, 3]],
  ])('filters by %s', (_name, filterUpdate, expectedIds) => {
    filters.value = { ...defaultFilters, ...filterUpdate }
    const { result } = renderHook(() => useFilteredIssues(issues))
    expect(result.current.map(i => i.id)).toEqual(expectedIds)
  })

  test('blockedOnly returns issues with blocked_by_count > 0', () => {
    filters.value = { ...defaultFilters, blockedOnly: true }
    const { result } = renderHook(() => useFilteredIssues(issues))
    expect(result.current.map(i => i.id)).toEqual([2, 4])
  })

  test('readyOnly returns issues with blocked_by_count === 0', () => {
    filters.value = { ...defaultFilters, readyOnly: true }
    const { result } = renderHook(() => useFilteredIssues(issues))
    expect(result.current.map(i => i.id)).toEqual([1, 3])
  })

  test('combines multiple filters', () => {
    filters.value = { ...defaultFilters, priority: ['P1'], type: ['bug'], assignee: ['Carol'] }
    const { result } = renderHook(() => useFilteredIssues(issues))
    expect(result.current.map(i => i.id)).toEqual([4])
  })

  test('handles issues with null labels', () => {
    filters.value = { ...defaultFilters, label: ['frontend'] }
    const { result } = renderHook(() => useFilteredIssues(issues))
    expect(result.current.map(i => i.id)).toEqual([1])
  })

  test('returns empty array when no issues match', () => {
    filters.value = { ...defaultFilters, priority: ['P4'] }
    const { result } = renderHook(() => useFilteredIssues(issues))
    expect(result.current).toEqual([])
  })

  test('assignedToMe filters to currentUser issues', () => {
    currentUser.value = 'Alice'
    filters.value = { ...defaultFilters, assignedToMe: true }
    const { result } = renderHook(() => useFilteredIssues(issues))
    expect(result.current.map(i => i.id)).toEqual([1, 3])
  })

  test('assignedToMe has no effect when currentUser is null', () => {
    currentUser.value = null
    filters.value = { ...defaultFilters, assignedToMe: true }
    const { result } = renderHook(() => useFilteredIssues(issues))
    expect(result.current).toHaveLength(4)
  })

  test('assignedToMe combines with other filters', () => {
    currentUser.value = 'Alice'
    filters.value = { ...defaultFilters, assignedToMe: true, priority: ['P1'] }
    const { result } = renderHook(() => useFilteredIssues(issues))
    expect(result.current.map(i => i.id)).toEqual([1])
  })
})
