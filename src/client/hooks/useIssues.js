import { useState, useEffect, useCallback, useRef } from 'preact/hooks'
import { changedIds } from '../state.js'
import { apiUrl } from '../projectUrl.js'
import { useLiveUpdates } from './useLiveUpdates.js'

export const useIssues = (path = '/issues') => {
  const [issues, setIssues] = useState([])
  const [loading, setLoading] = useState(true)
  const snapshotRef = useRef(/** @type {Map<string, string>} */ (new Map()))

  const endpoint = apiUrl(path)

  const fetch_ = useCallback(async () => {
    const res = await fetch(endpoint)
    const { data } = await res.json()
    const prev = snapshotRef.current
    if (prev.size > 0) {
      const changed = new Set(
        data.filter(i => { const old = prev.get(i.id); return old && old !== i.updated_at })
            .map(i => i.id)
      )
      if (changed.size > 0) changedIds.value = changed
    }
    snapshotRef.current = new Map(data.map(i => [i.id, i.updated_at ?? '']))
    setIssues(data)
    setLoading(false)
  }, [endpoint])

  useEffect(() => { fetch_() }, [fetch_])
  useLiveUpdates(fetch_)

  return { issues, loading, refetch: fetch_ }
}
