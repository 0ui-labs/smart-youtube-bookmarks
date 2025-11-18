import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import type { UnusedSchemaStat } from '@/types/analytics'
import { formatDistanceToNow } from 'date-fns'

export interface UnusedSchemasTableProps {
  data: UnusedSchemaStat[]
  onDelete?: (schemaId: string) => void
}

/**
 * UnusedSchemasTable - Table showing schemas with no usage.
 *
 * Features:
 * - Displays schemas with 0 tags or 0 field values
 * - Shows reason (no tags / no values)
 * - Delete action button with confirmation
 * - Sortable columns (future enhancement)
 * - Empty state when all schemas are in use
 *
 * Design Patterns:
 * - Uses shadcn/ui Table components
 * - Badge for reason indicator
 * - Trash icon for delete action
 *
 * @example
 * <UnusedSchemasTable
 *   data={analytics.unused_schemas}
 *   onDelete={(id) => confirmDeleteSchema(id)}
 * />
 */
export function UnusedSchemasTable({ data, onDelete }: UnusedSchemasTableProps) {
  // Empty state
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Unused Schemas</CardTitle>
          <CardDescription>All schemas are in use</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32 text-gray-400">
            <p>No unused schemas found</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const formatLastUsed = (lastUsed: string | null): string => {
    if (!lastUsed) return 'Never'
    try {
      return formatDistanceToNow(new Date(lastUsed), { addSuffix: true })
    } catch {
      return 'Unknown'
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Unused Schemas</CardTitle>
        <CardDescription>
          {data.length} schema{data.length === 1 ? '' : 's'} not actively used
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left p-3 font-semibold">Schema Name</th>
                <th className="text-left p-3 font-semibold">Fields</th>
                <th className="text-left p-3 font-semibold">Tags</th>
                <th className="text-left p-3 font-semibold">Reason</th>
                <th className="text-left p-3 font-semibold">Last Used</th>
                {onDelete && <th className="text-right p-3 font-semibold">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {data.map((schema) => (
                <tr key={schema.schema_id} className="border-b hover:bg-gray-50">
                  <td className="p-3">{schema.schema_name}</td>
                  <td className="p-3">{schema.field_count}</td>
                  <td className="p-3">{schema.tag_count}</td>
                  <td className="p-3">
                    <Badge variant={schema.reason === 'no_tags' ? 'destructive' : 'secondary'}>
                      {schema.reason === 'no_tags' ? 'No Tags' : 'No Values'}
                    </Badge>
                  </td>
                  <td className="p-3 text-gray-600 text-sm">
                    {formatLastUsed(schema.last_used)}
                  </td>
                  {onDelete && (
                    <td className="p-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(schema.schema_id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
