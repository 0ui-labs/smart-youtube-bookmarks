import { Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSchema } from '@/hooks/useSchemas'
import { FieldTypeBadge } from './FieldTypeBadge'

interface WorkspaceFieldsCardProps {
  listId: string
  defaultSchemaId: string | null
  onEdit: () => void
}

/**
 * Card displaying workspace-level fields that apply to all videos.
 *
 * Features:
 * - Visual distinction with blue gradient background
 * - Home icon to indicate workspace-level scope
 * - Edit button to open WorkspaceFieldsEditor
 * - Shows field count and list when schema exists
 * - Empty state when no fields defined
 *
 * @example
 * ```tsx
 * <WorkspaceFieldsCard
 *   listId={currentList.id}
 *   defaultSchemaId={currentList.default_schema_id}
 *   onEdit={() => setWorkspaceEditorOpen(true)}
 * />
 * ```
 */
export function WorkspaceFieldsCard({
  listId,
  defaultSchemaId,
  onEdit,
}: WorkspaceFieldsCardProps) {
  // Fetch schema with nested fields (only if defaultSchemaId exists)
  const { data: schema, isLoading } = useSchema(listId, defaultSchemaId ?? undefined)

  // Get sorted fields from schema
  const fields = schema?.schema_fields
    ?.slice()
    .sort((a, b) => a.display_order - b.display_order)
    .map((sf) => sf.field) ?? []

  return (
    <div className="rounded-lg border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Home className="h-5 w-5 text-blue-600" />
          <h3 className="font-medium">Alle Videos</h3>
        </div>
        <Button variant="outline" size="sm" onClick={onEdit}>
          Bearbeiten
        </Button>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Diese Felder haben alle Videos
      </p>

      {/* Field list or empty state */}
      {isLoading ? (
        <p className="mt-3 text-sm text-muted-foreground">Lade Felder...</p>
      ) : fields.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {fields.map((field) => (
            <li key={field.id} className="flex items-center gap-2 text-sm">
              <span>•</span>
              <span>{field.name}</span>
              <FieldTypeBadge fieldType={field.field_type} className="text-[10px] px-1.5 py-0" />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground italic">
          Keine Felder definiert
        </p>
      )}

      {/* Field count */}
      <p className="mt-2 text-xs text-muted-foreground">
        ({fields.length} {fields.length === 1 ? 'Feld' : 'Felder'} definiert)
      </p>
    </div>
  )
}
