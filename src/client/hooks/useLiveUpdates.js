import { useEffect } from 'preact/hooks'
import { lastUpdated } from '../state.js'

/**
 * @param {() => void} onRefresh - called when the server signals a DB change
 */
export const useLiveUpdates = (onRefresh) => {
  useEffect(() => {
    const source = new EventSource('/api/events')
    source.onmessage = () => {
      onRefresh()
      lastUpdated.value = new Date()
    }
    return () => source.close()
  }, [onRefresh])
}
