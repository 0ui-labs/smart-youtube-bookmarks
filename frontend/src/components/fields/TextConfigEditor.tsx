/**
 * TextConfigEditor Component
 *
 * Manages optional max_length configuration for 'text' field type.
 * Provides checkbox toggle with numeric input.
 *
 * Backend validation rules (from backend/app/schemas/custom_field.py):
 * - max_length is optional (undefined = unlimited)
 * - If specified: max_length ≥ 1
 *
 * REF MCP Improvements (Task #123):
 * - Field component pattern (2025 shadcn/ui, NOT deprecated Form)
 * - aria-invalid for error states
 * - role="alert" for error announcements
 * - German localization
 */

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldLabel, FieldError, FieldDescription } from '@/components/ui/field'

interface TextConfig {
  max_length?: number
}

export interface TextConfigEditorProps {
  config: TextConfig
  onChange: (config: TextConfig) => void
  error?: string
}

/**
 * TextConfigEditor - Manages optional max_length config for 'text' field type
 *
 * Features:
 * - Optional max_length input (≥1 if specified)
 * - Clear UX for "unlimited" vs "limited" state
 * - Checkbox to toggle max_length constraint
 * - Numeric input only when enabled
 *
 * @example
 * ```tsx
 * // Unlimited text
 * <TextConfigEditor
 *   config={{}}
 *   onChange={(config) => setConfig(config)}
 * />
 *
 * // Limited to 500 characters
 * <TextConfigEditor
 *   config={{ max_length: 500 }}
 *   onChange={(config) => setConfig(config)}
 * />
 * ```
 */
export function TextConfigEditor({
  config,
  onChange,
  error,
}: TextConfigEditorProps) {
  const hasMaxLength = config.max_length !== undefined
  const [localError, setLocalError] = useState<string | null>(null)

  /**
   * Toggle max_length constraint on/off
   */
  const handleToggle = (checked: boolean) => {
    if (checked) {
      // Enable with default 500 characters
      onChange({ max_length: 500 })
    } else {
      // Disable (remove max_length)
      onChange({})
    }
    setLocalError(null)
  }

  /**
   * Update max_length value
   * Validates: ≥1 if specified
   */
  const handleChange = (value: string) => {
    // Allow empty for typing
    if (value === '') {
      setLocalError('Bitte geben Sie eine Zahl ≥ 1 ein')
      return
    }

    const num = parseInt(value, 10)

    // Validate: is integer
    if (isNaN(num) || !Number.isInteger(num)) {
      setLocalError('Bitte geben Sie eine ganze Zahl ein')
      return
    }

    // Validate: ≥1
    if (num < 1) {
      setLocalError('Maximale Länge muss mindestens 1 sein')
      return
    }

    // Valid - clear error and update
    setLocalError(null)
    onChange({ max_length: num })
  }

  const hasError = !!(localError || error)

  return (
    <div className="space-y-3">
      <FieldLabel>
        Maximale Länge (optional)
      </FieldLabel>

      {/* Toggle Checkbox */}
      <div className="flex items-center gap-2">
        <Checkbox
          id="max-length-toggle"
          checked={hasMaxLength}
          onCheckedChange={handleToggle}
        />
        <label
          htmlFor="max-length-toggle"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          Zeichenlimit festlegen
        </label>
      </div>

      {/* Numeric Input (only shown when enabled) */}
      {hasMaxLength && (
        <Field data-invalid={hasError} className="pl-6">
          <div className="flex items-center gap-3">
            <Input
              id="max-length-input"
              type="number"
              min={1}
              step={1}
              value={config.max_length}
              onChange={(e) => handleChange(e.target.value)}
              className="w-32"
              aria-label="Maximale Zeichenanzahl"
              aria-invalid={hasError}
              aria-describedby="text-description"
            />

            <span className="text-sm text-muted-foreground">Zeichen</span>
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
            <FieldDescription id="text-description">
              Benutzer können bis zu {config.max_length} Zeichen eingeben
            </FieldDescription>
          )}
        </Field>
      )}

      {/* Helper Text (when disabled) */}
      {!hasMaxLength && (
        <p className="text-sm text-muted-foreground">
          Keine Längenbeschränkung - Benutzer können beliebig viel Text eingeben
        </p>
      )}
    </div>
  )
}
