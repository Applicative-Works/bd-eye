import { useEffect } from 'preact/hooks'

/**
 * @param {() => void} onRefresh - called when the server signals a DB change
 */
export const useLiveUpdates = (onRefresh) => {
  useEffect(() => {
    const source = new EventSource('/api/events')
    source.onmessage = () => onRefresh()
    return () => source.close()
  }, [onRefresh])
}
