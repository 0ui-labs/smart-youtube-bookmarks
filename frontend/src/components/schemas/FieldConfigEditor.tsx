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

import { FieldType, FieldConfig } from '@/types/customField'

interface FieldConfigEditorProps {
  fieldType: FieldType
  config: FieldConfig
  onChange: (config: FieldConfig) => void
  errors?: Record<string, string>
}

export const FieldConfigEditor = ({
  fieldType,
  config,
  onChange: _onChange,
  errors: _errors,
}: FieldConfigEditorProps) => {
  return (
    <div className="border rounded-md p-3 bg-muted/50">
      <p className="text-sm text-muted-foreground">
        FieldConfigEditor for type "{fieldType}" (Task #124 pending)
      </p>
      <pre className="text-xs mt-2 p-2 bg-background rounded">
        {JSON.stringify(config, null, 2)}
      </pre>
    </div>
  )
}
