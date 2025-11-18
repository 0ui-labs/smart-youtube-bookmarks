/**
 * SchemaSelector Component
 *
 * Reusable dropdown selector for choosing field schemas.
 * Supports three modes: no schema, existing schema, or create new schema.
 *
 * @example
 * ```tsx
 * <SchemaSelector
 *   value={schemaId}
 *   schemas={schemas}
 *   onChange={(newSchemaId) => setSchemaId(newSchemaId)}
 *   disabled={false}
 * />
 * ```
 */
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface FieldSchema {
  id: string
  name: string
  description?: string | null
}

interface SchemaSelectorProps {
  value: string | null
  schemas: FieldSchema[]
  onChange: (value: string | null) => void
  disabled?: boolean
}

export const SchemaSelector = ({
  value,
  schemas,
  onChange,
  disabled = false,
}: SchemaSelectorProps) => {
  // DEFENSIVE: Handle null AND undefined to prevent React warnings
  // When value is null, we use special "__none__" value (Radix doesn't allow empty string)
  const selectValue = value === null ? '__none__' : (value ?? '__none__')

  const handleValueChange = (newValue: string) => {
    // Convert "__none__" back to null for "Kein Schema"
    onChange(newValue === '__none__' ? null : newValue)
  }

  return (
    <Select value={selectValue} onValueChange={handleValueChange} disabled={disabled}>
      <SelectTrigger className="w-full" aria-label="Schema auswählen">
        <SelectValue placeholder="Kein Schema" />
      </SelectTrigger>
      <SelectContent>
        {/* Option 1: No Schema */}
        <SelectItem value="__none__">
          <span className="text-gray-600">Kein Schema</span>
        </SelectItem>

        {/* Option 2: Existing Schemas */}
        {schemas.length > 0 && (
          <>
            {schemas.map((schema) => (
              <SelectItem key={schema.id} value={schema.id}>
                <div className="flex flex-col">
                  <span>{schema.name}</span>
                  {schema.description && (
                    <span className="text-xs text-gray-500">{schema.description}</span>
                  )}
                </div>
              </SelectItem>
            ))}
          </>
        )}

        {/* Option 3: Create New Schema (Task #83) */}
        <SelectItem value="new">
          <span className="text-blue-600 font-medium">+ Neues Schema erstellen</span>
        </SelectItem>
      </SelectContent>
    </Select>
  )
}
