/**
 * FieldConfigEditor Component (Placeholder for Task #124)
 *
 * This is a placeholder implementation to unblock Task #123.
 * The full implementation will be done in Task #124.
 *
 * TODO Task #124: Implement type-specific config editors:
 * - SelectConfigEditor: Multi-input for options with add/remove
 * - RatingConfigEditor: Number input for max_rating with slider
 * - TextConfigEditor: Optional max_length input
 * - BooleanConfigEditor: Info text (no config needed)
 */

import type { FieldConfig, FieldType } from "@/types/customField";

interface FieldConfigEditorProps {
  fieldType: FieldType;
  config: FieldConfig;
  onChange: (config: FieldConfig) => void;
  errors?: Record<string, string>;
}

export const FieldConfigEditor = ({
  fieldType,
  config,
  onChange: _onChange,
  errors: _errors,
}: FieldConfigEditorProps) => (
  <div className="rounded-md border bg-muted/50 p-3">
    <p className="text-muted-foreground text-sm">
      FieldConfigEditor for type "{fieldType}" (Task #124 pending)
    </p>
    <pre className="mt-2 rounded bg-background p-2 text-xs">
      {JSON.stringify(config, null, 2)}
    </pre>
  </div>
);
