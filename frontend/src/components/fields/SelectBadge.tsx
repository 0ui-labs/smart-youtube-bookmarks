import React from 'react'
import { ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export interface SelectBadgeProps {
  /**
   * Current selected value
   */
  value: string | null
  /**
   * Available options to select from
   */
  options: string[]
  /**
   * Field name for accessibility
   */
  fieldName: string
  /**
   * Whether the field is editable
   */
  readonly?: boolean
  /**
   * Callback when value changes
   */
  onChange?: (value: string) => void
}

/**
 * SelectBadge Component
 *
 * Badge-style dropdown selector with accessibility support.
 *
 * REF MCP Improvements Applied:
 * - #3 (Event Propagation): stopPropagation on all interactive events
 * - #4 (Performance): Wrapped in React.memo()
 * - #5 (Accessibility): Complete ARIA labels with current value and action hint
 *
 * @example
 * // Editable select
 * <SelectBadge
 *   value="good"
 *   options={['bad', 'good', 'great']}
 *   fieldName="Quality"
 *   onChange={(newValue) => console.log(newValue)}
 * />
 *
 * @example
 * // Read-only select
 * <SelectBadge
 *   value="great"
 *   options={['bad', 'good', 'great']}
 *   fieldName="Quality"
 *   readonly
 * />
 */
export const SelectBadge = React.memo<SelectBadgeProps>(
  ({ value, options, fieldName, readonly = false, onChange }) => {
    const displayValue = value || 'not set'

    if (readonly) {
      return (
        <Badge
          variant="secondary"
          className="cursor-default"
          onClick={(e: React.MouseEvent) => e.stopPropagation()} // REF MCP #3: Prevent VideoCard click
        >
          {displayValue}
        </Badge>
      )
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          onClick={(e) => e.stopPropagation()} // REF MCP #3: Prevent VideoCard click
          aria-label={`${fieldName}: ${displayValue}, click to change`} // REF MCP #5: Screen reader context
          asChild
        >
          <Badge
            variant="outline"
            className="cursor-pointer hover:bg-accent transition-colors"
          >
            {displayValue}
            <ChevronDown className="ml-1 h-3 w-3" />
          </Badge>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          onClick={(e) => e.stopPropagation()} // REF MCP #3: Prevent VideoCard click
          align="start"
        >
          {options.map((option) => (
            <DropdownMenuItem
              key={option}
              onClick={(e) => {
                e.stopPropagation() // REF MCP #3: Prevent VideoCard click
                onChange?.(option)
              }}
              className={value === option ? 'bg-accent' : ''}
            >
              {option}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }
)

SelectBadge.displayName = 'SelectBadge'
