import { useEffect, useState } from 'preact/hooks'
import { lastUpdated } from '../state.js'

const formatTime = (date) =>
  date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

export const UpdatedAt = () => {
  const [highlighted, setHighlighted] = useState(false)
  const ts = lastUpdated.value

  useEffect(() => {
    if (!ts) return
    setHighlighted(true)
    const timer = setTimeout(() => setHighlighted(false), 800)
    return () => clearTimeout(timer)
  }, [ts])

  if (!ts) return null

  return (
    <div class={`updated-at${highlighted ? ' updated-at-active' : ''}`}>
      Updated {formatTime(ts)}
    </div>
  )
}
