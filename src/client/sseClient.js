import { lastUpdated } from './state.js'

/** @type {EventSource | null} */
let source = null
/** @type {Set<() => void>} */
const listeners = new Set()

const open = () => {
  source = new EventSource('/api/events')
  source.onmessage = () => {
    lastUpdated.value = new Date()
    for (const fn of listeners) fn()
  }
}

export const subscribe = (/** @type {() => void} */ fn) => {
  listeners.add(fn)
  if (!source) open()
  return () => {
    listeners.delete(fn)
    if (listeners.size === 0 && source) {
      source.close()
      source = null
    }
  }
}
