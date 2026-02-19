/** @vitest-environment jsdom */
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/preact'

vi.mock('../../src/client/hooks/useLiveUpdates.js', () => ({
  useLiveUpdates: vi.fn()
}))

import { useIssues } from '../../src/client/hooks/useIssues.js'
import { useLiveUpdates } from '../../src/client/hooks/useLiveUpdates.js'

const mockData = [
  { id: 1, title: 'Issue one' },
  { id: 2, title: 'Issue two' },
]

beforeEach(() => {
  vi.restoreAllMocks()
  globalThis.fetch = vi.fn(() =>
    Promise.resolve({
      json: () => Promise.resolve({ data: mockData })
    })
  )
})

describe('useIssues', () => {
  test('starts with loading true and empty issues', () => {
    const { result } = renderHook(() => useIssues())
    expect(result.current.loading).toBe(true)
    expect(result.current.issues).toEqual([])
  })

  test('fetches from default endpoint and populates issues', async () => {
    const { result } = renderHook(() => useIssues())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.issues).toEqual(mockData)
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/issues')
  })

  test('fetches from custom endpoint', async () => {
    const { result } = renderHook(() => useIssues('/api/other'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/other')
  })

  test('registers refetch callback with useLiveUpdates', () => {
    renderHook(() => useIssues())
    expect(useLiveUpdates).toHaveBeenCalledWith(expect.any(Function))
  })

  test('refetch reloads data', async () => {
    const { result } = renderHook(() => useIssues())
    await waitFor(() => expect(result.current.loading).toBe(false))

    const updated = [{ id: 3, title: 'New issue' }]
    globalThis.fetch = vi.fn(() =>
      Promise.resolve({ json: () => Promise.resolve({ data: updated }) })
    )

    await result.current.refetch()
    await waitFor(() => expect(result.current.issues).toEqual(updated))
  })
})
