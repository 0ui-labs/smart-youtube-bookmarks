/**
 * Tests for TextSnippet Component - Rich Text Field Display with Truncation
 *
 * Tests cover:
 * - Read-only mode with HTML rendering and truncation
 * - Edit mode with Tiptap editor
 * - Null value handling
 * - Expand button behavior
 * - Backward compatibility with plain text
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TextSnippet } from './TextSnippet'

// Mock TiptapEditor since it requires complex browser APIs
vi.mock('./TiptapEditor', () => ({
  TiptapEditor: ({
    content,
    onChange,
    placeholder,
    className,
  }: {
    content: string
    onChange: (html: string) => void
    placeholder?: string
    maxLength?: number
    className?: string
  }) => (
    <div data-testid="tiptap-editor" className={className}>
      <textarea
        data-testid="tiptap-textarea"
        value={content.replace(/<[^>]*>/g, '')}
        onChange={(e) => onChange(`<p>${e.target.value}</p>`)}
        placeholder={placeholder}
      />
    </div>
  ),
}))

describe('TextSnippet Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Read-Only Mode - HTML Rendering', () => {
    it('renders short text without truncation', () => {
      const { container } = render(
        <TextSnippet
          value="Hello World"
          truncateAt={50}
          readOnly={true}
        />
      )

      expect(container.textContent).toContain('Hello World')
      expect(container.textContent).not.toContain('...')
    })

    it('renders HTML content correctly', () => {
      const { container } = render(
        <TextSnippet
          value="<p>Formatted <strong>text</strong></p>"
          truncateAt={100}
          readOnly={true}
        />
      )

      // Should render the HTML
      const proseContainer = container.querySelector('.tiptap-prose')
      expect(proseContainer).toBeInTheDocument()
    })

    it('truncates long text with ellipsis', () => {
      const longText = 'This is a very long text that should be truncated because it exceeds the limit'
      const { container } = render(
        <TextSnippet
          value={longText}
          truncateAt={20}
          readOnly={true}
        />
      )

      expect(container.textContent).toContain('...')
    })

    it('wraps plain text in paragraph for backward compatibility', () => {
      const { container } = render(
        <TextSnippet
          value="Plain text without HTML"
          truncateAt={100}
          readOnly={true}
        />
      )

      // Plain text should be wrapped and rendered via tiptap-prose
      const proseContainer = container.querySelector('.tiptap-prose')
      expect(proseContainer).toBeInTheDocument()
      expect(container.textContent).toContain('Plain text without HTML')
    })

    it('displays null value as em dash placeholder', () => {
      const { container } = render(
        <TextSnippet
          value={null}
          truncateAt={50}
          readOnly={true}
        />
      )

      expect(container.textContent).toContain('—')
    })

    it('displays undefined value as em dash placeholder', () => {
      const { container } = render(
        <TextSnippet
          value={undefined}
          truncateAt={50}
          readOnly={true}
        />
      )

      expect(container.textContent).toContain('—')
    })

    it('displays empty string as em dash placeholder', () => {
      const { container } = render(
        <TextSnippet
          value=""
          truncateAt={50}
          readOnly={true}
        />
      )

      expect(container.textContent).toContain('—')
    })
  })

  describe('Expand Button Behavior', () => {
    it('shows expand button when text is truncated', () => {
      const longText = 'This is a long text that will definitely be truncated'
      render(
        <TextSnippet
          value={longText}
          truncateAt={20}
          readOnly={true}
          onExpand={vi.fn()}
        />
      )

      const expandButton = screen.getByRole('button')
      expect(expandButton).toBeInTheDocument()
      expect(expandButton).toHaveAttribute('aria-label', 'Text erweitern')
    })

    it('does not show expand button when text is not truncated', () => {
      render(
        <TextSnippet
          value="Short text"
          truncateAt={50}
          readOnly={true}
          onExpand={vi.fn()}
        />
      )

      const buttons = screen.queryAllByRole('button')
      expect(buttons).toHaveLength(0)
    })

    it('calls onExpand callback when expand button clicked', async () => {
      const onExpand = vi.fn()
      const user = userEvent.setup()
      const longText = 'This is a long text that will be truncated for testing'

      render(
        <TextSnippet
          value={longText}
          truncateAt={20}
          readOnly={true}
          onExpand={onExpand}
        />
      )

      const expandButton = screen.getByRole('button')
      await user.click(expandButton)

      expect(onExpand).toHaveBeenCalledTimes(1)
    })
  })

  describe('Editable Mode - Tiptap Editor', () => {
    it('renders TiptapEditor in edit mode', () => {
      render(
        <TextSnippet
          value="Editable text"
          truncateAt={50}
          readOnly={false}
          onChange={vi.fn()}
        />
      )

      expect(screen.getByTestId('tiptap-editor')).toBeInTheDocument()
    })

    it('passes content to TiptapEditor', () => {
      render(
        <TextSnippet
          value="<p>HTML content</p>"
          truncateAt={50}
          readOnly={false}
          onChange={vi.fn()}
        />
      )

      expect(screen.getByTestId('tiptap-editor')).toBeInTheDocument()
    })

    it('calls onChange with HTML when content changes', async () => {
      const onChange = vi.fn()
      const user = userEvent.setup()

      render(
        <TextSnippet
          value=""
          truncateAt={50}
          readOnly={false}
          onChange={onChange}
        />
      )

      const textarea = screen.getByTestId('tiptap-textarea')
      await user.type(textarea, 'New text')

      expect(onChange).toHaveBeenCalled()
      // Should receive HTML wrapped content
      expect(onChange).toHaveBeenCalledWith(expect.stringContaining('<p>'))
    })

    it('handles null value in edit mode', () => {
      render(
        <TextSnippet
          value={null}
          truncateAt={50}
          readOnly={false}
          onChange={vi.fn()}
        />
      )

      expect(screen.getByTestId('tiptap-editor')).toBeInTheDocument()
    })
  })

  describe('Custom Styling', () => {
    it('applies custom className to read-only container', () => {
      const { container } = render(
        <TextSnippet
          value="Styled text"
          truncateAt={50}
          readOnly={true}
          className="custom-style"
        />
      )

      const wrapper = container.firstChild
      expect(wrapper).toHaveClass('custom-style')
    })

    it('applies custom className to editor in edit mode', () => {
      render(
        <TextSnippet
          value="Styled"
          truncateAt={50}
          readOnly={false}
          className="custom-style"
          onChange={vi.fn()}
        />
      )

      expect(screen.getByTestId('tiptap-editor')).toHaveClass('custom-style')
    })
  })

  describe('Edge Cases', () => {
    it('handles text exactly equal to truncateAt length', () => {
      const { container } = render(
        <TextSnippet
          value="ABCDEFGHIJ"
          truncateAt={10}
          readOnly={true}
        />
      )

      // Should NOT truncate (text equals limit)
      expect(container.textContent).not.toContain('...')
    })

    it('handles text one character over truncateAt length', () => {
      const { container } = render(
        <TextSnippet
          value="ABCDEFGHIJK"
          truncateAt={10}
          readOnly={true}
        />
      )

      // Should truncate
      expect(container.textContent).toContain('...')
    })

    it('handles HTML content with special characters', () => {
      const { container } = render(
        <TextSnippet
          value="<p>Text with &amp; and &lt;brackets&gt;</p>"
          truncateAt={100}
          readOnly={true}
        />
      )

      // Should render HTML entities correctly
      expect(container.querySelector('.tiptap-prose')).toBeInTheDocument()
    })
  })

  describe('Backward Compatibility', () => {
    it('converts plain text to HTML for display', () => {
      const { container } = render(
        <TextSnippet
          value="Just plain text"
          truncateAt={100}
          readOnly={true}
        />
      )

      // Should be wrapped in tiptap-prose for styling
      expect(container.querySelector('.tiptap-prose')).toBeInTheDocument()
    })

    it('escapes HTML in plain text values', () => {
      const { container } = render(
        <TextSnippet
          value="Text with <script>alert('xss')</script>"
          truncateAt={100}
          readOnly={true}
        />
      )

      // Should escape and display as text, not execute
      expect(container.innerHTML).not.toContain('<script>')
    })
  })

  describe('Accessibility', () => {
    it('provides accessible label for expand button', () => {
      const longText = 'This is a long text that needs expanding'
      render(
        <TextSnippet
          value={longText}
          truncateAt={20}
          readOnly={true}
          onExpand={vi.fn()}
        />
      )

      const button = screen.getByRole('button', { name: /text erweitern/i })
      expect(button).toBeInTheDocument()
    })

    it('supports keyboard navigation for expand button', async () => {
      const onExpand = vi.fn()
      const user = userEvent.setup()
      const longText = 'This is a long text that needs expanding'

      render(
        <TextSnippet
          value={longText}
          truncateAt={20}
          readOnly={true}
          onExpand={onExpand}
        />
      )

      const button = screen.getByRole('button')
      await user.tab()
      expect(button).toHaveFocus()

      await user.keyboard('{Enter}')
      expect(onExpand).toHaveBeenCalledTimes(1)
    })
  })
})
