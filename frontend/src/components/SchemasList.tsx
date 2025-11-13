import { SchemaCard } from './SchemaCard'
import type { FieldSchemaResponse } from '@/types/schema'

export interface SchemasListProps {
  schemas: FieldSchemaResponse[]
  onEdit: (schemaId: string) => void
  onDelete: (schemaId: string) => void
  onDuplicate: (schemaId: string) => void
}

/**
 * SchemasList - Grid of schema cards
 *
 * Displays all schemas in a responsive grid layout.
 * Each card shows schema details and action menu.
 *
 * Responsive grid:
 * - Mobile: 1 column
 * - Tablet (md): 2 columns
 * - Desktop (lg): 3 columns
 *
 * Follows Dashboard pattern (grid layout with cards).
 *
 * @example
 * <SchemasList
 *   schemas={schemas}
 *   onEdit={(id) => openEditor(id)}
 *   onDelete={(id) => confirmDelete(id)}
 *   onDuplicate={(id) => duplicateSchema(id)}
 * />
 */
export function SchemasList({
  schemas,
  onEdit,
  onDelete,
  onDuplicate,
}: SchemasListProps) {
  // TODO: Fetch tag counts for each schema (Task #136)
  // For now, use placeholder count of 0
  const getTagCount = (schemaId: string): number => {
    // Placeholder: Real implementation will query tags table
    return 0
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {schemas.map((schema) => (
        <SchemaCard
          key={schema.id}
          schema={schema}
          onEdit={onEdit}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
          tagCount={getTagCount(schema.id)}
        />
      ))}
    </div>
  )
}
