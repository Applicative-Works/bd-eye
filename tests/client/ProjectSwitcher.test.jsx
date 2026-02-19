/** @vitest-environment jsdom */
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/preact'
import '@testing-library/jest-dom/vitest'
import { signal } from '@preact/signals'

const currentProject = signal('alpha')
const projectList = signal([])

vi.mock('../../src/client/state.js', () => ({
  get currentProject() { return currentProject },
  get projectList() { return projectList },
}))

import { ProjectSwitcher } from '../../src/client/components/ProjectSwitcher.jsx'

beforeEach(() => {
  currentProject.value = 'alpha'
  projectList.value = []
  vi.clearAllMocks()
})

afterEach(cleanup)

describe('ProjectSwitcher', () => {
  describe('zero projects', () => {
    test('shows "No projects found"', () => {
      projectList.value = []
      const { container } = render(<ProjectSwitcher />)
      expect(container).toHaveTextContent('No projects found')
    })

    test('does not render a button', () => {
      projectList.value = []
      const { container } = render(<ProjectSwitcher />)
      expect(container.querySelector('button')).toBeNull()
    })
  })

  describe('one project', () => {
    test('shows plain text label', () => {
      projectList.value = [{ name: 'alpha', issueCount: 5 }]
      const { container } = render(<ProjectSwitcher />)
      expect(container).toHaveTextContent('Alpha')
    })

    test('does not render a dropdown button', () => {
      projectList.value = [{ name: 'alpha', issueCount: 5 }]
      const { container } = render(<ProjectSwitcher />)
      expect(container.querySelector('.project-switcher-btn')).toBeNull()
    })
  })

  describe('multiple projects', () => {
    beforeEach(() => {
      projectList.value = [
        { name: 'alpha', issueCount: 10 },
        { name: 'beta', issueCount: 20 },
        { name: 'gamma', issueCount: 5 },
      ]
    })

    test('renders dropdown button with current project name', () => {
      const { container } = render(<ProjectSwitcher />)
      const btn = container.querySelector('.project-switcher-btn')
      expect(btn).toHaveTextContent('Alpha')
    })

    test('dropdown is closed by default', () => {
      const { container } = render(<ProjectSwitcher />)
      expect(container.querySelector('.project-switcher-dropdown')).toBeNull()
    })

    test('clicking button opens dropdown', () => {
      const { container } = render(<ProjectSwitcher />)
      fireEvent.click(container.querySelector('.project-switcher-btn'))
      expect(container.querySelector('.project-switcher-dropdown')).not.toBeNull()
    })

    test('dropdown shows all projects with issue counts', () => {
      const { container } = render(<ProjectSwitcher />)
      fireEvent.click(container.querySelector('.project-switcher-btn'))
      const items = container.querySelectorAll('.project-switcher-item')
      expect(items).toHaveLength(3)
      expect(items[0]).toHaveTextContent('Alpha')
      expect(items[0]).toHaveTextContent('10')
      expect(items[1]).toHaveTextContent('Beta')
      expect(items[1]).toHaveTextContent('20')
    })

    test('current project has check mark', () => {
      const { container } = render(<ProjectSwitcher />)
      fireEvent.click(container.querySelector('.project-switcher-btn'))
      const activeItem = container.querySelector('.project-switcher-active')
      expect(activeItem).not.toBeNull()
      expect(activeItem.querySelector('.project-switcher-check')).toHaveTextContent('\u2713')
    })

    test('non-active projects have empty check mark', () => {
      const { container } = render(<ProjectSwitcher />)
      fireEvent.click(container.querySelector('.project-switcher-btn'))
      const items = container.querySelectorAll('.project-switcher-item:not(.project-switcher-active)')
      items.forEach(item => {
        expect(item.querySelector('.project-switcher-check')).toHaveTextContent('')
      })
    })

    test('clicking a project updates currentProject signal', () => {
      const { container } = render(<ProjectSwitcher />)
      fireEvent.click(container.querySelector('.project-switcher-btn'))
      const items = container.querySelectorAll('.project-switcher-item')
      fireEvent.click(items[1])
      expect(currentProject.value).toBe('beta')
    })

    test('clicking a project closes dropdown', () => {
      const { container } = render(<ProjectSwitcher />)
      fireEvent.click(container.querySelector('.project-switcher-btn'))
      const items = container.querySelectorAll('.project-switcher-item')
      fireEvent.click(items[1])
      expect(container.querySelector('.project-switcher-dropdown')).toBeNull()
    })

    test('Escape closes dropdown', () => {
      const { container } = render(<ProjectSwitcher />)
      fireEvent.click(container.querySelector('.project-switcher-btn'))
      expect(container.querySelector('.project-switcher-dropdown')).not.toBeNull()
      fireEvent.keyDown(container.querySelector('.project-switcher'), { key: 'Escape' })
      expect(container.querySelector('.project-switcher-dropdown')).toBeNull()
    })

    test('clicking outside closes dropdown', () => {
      const { container } = render(<ProjectSwitcher />)
      fireEvent.click(container.querySelector('.project-switcher-btn'))
      expect(container.querySelector('.project-switcher-dropdown')).not.toBeNull()
      fireEvent.mouseDown(document.body)
      expect(container.querySelector('.project-switcher-dropdown')).toBeNull()
    })

    test('ArrowDown moves focus', () => {
      const { container } = render(<ProjectSwitcher />)
      fireEvent.click(container.querySelector('.project-switcher-btn'))
      fireEvent.keyDown(container.querySelector('.project-switcher'), { key: 'ArrowDown' })
      const items = container.querySelectorAll('.project-switcher-item')
      expect(items[1]).toHaveClass('project-switcher-focused')
    })

    test('ArrowUp moves focus', () => {
      const { container } = render(<ProjectSwitcher />)
      fireEvent.click(container.querySelector('.project-switcher-btn'))
      fireEvent.keyDown(container.querySelector('.project-switcher'), { key: 'ArrowDown' })
      fireEvent.keyDown(container.querySelector('.project-switcher'), { key: 'ArrowDown' })
      fireEvent.keyDown(container.querySelector('.project-switcher'), { key: 'ArrowUp' })
      const items = container.querySelectorAll('.project-switcher-item')
      expect(items[1]).toHaveClass('project-switcher-focused')
    })

    test('Enter selects focused project', () => {
      const { container } = render(<ProjectSwitcher />)
      fireEvent.click(container.querySelector('.project-switcher-btn'))
      fireEvent.keyDown(container.querySelector('.project-switcher'), { key: 'ArrowDown' })
      fireEvent.keyDown(container.querySelector('.project-switcher'), { key: 'Enter' })
      expect(currentProject.value).toBe('beta')
    })

    test('updates document.title', () => {
      render(<ProjectSwitcher />)
      expect(document.title).toBe('Alpha \u2014 Beady Eye')
    })

    test('strips beads_ prefix and humanises names', () => {
      projectList.value = [
        { name: 'beads_my-project', issueCount: 3 },
        { name: 'beads_other_thing', issueCount: 7 },
      ]
      currentProject.value = 'beads_my-project'
      const { container } = render(<ProjectSwitcher />)
      const btn = container.querySelector('.project-switcher-btn')
      expect(btn).toHaveTextContent('My project')
      fireEvent.click(btn)
      const items = container.querySelectorAll('.project-switcher-name')
      expect(items[0]).toHaveTextContent('My project')
      expect(items[1]).toHaveTextContent('Other thing')
    })
  })
})
