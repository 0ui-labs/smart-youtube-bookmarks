import React from 'react'

export interface BooleanCheckboxProps {
  /**
   * Current boolean value (null treated as false)
   */
  value: boolean | null
  /**
   * Field name for label and accessibility
   */
  fieldName: string
  /**
   * Whether the field is editable
   */
  readonly?: boolean
  /**
   * Callback when value changes
   */
  onChange?: (value: boolean) => void
  /**
   * Optional custom CSS class
   */
  className?: string
}

/**
 * BooleanCheckbox Component
 *
 * Native checkbox input with label for boolean field values.
 * Uses native HTML <input type="checkbox"> for maximum compatibility
 * and accessibility.
 *
 * REF MCP Improvements Applied:
 * - #3 (Event Propagation): stopPropagation on all interactive events
 * - #4 (Performance): Wrapped in React.memo()
 * - #5 (Accessibility): Complete ARIA labels with checked state
 *
 * @example
 * // Editable checkbox
 * <BooleanCheckbox
 *   value={true}
 *   fieldName="Recommended"
 *   onChange={(newValue) => console.log(newValue)}
 * />
 *
 * @example
 * // Read-only checkbox
 * <BooleanCheckbox
 *   value={false}
 *   fieldName="Watched"
 *   readonly
 * />
 */
export const BooleanCheckbox = React.memo<BooleanCheckboxProps>(
  ({ value, fieldName, readonly = false, onChange, className = '' }) => {
    const checked = value ?? false // Treat null as false
    const id = React.useId()
    const checkboxId = `${id}-${fieldName}`

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      e.stopPropagation() // REF MCP #3: Prevent event bubbling
      onChange?.(e.target.checked)
    }

    const handleClick = (e: React.MouseEvent<HTMLInputElement>) => {
      e.stopPropagation() // REF MCP #3: Prevent event bubbling
    }

    const handleLabelClick = (e: React.MouseEvent<HTMLLabelElement>) => {
      e.stopPropagation() // REF MCP #3: Prevent event bubbling
    }

    return (
      <div
        className={`flex items-center gap-2 ${className}`}
        onClick={(e) => e.stopPropagation()} // REF MCP #3: Prevent VideoCard click
      >
        <input
          id={checkboxId}
          type="checkbox"
          checked={checked}
          disabled={readonly}
          onChange={handleChange}
          onClick={handleClick}
          aria-label={`${fieldName}: ${checked ? 'checked' : 'unchecked'}`} // REF MCP #5: Screen reader context
          className="w-4 h-4 accent-blue-600 rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <label
          htmlFor={checkboxId}
          className={`text-sm ${readonly ? 'cursor-default' : 'cursor-pointer'}`}
          onClick={handleLabelClick}
        >
          {fieldName}
        </label>
      </div>
    )
  }
)

BooleanCheckbox.displayName = 'BooleanCheckbox'
