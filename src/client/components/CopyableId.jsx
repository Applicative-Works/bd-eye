import { useState, useCallback } from 'preact/hooks'

export const CopyableId = ({ id, class: className = '' }) => {
  const [copied, setCopied] = useState(false)

  const handleClick = useCallback((e) => {
    e.stopPropagation()
    navigator.clipboard.writeText(id).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    })
  }, [id])

  return (
    <span
      class={`copyable-id ${className}`.trim()}
      onClick={handleClick}
      title="Click to copy"
    >
      {copied ? 'Copied!' : id}
    </span>
  )
}
