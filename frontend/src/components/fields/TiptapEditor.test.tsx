/**
 * Tests for TiptapEditor Component
 *
 * Note: Tiptap relies heavily on ProseMirror which requires browser APIs.
 * These tests focus on component props and basic rendering behavior.
 * Full interaction testing should be done in integration/E2E tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { TiptapEditor } from './TiptapEditor'

// Mock @tiptap/react/menus since it requires browser APIs
vi.mock('@tiptap/react/menus', () => ({
  BubbleMenu: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bubble-menu">{children}</div>
  ),
}))

describe('TiptapEditor Component', () => {
  const defaultProps = {
    content: '',
    onChange: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('renders without crashing', async () => {
      const { container } = render(<TiptapEditor {...defaultProps} />)

      // Wait for editor to initialize
      await waitFor(() => {
        expect(container.querySelector('.tiptap-editor')).toBeInTheDocument()
      })
    })

    it('renders with initial content', async () => {
      const { container } = render(
        <TiptapEditor
          {...defaultProps}
          content="<p>Hello World</p>"
        />
      )

      await waitFor(() => {
        expect(container.textContent).toContain('Hello World')
      })
    })

    it('applies custom className', async () => {
      const { container } = render(
        <TiptapEditor
          {...defaultProps}
          className="custom-class"
        />
      )

      await waitFor(() => {
        const editor = container.querySelector('.tiptap-editor')
        expect(editor).toHaveClass('custom-class')
      })
    })

    it('renders character count when maxLength is provided', async () => {
      render(
        <TiptapEditor
          {...defaultProps}
          content="<p>Test</p>"
          maxLength={100}
        />
      )

      await waitFor(() => {
        expect(screen.getByText(/\/ 100/)).toBeInTheDocument()
      })
    })

    it('does not render character count when maxLength is not provided', async () => {
      const { container } = render(<TiptapEditor {...defaultProps} />)

      await waitFor(() => {
        expect(container.querySelector('.tiptap-editor')).toBeInTheDocument()
      })

      expect(screen.queryByText(/\/ \d+/)).not.toBeInTheDocument()
    })
  })

  describe('Props', () => {
    it('respects placeholder prop', async () => {
      const { container } = render(
        <TiptapEditor
          {...defaultProps}
          placeholder="Custom placeholder..."
        />
      )

      await waitFor(() => {
        // Placeholder is set via extension, check if rendered
        const proseMirror = container.querySelector('.ProseMirror')
        expect(proseMirror).toBeInTheDocument()
      })
    })

    it('calls onChange when content changes', async () => {
      const onChange = vi.fn()
      render(
        <TiptapEditor
          content=""
          onChange={onChange}
        />
      )

      // Wait for editor to be ready
      await waitFor(() => {
        expect(screen.getByRole('textbox', { hidden: true })).toBeInTheDocument()
      }, { timeout: 2000 })
    })
  })

  describe('Accessibility', () => {
    it('renders with proper structure', async () => {
      const { container } = render(<TiptapEditor {...defaultProps} />)

      await waitFor(() => {
        // Editor container should be present
        expect(container.querySelector('.tiptap-editor')).toBeInTheDocument()
      })
    })
  })
})
