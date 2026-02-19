import { useState, useMemo, useRef, useCallback, useEffect } from 'preact/hooks'
import { useIssues } from '../hooks/useIssues.js'

const TYPE_COLOR = {
  task:    '#58a6ff',
  bug:     '#ff7b72',
  feature: '#a371f7',
  epic:    '#ffa657',
}

const TYPE_ORDER = ['task', 'feature', 'bug', 'epic']

const BUCKET_OPTIONS = [
  { id: 'day',   label: 'Day' },
  { id: 'week',  label: 'Week' },
  { id: 'month', label: 'Month' },
]

const isoWeekStart = (date) => {
  const d = new Date(date)
  const day = d.getUTCDay()
  const diff = (day === 0 ? -6 : 1 - day)
  d.setUTCDate(d.getUTCDate() + diff)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

const bucketKey = (dateStr, granularity) => {
  const d = new Date(dateStr)
  if (granularity === 'day') {
    return d.toISOString().slice(0, 10)
  }
  if (granularity === 'week') {
    return isoWeekStart(d).toISOString().slice(0, 10)
  }
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

const formatBucketLabel = (key, granularity) => {
  if (granularity === 'month') {
    const [y, m] = key.split('-')
    return new Date(Number(y), Number(m) - 1, 1)
      .toLocaleString('default', { month: 'short', year: '2-digit' })
  }
  const d = new Date(key + 'T00:00:00Z')
  if (granularity === 'week') {
    return d.toLocaleString('default', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  }
  return d.toLocaleString('default', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

const buildBuckets = (issues, granularity) => {
  const closed = issues.filter(i => i.closed_at)
  if (closed.length === 0) return []

  const keys = new Map()
  for (const issue of closed) {
    const k = bucketKey(issue.closed_at, granularity)
    if (!keys.has(k)) keys.set(k, { key: k, task: 0, bug: 0, feature: 0, epic: 0, total: 0, issues: [] })
    const bucket = keys.get(k)
    const t = issue.issue_type || 'task'
    bucket[t] = (bucket[t] || 0) + 1
    bucket.total += 1
    bucket.issues.push(issue)
  }

  return Array.from(keys.values()).sort((a, b) => a.key.localeCompare(b.key))
}

const movingAverage = (buckets, window) => {
  return buckets.map((b, i) => {
    const start = Math.max(0, i - window + 1)
    const slice = buckets.slice(start, i + 1)
    return slice.reduce((s, x) => s + x.total, 0) / slice.length
  })
}

const CHART_MARGIN = { top: 20, right: 24, bottom: 40, left: 36 }

const sparkPath = (points, width, height) => {
  if (points.length < 2) return ''
  const max = Math.max(...points, 1)
  const xs = points.map((_, i) => (i / (points.length - 1)) * width)
  const ys = points.map(v => height - (v / max) * height * 0.85)
  let d = `M${xs[0]},${ys[0]}`
  for (let i = 1; i < points.length; i++) {
    const cx = (xs[i - 1] + xs[i]) / 2
    d += ` C${cx},${ys[i - 1]} ${cx},${ys[i]} ${xs[i]},${ys[i]}`
  }
  return d
}

const StatCard = ({ label, value, sub, accent }) => (
  <div class="tp-stat">
    <span class="tp-stat-value" style={accent ? `color:${accent}` : undefined}>{value}</span>
    <span class="tp-stat-label">{label}</span>
    {sub && <span class="tp-stat-sub">{sub}</span>}
  </div>
)

const TypeLegend = ({ onHover, hoveredType }) => (
  <div class="tp-legend">
    {TYPE_ORDER.map(t => (
      <button
        key={t}
        class={`tp-legend-item${hoveredType === t ? ' tp-legend-item-active' : ''}`}
        onMouseEnter={() => onHover(t)}
        onMouseLeave={() => onHover(null)}
        onClick={() => onHover(hoveredType === t ? null : t)}
        aria-pressed={hoveredType === t}
      >
        <span class="tp-legend-dot" style={`background:${TYPE_COLOR[t]}`} />
        {t}
      </button>
    ))}
  </div>
)

const BucketToggle = ({ value, onChange }) => (
  <div class="tp-bucket-toggle">
    {BUCKET_OPTIONS.map(o => (
      <button
        key={o.id}
        class={`tp-bucket-btn${value === o.id ? ' tp-bucket-btn-active' : ''}`}
        onClick={() => onChange(o.id)}
      >
        {o.label}
      </button>
    ))}
  </div>
)

const Tooltip = ({ bucket, granularity, x, y, visible }) => {
  if (!visible || !bucket) return null
  const label = formatBucketLabel(bucket.key, granularity)
  return (
    <div
      class="tp-tooltip"
      style={`left:${x}px;top:${y}px;opacity:${visible ? 1 : 0}`}
      aria-hidden="true"
    >
      <div class="tp-tooltip-date">{label}</div>
      <div class="tp-tooltip-total">{bucket.total} closed</div>
      <div class="tp-tooltip-breakdown">
        {TYPE_ORDER.filter(t => bucket[t] > 0).map(t => (
          <span key={t} class="tp-tooltip-type" style={`color:${TYPE_COLOR[t]}`}>
            {bucket[t]} {t}
          </span>
        ))}
      </div>
    </div>
  )
}

const SvgChart = ({ buckets, granularity, hoveredType, width, height, onHoverBucket, hoveredBucketIndex }) => {
  const innerW = width - CHART_MARGIN.left - CHART_MARGIN.right
  const innerH = height - CHART_MARGIN.top - CHART_MARGIN.bottom

  const maxTotal = useMemo(() => Math.max(...buckets.map(b => b.total), 1), [buckets])
  const maValues = useMemo(() => movingAverage(buckets, 3), [buckets])

  if (buckets.length === 0) return null

  const barW = Math.max(2, Math.min(40, innerW / buckets.length - 3))
  const xStep = innerW / buckets.length

  const yScale = (v) => innerH - (v / maxTotal) * innerH * 0.92

  const yTicks = useMemo(() => {
    const step = maxTotal <= 5 ? 1 : maxTotal <= 10 ? 2 : maxTotal <= 20 ? 4 : Math.ceil(maxTotal / 5)
    const ticks = []
    for (let v = 0; v <= maxTotal; v += step) {
      if (v > maxTotal * 0.95) break
      ticks.push(v)
    }
    ticks.push(maxTotal)
    return [...new Set(ticks)]
  }, [maxTotal])

  const maPath = useMemo(() => {
    if (buckets.length < 2) return ''
    const points = maValues.map((v, i) => ({
      x: CHART_MARGIN.left + i * xStep + xStep / 2,
      y: CHART_MARGIN.top + yScale(v),
    }))
    let d = `M${points[0].x},${points[0].y}`
    for (let i = 1; i < points.length; i++) {
      const cx = (points[i - 1].x + points[i].x) / 2
      d += ` C${cx},${points[i - 1].y} ${cx},${points[i].y} ${points[i].x},${points[i].y}`
    }
    return d
  }, [maValues, xStep, buckets.length])

  const labelFreq = Math.max(1, Math.ceil(buckets.length / (granularity === 'day' ? 7 : 4)))

  return (
    <svg
      class="tp-svg"
      width={width}
      height={height}
      role="img"
      aria-label="Throughput chart"
    >
      <defs>
        {TYPE_ORDER.map(t => (
          <linearGradient key={t} id={`tp-grad-${t}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color={TYPE_COLOR[t]} stop-opacity="0.95" />
            <stop offset="100%" stop-color={TYPE_COLOR[t]} stop-opacity="0.55" />
          </linearGradient>
        ))}
        <linearGradient id="tp-ma-glow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#58a6ff" stop-opacity="0.15" />
          <stop offset="100%" stop-color="#58a6ff" stop-opacity="0" />
        </linearGradient>
        <filter id="tp-bar-glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Grid lines */}
      {yTicks.map(v => (
        <line
          key={v}
          x1={CHART_MARGIN.left}
          x2={CHART_MARGIN.left + innerW}
          y1={CHART_MARGIN.top + yScale(v)}
          y2={CHART_MARGIN.top + yScale(v)}
          stroke="var(--color-border-muted)"
          stroke-width="1"
          stroke-dasharray={v === 0 ? 'none' : '3,4'}
        />
      ))}

      {/* Y-axis labels */}
      {yTicks.filter(v => v > 0).map(v => (
        <text
          key={v}
          x={CHART_MARGIN.left - 6}
          y={CHART_MARGIN.top + yScale(v) + 4}
          text-anchor="end"
          font-size="10"
          fill="var(--color-text-tertiary)"
          font-family="var(--font-mono)"
        >
          {v}
        </text>
      ))}

      {/* Stacked bars */}
      {buckets.map((bucket, i) => {
        const cx = CHART_MARGIN.left + i * xStep + xStep / 2
        const bx = cx - barW / 2
        const isHovered = hoveredBucketIndex === i
        const isDimmed = hoveredType !== null && bucket[hoveredType] === 0

        let yOffset = innerH
        const segments = TYPE_ORDER.filter(t => bucket[t] > 0).map(t => {
          const bh = (bucket[t] / maxTotal) * innerH * 0.92
          const by = CHART_MARGIN.top + yOffset - bh
          yOffset -= bh
          return { type: t, bh, by }
        })

        return (
          <g
            key={bucket.key}
            class="tp-bar-group"
            opacity={isDimmed ? 0.18 : 1}
            style="transition: opacity 150ms ease"
            onMouseEnter={() => onHoverBucket(i)}
            onMouseLeave={() => onHoverBucket(null)}
          >
            {/* Hover highlight */}
            {isHovered && (
              <rect
                x={bx - 3}
                y={CHART_MARGIN.top}
                width={barW + 6}
                height={innerH}
                fill="var(--color-accent-primary)"
                opacity="0.05"
                rx="2"
              />
            )}
            {segments.map(({ type, bh, by }) => (
              <rect
                key={type}
                x={bx}
                y={by}
                width={barW}
                height={bh}
                fill={isHovered ? TYPE_COLOR[type] : `url(#tp-grad-${type})`}
                rx={segments[segments.length - 1].type === type ? 2 : 0}
                style="transition: filter 100ms ease"
                filter={isHovered ? 'url(#tp-bar-glow)' : 'none'}
              />
            ))}
            {/* X-axis label */}
            {i % labelFreq === 0 && (
              <text
                x={cx}
                y={CHART_MARGIN.top + innerH + 20}
                text-anchor="middle"
                font-size="10"
                fill={isHovered ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)'}
                font-family="var(--font-sans)"
                style="transition: fill 100ms ease"
              >
                {formatBucketLabel(bucket.key, granularity)}
              </text>
            )}
          </g>
        )
      })}

      {/* Moving average line */}
      {buckets.length >= 3 && (
        <g class="tp-ma-line">
          <path
            d={maPath}
            fill="none"
            stroke="var(--color-accent-primary)"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            opacity="0.7"
          />
          {maValues.map((v, i) => (
            <circle
              key={i}
              cx={CHART_MARGIN.left + i * xStep + xStep / 2}
              cy={CHART_MARGIN.top + yScale(v)}
              r={hoveredBucketIndex === i ? 4 : 2.5}
              fill={hoveredBucketIndex === i ? 'var(--color-accent-primary)' : 'var(--color-bg-primary)'}
              stroke="var(--color-accent-primary)"
              stroke-width={hoveredBucketIndex === i ? 2 : 1.5}
              style="transition: r 100ms ease, fill 100ms ease"
            />
          ))}
        </g>
      )}

      {/* X-axis baseline */}
      <line
        x1={CHART_MARGIN.left}
        x2={CHART_MARGIN.left + innerW}
        y1={CHART_MARGIN.top + innerH}
        y2={CHART_MARGIN.top + innerH}
        stroke="var(--color-border)"
        stroke-width="1"
      />
    </svg>
  )
}

const MiniSparkline = ({ values, color, width = 80, height = 28 }) => {
  if (values.length < 2) return null
  const path = sparkPath(values, width, height)
  const max = Math.max(...values, 1)
  const last = values[values.length - 1]
  const areaPoints = values.map((v, i) => [
    (i / (values.length - 1)) * width,
    height - (v / max) * height * 0.85,
  ])
  const areaPath = `M${areaPoints[0][0]},${areaPoints[0][1]}` +
    areaPoints.slice(1).map(([x, y]) => `L${x},${y}`).join('') +
    `L${width},${height}L0,${height}Z`

  return (
    <svg width={width} height={height} aria-hidden="true" class="tp-sparkline">
      <defs>
        <linearGradient id={`spark-grad-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color={color} stop-opacity="0.3" />
          <stop offset="100%" stop-color={color} stop-opacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#spark-grad-${color.replace('#','')})`} />
      <path d={path} fill="none" stroke={color} stroke-width="1.5" stroke-linecap="round" opacity="0.8" />
      <circle
        cx={(values.length - 1) / (values.length - 1) * width}
        cy={height - (last / max) * height * 0.85}
        r="2.5"
        fill={color}
      />
    </svg>
  )
}

const TypeBreakdownRow = ({ type, buckets, total }) => {
  const count = buckets.reduce((s, b) => s + (b[type] || 0), 0)
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  const sparkValues = buckets.map(b => b[type] || 0)

  return (
    <div class="tp-breakdown-row">
      <span class="tp-breakdown-dot" style={`background:${TYPE_COLOR[type]}`} />
      <span class="tp-breakdown-type">{type}</span>
      <div class="tp-breakdown-bar-track">
        <div
          class="tp-breakdown-bar-fill"
          style={`width:${pct}%;background:${TYPE_COLOR[type]}`}
        />
      </div>
      <span class="tp-breakdown-count font-mono">{count}</span>
      <span class="tp-breakdown-pct">{pct}%</span>
      <MiniSparkline values={sparkValues} color={TYPE_COLOR[type]} />
    </div>
  )
}

export const ThroughputChart = () => {
  const { issues, loading } = useIssues('/api/issues')
  const [granularity, setGranularity] = useState('week')
  const [hoveredType, setHoveredType] = useState(null)
  const [hoveredBucketIndex, setHoveredBucketIndex] = useState(null)
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, bucket: null })
  const containerRef = useRef(null)
  const [chartWidth, setChartWidth] = useState(800)

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width
      if (w) setChartWidth(w)
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  const buckets = useMemo(() => buildBuckets(issues, granularity), [issues, granularity])

  const totalClosed = useMemo(() => buckets.reduce((s, b) => s + b.total, 0), [buckets])

  const weeklyAvg = useMemo(() => {
    if (buckets.length === 0) return 0
    if (granularity === 'week') return (totalClosed / buckets.length).toFixed(1)
    const weeks = buckets.reduce((s, b) => {
      const d = new Date(b.key + '-01T00:00:00Z')
      const daysInMonth = new Date(d.getUTCFullYear(), d.getUTCMonth() + 1, 0).getDate()
      return s + daysInMonth / 7
    }, 0)
    return (totalClosed / Math.max(weeks, 1)).toFixed(1)
  }, [buckets, granularity, totalClosed])

  const bestBucket = useMemo(() =>
    buckets.reduce((best, b) => (!best || b.total > best.total ? b : best), null),
    [buckets]
  )

  const recentTrend = useMemo(() => {
    if (buckets.length < 4) return null
    const recent = buckets.slice(-3).reduce((s, b) => s + b.total, 0) / 3
    const prior = buckets.slice(-6, -3).reduce((s, b) => s + b.total, 0) / 3
    if (prior === 0) return null
    const delta = ((recent - prior) / prior) * 100
    return { delta: Math.round(delta), up: delta >= 0 }
  }, [buckets])

  const handleHoverBucket = useCallback((index) => {
    setHoveredBucketIndex(index)
    if (index === null) {
      setTooltip(t => ({ ...t, visible: false }))
      return
    }
    const bucket = buckets[index]
    if (!bucket || !containerRef.current) return
    const innerW = chartWidth - CHART_MARGIN.left - CHART_MARGIN.right
    const xStep = innerW / buckets.length
    const cx = CHART_MARGIN.left + index * xStep + xStep / 2
    const txRaw = cx + 16
    const txClamped = txRaw + 160 > chartWidth ? cx - 176 : txRaw
    setTooltip({ visible: true, x: txClamped, y: CHART_MARGIN.top + 8, bucket })
  }, [buckets, chartWidth])

  const chartHeight = Math.min(320, Math.max(200, chartWidth * 0.35))

  if (loading) return <div class="tp-empty">Loading...</div>
  if (buckets.length === 0) return <div class="tp-empty">No closed issues yet</div>

  return (
    <div class="tp-root">
      <div class="tp-header">
        <div class="tp-header-left">
          <span class="tp-title">Throughput</span>
          <span class="tp-subtitle">Issues closed over time</span>
        </div>
        <div class="tp-header-right">
          <TypeLegend onHover={setHoveredType} hoveredType={hoveredType} />
          <BucketToggle value={granularity} onChange={setGranularity} />
        </div>
      </div>

      <div class="tp-stats-row">
        <StatCard label="Total closed" value={totalClosed} />
        <StatCard label="Weekly avg" value={weeklyAvg} sub="issues / week" />
        {bestBucket && (
          <StatCard
            label="Best period"
            value={bestBucket.total}
            sub={formatBucketLabel(bestBucket.key, granularity)}
            accent="var(--color-success)"
          />
        )}
        {recentTrend && (
          <StatCard
            label="Recent trend"
            value={`${recentTrend.up ? '+' : ''}${recentTrend.delta}%`}
            sub="vs prior period"
            accent={recentTrend.up ? 'var(--color-success)' : 'var(--color-error)'}
          />
        )}
        <StatCard label="Periods" value={buckets.length} sub={granularity + 's'} />
      </div>

      <div class="tp-chart-wrap" ref={containerRef}>
        <SvgChart
          buckets={buckets}
          granularity={granularity}
          hoveredType={hoveredType}
          width={chartWidth}
          height={chartHeight}
          onHoverBucket={handleHoverBucket}
          hoveredBucketIndex={hoveredBucketIndex}
        />
        <Tooltip
          bucket={tooltip.bucket}
          granularity={granularity}
          x={tooltip.x}
          y={tooltip.y}
          visible={tooltip.visible}
        />
      </div>

      <div class="tp-ma-hint">
        <span class="tp-ma-line-sample" aria-hidden="true" />
        <span class="tp-ma-hint-text">3-period moving average</span>
      </div>

      <div class="tp-breakdown">
        <div class="tp-breakdown-header">By type</div>
        {TYPE_ORDER.map(t => (
          <TypeBreakdownRow
            key={t}
            type={t}
            buckets={buckets}
            total={totalClosed}
          />
        ))}
      </div>
    </div>
  )
}
