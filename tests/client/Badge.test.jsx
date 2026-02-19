/** @vitest-environment jsdom */
import { describe, test, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/preact'
import '@testing-library/jest-dom/vitest'
import { Badge, PillBadge } from '../../src/client/components/Badge.jsx'

afterEach(cleanup)

describe('Badge', () => {
  test('renders children', () => {
    const { container } = render(<Badge>P1</Badge>)
    expect(container.querySelector('.badge')).toHaveTextContent('P1')
  })

  test('applies base badge class', () => {
    const { container } = render(<Badge>test</Badge>)
    expect(container.querySelector('span')).toHaveClass('badge')
  })

  test.each([
    ['badge-p1'],
    ['badge-p2'],
    ['badge-critical'],
  ])('applies additional class "%s"', (cls) => {
    const { container } = render(<Badge class={cls}>x</Badge>)
    expect(container.querySelector('span')).toHaveClass('badge', cls)
  })

  test('defaults to empty additional class', () => {
    const { container } = render(<Badge>x</Badge>)
    expect(container.querySelector('span').className.trim()).toBe('badge')
  })
})

describe('PillBadge', () => {
  test('renders children', () => {
    const { container } = render(<PillBadge>story</PillBadge>)
    expect(container.querySelector('.badge-pill')).toHaveTextContent('story')
  })

  test('applies base badge-pill class', () => {
    const { container } = render(<PillBadge>test</PillBadge>)
    expect(container.querySelector('span')).toHaveClass('badge-pill')
  })

  test.each([
    ['badge-story'],
    ['badge-bug'],
    ['badge-label'],
  ])('applies additional class "%s"', (cls) => {
    const { container } = render(<PillBadge class={cls}>x</PillBadge>)
    expect(container.querySelector('span')).toHaveClass('badge-pill', cls)
  })

  test('defaults to empty additional class', () => {
    const { container } = render(<PillBadge>x</PillBadge>)
    expect(container.querySelector('span').className.trim()).toBe('badge-pill')
  })
})
