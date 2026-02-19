/** @vitest-environment jsdom */
import { describe, test, expect, afterEach, vi, beforeEach } from 'vitest'
import { render, cleanup, fireEvent, waitFor } from '@testing-library/preact'
import '@testing-library/jest-dom/vitest'
import { CopyableId } from '../../src/client/components/CopyableId.jsx'

afterEach(cleanup)

describe('CopyableId', () => {
  let writeTextMock

  beforeEach(() => {
    writeTextMock = vi.fn(() => Promise.resolve())
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    })
  })

  test('renders the id text', () => {
    const { container } = render(<CopyableId id="bd-eye-123" />)
    expect(container.querySelector('.copyable-id')).toHaveTextContent('bd-eye-123')
  })

  test('applies additional classes', () => {
    const { container } = render(<CopyableId id="x" class="font-mono text-xs" />)
    expect(container.querySelector('span')).toHaveClass('copyable-id', 'font-mono', 'text-xs')
  })

  test('copies id to clipboard on click', async () => {
    const { container } = render(<CopyableId id="bd-eye-456" />)
    fireEvent.click(container.querySelector('.copyable-id'))
    expect(writeTextMock).toHaveBeenCalledWith('bd-eye-456')
  })

  test('shows "Copied!" feedback after click', async () => {
    const { container } = render(<CopyableId id="bd-eye-789" />)
    fireEvent.click(container.querySelector('.copyable-id'))
    await waitFor(() => {
      expect(container.querySelector('.copyable-id')).toHaveTextContent('Copied!')
    })
  })

  test('reverts to id after timeout', async () => {
    vi.useFakeTimers()
    const { container } = render(<CopyableId id="bd-eye-abc" />)
    fireEvent.click(container.querySelector('.copyable-id'))
    await waitFor(() => {
      expect(container.querySelector('.copyable-id')).toHaveTextContent('Copied!')
    })
    vi.advanceTimersByTime(1200)
    await waitFor(() => {
      expect(container.querySelector('.copyable-id')).toHaveTextContent('bd-eye-abc')
    })
    vi.useRealTimers()
  })

  test('stops event propagation', () => {
    const parentHandler = vi.fn()
    const { container } = render(
      <div onClick={parentHandler}>
        <CopyableId id="bd-eye-xyz" />
      </div>
    )
    fireEvent.click(container.querySelector('.copyable-id'))
    expect(parentHandler).not.toHaveBeenCalled()
  })

  test('has click-to-copy title', () => {
    const { container } = render(<CopyableId id="x" />)
    expect(container.querySelector('.copyable-id')).toHaveAttribute('title', 'Click to copy')
  })
})
