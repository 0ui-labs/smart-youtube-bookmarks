/**
 * RatingConfigEditor Component
 *
 * Manages max_rating configuration for 'rating' field type.
 * Provides numeric input with 1-10 range validation.
 *
 * Backend validation rules (from backend/app/schemas/custom_field.py):
 * - max_rating must be integer
 * - Range: 1 ≤ max_rating ≤ 10
 *
 * REF MCP Improvements (Task #123):
 * - Field component pattern (2025 shadcn/ui, NOT deprecated Form)
 * - aria-invalid for error states
 * - role="alert" for error announcements
 * - German localization
 */

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Field, FieldLabel, FieldError, FieldDescription } from '@/components/ui/field'

interface RatingConfig {
  max_rating: number
}

export interface RatingConfigEditorProps {
  config: RatingConfig
  onChange: (config: RatingConfig) => void
  error?: string
}

/**
 * RatingConfigEditor - Manages max_rating config for 'rating' field type
 *
 * Features:
 * - Numeric input for max_rating (1-10 range)
 * - Real-time validation with visual feedback
 * - Keyboard navigation (arrow keys increment/decrement)
 * - Default value: 5 stars
 *
 * @example
 * ```tsx
 * <RatingConfigEditor
 *   config={{ max_rating: 5 }}
 *   onChange={(config) => setConfig(config)}
 * />
 * ```
 */
export function RatingConfigEditor({
  config,
  onChange,
  error,
}: RatingConfigEditorProps) {
  const [localError, setLocalError] = useState<string | null>(null)

  /**
   * Validate and update max_rating
   * Ensures: integer, 1-10 range
   */
  const handleChange = (value: string) => {
    // Allow empty string for typing experience
    if (value === '') {
      setLocalError('Bitte geben Sie eine Zahl zwischen 1 und 10 ein')
      return
    }

    const num = parseInt(value, 10)

    // Validate: is integer
    if (isNaN(num) || !Number.isInteger(num)) {
      setLocalError('Bitte geben Sie eine ganze Zahl ein')
      return
    }

    // Validate: 1-10 range
    if (num < 1 || num > 10) {
      setLocalError('Maximale Bewertung muss zwischen 1 und 10 liegen')
      return
    }

    // Valid - clear error and update
    setLocalError(null)
    onChange({ max_rating: num })
  }

  const hasError = !!(localError || error)

  return (
    <Field data-invalid={hasError}>
      <FieldLabel htmlFor="max-rating-input">
        Maximale Bewertung *
      </FieldLabel>

      <div className="flex items-center gap-3">
        <Input
          id="max-rating-input"
          type="number"
          min={1}
          max={10}
          step={1}
          value={config.max_rating}
          onChange={(e) => handleChange(e.target.value)}
          className="w-24"
          aria-invalid={hasError}
          aria-describedby={
            hasError ? 'rating-error rating-description' : 'rating-description'
          }
        />

        <span className="text-sm text-muted-foreground">
          (1-{config.max_rating} Sterne)
        </span>
      </div>

      {/* Error Messages */}
      {localError && (
        <FieldError errors={[{ message: localError }]} />
      )}

      {error && (
        <FieldError errors={[{ message: error }]} />
      )}

      {/* Helper Text */}
      {!localError && !error && (
        <FieldDescription id="rating-description">
          Geben Sie die maximale Anzahl der Sterne ein (1-10). Standard: 5 Sterne.
        </FieldDescription>
      )}
    </Field>
  )
}
