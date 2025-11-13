import { MoreVertical, Edit, Trash2, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { FieldSchemaResponse } from '@/types/schema'

export interface SchemaCardProps {
  schema: FieldSchemaResponse
  onEdit: (schemaId: string) => void
  onDelete: (schemaId: string) => void
  onDuplicate: (schemaId: string) => void
  tagCount: number // Number of tags using this schema
}

/**
 * SchemaCard - Displays a schema summary with action menu
 *
 * Shows:
 * - Schema name and description
 * - Field count
 * - Tag usage count (warns if schema is in use)
 * - Action menu (Edit, Delete, Duplicate)
 *
 * Design follows JobProgressCard pattern with shadcn/ui Card component.
 *
 * Accessibility:
 * - Dynamic aria-label includes schema name for screen readers (WCAG 2.1 AA)
 * - Keyboard navigation support
 *
 * @example
 * <SchemaCard
 *   schema={schema}
 *   onEdit={(id) => openEditor(id)}
 *   onDelete={(id) => confirmDelete(id)}
 *   onDuplicate={(id) => duplicateSchema(id)}
 *   tagCount={5}
 * />
 */
export function SchemaCard({
  schema,
  onEdit,
  onDelete,
  onDuplicate,
  tagCount,
}: SchemaCardProps) {
  const fieldCount = schema.schema_fields.length

  return (
    <Card className="hover:shadow-lg transition-shadow duration-200">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="text-lg">{schema.name}</CardTitle>
            {schema.description && (
              <CardDescription className="mt-1">
                {schema.description}
              </CardDescription>
            )}
          </div>

          {/* Action Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label={`Actions for ${schema.name}`} // ✨ FIX #6: Schema-specific aria-label
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(schema.id)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDuplicate(schema.id)}>
                <Copy className="h-4 w-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(schema.id)}
                className="text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>{fieldCount} {fieldCount === 1 ? 'field' : 'fields'}</span>
          {tagCount > 0 && (
            <span className="text-blue-600 font-medium">
              Used by {tagCount} {tagCount === 1 ? 'tag' : 'tags'}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
