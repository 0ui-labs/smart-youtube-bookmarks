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

import { FolderOpen, Home, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { ConfirmDeleteTagDialog } from "@/components/ConfirmDeleteTagDialog";
import { CreateTagDialog } from "@/components/CreateTagDialog";
import { EditTagDialog } from "@/components/EditTagDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCustomFields } from "@/hooks/useCustomFields";
import { useSchemas } from "@/hooks/useSchemas";
import { useCategories } from "@/hooks/useTags";
import type { Tag } from "@/types/tag";

interface KategorienTabProps {
  listId: string;
}

export function KategorienTab({ listId }: KategorienTabProps) {
  const { data: categories = [], isLoading: isCategoriesLoading } =
    useCategories();
  const { data: schemas = [] } = useSchemas(listId);
  const { data: fields = [] } = useCustomFields(listId);

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Tag | null>(null);

  // Get fields for a category (via schema)
  const getFieldsForCategory = (category: Tag) => {
    if (!category.schema_id) return [];
    const schema = schemas.find((s) => s.id === category.schema_id);
    if (!schema) return [];
    return (
      schema.schema_fields
        ?.map((sf) => {
          const field = fields.find((f) => f.id === sf.field_id);
          return field ? { ...field, showOnCard: sf.show_on_card } : null;
        })
        .filter(Boolean) || []
    );
  };

  // Get workspace-level fields (fields not tied to any category schema)
  const getWorkspaceFields = () => {
    const categorySchemaIds = new Set(
      categories.map((c) => c.schema_id).filter(Boolean)
    );
    const fieldsInCategorySchemas = new Set<string>();

    schemas.forEach((schema) => {
      if (categorySchemaIds.has(schema.id)) {
        schema.schema_fields?.forEach((sf) => {
          fieldsInCategorySchemas.add(sf.field_id);
        });
      }
    });

    return fields.filter((f) => !fieldsInCategorySchemas.has(f.id));
  };

  const handleEditCategory = (category: Tag) => {
    setSelectedCategory(category);
    setEditDialogOpen(true);
  };

  const handleDeleteCategory = (category: Tag) => {
    setSelectedCategory(category);
    setDeleteDialogOpen(true);
  };

  if (isCategoriesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Lade Kategorien...</p>
      </div>
    );
  }

  const workspaceFields = getWorkspaceFields();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-2xl tracking-tight">Kategorien</h2>
          <p className="text-muted-foreground">
            Organisiere deine Videos nach Kategorien mit eigenen Informationen
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Neue Kategorie
        </Button>
      </div>

      {/* Workspace Fields Card - "Alle Videos" */}
      <WorkspaceFieldsCard fields={workspaceFields} />

      {/* Category Cards */}
      {categories.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed p-8 text-center">
          <FolderOpen className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="mb-2 font-medium text-lg">
            Keine Kategorien vorhanden
          </h3>
          <p className="mb-4 text-muted-foreground">
            Kategorien helfen dir, Videos nach Typ zu organisieren und eigene
            Informationen zu erfassen.
          </p>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Erste Kategorie erstellen
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <CategoryCard
              category={category}
              fields={getFieldsForCategory(category)}
              key={category.id}
              onDelete={() => handleDeleteCategory(category)}
              onEdit={() => handleEditCategory(category)}
            />
          ))}
        </div>
      )}

      {/* Dialogs */}
      <CreateTagDialog
        defaultIsVideoType={true}
        onClose={() => setCreateDialogOpen(false)}
        open={createDialogOpen}
      />

      {selectedCategory && (
        <>
          <EditTagDialog
            listId={listId}
            onClose={() => {
              setEditDialogOpen(false);
              setSelectedCategory(null);
            }}
            open={editDialogOpen}
            tag={selectedCategory}
          />

          <ConfirmDeleteTagDialog
            onCancel={() => {
              setDeleteDialogOpen(false);
              setSelectedCategory(null);
            }}
            onConfirm={() => {
              setDeleteDialogOpen(false);
              setSelectedCategory(null);
            }}
            open={deleteDialogOpen}
            tag={selectedCategory}
          />
        </>
      )}
    </div>
  );
}

/**
 * WorkspaceFieldsCard - Special card for fields that apply to ALL videos
 */
interface WorkspaceFieldsCardProps {
  fields: any[];
}

function WorkspaceFieldsCard({ fields }: WorkspaceFieldsCardProps) {
  return (
    <div className="rounded-lg border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Home className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold text-blue-900">Alle Videos</h3>
        </div>
        <Button size="sm" variant="outline">
          <Pencil className="mr-1 h-3 w-3" />
          Bearbeiten
        </Button>
      </div>

      <p className="mb-3 text-blue-700 text-sm">
        Diese Informationen sind für alle Videos verfügbar
      </p>

      {fields.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {fields.map((field) => (
            <Badge
              className="bg-blue-100 text-blue-800"
              key={field.id}
              variant="secondary"
            >
              {field.name}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-blue-600 text-sm italic">
          Noch keine Informationen definiert
        </p>
      )}
    </div>
  );
}

/**
 * CategoryCard - Card displaying a category with its fields
 */
interface CategoryCardProps {
  category: Tag;
  fields: any[];
  onEdit: () => void;
  onDelete: () => void;
}

function CategoryCard({
  category,
  fields,
  onEdit,
  onDelete,
}: CategoryCardProps) {
  return (
    <div className="rounded-lg border bg-card p-4 transition-shadow hover:shadow-md">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="h-4 w-4 rounded-full"
            style={{ backgroundColor: category.color || "#3B82F6" }}
          />
          <h3 className="font-semibold">{category.name}</h3>
        </div>
        <Button onClick={onEdit} size="sm" variant="ghost">
          <Pencil className="mr-1 h-3 w-3" />
          Bearbeiten
        </Button>
      </div>

      {fields.length > 0 ? (
        <div className="mb-3 space-y-1">
          <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
            Informationen
          </p>
          <div className="flex flex-wrap gap-1">
            {fields.map((field) => (
              <Badge className="text-xs" key={field.id} variant="outline">
                {field.name}
              </Badge>
            ))}
          </div>
        </div>
      ) : (
        <p className="mb-3 text-muted-foreground text-sm italic">
          Keine Informationen definiert
        </p>
      )}

      <div className="flex items-center justify-between text-muted-foreground text-xs">
        <span>TODO: Video-Anzahl</span>
        <button
          className="text-red-500 transition-colors hover:text-red-700"
          onClick={onDelete}
        >
          Löschen
        </button>
      </div>
    </div>
  );
}
