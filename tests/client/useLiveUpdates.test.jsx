/** @vitest-environment jsdom */
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/preact'
import { useLiveUpdates } from '../../src/client/hooks/useLiveUpdates.js'

let instances = []

class MockEventSource {
  constructor(url) {
    this.url = url
    this.onmessage = null
    this.close = vi.fn()
    instances.push(this)
  }
}

beforeEach(() => {
  instances = []
  globalThis.EventSource = MockEventSource
})

describe('useLiveUpdates', () => {
  test('creates EventSource connected to /api/events', () => {
    renderHook(() => useLiveUpdates(vi.fn()))
    expect(instances).toHaveLength(1)
    expect(instances[0].url).toBe('/api/events')
  })

  test('calls onRefresh when a message is received', () => {
    const onRefresh = vi.fn()
    renderHook(() => useLiveUpdates(onRefresh))
    instances[0].onmessage({ data: 'update' })
    expect(onRefresh).toHaveBeenCalledOnce()
  })

  test('calls onRefresh multiple times for multiple messages', () => {
    const onRefresh = vi.fn()
    renderHook(() => useLiveUpdates(onRefresh))
    instances[0].onmessage({ data: '1' })
    instances[0].onmessage({ data: '2' })
    instances[0].onmessage({ data: '3' })
    expect(onRefresh).toHaveBeenCalledTimes(3)
  })

  test('closes EventSource on unmount', () => {
    const { unmount } = renderHook(() => useLiveUpdates(vi.fn()))
    const source = instances[0]
    unmount()
    expect(source.close).toHaveBeenCalledOnce()
  })
})
