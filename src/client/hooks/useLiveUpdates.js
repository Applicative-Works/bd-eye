import { useEffect } from 'preact/hooks'
import { subscribe } from '../sseClient.js'

export const useLiveUpdates = (/** @type {() => void} */ onRefresh) => {
  useEffect(() => subscribe(onRefresh), [onRefresh])
}
