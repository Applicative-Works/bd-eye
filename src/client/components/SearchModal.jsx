import { useState, useEffect, useRef } from 'preact/hooks'
import { Badge } from './Badge.jsx'
import { CopyableId } from './CopyableId.jsx'
import { apiUrl } from '../projectUrl.js'

/**
 * @param {{ onClose: () => void, onSelect: (id: string) => void }} props
 */
export const SearchModal = ({ onClose, onSelect }) => {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const timer = setTimeout(async () => {
      const res = await fetch(apiUrl(`/search?q=${encodeURIComponent(query)}`))
      const { data } = await res.json()
      setResults(data)
      setSelectedIndex(0)
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  const handleKeyDown = (e) => {
    switch (e.key) {
      case 'ArrowDown':
      case 'j':
        if (e.key === 'j' && e.target.tagName === 'INPUT') break
        e.preventDefault()
        setSelectedIndex(i => Math.min(i + 1, results.length - 1))
        break
      case 'ArrowUp':
      case 'k':
        if (e.key === 'k' && e.target.tagName === 'INPUT') break
        e.preventDefault()
        setSelectedIndex(i => Math.max(i - 1, 0))
        break
      case 'Enter':
        if (results[selectedIndex]) {
          onSelect(results[selectedIndex].id)
          onClose()
        }
        break
      case 'Escape':
        onClose()
        break
    }
  }

  return (
    <div class='search-overlay' onClick={onClose} onKeyDown={handleKeyDown}>
      <div class='search-modal' onClick={e => e.stopPropagation()}>
        <input
          ref={inputRef}
          class='search-input'
          type='text'
          placeholder='Search issues...'
          value={query}
          onInput={e => setQuery(e.target.value)}
        />
        <div class='search-results'>
          {results.map((issue, i) => (
            <div
              key={issue.id}
              class={`search-result ${i === selectedIndex ? 'search-result-active' : ''}`}
              onClick={() => { onSelect(issue.id); onClose() }}
            >
              <CopyableId id={issue.id} class='font-mono text-xs text-tertiary' />
              <span class='text-sm flex-1 truncate'>{issue.title}</span>
              <Badge class={`badge-p${issue.priority}`}>P{issue.priority}</Badge>
              <Badge class={`badge-${issue.status.replace('_', '-')}`}>{issue.status}</Badge>
            </div>
          ))}
          {query && results.length === 0 && (
            <div class='search-empty'>No issues found</div>
          )}
        </div>
        <div class='search-footer'>
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  )
}
