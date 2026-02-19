import { useState, useEffect, useCallback } from 'preact/hooks'
import { lastUpdated } from '../state.js'
import { useLiveUpdates } from './useLiveUpdates.js'

export const useIssues = (endpoint = '/api/issues') => {
  const [issues, setIssues] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch_ = useCallback(async () => {
    const res = await fetch(endpoint)
    const { data } = await res.json()
    setIssues(data)
    setLoading(false)
    lastUpdated.value = new Date()
  }, [endpoint])

  useEffect(() => { fetch_() }, [fetch_])
  useLiveUpdates(fetch_)

  return { issues, loading, refetch: fetch_ }
}
