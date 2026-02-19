/** @vitest-environment jsdom */
import { describe, test, expect, beforeEach } from 'vitest'
import { initRouter, navigate, selectIssue, clearSelection } from '../../src/client/router.js'
import { currentView, selectedIssueId } from '../../src/client/state.js'

const dispatchHashChange = () =>
  window.dispatchEvent(new HashChangeEvent('hashchange'))

describe('initRouter', () => {
  beforeEach(() => {
    window.location.hash = ''
    currentView.value = 'board'
    selectedIssueId.value = null
    initRouter()
  })

  test.each([
    ['', 'board'],
    ['#/board', 'board'],
    ['#/ready', 'ready'],
    ['#/epics', 'epics'],
    ['#/deps', 'deps'],
  ])('maps hash "%s" to view "%s"', (hash, expected) => {
    window.location.hash = hash
    dispatchHashChange()
    expect(currentView.value).toBe(expected)
  })

  test('defaults unknown hash to board', () => {
    window.location.hash = '#/unknown'
    dispatchHashChange()
    expect(currentView.value).toBe('board')
  })

  test('extracts issue param from hash query string', () => {
    window.location.hash = '#/board?issue=PROJ-123'
    dispatchHashChange()
    expect(selectedIssueId.value).toBe('PROJ-123')
  })

  test('sets selectedIssueId to null when no issue param', () => {
    window.location.hash = '#/board'
    dispatchHashChange()
    expect(selectedIssueId.value).toBeNull()
  })

  test('parses route on init without requiring hashchange', () => {
    window.location.hash = '#/epics'
    initRouter()
    expect(currentView.value).toBe('epics')
  })
})

describe('navigate', () => {
  test.each([
    ['board', '#/board'],
    ['ready', '#/ready'],
    ['deps', '#/deps'],
    ['epics', '#/epics'],
  ])('navigate("%s") sets hash to "%s"', (view, expectedHash) => {
    navigate(view)
    expect(window.location.hash).toBe(expectedHash)
  })
})

describe('selectIssue', () => {
  beforeEach(() => {
    window.location.hash = '#/board'
  })

  test('appends issue param to current hash', () => {
    selectIssue('PROJ-99')
    expect(window.location.hash).toBe('#/board?issue=PROJ-99')
  })

  test('clears issue param when id is null', () => {
    selectIssue('PROJ-99')
    selectIssue(null)
    expect(window.location.hash).toBe('#/board')
  })
})

describe('clearSelection', () => {
  test('removes query string from hash', () => {
    window.location.hash = '#/deps?issue=PROJ-5'
    clearSelection()
    expect(window.location.hash).toBe('#/deps')
  })

  test('leaves hash unchanged when no query string', () => {
    window.location.hash = '#/ready'
    clearSelection()
    expect(window.location.hash).toBe('#/ready')
  })
})
