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

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

interface TextConfig {
  max_length?: number;
}

export interface TextConfigEditorProps {
  config: TextConfig;
  onChange: (config: TextConfig) => void;
  error?: string;
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
  const hasMaxLength = config.max_length !== undefined;
  const [localError, setLocalError] = useState<string | null>(null);

  /**
   * Toggle max_length constraint on/off
   */
  const handleToggle = (checked: boolean) => {
    if (checked) {
      // Enable with default 500 characters
      onChange({ max_length: 500 });
    } else {
      // Disable (remove max_length)
      onChange({});
    }
    setLocalError(null);
  };

  /**
   * Update max_length value
   * Validates: ≥1 if specified
   */
  const handleChange = (value: string) => {
    // Allow empty for typing
    if (value === "") {
      setLocalError("Bitte geben Sie eine Zahl ≥ 1 ein");
      return;
    }

    const num = Number.parseInt(value, 10);

    // Validate: is integer
    if (Number.isNaN(num) || !Number.isInteger(num)) {
      setLocalError("Bitte geben Sie eine ganze Zahl ein");
      return;
    }

    // Validate: ≥1
    if (num < 1) {
      setLocalError("Maximale Länge muss mindestens 1 sein");
      return;
    }

    // Valid - clear error and update
    setLocalError(null);
    onChange({ max_length: num });
  };

  const hasError = !!(localError || error);

  return (
    <div className="space-y-3">
      <FieldLabel>Maximale Länge (optional)</FieldLabel>

      {/* Toggle Checkbox */}
      <div className="flex items-center gap-2">
        <Checkbox
          checked={hasMaxLength}
          id="max-length-toggle"
          onCheckedChange={handleToggle}
        />
        <label
          className="font-medium text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          htmlFor="max-length-toggle"
        >
          Zeichenlimit festlegen
        </label>
      </div>

      {/* Numeric Input (only shown when enabled) */}
      {hasMaxLength && (
        <Field className="pl-6" data-invalid={hasError}>
          <div className="flex items-center gap-3">
            <Input
              aria-describedby="text-description"
              aria-invalid={hasError}
              aria-label="Maximale Zeichenanzahl"
              className="w-32"
              id="max-length-input"
              min={1}
              onChange={(e) => handleChange(e.target.value)}
              step={1}
              type="number"
              value={config.max_length}
            />

            <span className="text-muted-foreground text-sm">Zeichen</span>
          </div>

          {/* Error Messages */}
          {localError && <FieldError errors={[{ message: localError }]} />}

          {error && <FieldError errors={[{ message: error }]} />}

          {/* Helper Text */}
          {!(localError || error) && (
            <FieldDescription id="text-description">
              Benutzer können bis zu {config.max_length} Zeichen eingeben
            </FieldDescription>
          )}
        </Field>
      )}

      {/* Helper Text (when disabled) */}
      {!hasMaxLength && (
        <p className="text-muted-foreground text-sm">
          Keine Längenbeschränkung - Benutzer können beliebig viel Text eingeben
        </p>
      )}
    </div>
  );
}
