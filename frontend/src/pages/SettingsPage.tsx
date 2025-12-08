import { AlertCircle, Moon, Plus, Sun, X } from "lucide-react";
import { useState } from "react";
import { ConfirmDeleteTagDialog } from "@/components/ConfirmDeleteTagDialog";
import { CreateTagDialog } from "@/components/CreateTagDialog";
import { EditTagDialog } from "@/components/EditTagDialog";
import { SchemasList } from "@/components/SchemasList";
import { SchemaCreationDialog } from "@/components/schemas/SchemaCreationDialog";
import { ConfirmDeleteFieldModal } from "@/components/settings/ConfirmDeleteFieldModal";
import { FieldEditDialog } from "@/components/settings/FieldEditDialog";
import { FieldsList } from "@/components/settings/FieldsList";
import { SubscriptionsTab } from "@/components/settings/SubscriptionsTab";
import { TagsList } from "@/components/settings/TagsList";
import { WorkspaceFieldsCard } from "@/components/settings/WorkspaceFieldsCard";
import { WorkspaceFieldsEditor } from "@/components/settings/WorkspaceFieldsEditor";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Tabs,
  TabsContent,
  TabsList as TabsListUI,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  useCustomFields,
  useDeleteCustomField,
  useFieldUsageCounts,
  useUpdateCustomField,
} from "@/hooks/useCustomFields";
import { useLists } from "@/hooks/useLists";
import { useSchemas } from "@/hooks/useSchemas";
import { useTags } from "@/hooks/useTags";
import { useThemeStore } from "@/stores";
import type { CustomField } from "@/types/customField";
import type { Tag } from "@/types/tag";

/**
 * SettingsPage - Centralized settings management
 *
 * Provides tabbed interface for:
 * - Kategorien: Manage categories, labels and their fields
 * - Design: Theme settings (dark/light mode)
 *
 * Architecture:
 * - Uses shadcn/ui Tabs for navigation
 * - Fetches data via TanStack Query hooks
 * - Uses useLists() to get listId dynamically
 *
 * Route: /settings
 */
export function SettingsPage() {
  // Tabs: Kategorien, Abos and Design
  const [activeTab, setActiveTab] = useState<"kategorien" | "abos" | "design">(
    "kategorien"
  );

  // Theme store for dark/light mode
  const { theme, setTheme } = useThemeStore();

  // Fetch lists dynamically instead of hardcoded listId
  const {
    data: lists,
    isLoading: isListsLoading,
    isError: isListsError,
  } = useLists();
  const listId = lists?.[0]?.id || "";

  // Fetch schemas for current list
  const {
    data: schemas,
    isLoading: isSchemasLoading,
    isError: isSchemasError,
  } = useSchemas(listId);

  // Fetch custom fields for current list
  const { data: fields = [], isLoading: isFieldsLoading } =
    useCustomFields(listId);
  const updateField = useUpdateCustomField(listId);
  const deleteField = useDeleteCustomField(listId);
  const usageCounts = useFieldUsageCounts(listId);

  // Fetch tags for current user
  const { data: tags = [], isLoading: isTagsLoading } = useTags();

  // Schema creation dialog state
  const [schemaDialogOpen, setSchemaDialogOpen] = useState(false);

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [fieldToEdit, setFieldToEdit] = useState<CustomField | null>(null);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fieldToDelete, setFieldToDelete] = useState<CustomField | null>(null);

  // Tag dialog state
  const [editTagDialogOpen, setEditTagDialogOpen] = useState(false);
  const [deleteTagDialogOpen, setDeleteTagDialogOpen] = useState(false);
  const [createTagDialogOpen, setCreateTagDialogOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null);

  // Workspace fields editor state
  const [workspaceEditorOpen, setWorkspaceEditorOpen] = useState(false);

  // Error states for user feedback
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Combine loading states
  const isLoading = isListsLoading || isSchemasLoading || isFieldsLoading;
  const isError = isListsError || isSchemasError;

  // Schema creation handler
  const handleCreateSchema = () => {
    setSchemaDialogOpen(true);
  };

  // Field edit handler
  const handleEditClick = (field: CustomField) => {
    setFieldToEdit(field);
    setEditDialogOpen(true);
  };

  // Field edit save handler
  const handleEditSave = (fieldId: string, updates: any) => {
    updateField.mutate(
      { fieldId, data: updates },
      {
        onSuccess: () => {
          setEditError(null);
          setEditDialogOpen(false);
          setFieldToEdit(null);
        },
        onError: (error: any) => {
          const message =
            error.response?.data?.detail ||
            "Fehler beim Aktualisieren des Feldes";
          setEditError(message);
        },
      }
    );
  };

  // Field delete click handler
  const handleDeleteClick = (fieldId: string) => {
    const field = fields.find((f) => f.id === fieldId);
    if (field) {
      setFieldToDelete(field);
      setDeleteDialogOpen(true);
    }
  };

  // Field delete confirm handler
  const handleDeleteConfirm = () => {
    if (!fieldToDelete) return;

    deleteField.mutate(fieldToDelete.id, {
      onSuccess: () => {
        setDeleteError(null);
        setDeleteDialogOpen(false);
        setFieldToDelete(null);
      },
      onError: (error: any) => {
        const message =
          error.response?.data?.detail || "Fehler beim Löschen des Feldes";
        setDeleteError(message);
      },
    });
  };

  // Schema creation success handler
  const handleSchemaCreated = (schema: any) => {
    console.log(
      `Schema created successfully: "${schema.name}" with ${schema.schema_fields?.length || 0} fields`
    );
  };

  // Tag edit handler
  const handleEditTag = (tag: Tag) => {
    setSelectedTag(tag);
    setEditTagDialogOpen(true);
  };

  // Tag delete handler
  const handleDeleteTag = (tag: Tag) => {
    setSelectedTag(tag);
    setDeleteTagDialogOpen(true);
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="bg-card shadow-sm">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
            <h1 className="font-bold text-2xl text-foreground">
              Einstellungen
            </h1>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="py-12 text-center">
            <p className="text-lg text-muted-foreground">Lade Daten...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="font-bold text-2xl text-foreground">
              Einstellungen
            </h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Tabs
          onValueChange={(v) =>
            setActiveTab(v as "kategorien" | "abos" | "design")
          }
          value={activeTab}
        >
          <TabsListUI className="mb-6">
            <TabsTrigger value="kategorien">Kategorien</TabsTrigger>
            <TabsTrigger value="abos">Abos</TabsTrigger>
            <TabsTrigger value="design">Design</TabsTrigger>
          </TabsListUI>

          {/* Schemas Tab */}
          <TabsContent value="schemas">
            {isError ? (
              <div className="py-12 text-center">
                <p className="text-lg text-red-600">Error loading schemas.</p>
              </div>
            ) : schemas && schemas.length > 0 ? (
              <SchemasList listId={listId} schemas={schemas} />
            ) : (
              <div className="py-12 text-center">
                <p className="mb-4 text-lg text-muted-foreground">
                  No schemas yet. Create your first schema to organize custom
                  fields!
                </p>
                <Button onClick={handleCreateSchema}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Schema
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Fields Tab */}
          <TabsContent value="fields">
            {/* Edit Error Alert */}
            {editError && (
              <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
                <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
                <div className="flex-1">
                  <p className="text-red-800 text-sm">{editError}</p>
                </div>
                <button
                  className="text-red-600 hover:text-red-800"
                  onClick={() => setEditError(null)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Delete Error Alert */}
            {deleteError && (
              <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
                <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
                <div className="flex-1">
                  <p className="text-red-800 text-sm">{deleteError}</p>
                </div>
                <button
                  className="text-red-600 hover:text-red-800"
                  onClick={() => setDeleteError(null)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {fields.length > 0 ? (
              <FieldsList
                fields={fields}
                onDelete={handleDeleteClick}
                onEdit={handleEditClick}
                showUsageCount={true}
                usageCounts={usageCounts}
              />
            ) : (
              <div className="py-12 text-center">
                <p className="mb-4 text-lg text-muted-foreground">
                  No custom fields yet. Create your first field to extend video
                  metadata!
                </p>
              </div>
            )}
          </TabsContent>

          {/* Kategorien Tab */}
          <TabsContent value="kategorien">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-2xl tracking-tight">
                    Kategorien & Labels
                  </h2>
                  <p className="text-muted-foreground">
                    Verwalte Kategorien, Labels und deren Felder
                  </p>
                </div>
                <Button onClick={() => setCreateTagDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Neue Kategorie
                </Button>
              </div>

              {/* Workspace Fields Card */}
              {listId && (
                <WorkspaceFieldsCard
                  defaultSchemaId={lists?.[0]?.default_schema_id ?? null}
                  listId={listId}
                  onEdit={() => setWorkspaceEditorOpen(true)}
                />
              )}

              {isTagsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-muted-foreground">Lade Kategorien...</p>
                </div>
              ) : (
                <TagsList
                  onDelete={handleDeleteTag}
                  onEdit={handleEditTag}
                  tags={tags}
                />
              )}
            </div>
          </TabsContent>

          {/* Abos Tab */}
          <TabsContent value="abos">
            <SubscriptionsTab />
          </TabsContent>

          {/* Design Tab - Theme Settings */}
          <TabsContent value="design">
            <div className="space-y-6">
              <div>
                <h2 className="font-bold text-2xl tracking-tight">Design</h2>
                <p className="text-muted-foreground">
                  Passe das Erscheinungsbild der Anwendung an
                </p>
              </div>

              {/* Dark Mode Toggle */}
              <div className="rounded-lg border bg-card p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                      {theme === "dark" ? (
                        <Moon className="h-5 w-5" />
                      ) : (
                        <Sun className="h-5 w-5" />
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label
                        className="font-medium text-base"
                        htmlFor="dark-mode"
                      >
                        Dark Mode
                      </Label>
                      <p className="text-muted-foreground text-sm">
                        Aktiviere den dunklen Modus für eine augenfreundlichere
                        Darstellung
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={theme === "dark"}
                    id="dark-mode"
                    onCheckedChange={(checked) =>
                      setTheme(checked ? "dark" : "light")
                    }
                  />
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Edit Dialog */}
      <FieldEditDialog
        field={fieldToEdit}
        isLoading={updateField.isPending}
        onClose={() => {
          setEditDialogOpen(false);
          setFieldToEdit(null);
        }}
        onSave={handleEditSave}
        open={editDialogOpen}
      />

      {/* Delete Confirmation */}
      <ConfirmDeleteFieldModal
        fieldName={fieldToDelete?.name || null}
        isLoading={deleteField.isPending}
        onCancel={() => {
          setDeleteDialogOpen(false);
          setFieldToDelete(null);
        }}
        onConfirm={handleDeleteConfirm}
        open={deleteDialogOpen}
        usageCount={fieldToDelete ? usageCounts.get(fieldToDelete.id) || 0 : 0}
      />

      {/* Schema Creation Dialog */}
      <SchemaCreationDialog
        listId={listId}
        onOpenChange={setSchemaDialogOpen}
        onSchemaCreated={handleSchemaCreated}
        open={schemaDialogOpen}
      />

      {/* Tag Dialogs */}
      {selectedTag && (
        <>
          <EditTagDialog
            listId={listId}
            onClose={() => {
              setEditTagDialogOpen(false);
              setSelectedTag(null);
            }}
            open={editTagDialogOpen}
            tag={selectedTag}
          />

          <ConfirmDeleteTagDialog
            onCancel={() => {
              setDeleteTagDialogOpen(false);
              setSelectedTag(null);
            }}
            onConfirm={() => {
              setDeleteTagDialogOpen(false);
              setSelectedTag(null);
            }}
            open={deleteTagDialogOpen}
            tag={selectedTag}
          />
        </>
      )}

      {/* Workspace Fields Editor */}
      <WorkspaceFieldsEditor
        defaultSchemaId={lists?.[0]?.default_schema_id ?? null}
        listId={listId}
        onOpenChange={setWorkspaceEditorOpen}
        open={workspaceEditorOpen}
      />

      {/* Create Tag Dialog */}
      <CreateTagDialog
        listId={listId}
        onOpenChange={setCreateTagDialogOpen}
        open={createTagDialogOpen}
      />
    </div>
  );
}
