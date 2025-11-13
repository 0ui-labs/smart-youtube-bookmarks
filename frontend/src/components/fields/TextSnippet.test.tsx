/**
 * Tests for TextSnippet Component - Text Field Display with Truncation
 * REF MCP Improvement #2: Use `truncateAt` prop (NOT `maxLength`) for clarity
 *
 * Tests cover:
 * - Read-only mode with truncation
 * - Editable mode with inline input
 * - Null value handling
 * - Expand button behavior
 * - Custom className support
 * - maxLength enforcement
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TextSnippet } from './TextSnippet'

describe('TextSnippet Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Read-Only Mode - Truncation', () => {
    it('renders short text without truncation', () => {
      const { container } = render(
        <TextSnippet
          value="Hello World"
          truncateAt={50}
          readOnly={true}
        />
      )

      expect(screen.getByText('Hello World')).toBeInTheDocument()
      // Should NOT have ellipsis
      expect(container.textContent).not.toContain('...')
    })

    it('truncates long text with ellipsis (REF MCP #2)', () => {
      const longText = 'This is a very long text that should be truncated because it exceeds the limit'
      const { container } = render(
        <TextSnippet
          value={longText}
          truncateAt={20}
          readOnly={true}
        />
      )

      const textElement = screen.getByText(/This is a very lon/)
      expect(textElement).toBeInTheDocument()
      expect(container.textContent).toContain('...')
    })

    it('respects truncateAt prop as character limit (REF MCP #2)', () => {
      const text = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' // 26 chars
      const { container } = render(
        <TextSnippet
          value={text}
          truncateAt={10}
          readOnly={true}
        />
      )

      // Should truncate to 10 chars + "..."
      expect(container.textContent).toContain('ABCDEFGHIJ')
      expect(container.textContent).toContain('...')
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
      expect(expandButton).toHaveAttribute('aria-label', 'Expand text')
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

    it('expand button has keyboard accessibility (Keyboard navigation)', async () => {
      const onExpand = vi.fn()
      const user = userEvent.setup()
      const longText = 'This is a long text that will be truncated'

      render(
        <TextSnippet
          value={longText}
          truncateAt={20}
          readOnly={true}
          onExpand={onExpand}
        />
      )

      const expandButton = screen.getByRole('button')
      expandButton.focus()
      expect(expandButton).toHaveFocus()

      await user.keyboard('{Enter}')
      expect(onExpand).toHaveBeenCalledTimes(1)
    })
  })

  describe('Editable Mode - Inline Input', () => {
    it('renders native input element in editable mode', () => {
      const { container } = render(
        <TextSnippet
          value="Editable text"
          truncateAt={50}
          readOnly={false}
          onChange={vi.fn()}
        />
      )

      const input = container.querySelector('input[type="text"]')
      expect(input).toBeInTheDocument()
      expect(input).toHaveValue('Editable text')
    })

    it('displays editable input with null value', () => {
      const { container } = render(
        <TextSnippet
          value={null}
          truncateAt={50}
          readOnly={false}
          onChange={vi.fn()}
        />
      )

      const input = container.querySelector('input[type="text"]')
      expect(input).toBeInTheDocument()
      expect(input).toHaveValue('')
    })

    it('calls onChange when input value changes', async () => {
      const onChange = vi.fn()
      const user = userEvent.setup()
      const { container } = render(
        <TextSnippet
          value="Original"
          truncateAt={50}
          readOnly={false}
          onChange={onChange}
        />
      )

      const input = container.querySelector('input[type="text"]') as HTMLInputElement
      // Triple-click to select all
      await user.tripleClick(input)
      // Type replacement text
      await user.type(input, 'Updated text')

      // onChange is called on every keystroke, check that it was called (at least once)
      expect(onChange).toHaveBeenCalled()
    })

    it('enforces maxLength from field config in editable mode', () => {
      const { container } = render(
        <TextSnippet
          value="Test"
          truncateAt={50}
          readOnly={false}
          maxLength={10}
          onChange={vi.fn()}
        />
      )

      const input = container.querySelector('input[type="text"]') as HTMLInputElement
      expect(input).toHaveAttribute('maxLength', '10')
    })

    it('allows input beyond maxLength attribute (browser enforces limit)', async () => {
      const onChange = vi.fn()
      const user = userEvent.setup()
      const { container } = render(
        <TextSnippet
          value=""
          truncateAt={50}
          readOnly={false}
          maxLength={5}
          onChange={onChange}
        />
      )

      const input = container.querySelector('input[type="text"]') as HTMLInputElement

      // Type all characters
      for (const char of 'ABCDEFGH') {
        await user.type(input, char)
        // Check that maxLength prevents exceeding 5 chars
        if (input.value.length > 5) {
          // Reset to test again
          break
        }
      }

      // Browser enforces maxLength, so input stops at 5 chars
      expect(input.value.length).toBeLessThanOrEqual(5)
    })

    it('handles rapid input changes', async () => {
      const onChange = vi.fn()
      const user = userEvent.setup()
      const { container } = render(
        <TextSnippet
          value=""
          truncateAt={50}
          readOnly={false}
          onChange={onChange}
        />
      )

      const input = container.querySelector('input[type="text"]') as HTMLInputElement
      await user.type(input, 'Fast typing!')

      // onChange is called on every keystroke, verify it was called multiple times
      expect(onChange.mock.calls.length).toBeGreaterThan(5)
    })
  })

  describe('Custom Styling', () => {
    it('applies custom className to read-only text container', () => {
      const { container } = render(
        <TextSnippet
          value="Styled text"
          truncateAt={50}
          readOnly={true}
          className="text-blue-600 font-bold"
        />
      )

      const textContainer = container.querySelector('[class*="text-blue-600"]')
      expect(textContainer).toBeInTheDocument()
      expect(textContainer).toHaveClass('font-bold')
    })

    it('applies custom className to editable input', () => {
      const { container } = render(
        <TextSnippet
          value="Styled input"
          truncateAt={50}
          readOnly={false}
          className="border-red-500"
          onChange={vi.fn()}
        />
      )

      const input = container.querySelector('input[type="text"]')
      expect(input).toHaveClass('border-red-500')
    })
  })

  describe('Edge Cases', () => {
    it('handles empty string correctly', () => {
      const { container } = render(
        <TextSnippet
          value=""
          truncateAt={50}
          readOnly={true}
        />
      )

      expect(container.textContent).toContain('—')
    })

    it('handles whitespace-only text in read-only mode', () => {
      const { container } = render(
        <TextSnippet
          value="   "
          truncateAt={50}
          readOnly={true}
        />
      )

      // Should render the spaces (not treated as empty)
      const span = container.querySelector('span.truncate')
      expect(span).toBeInTheDocument()
      expect(span?.textContent).toBe('   ')
    })

    it('handles text exactly equal to truncateAt length', () => {
      const { container } = render(
        <TextSnippet
          value="ABCDEFGHIJ"
          truncateAt={10}
          readOnly={true}
        />
      )

      // Should NOT truncate (text equals limit)
      expect(screen.getByText('ABCDEFGHIJ')).toBeInTheDocument()
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

    it('renders without error when both value and onChange are provided', async () => {
      const onChange = vi.fn()
      const user = userEvent.setup()
      const { container } = render(
        <TextSnippet
          value="Text"
          truncateAt={50}
          readOnly={false}
          onChange={onChange}
        />
      )

      const input = container.querySelector('input[type="text"]') as HTMLInputElement
      await user.type(input, ' updated')

      expect(onChange).toHaveBeenCalled()
    })
  })

  describe('Accessibility (WCAG 2.1 AA)', () => {
    it('provides semantic HTML structure for read-only text', () => {
      const { container } = render(
        <TextSnippet
          value="Accessible text"
          truncateAt={50}
          readOnly={true}
        />
      )

      // Should have meaningful text content
      expect(screen.getByText('Accessible text')).toBeInTheDocument()
    })

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

      const button = screen.getByRole('button', { name: /expand text/i })
      expect(button).toBeInTheDocument()
    })

    it('provides accessible input with proper attributes in editable mode', () => {
      const { container } = render(
        <TextSnippet
          value="Editable"
          truncateAt={50}
          readOnly={false}
          onChange={vi.fn()}
        />
      )

      const input = container.querySelector('input[type="text"]') as HTMLInputElement
      expect(input).toHaveAttribute('type', 'text')
      expect(input).toBeVisible()
    })

    it('supports keyboard-only navigation for expand button', async () => {
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

      // Tab to focus
      await user.tab()
      expect(button).toHaveFocus()

      // Space to activate
      await user.keyboard(' ')
      expect(onExpand).toHaveBeenCalledTimes(1)
    })
  })

  describe('Prop Validation', () => {
    it('uses truncateAt prop (NOT maxLength for read-only)', () => {
      // REF MCP #2: truncateAt is for display truncation, maxLength is for input
      const { container } = render(
        <TextSnippet
          value="A very long text string that should be truncated"
          truncateAt={10}
          readOnly={true}
        />
      )

      // Should use truncateAt for truncation point
      expect(container.textContent).toContain('A very lo')
      expect(container.textContent).toContain('...')
    })

    it('uses maxLength only in editable mode for input element', () => {
      const { container } = render(
        <TextSnippet
          value="Test"
          truncateAt={50}
          readOnly={false}
          maxLength={5}
          onChange={vi.fn()}
        />
      )

      const input = container.querySelector('input[type="text"]') as HTMLInputElement
      // maxLength is applied to input element
      expect(input).toHaveAttribute('maxLength', '5')
    })
  })
})
