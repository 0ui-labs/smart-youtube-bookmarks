/**
 * SelectConfigEditor Component
 *
 * Manages dynamic options list for 'select' field type.
 * Provides add/remove/edit functionality for dropdown options.
 *
 * Backend validation rules (from backend/app/schemas/custom_field.py):
 * - Minimum 1 option required
 * - All options must be non-empty strings
 * - Whitespace trimmed automatically
 *
 * REF MCP Improvements (Task #123 + #124):
 * - useFieldArray hook for array state management (NOT manual state)
 * - Icon accessibility: aria-hidden on icons, sr-only span on buttons
 * - Field component pattern (2025 shadcn/ui, NOT deprecated Form)
 * - German localization
 */

import { useState } from 'react'
import { useFieldArray, Control } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldLabel, FieldError, FieldDescription } from '@/components/ui/field'
import { Plus, X, GripVertical } from 'lucide-react'

export interface SelectConfigEditorProps {
  control: Control<any>
  error?: string
}

/**
 * SelectConfigEditor - Manages dynamic options list for 'select' field type
 *
 * CRITICAL: Uses useFieldArray hook for proper React Hook Form integration
 * (NOT manual array state management)
 *
 * Features:
 * - Add new options with inline input
 * - Remove individual options (min 1 required)
 * - Inline editing of existing options
 * - Real-time duplicate detection (case-insensitive)
 * - Auto-trim whitespace on blur
 * - Empty state with helpful message
 *
 * @example
 * ```tsx
 * <SelectConfigEditor
 *   control={form.control}
 *   error={errors.config?.options?.message}
 * />
 * ```
 */
export function SelectConfigEditor({
  control,
  error,
}: SelectConfigEditorProps) {
  const { fields, append, remove, update } = useFieldArray({
    control,
    name: 'config.options',
  })

  const [newOption, setNewOption] = useState('')
  const [duplicateError, setDuplicateError] = useState<string | null>(null)

  /**
   * Add new option to the list
   * Validates: non-empty, no duplicates (case-insensitive)
   */
  const handleAddOption = () => {
    const trimmed = newOption.trim()

    if (!trimmed) {
      setDuplicateError('Option darf nicht leer sein')
      return
    }

    // Check for duplicates (case-insensitive)
    const isDuplicate = fields.some(
      (field: any) => field.value.toLowerCase() === trimmed.toLowerCase()
    )

    if (isDuplicate) {
      setDuplicateError('Diese Option existiert bereits')
      return
    }

    // Add option and clear input
    append({ value: trimmed })
    setNewOption('')
    setDuplicateError(null)
  }

  /**
   * Remove option by index
   * Validates: min 1 option must remain
   */
  const handleRemoveOption = (index: number) => {
    if (fields.length <= 1) {
      // Cannot remove last option - this should be prevented by UI
      return
    }

    remove(index)
  }

  /**
   * Update existing option (for inline editing)
   */
  const handleUpdateOption = (index: number, value: string) => {
    update(index, { value })
  }

  /**
   * Handle Enter key in new option input
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddOption()
    }
  }

  const hasError = !!(duplicateError || error)

  return (
    <Field data-invalid={hasError}>
      <FieldLabel>Optionen *</FieldLabel>

      {/* Existing Options List */}
      <div className="space-y-2">
        {fields.length === 0 && (
          <p className="text-sm text-muted-foreground italic">
            Noch keine Optionen. Fügen Sie mindestens eine Option hinzu.
          </p>
        )}

        {fields.map((field: any, index) => (
          <div
            key={field.id}
            className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2"
          >
            {/* Drag Handle (visual only for now, drag-drop in future iteration) */}
            <GripVertical className="h-4 w-4 text-muted-foreground" aria-hidden="true" />

            {/* Option Value (inline editable) */}
            <Input
              type="text"
              value={field.value}
              onChange={(e) => handleUpdateOption(index, e.target.value)}
              onBlur={(e) => {
                // Trim whitespace on blur
                const trimmed = e.target.value.trim()
                if (trimmed !== field.value) {
                  // Check for duplicates (excluding current field)
                  const isDuplicate = fields.some(
                    (f: any, idx) => idx !== index && f.value.toLowerCase() === trimmed.toLowerCase()
                  )

                  if (isDuplicate) {
                    // Revert to original value
                    handleUpdateOption(index, field.value)
                    return
                  }

                  handleUpdateOption(index, trimmed)
                }
              }}
              className="flex-1 bg-transparent border-none focus:ring-2 focus:ring-primary rounded px-2 py-1"
              aria-label={`Option ${index + 1}`}
            />

            {/* Remove Button */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleRemoveOption(index)}
              disabled={fields.length <= 1}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <span className="sr-only">Option {index + 1} entfernen</span>
            </Button>
          </div>
        ))}
      </div>

      {/* Add New Option Input */}
      <div className="flex items-center gap-2">
        <Input
          type="text"
          value={newOption}
          onChange={(e) => {
            setNewOption(e.target.value)
            setDuplicateError(null) // Clear error on typing
          }}
          onKeyDown={handleKeyDown}
          placeholder="Neue Option hinzufügen..."
          aria-label="Neue Option"
          aria-invalid={hasError}
          aria-describedby={hasError ? 'option-error' : undefined}
        />

        <Button
          type="button"
          onClick={handleAddOption}
          variant="outline"
          size="sm"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Option hinzufügen</span>
        </Button>
      </div>

      {/* Error Messages */}
      {duplicateError && (
        <FieldError errors={[{ message: duplicateError }]} />
      )}

      {error && (
        <FieldError errors={[{ message: error }]} />
      )}

      {/* Helper Text */}
      {!hasError && (
        <FieldDescription>
          Fügen Sie Optionen hinzu, die Benutzer auswählen können (z.B. "schlecht", "gut", "sehr gut")
        </FieldDescription>
      )}
    </Field>
  )
}
