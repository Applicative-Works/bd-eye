/** @vitest-environment jsdom */
import { describe, test, expect, beforeEach } from 'vitest'
import { currentView, selectedIssueId, filters, columnMode, closedDays } from '../../src/client/state.js'

describe('state signals', () => {
  test.each([
    ['currentView', () => currentView.value, 'board'],
    ['selectedIssueId', () => selectedIssueId.value, null],
    ['columnMode', () => columnMode.value, 'status'],
    ['closedDays', () => closedDays.value, null],
  ])('%s has default value %j', (_name, getter, expected) => {
    expect(getter()).toEqual(expected)
  })

  test('filters has correct default shape', () => {
    expect(filters.value).toEqual({
      priority: [],
      type: [],
      assignee: [],
      label: [],
      blockedOnly: false,
      readyOnly: false
    })
  })

  test.each([
    ['currentView', currentView, 'deps'],
    ['selectedIssueId', selectedIssueId, 'ISSUE-42'],
    ['columnMode', columnMode, 'priority'],
    ['closedDays', closedDays, 7],
  ])('%s is reactive when set to %j', (_name, sig, newVal) => {
    const original = sig.value
    sig.value = newVal
    expect(sig.value).toEqual(newVal)
    sig.value = original
  })

  test('filters signal is reactive', () => {
    const original = filters.value
    const updated = { ...original, priority: ['P1'], blockedOnly: true }
    filters.value = updated
    expect(filters.value.priority).toEqual(['P1'])
    expect(filters.value.blockedOnly).toBe(true)
    filters.value = original
  })
})
