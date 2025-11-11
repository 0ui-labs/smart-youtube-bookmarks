import React from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

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
}

/**
 * BooleanCheckbox Component
 *
 * Checkbox with label for boolean field values.
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
  ({ value, fieldName, readonly = false, onChange }) => {
    const checked = value ?? false // Treat null as false

    return (
      <div
        className="flex items-center gap-2"
        onClick={(e) => e.stopPropagation()} // REF MCP #3: Prevent VideoCard click
      >
        <Checkbox
          id={`checkbox-${fieldName}`}
          checked={checked}
          disabled={readonly}
          onCheckedChange={(checkedState) => {
            // checkedState can be boolean or 'indeterminate', we only handle boolean
            if (typeof checkedState === 'boolean') {
              onChange?.(checkedState)
            }
          }}
          onClick={(e) => e.stopPropagation()} // REF MCP #3: Prevent VideoCard click
          aria-label={`${fieldName}: ${checked ? 'checked' : 'unchecked'}`} // REF MCP #5: Screen reader context
        />
        <Label
          htmlFor={`checkbox-${fieldName}`}
          className={`text-sm ${readonly ? 'cursor-default' : 'cursor-pointer'}`}
          onClick={(e: React.MouseEvent) => e.stopPropagation()} // REF MCP #3: Prevent VideoCard click
        >
          {fieldName}
        </Label>
      </div>
    )
  }
)

BooleanCheckbox.displayName = 'BooleanCheckbox'
