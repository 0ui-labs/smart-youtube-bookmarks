import React, { useState, useRef, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

export interface TextSnippetProps {
  /**
   * Current text value
   */
  value: string | null
  /**
   * Field name for accessibility
   */
  fieldName: string
  /**
   * Maximum length constraint (optional)
   */
  maxLength?: number
  /**
   * Whether the field is editable
   */
  readonly?: boolean
  /**
   * Save on blur (default: true) - RSuite pattern
   * REF MCP #3: New prop for Tab key behavior
   */
  saveOnBlur?: boolean
  /**
   * Callback when value changes
   */
  onChange?: (value: string) => void
}

/**
 * TextSnippet Component
 *
 * Click-to-edit text field with keyboard navigation.
 *
 * REF MCP Improvements Applied:
 * - #3 (Keyboard Navigation): Enter saves, Escape cancels, Tab saves + blurs (NEW!)
 * - #3 (saveOnBlur prop): Default true for RSuite pattern (NEW!)
 * - #3 (Event Propagation): stopPropagation on all interactive events
 * - #4 (Performance): Wrapped in React.memo()
 * - #5 (Accessibility): Complete ARIA labels with current value and edit hint
 *
 * @example
 * // Editable text with auto-save on blur
 * <TextSnippet
 *   value="Great tutorial!"
 *   fieldName="Notes"
 *   maxLength={500}
 *   onChange={(newValue) => console.log(newValue)}
 * />
 *
 * @example
 * // No auto-save on blur (must press Enter)
 * <TextSnippet
 *   value="Notes here"
 *   fieldName="Comments"
 *   saveOnBlur={false}
 *   onChange={(newValue) => console.log(newValue)}
 * />
 */
export const TextSnippet = React.memo<TextSnippetProps>(
  ({ value, fieldName, maxLength, readonly = false, saveOnBlur = true, onChange }) => {
    const [isEditing, setIsEditing] = useState(false)
    const [editValue, setEditValue] = useState(value ?? '')
    const inputRef = useRef<HTMLInputElement>(null)

    // Sync editValue when value prop changes
    useEffect(() => {
      if (!isEditing) {
        setEditValue(value ?? '')
      }
    }, [value, isEditing])

    // Auto-select text on edit mode entry
    useEffect(() => {
      if (isEditing && inputRef.current) {
        inputRef.current.select()
      }
    }, [isEditing])

    const displayValue = value || 'empty'
    const truncatedDisplay = displayValue.length > 30 ? `${displayValue.slice(0, 30)}...` : displayValue

    const handleSave = () => {
      if (editValue !== value) {
        onChange?.(editValue)
      }
      setIsEditing(false)
    }

    const handleCancel = () => {
      setEditValue(value ?? '')
      setIsEditing(false)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      // REF MCP #3: Keyboard navigation
      if (e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation() // REF MCP #3: Prevent VideoCard click
        handleSave()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation() // REF MCP #3: Prevent VideoCard click
        handleCancel()
      } else if (e.key === 'Tab') {
        // REF MCP #3: Tab saves + blurs (NEW!)
        if (saveOnBlur) {
          // Don't prevent default, let Tab work normally
          // But save before blur happens
          handleSave()
        }
      }
    }

    const handleBlur = () => {
      // REF MCP #3: saveOnBlur prop (default: true)
      if (saveOnBlur) {
        handleSave()
      } else {
        handleCancel()
      }
    }

    if (readonly) {
      return (
        <Badge
          variant="secondary"
          className="cursor-default"
          onClick={(e: React.MouseEvent) => e.stopPropagation()} // REF MCP #3: Prevent VideoCard click
        >
          {truncatedDisplay}
        </Badge>
      )
    }

    if (isEditing) {
      return (
        <Input
          ref={inputRef}
          type="text"
          value={editValue}
          maxLength={maxLength}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onClick={(e: React.MouseEvent) => e.stopPropagation()} // REF MCP #3: Prevent VideoCard click
          className="h-6 px-2 text-sm"
          aria-label={`Editing ${fieldName}`}
        />
      )
    }

    return (
      <Badge
        variant="outline"
        className="cursor-pointer hover:bg-accent transition-colors"
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation() // REF MCP #3: Prevent VideoCard click
          setIsEditing(true)
        }}
        aria-label={`${fieldName}: ${displayValue}, click to edit`} // REF MCP #5: Screen reader context
      >
        {truncatedDisplay}
      </Badge>
    )
  }
)

TextSnippet.displayName = 'TextSnippet'
