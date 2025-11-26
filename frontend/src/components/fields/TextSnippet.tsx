/**
 * TextSnippet Component - Text Field Display with Truncation
 *
 * Features:
 * - Read-only mode: Displays truncated text with expand button
 * - Editable mode: Auto-resizing textarea with maxLength enforcement
 * - Null/undefined handling: Displays em dash (—)
 * - REF MCP #2: Uses truncateAt prop (NOT maxLength) for clarity
 *
 * Props:
 * - value: string | null | undefined - Text content to display
 * - truncateAt: number - Character limit for display truncation (read-only)
 * - readOnly?: boolean - Toggle between read-only and editable modes
 * - onChange?: (value: string) => void - Callback on input change (editable mode)
 * - onExpand?: () => void - Callback when expand button clicked
 * - maxLength?: number - Max characters for input field (editable mode)
 * - className?: string - Custom Tailwind classes
 */

import React, { useEffect, useRef, useCallback } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

export interface TextSnippetProps {
  /** Text content to display */
  value: string | null | undefined
  /** Character limit for display truncation (read-only mode) - REF MCP #2 */
  truncateAt: number
  /** Toggle between read-only and editable modes (default: true) */
  readOnly?: boolean
  /** Callback when input value changes (editable mode) */
  onChange?: (value: string) => void
  /** Callback when expand button clicked */
  onExpand?: () => void
  /** Max characters for input field (editable mode) */
  maxLength?: number
  /** Custom Tailwind classes */
  className?: string
}

export const TextSnippet = React.forwardRef<
  HTMLDivElement | HTMLTextAreaElement,
  TextSnippetProps
>(
  (
    {
      value,
      truncateAt,
      readOnly = true,
      onChange,
      onExpand,
      maxLength,
      className,
    },
    ref
  ) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    // Auto-resize textarea to fit content
    const adjustHeight = useCallback(() => {
      const textarea = textareaRef.current
      if (textarea) {
        textarea.style.height = 'auto'
        textarea.style.height = `${textarea.scrollHeight}px`
      }
    }, [])

    // Adjust height on value change and initial mount
    useEffect(() => {
      adjustHeight()
    }, [value, adjustHeight])

    // Determine if text needs truncation
    const isTruncated = value && value.length > truncateAt
    const displayText = isTruncated ? value.slice(0, truncateAt) : value

    if (readOnly) {
      // Read-only mode: display text with optional expand button
      return (
        <div
          ref={ref as React.Ref<HTMLDivElement>}
          className={cn(
            'inline-flex items-center gap-2 text-sm',
            className
          )}
        >
          <span className="truncate">
            {!displayText ? '—' : displayText}
            {isTruncated && '...'}
          </span>
          {isTruncated && onExpand && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 shrink-0 p-0"
              onClick={onExpand}
              aria-label="Expand text"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      )
    }

    // Editable mode: auto-resizing textarea
    return (
      <Textarea
        ref={textareaRef}
        value={value ?? ''}
        onChange={(e) => {
          onChange?.(e.target.value)
        }}
        onInput={adjustHeight}
        maxLength={maxLength}
        placeholder="Notizen eingeben..."
        rows={3}
        className={cn(
          'resize-none overflow-hidden min-h-[80px]',
          className
        )}
      />
    )
  }
)

TextSnippet.displayName = 'TextSnippet'
