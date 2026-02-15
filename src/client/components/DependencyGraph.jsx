import { useState, useEffect } from 'preact/hooks'
import { selectedIssueId } from '../state.js'
import { selectIssue } from '../router.js'

/**
 * @typedef {Object} Issue
 * @property {string} id
 * @property {string} title
 * @property {string} status
 * @property {number} [priority]
 */

/**
 * @typedef {Object} DependencyData
 * @property {Issue[]} blockedBy
 * @property {Issue[]} blocks
 */

const statusClasses = {
  open: 'dep-node-status-open',
  in_progress: 'dep-node-status-in_progress',
  closed: 'dep-node-status-closed'
}

const getNodeBorderColor = (issue, hasBlockers) => {
  if (issue.status === 'closed') return 'var(--color-closed-border)'
  if (hasBlockers) return 'var(--color-blocked-border)'
  if (issue.status === 'in_progress') return 'var(--color-in-progress-border)'
  return hasBlockers ? 'var(--color-blocked-border)' : 'var(--color-ready-border)'
}

const DependencyNode = ({ issue, isSelected, hasBlockers }) => (
  <div
    class={`dep-node ${statusClasses[issue.status]} ${isSelected ? 'dep-node-selected' : ''}`}
    onClick={() => selectIssue(issue.id)}
    style={{ borderColor: getNodeBorderColor(issue, hasBlockers) }}
  >
    <div class="dep-node-header">
      <span class="dep-node-id font-mono">{issue.id}</span>
      {isSelected && <span class="dep-node-label">SELECTED</span>}
    </div>
    <div class="dep-node-title">{issue.title}</div>
  </div>
)

const FocusView = ({ issueId }) => {
  const [deps, setDeps] = useState(/** @type {DependencyData|null} */ (null))
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!issueId) {
      setDeps(null)
      return
    }

    setLoading(true)
    fetch(`/api/issues/${issueId}/dependencies`)
      .then(res => res.json())
      .then(({ data }) => setDeps(data))
      .catch(() => setDeps({ blockedBy: [], blocks: [] }))
      .finally(() => setLoading(false))
  }, [issueId])

  const [selectedIssue, setSelectedIssue] = useState(/** @type {Issue|null} */ (null))

  useEffect(() => {
    if (!issueId) {
      setSelectedIssue(null)
      return
    }

    fetch(`/api/issues/${issueId}`)
      .then(res => res.json())
      .then(({ data }) => setSelectedIssue(data))
      .catch(() => setSelectedIssue(null))
  }, [issueId])

  if (!issueId) {
    return (
      <div class="dep-focus-empty">
        Select an issue from the search to view its dependencies
      </div>
    )
  }

  if (loading) {
    return <div class="dep-focus-empty">Loading dependencies...</div>
  }

  if (!deps || !selectedIssue) return null

  return (
    <div class="dep-focus">
      {deps.blockedBy.length > 0 && (
        <div class="dep-section">
          <div class="dep-section-label">Blocked by</div>
          <div class="dep-chain">
            {deps.blockedBy.map(issue => (
              <div key={issue.id}>
                <DependencyNode issue={issue} isSelected={false} hasBlockers={false} />
                <div class="dep-arrow">↓</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <DependencyNode issue={selectedIssue} isSelected={true} hasBlockers={deps.blockedBy.length > 0} />

      {deps.blocks.length > 0 && (
        <div class="dep-section">
          <div class="dep-section-label">Blocks</div>
          <div class="dep-chain">
            {deps.blocks.map(issue => (
              <div key={issue.id}>
                <div class="dep-arrow">↓</div>
                <DependencyNode issue={issue} isSelected={false} hasBlockers={false} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const FullGraphView = () => {
  const [issues, setIssues] = useState(/** @type {Issue[]} */ ([]))
  const [blockedIssues, setBlockedIssues] = useState(/** @type {Set<string>} */ (new Set()))
  const [dependencies, setDependencies] = useState(/** @type {Map<string, string[]>} */ (new Map()))
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)

    Promise.all([
      fetch('/api/issues').then(r => r.json()),
      fetch('/api/issues/blocked').then(r => r.json())
    ])
      .then(([issuesRes, blockedRes]) => {
        const allIssues = issuesRes.data || []
        const blocked = new Set((blockedRes.data || []).map(i => i.id))

        setIssues(allIssues)
        setBlockedIssues(blocked)

        const depPromises = Array.from(blocked).map(id =>
          fetch(`/api/issues/${id}/dependencies`)
            .then(r => r.json())
            .then(({ data }) => ({
              id,
              blockers: (data.blockedBy || []).map(b => b.id)
            }))
        )

        return Promise.all(depPromises)
      })
      .then(depData => {
        const depMap = new Map()
        depData.forEach(({ id, blockers }) => {
          depMap.set(id, blockers)
        })
        setDependencies(depMap)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div class="dep-svg-empty">Loading full graph...</div>
  }

  const nodes = issues
  const layers = computeLayers(nodes, dependencies)

  const nodeWidth = 180
  const nodeHeight = 60
  const layerHeight = 120
  const horizontalGap = 40

  const layerWidths = layers.map(layer =>
    Math.max(layer.length * nodeWidth + (layer.length - 1) * horizontalGap, nodeWidth)
  )
  const maxWidth = Math.max(...layerWidths, 800)
  const svgHeight = layers.length * layerHeight + 100

  const nodePositions = new Map()
  layers.forEach((layer, layerIndex) => {
    const y = layerIndex * layerHeight + 50
    const layerWidth = layer.length * nodeWidth + (layer.length - 1) * horizontalGap
    const startX = (maxWidth - layerWidth) / 2

    layer.forEach((nodeId, index) => {
      const x = startX + index * (nodeWidth + horizontalGap)
      nodePositions.set(nodeId, { x, y })
    })
  })

  const edges = []
  dependencies.forEach((blockers, targetId) => {
    blockers.forEach(blockerId => {
      const source = nodePositions.get(blockerId)
      const target = nodePositions.get(targetId)
      if (source && target) {
        edges.push({
          x1: source.x + nodeWidth / 2,
          y1: source.y + nodeHeight,
          x2: target.x + nodeWidth / 2,
          y2: target.y
        })
      }
    })
  })

  return (
    <svg class="dep-svg" width={maxWidth} height={svgHeight}>
      {edges.map((edge, i) => (
        <line
          key={i}
          class="dep-svg-edge"
          x1={edge.x1}
          y1={edge.y1}
          x2={edge.x2}
          y2={edge.y2}
          stroke="var(--color-border)"
          stroke-width="2"
          marker-end="url(#arrowhead)"
        />
      ))}

      <defs>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="3"
          orient="auto"
        >
          <polygon points="0 0, 10 3, 0 6" fill="var(--color-border)" />
        </marker>
      </defs>

      {nodes.map(issue => {
        const pos = nodePositions.get(issue.id)
        if (!pos) return null

        const hasBlockers = blockedIssues.has(issue.id)
        const borderColor = getNodeBorderColor(issue, hasBlockers)

        return (
          <g key={issue.id} onClick={() => selectIssue(issue.id)} style="cursor: pointer">
            <rect
              class="dep-svg-node"
              x={pos.x}
              y={pos.y}
              width={nodeWidth}
              height={nodeHeight}
              fill="var(--color-bg-secondary)"
              stroke={borderColor}
              stroke-width="2"
              rx="6"
            />
            <text
              x={pos.x + 8}
              y={pos.y + 20}
              font-family="var(--font-mono)"
              font-size="12"
              fill="var(--color-text-primary)"
            >
              {issue.id}
            </text>
            <text
              x={pos.x + 8}
              y={pos.y + 40}
              font-family="var(--font-sans)"
              font-size="11"
              fill="var(--color-text-secondary)"
            >
              {truncate(issue.title, 24)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

const computeLayers = (nodes, dependencies) => {
  const nodeMap = new Map(nodes.map(n => [n.id, n]))
  const visited = new Set()
  const layers = []

  const getLayer = (nodeId, memo = new Map()) => {
    if (memo.has(nodeId)) return memo.get(nodeId)
    const blockers = dependencies.get(nodeId) || []
    const validBlockers = blockers.filter(b => nodeMap.has(b))

    if (validBlockers.length === 0) {
      memo.set(nodeId, 0)
      return 0
    }

    const maxBlockerLayer = Math.max(...validBlockers.map(b => getLayer(b, memo)))
    const layer = maxBlockerLayer + 1
    memo.set(nodeId, layer)
    return layer
  }

  const layerMemo = new Map()
  nodes.forEach(node => {
    const layer = getLayer(node.id, layerMemo)
    if (!layers[layer]) layers[layer] = []
    layers[layer].push(node.id)
  })

  return layers.filter(l => l.length > 0)
}

const truncate = (str, len) =>
  str.length > len ? str.slice(0, len - 1) + '…' : str

export const DependencyGraph = () => {
  const [mode, setMode] = useState('focus')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(/** @type {Issue[]} */ ([]))

  const handleSearch = (q) => {
    setSearchQuery(q)
    if (!q.trim()) {
      setSearchResults([])
      return
    }

    fetch(`/api/search?q=${encodeURIComponent(q)}`)
      .then(r => r.json())
      .then(({ data }) => setSearchResults(data || []))
      .catch(() => setSearchResults([]))
  }

  const selectFromSearch = (id) => {
    selectIssue(id)
    setSearchQuery('')
    setSearchResults([])
  }

  useEffect(() => {
    if (selectedIssueId.value) {
      fetch(`/api/issues/${selectedIssueId.value}`)
        .then(r => r.json())
        .then(({ data }) => {
          if (data) {
            setSearchQuery(data.id)
          }
        })
    }
  }, [])

  return (
    <div class="dep-graph">
      <div class="dep-graph-controls">
        <div class="dep-search-container">
          <input
            type="text"
            class="dep-graph-search"
            placeholder="Search for an issue..."
            value={searchQuery}
            onInput={(e) => handleSearch(e.target.value)}
          />
          {searchResults.length > 0 && (
            <div class="dep-search-results">
              {searchResults.map(issue => (
                <div
                  key={issue.id}
                  class="dep-search-result"
                  onClick={() => selectFromSearch(issue.id)}
                >
                  <span class="font-mono text-sm">{issue.id}</span>
                  <span class="text-sm truncate">{issue.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <button
          class="dep-mode-toggle"
          onClick={() => setMode(mode === 'focus' ? 'full' : 'focus')}
        >
          {mode === 'focus' ? 'Show Full Graph' : 'Show Focus View'}
        </button>
      </div>

      {mode === 'focus' ? (
        <FocusView issueId={selectedIssueId.value} />
      ) : (
        <div class="dep-svg-container">
          <FullGraphView />
        </div>
      )}
    </div>
  )
}
