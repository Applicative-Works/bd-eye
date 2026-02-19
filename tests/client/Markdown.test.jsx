/** @vitest-environment jsdom */
import { describe, test, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/preact'
import '@testing-library/jest-dom/vitest'
import { Markdown } from '../../src/client/components/Markdown.jsx'

afterEach(cleanup)

describe('Markdown', () => {
  test.each([
    ['heading', '# Hello', 'h1', 'Hello'],
    ['h2', '## Subheading', 'h2', 'Subheading'],
    ['bold', '**bold text**', 'strong', 'bold text'],
    ['italic', '*italic text*', 'em', 'italic text'],
    ['inline code', '`code`', 'code', 'code'],
  ])('renders %s from markdown', (_name, input, tag, expected) => {
    const { container } = render(<Markdown text={input} />)
    const el = container.querySelector(tag)
    expect(el).toBeInTheDocument()
    expect(el.textContent).toBe(expected)
  })

  test('renders unordered list', () => {
    const { container } = render(<Markdown text={'- item a\n- item b'} />)
    const items = container.querySelectorAll('li')
    expect(items).toHaveLength(2)
    expect(items[0].textContent).toBe('item a')
    expect(items[1].textContent).toBe('item b')
  })

  test('renders code block', () => {
    const { container } = render(<Markdown text={'```\nconst x = 1\n```'} />)
    const code = container.querySelector('pre code')
    expect(code).toBeInTheDocument()
    expect(code.textContent).toContain('const x = 1')
  })

  test('renders link', () => {
    const { container } = render(<Markdown text="[click](https://example.com)" />)
    const link = container.querySelector('a')
    expect(link).toHaveAttribute('href', 'https://example.com')
    expect(link.textContent).toBe('click')
  })

  test('has markdown-body class', () => {
    const { container } = render(<Markdown text="hello" />)
    expect(container.querySelector('.markdown-body')).toBeInTheDocument()
  })

  test('handles empty text', () => {
    const { container } = render(<Markdown text="" />)
    expect(container.querySelector('.markdown-body')).toBeInTheDocument()
  })

  test('handles null/undefined text', () => {
    const { container } = render(<Markdown text={null} />)
    expect(container.querySelector('.markdown-body')).toBeInTheDocument()
  })

  test('renders line breaks with gfm breaks enabled', () => {
    const { container } = render(<Markdown text={'line1\nline2'} />)
    const br = container.querySelector('br')
    expect(br).toBeInTheDocument()
  })
})
