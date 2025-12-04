/**
 * KategorienTab - Combined view for Categories (formerly Tags with is_video_type=true)
 *
 * Replaces separate Schemas/Fields/Tags tabs with a unified "Kategorien" view.
 * Shows:
 * - WorkspaceFieldsCard: Fields that apply to ALL videos
 * - CategoryCard: Each category with its fields inline
 *
 * User-friendly language:
 * - "Kategorien" instead of "Tags"
 * - "Informationen" instead of "Fields/Schema"
 */
import { useState } from 'react'
import { useCategories } from '@/hooks/useTags'
import { useSchemas } from '@/hooks/useSchemas'
import { useCustomFields } from '@/hooks/useCustomFields'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Home, FolderOpen, Pencil } from 'lucide-react'
import { CreateTagDialog } from '@/components/CreateTagDialog'
import { EditTagDialog } from '@/components/EditTagDialog'
import { ConfirmDeleteTagDialog } from '@/components/ConfirmDeleteTagDialog'
import type { Tag } from '@/types/tag'

interface KategorienTabProps {
  listId: string
}

export function KategorienTab({ listId }: KategorienTabProps) {
  const { data: categories = [], isLoading: isCategoriesLoading } = useCategories()
  const { data: schemas = [] } = useSchemas(listId)
  const { data: fields = [] } = useCustomFields(listId)

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<Tag | null>(null)

  // Get fields for a category (via schema)
  const getFieldsForCategory = (category: Tag) => {
    if (!category.schema_id) return []
    const schema = schemas.find((s) => s.id === category.schema_id)
    if (!schema) return []
    return schema.schema_fields?.map((sf) => {
      const field = fields.find((f) => f.id === sf.field_id)
      return field ? { ...field, showOnCard: sf.show_on_card } : null
    }).filter(Boolean) || []
  }

  // Get workspace-level fields (fields not tied to any category schema)
  const getWorkspaceFields = () => {
    const categorySchemaIds = new Set(categories.map((c) => c.schema_id).filter(Boolean))
    const fieldsInCategorySchemas = new Set<string>()

    schemas.forEach((schema) => {
      if (categorySchemaIds.has(schema.id)) {
        schema.schema_fields?.forEach((sf) => {
          fieldsInCategorySchemas.add(sf.field_id)
        })
      }
    })

    return fields.filter((f) => !fieldsInCategorySchemas.has(f.id))
  }

  const handleEditCategory = (category: Tag) => {
    setSelectedCategory(category)
    setEditDialogOpen(true)
  }

  const handleDeleteCategory = (category: Tag) => {
    setSelectedCategory(category)
    setDeleteDialogOpen(true)
  }

  if (isCategoriesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Lade Kategorien...</p>
      </div>
    )
  }

  const workspaceFields = getWorkspaceFields()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Kategorien</h2>
          <p className="text-muted-foreground">
            Organisiere deine Videos nach Kategorien mit eigenen Informationen
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Neue Kategorie
        </Button>
      </div>

      {/* Workspace Fields Card - "Alle Videos" */}
      <WorkspaceFieldsCard fields={workspaceFields} />

      {/* Category Cards */}
      {categories.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed p-8 text-center">
          <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Keine Kategorien vorhanden</h3>
          <p className="text-muted-foreground mb-4">
            Kategorien helfen dir, Videos nach Typ zu organisieren und eigene Informationen zu erfassen.
          </p>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Erste Kategorie erstellen
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              fields={getFieldsForCategory(category)}
              onEdit={() => handleEditCategory(category)}
              onDelete={() => handleDeleteCategory(category)}
            />
          ))}
        </div>
      )}

      {/* Dialogs */}
      <CreateTagDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        defaultIsVideoType={true}
      />

      {selectedCategory && (
        <>
          <EditTagDialog
            tag={selectedCategory}
            open={editDialogOpen}
            onClose={() => {
              setEditDialogOpen(false)
              setSelectedCategory(null)
            }}
            listId={listId}
          />

          <ConfirmDeleteTagDialog
            tag={selectedCategory}
            open={deleteDialogOpen}
            onConfirm={() => {
              setDeleteDialogOpen(false)
              setSelectedCategory(null)
            }}
            onCancel={() => {
              setDeleteDialogOpen(false)
              setSelectedCategory(null)
            }}
          />
        </>
      )}
    </div>
  )
}

/**
 * WorkspaceFieldsCard - Special card for fields that apply to ALL videos
 */
interface WorkspaceFieldsCardProps {
  fields: any[]
}

function WorkspaceFieldsCard({ fields }: WorkspaceFieldsCardProps) {
  return (
    <div className="rounded-lg border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Home className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold text-blue-900">Alle Videos</h3>
        </div>
        <Button variant="outline" size="sm">
          <Pencil className="h-3 w-3 mr-1" />
          Bearbeiten
        </Button>
      </div>

      <p className="text-sm text-blue-700 mb-3">
        Diese Informationen sind für alle Videos verfügbar
      </p>

      {fields.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {fields.map((field) => (
            <Badge key={field.id} variant="secondary" className="bg-blue-100 text-blue-800">
              {field.name}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-sm text-blue-600 italic">Noch keine Informationen definiert</p>
      )}
    </div>
  )
}

/**
 * CategoryCard - Card displaying a category with its fields
 */
interface CategoryCardProps {
  category: Tag
  fields: any[]
  onEdit: () => void
  onDelete: () => void
}

function CategoryCard({ category, fields, onEdit, onDelete }: CategoryCardProps) {
  return (
    <div className="rounded-lg border bg-card p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="h-4 w-4 rounded-full"
            style={{ backgroundColor: category.color || '#3B82F6' }}
          />
          <h3 className="font-semibold">{category.name}</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={onEdit}>
          <Pencil className="h-3 w-3 mr-1" />
          Bearbeiten
        </Button>
      </div>

      {fields.length > 0 ? (
        <div className="space-y-1 mb-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Informationen
          </p>
          <div className="flex flex-wrap gap-1">
            {fields.map((field) => (
              <Badge key={field.id} variant="outline" className="text-xs">
                {field.name}
              </Badge>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground mb-3 italic">
          Keine Informationen definiert
        </p>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>TODO: Video-Anzahl</span>
        <button
          onClick={onDelete}
          className="text-red-500 hover:text-red-700 transition-colors"
        >
          Löschen
        </button>
      </div>
    </div>
  )
}
