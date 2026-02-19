import { useState, useEffect, useRef, useMemo, useReducer } from 'preact/hooks'
import dagre from 'dagre'
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

const NODE_W = 180
const NODE_H = 60

const truncate = (str, len) =>
  str.length > len ? str.slice(0, len - 1) + '…' : str

const edgePath = (points) => {
  if (points.length < 2) return ''
  const [first, ...rest] = points
  let d = `M${first.x},${first.y}`
  if (rest.length === 1) {
    d += `L${rest[0].x},${rest[0].y}`
  } else {
    for (let i = 0; i < rest.length - 1; i++) {
      const curr = rest[i]
      const next = rest[i + 1]
      const cx = (curr.x + next.x) / 2
      const cy = (curr.y + next.y) / 2
      d += `Q${curr.x},${curr.y} ${cx},${cy}`
    }
    const last = rest[rest.length - 1]
    d += `L${last.x},${last.y}`
  }
  return d
}

const useGraphLayout = (issues, blockedSet, dependencies) =>
  useMemo(() => {
    if (issues.length === 0) return { nodes: [], edges: [], width: 0, height: 0 }

    const g = new dagre.graphlib.Graph()
    g.setGraph({ rankdir: 'TB', nodesep: 40, ranksep: 80, marginx: 40, marginy: 40 })
    g.setDefaultEdgeLabel(() => ({}))

    issues.forEach(issue => g.setNode(issue.id, { width: NODE_W, height: NODE_H, issue }))

    dependencies.forEach((blockers, targetId) => {
      blockers.forEach(blockerId => {
        if (g.hasNode(blockerId) && g.hasNode(targetId)) {
          g.setEdge(blockerId, targetId)
        }
      })
    })

    dagre.layout(g)

    const nodes = g.nodes().map(id => {
      const n = g.node(id)
      return { id, x: n.x - NODE_W / 2, y: n.y - NODE_H / 2, issue: n.issue, hasBlockers: blockedSet.has(id) }
    })

    const edges = g.edges().map(e => ({
      source: e.v,
      target: e.w,
      points: g.edge(e).points,
    }))

    const graphMeta = g.graph()
    return { nodes, edges, width: graphMeta.width || 800, height: graphMeta.height || 400 }
  }, [issues, blockedSet, dependencies])

const transformReducer = (state, action) => {
  switch (action.type) {
    case 'pan':
      return { ...state, x: state.x + action.dx, y: state.y + action.dy }
    case 'zoom': {
      const newK = Math.max(0.3, Math.min(3, state.k * action.factor))
      const ratio = newK / state.k
      return {
        k: newK,
        x: action.cx - ratio * (action.cx - state.x),
        y: action.cy - ratio * (action.cy - state.y),
      }
    }
    case 'fit':
      return action.transform
    default:
      return state
  }
}

const FullGraphView = () => {
  const [issues, setIssues] = useState([])
  const [blockedSet, setBlockedSet] = useState(new Set())
  const [dependencies, setDependencies] = useState(new Map())
  const [loading, setLoading] = useState(false)
  const [hoveredNode, setHoveredNode] = useState(null)
  const [tooltip, setTooltip] = useState(null)

  const svgRef = useRef(null)
  const containerRef = useRef(null)
  const panRef = useRef(null)

  const [transform, dispatch] = useReducer(transformReducer, { x: 0, y: 0, k: 1 })

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch('/api/issues').then(r => r.json()),
      fetch('/api/issues/blocked').then(r => r.json()),
    ])
      .then(([issuesRes, blockedRes]) => {
        const allIssues = issuesRes.data || []
        const blocked = new Set((blockedRes.data || []).map(i => i.id))
        setIssues(allIssues)
        setBlockedSet(blocked)

        return Promise.all(
          Array.from(blocked).map(id =>
            fetch(`/api/issues/${id}/dependencies`)
              .then(r => r.json())
              .then(({ data }) => ({ id, blockers: (data.blockedBy || []).map(b => b.id) }))
          )
        )
      })
      .then(depData => {
        const depMap = new Map()
        depData.forEach(({ id, blockers }) => depMap.set(id, blockers))
        setDependencies(depMap)
      })
      .finally(() => setLoading(false))
  }, [])

  const { nodes, edges, width, height } = useGraphLayout(issues, blockedSet, dependencies)

  const fitToView = () => {
    const container = containerRef.current
    if (!container || width === 0) return
    const cw = container.clientWidth
    const ch = container.clientHeight
    const k = Math.min(cw / width, ch / height, 1) * 0.9
    dispatch({ type: 'fit', transform: { x: (cw - width * k) / 2, y: (ch - height * k) / 2, k } })
  }

  useEffect(() => {
    if (nodes.length > 0) fitToView()
  }, [nodes.length])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (e) => {
      e.preventDefault()
      const rect = svg.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      const factor = e.deltaY < 0 ? 1.1 : 0.9
      dispatch({ type: 'zoom', factor, cx, cy })
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [])

  const onPointerDown = (e) => {
    if (e.button !== 0) return
    if (e.target.closest('.dep-graph-node')) return
    e.preventDefault()
    panRef.current = { x: e.clientX, y: e.clientY }
    const onMove = (me) => {
      if (!panRef.current) return
      dispatch({ type: 'pan', dx: me.clientX - panRef.current.x, dy: me.clientY - panRef.current.y })
      panRef.current = { x: me.clientX, y: me.clientY }
    }
    const onUp = () => {
      panRef.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const connectedEdges = hoveredNode
    ? new Set(edges.filter(e => e.source === hoveredNode || e.target === hoveredNode).map((_, i) => i))
    : null

  const onNodeEnter = (node, e) => {
    setHoveredNode(node.id)
    const rect = containerRef.current?.getBoundingClientRect()
    if (rect) {
      setTooltip({ x: e.clientX - rect.left + 12, y: e.clientY - rect.top - 10, issue: node.issue })
    }
  }

  const onNodeLeave = () => {
    setHoveredNode(null)
    setTooltip(null)
  }

  if (loading) return <div class="dep-svg-empty">Loading full graph...</div>
  if (nodes.length === 0) return <div class="dep-svg-empty">No issues to display</div>

  return (
    <div class="dep-graph-interactive" ref={containerRef}>
      <svg ref={svgRef} class="dep-svg-interactive" onPointerDown={onPointerDown}>
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
            <polygon points="0 0, 10 3, 0 6" fill="var(--color-border)" />
          </marker>
          <marker id="arrowhead-hl" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
            <polygon points="0 0, 10 3, 0 6" fill="var(--color-accent-primary)" />
          </marker>
        </defs>
        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
          {edges.map((edge, i) => {
            const highlighted = connectedEdges?.has(i)
            const dimmed = connectedEdges && !highlighted
            return (
              <path
                key={i}
                class="dep-svg-edge"
                d={edgePath(edge.points)}
                fill="none"
                stroke={highlighted ? 'var(--color-accent-primary)' : 'var(--color-border)'}
                stroke-width={highlighted ? 2.5 : 1.5}
                opacity={dimmed ? 0.15 : 1}
                marker-end={highlighted ? 'url(#arrowhead-hl)' : 'url(#arrowhead)'}
              />
            )
          })}
          {nodes.map(node => {
            const borderColor = getNodeBorderColor(node.issue, node.hasBlockers)
            const dimmed = hoveredNode && hoveredNode !== node.id &&
              !edges.some(e => (e.source === hoveredNode || e.target === hoveredNode) &&
                (e.source === node.id || e.target === node.id))
            return (
              <g
                key={node.id}
                class="dep-graph-node"
                style={{ cursor: 'pointer', opacity: dimmed ? 0.3 : 1 }}
                onClick={() => selectIssue(node.id)}
                onPointerEnter={(e) => onNodeEnter(node, e)}
                onPointerLeave={onNodeLeave}
              >
                <rect
                  class="dep-svg-node"
                  x={node.x}
                  y={node.y}
                  width={NODE_W}
                  height={NODE_H}
                  fill="var(--color-bg-secondary)"
                  stroke={borderColor}
                  stroke-width="2"
                  rx="6"
                />
                <text x={node.x + 8} y={node.y + 22} font-size="12" fill="var(--color-text-primary)">
                  {node.id}
                </text>
                <text x={node.x + 8} y={node.y + 42} font-size="11" fill="var(--color-text-secondary)">
                  {truncate(node.issue.title, 24)}
                </text>
              </g>
            )
          })}
        </g>
      </svg>
      <button class="dep-fit-btn" onClick={fitToView} title="Fit to view">⊞</button>
      {tooltip && (
        <div class="dep-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          <div class="dep-tooltip-id">{tooltip.issue.id}</div>
          <div class="dep-tooltip-title">{tooltip.issue.title}</div>
          <div class="dep-tooltip-status">{tooltip.issue.status}</div>
        </div>
      )}
    </div>
  )
}

export const DependencyGraph = () => {
  const [mode, setMode] = useState('focus')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(/** @type {Issue[]} */ ([]))
  const [selectedIndex, setSelectedIndex] = useState(0)

  const handleSearch = (q) => {
    setSearchQuery(q)
    setSelectedIndex(0)
    if (!q.trim()) {
      setSearchResults([])
      return
    }

    fetch(`/api/search?q=${encodeURIComponent(q)}`)
      .then(r => r.json())
      .then(({ data }) => { setSearchResults(data || []); setSelectedIndex(0) })
      .catch(() => setSearchResults([]))
  }

  const selectFromSearch = (id) => {
    selectIssue(id)
    setSearchQuery('')
    setSearchResults([])
    setSelectedIndex(0)
  }

  const handleSearchKeyDown = (e) => {
    if (searchResults.length === 0) return
    switch (e.key) {
      case 'ArrowDown':
      case 'j':
        if (e.key === 'j' && e.target.tagName === 'INPUT') break
        e.preventDefault()
        setSelectedIndex(i => Math.min(i + 1, searchResults.length - 1))
        break
      case 'ArrowUp':
      case 'k':
        if (e.key === 'k' && e.target.tagName === 'INPUT') break
        e.preventDefault()
        setSelectedIndex(i => Math.max(i - 1, 0))
        break
      case 'Enter':
        if (searchResults[selectedIndex]) {
          e.preventDefault()
          selectFromSearch(searchResults[selectedIndex].id)
        }
        break
    }
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
            onKeyDown={handleSearchKeyDown}
          />
          {searchResults.length > 0 && (
            <div class="dep-search-results">
              {searchResults.map((issue, i) => (
                <div
                  key={issue.id}
                  class={`dep-search-result${i === selectedIndex ? ' dep-search-result-active' : ''}`}
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
        <FullGraphView />
      )}
    </div>
  )
}
