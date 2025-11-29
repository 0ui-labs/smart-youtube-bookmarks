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

import { GripVertical, Plus, X } from "lucide-react";
import { useState } from "react";
import { type Control, useFieldArray } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export interface SelectConfigEditorProps {
  control: Control<any>;
  error?: string;
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
    name: "config.options",
  });

  const [newOption, setNewOption] = useState("");
  const [duplicateError, setDuplicateError] = useState<string | null>(null);

  /**
   * Add new option to the list
   * Validates: non-empty, no duplicates (case-insensitive)
   */
  const handleAddOption = () => {
    const trimmed = newOption.trim();

    if (!trimmed) {
      setDuplicateError("Option darf nicht leer sein");
      return;
    }

    // Check for duplicates (case-insensitive)
    const isDuplicate = fields.some(
      (field: any) => field.value.toLowerCase() === trimmed.toLowerCase()
    );

    if (isDuplicate) {
      setDuplicateError("Diese Option existiert bereits");
      return;
    }

    // Add option and clear input
    append({ value: trimmed });
    setNewOption("");
    setDuplicateError(null);
  };

  /**
   * Remove option by index
   * Validates: min 1 option must remain
   */
  const handleRemoveOption = (index: number) => {
    if (fields.length <= 1) {
      // Cannot remove last option - this should be prevented by UI
      return;
    }

    remove(index);
  };

  /**
   * Update existing option (for inline editing)
   */
  const handleUpdateOption = (index: number, value: string) => {
    update(index, { value });
  };

  /**
   * Handle Enter key in new option input
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddOption();
    }
  };

  const hasError = !!(duplicateError || error);

  return (
    <Field data-invalid={hasError}>
      <FieldLabel>Optionen *</FieldLabel>

      {/* Existing Options List */}
      <div className="space-y-2">
        {fields.length === 0 && (
          <p className="text-muted-foreground text-sm italic">
            Noch keine Optionen. Fügen Sie mindestens eine Option hinzu.
          </p>
        )}

        {fields.map((field: any, index) => (
          <div
            className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2"
            key={field.id}
          >
            {/* Drag Handle (visual only for now, drag-drop in future iteration) */}
            <GripVertical
              aria-hidden="true"
              className="h-4 w-4 text-muted-foreground"
            />

            {/* Option Value (inline editable) */}
            <Input
              aria-label={`Option ${index + 1}`}
              className="flex-1 rounded border-none bg-transparent px-2 py-1 focus:ring-2 focus:ring-primary"
              onBlur={(e) => {
                // Trim whitespace on blur
                const trimmed = e.target.value.trim();
                if (trimmed !== field.value) {
                  // Check for duplicates (excluding current field)
                  const isDuplicate = fields.some(
                    (f: any, idx) =>
                      idx !== index &&
                      f.value.toLowerCase() === trimmed.toLowerCase()
                  );

                  if (isDuplicate) {
                    // Revert to original value
                    handleUpdateOption(index, field.value);
                    return;
                  }

                  handleUpdateOption(index, trimmed);
                }
              }}
              onChange={(e) => handleUpdateOption(index, e.target.value)}
              type="text"
              value={field.value}
            />

            {/* Remove Button */}
            <Button
              className="h-8 w-8 p-0"
              disabled={fields.length <= 1}
              onClick={() => handleRemoveOption(index)}
              size="sm"
              type="button"
              variant="ghost"
            >
              <X aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
              <span className="sr-only">Option {index + 1} entfernen</span>
            </Button>
          </div>
        ))}
      </div>

      {/* Add New Option Input */}
      <div className="flex items-center gap-2">
        <Input
          aria-describedby={hasError ? "option-error" : undefined}
          aria-invalid={hasError}
          aria-label="Neue Option"
          onChange={(e) => {
            setNewOption(e.target.value);
            setDuplicateError(null); // Clear error on typing
          }}
          onKeyDown={handleKeyDown}
          placeholder="Neue Option hinzufügen..."
          type="text"
          value={newOption}
        />

        <Button
          onClick={handleAddOption}
          size="sm"
          type="button"
          variant="outline"
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
          <span className="sr-only">Option hinzufügen</span>
        </Button>
      </div>

      {/* Error Messages */}
      {duplicateError && <FieldError errors={[{ message: duplicateError }]} />}

      {error && <FieldError errors={[{ message: error }]} />}

      {/* Helper Text */}
      {!hasError && (
        <FieldDescription>
          Fügen Sie Optionen hinzu, die Benutzer auswählen können (z.B.
          "schlecht", "gut", "sehr gut")
        </FieldDescription>
      )}
    </Field>
  );
}
