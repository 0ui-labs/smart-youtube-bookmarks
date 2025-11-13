import React from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioItem,
  DropdownMenuRadioGroup,
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
   * Whether the field is read-only
   */
  readonly?: boolean
  /**
   * Whether the field is disabled
   */
  disabled?: boolean
  /**
   * Callback when value changes
   */
  onChange?: (value: string) => void
  /**
   * Custom CSS class
   */
  className?: string
}

/**
 * SelectBadge Component
 *
 * Interactive badge component for selecting from predefined options.
 * Displays selected value in a badge with optional dropdown for editing.
 *
 * REF MCP Improvements Applied:
 * - #4 (Event Propagation): stopPropagation() on DropdownMenuRadioItem onClick to prevent VideoCard click
 * - #5 (Accessibility): aria-hidden="true" on Check icon to hide from screen readers
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
 *   value="good"
 *   options={['bad', 'good', 'great']}
 *   fieldName="Quality"
 *   readonly
 * />
 */
export const SelectBadge = React.memo<SelectBadgeProps>(
  ({
    value,
    options,
    fieldName,
    readonly = false,
    disabled = false,
    onChange,
    className,
  }) => {
    // Display value: use placeholder dash for null
    const displayValue = value ?? '—'

    // Read-only mode: static badge
    if (readonly) {
      return (
        <Badge
          variant="secondary"
          className={cn('cursor-default', className)}
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        >
          {displayValue}
        </Badge>
      )
    }

    // Editable mode: badge as dropdown trigger
    return (
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold',
              'border-transparent bg-secondary text-secondary-foreground',
              'hover:bg-secondary/80 transition-colors cursor-pointer',
              disabled && 'cursor-not-allowed opacity-50',
              className
            )}
            onClick={(e) => {
              e.stopPropagation()
              if (disabled) e.preventDefault()
            }}
            aria-label={`${fieldName}: ${displayValue}, click to edit`}
          >
            {displayValue}
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuRadioGroup value={value ?? ''}>
            {options.map((option) => (
              <DropdownMenuRadioItem
                key={option}
                value={option}
                onClick={(e) => {
                  // REF MCP #4: stopPropagation to prevent VideoCard click
                  e.stopPropagation()
                  if (onChange) {
                    onChange(option)
                  }
                }}
              >
                <span className="flex-1">{option}</span>
                {value === option && (
                  <Check
                    className="h-4 w-4 ml-2 shrink-0"
                    // REF MCP #5: aria-hidden="true" to hide icon from screen readers
                    aria-hidden="true"
                  />
                )}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }
)

SelectBadge.displayName = 'SelectBadge'
