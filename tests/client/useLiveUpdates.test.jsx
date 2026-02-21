/** @vitest-environment jsdom */
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/preact'

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

afterEach(() => {
  vi.resetModules()
})

const loadModule = async () => {
  const mod = await import('../../src/client/hooks/useLiveUpdates.js')
  return mod.useLiveUpdates
}

describe('useLiveUpdates', () => {
  test('creates a single EventSource for multiple hooks', async () => {
    const useLiveUpdates = await loadModule()
    renderHook(() => {
      useLiveUpdates(vi.fn())
      useLiveUpdates(vi.fn())
    })
    expect(instances).toHaveLength(1)
    expect(instances[0].url).toBe('/api/events')
  })

  test('calls onRefresh when a message is received', async () => {
    const useLiveUpdates = await loadModule()
    const onRefresh = vi.fn()
    renderHook(() => useLiveUpdates(onRefresh))
    instances[0].onmessage({ data: 'update' })
    expect(onRefresh).toHaveBeenCalledOnce()
  })

  test('broadcasts to all subscribers', async () => {
    const useLiveUpdates = await loadModule()
    const fn1 = vi.fn()
    const fn2 = vi.fn()
    renderHook(() => {
      useLiveUpdates(fn1)
      useLiveUpdates(fn2)
    })
    instances[0].onmessage({ data: 'update' })
    expect(fn1).toHaveBeenCalledOnce()
    expect(fn2).toHaveBeenCalledOnce()
  })

  test('closes EventSource when all subscribers unmount', async () => {
    const useLiveUpdates = await loadModule()
    const { unmount } = renderHook(() => useLiveUpdates(vi.fn()))
    const source = instances[0]
    unmount()
    expect(source.close).toHaveBeenCalledOnce()
  })
})
