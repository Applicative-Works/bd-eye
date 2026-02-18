import { useEffect } from 'preact/hooks'
import { apiBase } from '../state.js'

/**
 * @param {() => void} onRefresh - called when the server signals a DB change
 */
export const useLiveUpdates = (onRefresh) => {
  useEffect(() => {
    const base = apiBase.value
    if (!base || base.endsWith('/_')) return

    const source = new EventSource(`${base}/events`)
    source.onmessage = () => onRefresh()
    return () => source.close()
  }, [onRefresh, apiBase.value])
}
