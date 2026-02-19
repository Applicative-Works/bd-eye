import { useState, useEffect, useRef } from 'preact/hooks'
import { currentProject, projectList } from '../state.js'

const prettyName = (name) =>
  (name.replace(/^beads_/, '').replace(/[-_]/g, ' ') + ' ')
    .replace(/^\w/, c => c.toUpperCase()).trim()

export const ProjectSwitcher = () => {
  const [open, setOpen] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const containerRef = useRef(null)

  const projects = projectList.value
  const current = currentProject.value

  useEffect(() => {
    if (current) {
      document.title = `${prettyName(current)} \u2014 Beady Eye`
    }
  }, [current])

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const selectProject = (name) => {
    currentProject.value = name
    setOpen(false)
  }

  const handleKeyDown = (e) => {
    if (!open) return
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setFocusedIndex(i => Math.min(i + 1, projects.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setFocusedIndex(i => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (projects[focusedIndex]) {
          selectProject(projects[focusedIndex].name)
        }
        break
      case 'Escape':
        e.preventDefault()
        setOpen(false)
        break
    }
  }

  const toggleOpen = () => {
    if (!open) {
      const idx = projects.findIndex(p => p.name === current)
      setFocusedIndex(idx >= 0 ? idx : 0)
    }
    setOpen(!open)
  }

  if (projects.length === 0) {
    return <span class="project-switcher-label text-secondary text-sm">No projects found</span>
  }

  if (projects.length === 1) {
    return <span class="project-switcher-label text-sm font-medium">{prettyName(current)}</span>
  }

  return (
    <div class="project-switcher" ref={containerRef} onKeyDown={handleKeyDown}>
      <button class="project-switcher-btn" onClick={toggleOpen} aria-expanded={open} aria-haspopup="listbox">
        {prettyName(current)} <span class="project-switcher-chevron">{'\u25BE'}</span>
      </button>
      {open && (
        <div class="project-switcher-dropdown" role="listbox">
          {projects.map((p, i) => (
            <div
              key={p.name}
              class={`project-switcher-item${i === focusedIndex ? ' project-switcher-focused' : ''}${p.name === current ? ' project-switcher-active' : ''}`}
              role="option"
              aria-selected={p.name === current}
              onClick={() => selectProject(p.name)}
              onMouseEnter={() => setFocusedIndex(i)}
            >
              <span class="project-switcher-check">{p.name === current ? '\u2713' : ''}</span>
              <span class="project-switcher-name">{prettyName(p.name)}</span>
              <span class="project-switcher-count text-tertiary text-xs">{p.issueCount}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
