import { useState, useEffect, useRef } from 'preact/hooks'
import { filters, swimlaneGrouping } from '../state.js'
import { apiUrl } from '../projectUrl.js'
import { FilterChip } from './FilterChip.jsx'

const GROUPING_OPTIONS = [
  { value: null, label: 'None' },
  { value: 'assignee', label: 'Assignee' },
  { value: 'priority', label: 'Priority' },
  { value: 'type', label: 'Type' },
  { value: 'label', label: 'Label' },
]

const GroupByControl = () => (
  <div class="group-by-control" role="radiogroup" aria-label="Group board by">
    <span class="group-by-label">Group:</span>
    {GROUPING_OPTIONS.map(opt => (
      <button
        key={opt.label}
        role="radio"
        aria-checked={swimlaneGrouping.value === opt.value}
        class={`group-by-btn${swimlaneGrouping.value === opt.value ? ' group-by-btn-active' : ''}`}
        onClick={() => { swimlaneGrouping.value = opt.value }}
        type="button"
      >
        {opt.label}
      </button>
    ))}
  </div>
)

export const FilterBar = ({ issues }) => {
  const [openDropdown, setOpenDropdown] = useState(null)
  const [labels, setLabels] = useState([])
  const dropdownRef = useRef(null)

  useEffect(() => {
    fetch(apiUrl('/labels'))
      .then(r => r.json())
      .then(({ data }) => setLabels(data))
      .catch(() => setLabels([]))
  }, [])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpenDropdown(null)
      }
    }
    const handleEscape = (e) => {
      if (e.key === 'Escape') setOpenDropdown(null)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  const assignees = [...new Set(issues.map(i => i.assignee).filter(Boolean))].sort()

  const toggleFilter = (type, value) => {
    const current = filters.value[type]
    const updated = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value]
    filters.value = { ...filters.value, [type]: updated }
  }

  const toggleBoolean = (key) => {
    filters.value = { ...filters.value, [key]: !filters.value[key] }
  }

  const removeFilter = (type, value) => {
    if (typeof filters.value[type] === 'boolean') {
      filters.value = { ...filters.value, [type]: false }
    } else {
      filters.value = {
        ...filters.value,
        [type]: filters.value[type].filter(v => v !== value)
      }
    }
  }

  const clearAll = () => {
    filters.value = {
      priority: [],
      type: [],
      assignee: [],
      label: [],
      blockedOnly: false,
      readyOnly: false
    }
  }

  const activeFilters = []
  filters.value.priority.forEach(p => activeFilters.push({ type: 'priority', value: p, label: `P${p}` }))
  filters.value.type.forEach(t => activeFilters.push({ type: 'type', value: t, label: t }))
  filters.value.assignee.forEach(a => activeFilters.push({ type: 'assignee', value: a, label: a }))
  filters.value.label.forEach(l => activeFilters.push({ type: 'label', value: l, label: l }))
  if (filters.value.blockedOnly) activeFilters.push({ type: 'blockedOnly', value: true, label: 'Blocked only' })
  if (filters.value.readyOnly) activeFilters.push({ type: 'readyOnly', value: true, label: 'Ready only' })

  const hasActiveFilters = activeFilters.length > 0

  const FilterDropdown = ({ type, label, options, valueKey = 'value', labelKey = 'label' }) => {
    const isOpen = openDropdown === type
    const hasSelections = filters.value[type]?.length > 0
    return (
      <div class="filter-dropdown-container" ref={isOpen ? dropdownRef : null}>
        <button
          class={`filter-btn ${hasSelections ? 'filter-btn-active' : ''}`}
          onClick={() => setOpenDropdown(isOpen ? null : type)}
          type="button"
        >
          {label} {hasSelections && `(${filters.value[type].length})`} ▾
        </button>
        {isOpen && (
          <div class="filter-dropdown">
            {options.map(opt => {
              const value = typeof opt === 'object' ? opt[valueKey] : opt
              const displayLabel = typeof opt === 'object' ? opt[labelKey] : opt
              return (
                <label key={value} class="filter-option">
                  <input
                    type="checkbox"
                    checked={filters.value[type].includes(value)}
                    onChange={() => toggleFilter(type, value)}
                  />
                  <span>{displayLabel}</span>
                </label>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div class="filter-bar">
      <div class="filter-bar-top">
        <div class="filter-dropdowns">
          <FilterDropdown
            type="priority"
            label="Priority"
            options={[0, 1, 2, 3, 4].map(p => ({ value: p, label: `P${p}` }))}
          />
          <FilterDropdown
            type="type"
            label="Type"
            options={['task', 'bug', 'feature', 'epic']}
          />
          <FilterDropdown
            type="assignee"
            label="Assignee"
            options={assignees}
          />
          <FilterDropdown
            type="label"
            label="Label"
            options={labels}
          />
        </div>
        <div class="filter-toggles">
          <button
            class={`filter-toggle ${filters.value.blockedOnly ? 'filter-toggle-active' : ''}`}
            onClick={() => toggleBoolean('blockedOnly')}
            type="button"
          >
            Blocked only
          </button>
          <button
            class={`filter-toggle ${filters.value.readyOnly ? 'filter-toggle-active' : ''}`}
            onClick={() => toggleBoolean('readyOnly')}
            type="button"
          >
            Ready only
          </button>
          <GroupByControl />
        </div>
      </div>
      {hasActiveFilters && (
        <div class="filter-chips">
          {activeFilters.map((f, i) => (
            <FilterChip
              key={`${f.type}-${f.value}-${i}`}
              label={f.label}
              onRemove={() => removeFilter(f.type, f.value)}
            />
          ))}
          <button class="filter-chip-clear" onClick={clearAll} type="button">
            Clear all
          </button>
        </div>
      )}
    </div>
  )
}
