import { useId } from 'react'
import { cn } from '@/lib/utils'
import { Field, FieldError } from '@/components/ui/field'

interface BooleanEditorProps {
  value: boolean | null
  label: string // Field name
  onChange: (value: boolean) => void
  disabled?: boolean
  error?: string
  className?: string
}

/**
 * BooleanEditor - Checkbox input with Field Component Pattern
 *
 * Features:
 * - Native checkbox with accessible label
 * - Null value treated as false (unchecked)
 * - Loading state (disabled checkbox)
 * - Error state with Field Component Pattern
 * - Keyboard accessible (Space/Enter toggle)
 *
 * Pattern: Field Component Pattern (CLAUDE.md requirement)
 */
export const BooleanEditor = ({
  value,
  label,
  onChange,
  disabled = false,
  error,
  className,
}: BooleanEditorProps) => {
  const isChecked = value === true
  const checkboxId = useId()

  return (
    <Field data-invalid={!!error} className={className}>
      <div className="flex items-center gap-2">
        <input
          id={checkboxId}
          type="checkbox"
          checked={isChecked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          aria-invalid={!!error}
          className={cn(
            'h-4 w-4 rounded border-gray-300 text-primary',
            'focus:ring-2 focus:ring-ring focus:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-red-500'
          )}
        />
        <label
          htmlFor={checkboxId}
          className={cn(
            'text-sm font-medium leading-none cursor-pointer',
            disabled && 'cursor-not-allowed opacity-50',
            error && 'text-red-600'
          )}
        >
          {label}
        </label>
      </div>
      {error && <FieldError errors={[{ message: error }]} />}
    </Field>
  )
}
