import { cn } from '@/lib/utils'
import { Field, FieldError } from '@/components/ui/field'

interface TextEditorProps {
  value: string | null
  maxLength?: number | null // From TextConfig.max_length (optional)
  onChange: (value: string) => void
  disabled?: boolean
  error?: string
  className?: string
}

/**
 * TextEditor - Single-line text input with Field Component Pattern
 *
 * Features:
 * - Native text input
 * - Optional max_length enforcement
 * - Character counter when max_length set
 * - Loading state (disabled input)
 * - Error state with Field Component Pattern
 * - German placeholder "Text eingeben..."
 *
 * Pattern: Field Component Pattern (CLAUDE.md requirement)
 */
export const TextEditor = ({
  value,
  maxLength,
  onChange,
  disabled = false,
  error,
  className,
}: TextEditorProps) => {
  const currentLength = value?.length ?? 0
  const showCounter = maxLength !== null && maxLength !== undefined

  return (
    <Field data-invalid={!!error} className={className}>
      <input
        type="text"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength ?? undefined}
        disabled={disabled}
        placeholder="Text eingeben..."
        aria-invalid={!!error}
        className={cn(
          'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error && 'border-red-500'
        )}
      />
      <div className="flex items-center justify-between mt-1">
        {error && <FieldError errors={[{ message: error }]} />}
        {showCounter && (
          <p className={cn(
            'text-xs text-muted-foreground ml-auto',
            error && 'text-red-600'
          )}>
            {currentLength} / {maxLength}
          </p>
        )}
      </div>
    </Field>
  )
}
