import { SchemaCard } from './SchemaCard'
import type { FieldSchemaResponse } from '@/types/schema'

export interface SchemasListProps {
  schemas: FieldSchemaResponse[]
  listId: string
}

/**
 * SchemasList - Grid of schema cards
 *
 * Displays all schemas in a responsive grid layout.
 * Each card shows schema details and integrated action dialogs.
 *
 * Responsive grid:
 * - Mobile: 1 column
 * - Tablet (md): 2 columns
 * - Desktop (lg): 3 columns
 *
 * Follows Dashboard pattern (grid layout with cards).
 *
 * SchemaCard handles all mutations internally (edit/delete/duplicate/usage stats).
 *
 * @example
 * <SchemasList
 *   schemas={schemas}
 *   listId={listId}
 * />
 */
export function SchemasList({ schemas, listId }: SchemasListProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {schemas.map((schema) => (
        <SchemaCard key={schema.id} schema={schema} listId={listId} />
      ))}
    </div>
  )
}
