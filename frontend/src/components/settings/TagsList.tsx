import { TagActionsMenu } from './TagActionsMenu'
import { Badge } from '@/components/ui/badge'
import type { Tag } from '@/types/tag'

interface TagsListProps {
  tags: Tag[]
  onEdit: (tag: Tag) => void
  onDelete: (tag: Tag) => void
  isLoading?: boolean
}

/**
 * Table displaying all tags with actions
 *
 * Features:
 * - Columns: Name, Color (with badge), Schema, Actions
 * - Color shown as colored circle badge with hex code
 * - Schema shows "No Schema" if schema_id is null
 * - Loading state with message
 * - Empty state with helpful message
 * - Table rows have hover effect
 *
 * @example
 * <TagsList
 *   tags={tags}
 *   onEdit={(tag) => setSelectedTag(tag)}
 *   onDelete={(tag) => setDeleteTag(tag)}
 *   isLoading={isLoading}
 * />
 */
export function TagsList({ tags, onEdit, onDelete, isLoading }: TagsListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading tags...</p>
      </div>
    )
  }

  if (tags.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground mb-2">
          No tags yet. Create your first tag from the sidebar.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
              Name
            </th>
            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
              Color
            </th>
            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
              Schema
            </th>
            <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {tags.map((tag) => (
            <tr
              key={tag.id}
              className="border-b transition-colors hover:bg-muted/50"
            >
              <td className="p-4 align-middle font-medium">{tag.name}</td>
              <td className="p-4 align-middle">
                <div className="flex items-center gap-2">
                  <div
                    className="h-4 w-4 rounded-full border"
                    style={{ backgroundColor: tag.color || '#3B82F6' }}
                    aria-label={`Color: ${tag.color || '#3B82F6'}`}
                  />
                  <span className="text-sm text-muted-foreground">
                    {tag.color || '#3B82F6'}
                  </span>
                </div>
              </td>
              <td className="p-4 align-middle">
                {tag.schema_id ? (
                  <Badge variant="secondary">Schema</Badge>
                ) : (
                  <span className="text-sm text-muted-foreground">No Schema</span>
                )}
              </td>
              <td className="p-4 align-middle text-right">
                <TagActionsMenu tag={tag} onEdit={onEdit} onDelete={onDelete} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
