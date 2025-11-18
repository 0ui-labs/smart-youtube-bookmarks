import { useState } from 'react'
import { useSchemas } from '@/hooks/useSchemas'
import { useLists } from '@/hooks/useLists' // ✨ FIX #4: Import useLists
import { useTags } from '@/hooks/useTags'
import {
  useCustomFields,
  useUpdateCustomField,
  useDeleteCustomField,
  useFieldUsageCounts,
} from '@/hooks/useCustomFields'
import { SchemasList } from '@/components/SchemasList'
import { SchemaCreationDialog } from '@/components/schemas/SchemaCreationDialog'
import { FieldsList } from '@/components/settings/FieldsList'
import { TagsList } from '@/components/settings/TagsList'
import { FieldEditDialog } from '@/components/settings/FieldEditDialog'
import { ConfirmDeleteFieldModal } from '@/components/settings/ConfirmDeleteFieldModal'
import { EditTagDialog } from '@/components/EditTagDialog'
import { ConfirmDeleteTagDialog } from '@/components/ConfirmDeleteTagDialog'
import { AnalyticsView } from '@/components/analytics/AnalyticsView'
import { Button } from '@/components/ui/button'
import {
  Tabs,
  TabsContent,
  TabsList as TabsListUI,
  TabsTrigger,
} from '@/components/ui/tabs'
import { Plus, AlertCircle, X } from 'lucide-react'
import type { CustomField } from '@/types/customField'
import type { Tag } from '@/types/tag'

/**
 * SettingsPage - Centralized settings management
 *
 * Provides tabbed interface for:
 * - Schemas: Manage field schema templates (Task #135)
 * - Fields: Manage custom field definitions (Task #139)
 * - Analytics: View field/schema usage statistics (Task #142)
 *
 * Architecture:
 * - Uses shadcn/ui Tabs for navigation
 * - Fetches data via TanStack Query hooks
 * - Follows Dashboard.tsx pattern for page layout
 * - Uses useLists() to get listId dynamically (not hardcoded)
 *
 * Route: /settings/schemas
 *
 * @example
 * // In App.tsx
 * <Route path="/settings/schemas" element={<SettingsPage />} />
 */
export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'schemas' | 'fields' | 'tags' | 'analytics'>('schemas')

  // ✨ FIX #4: Fetch lists dynamically instead of hardcoded listId
  const { data: lists, isLoading: isListsLoading, isError: isListsError } = useLists()
  const listId = lists?.[0]?.id || ''

  // Fetch schemas for current list
  const { data: schemas, isLoading: isSchemasLoading, isError: isSchemasError } = useSchemas(listId)

  // Fetch custom fields for current list (Task #139 Step 8)
  const { data: fields = [], isLoading: isFieldsLoading } = useCustomFields(listId)
  const updateField = useUpdateCustomField(listId)
  const deleteField = useDeleteCustomField(listId)
  const usageCounts = useFieldUsageCounts(listId)

  // Fetch tags for current user (Task 6)
  const { data: tags = [], isLoading: isTagsLoading } = useTags()

  // Schema creation dialog state (Task #140 Step 7)
  const [schemaDialogOpen, setSchemaDialogOpen] = useState(false)

  // Edit dialog state (Task #139 Step 8)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [fieldToEdit, setFieldToEdit] = useState<CustomField | null>(null)

  // Delete dialog state (Task #139 Step 8)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [fieldToDelete, setFieldToDelete] = useState<CustomField | null>(null)

  // Tag dialog state (Task 6)
  const [editTagDialogOpen, setEditTagDialogOpen] = useState(false)
  const [deleteTagDialogOpen, setDeleteTagDialogOpen] = useState(false)
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null)

  // Error states for user feedback
  const [editError, setEditError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Combine loading states
  const isLoading = isListsLoading || isSchemasLoading || isFieldsLoading
  const isError = isListsError || isSchemasError

  // Schema creation handler (Task #140 Step 7)
  const handleCreateSchema = () => {
    setSchemaDialogOpen(true)
  }

  // Field edit handler (Task #139 Step 8)
  const handleEditClick = (field: CustomField) => {
    setFieldToEdit(field)
    setEditDialogOpen(true)
  }

  // Field edit save handler (Task #139 Step 8)
  const handleEditSave = (fieldId: string, updates: any) => {
    updateField.mutate(
      { fieldId, data: updates },
      {
        onSuccess: () => {
          setEditError(null)
          setEditDialogOpen(false)
          setFieldToEdit(null)
        },
        onError: (error: any) => {
          const message = error.response?.data?.detail || 'Fehler beim Aktualisieren des Feldes'
          setEditError(message)
          // Keep dialog open on error (don't reset state)
        },
      }
    )
  }

  // Field delete click handler (Task #139 Step 8)
  const handleDeleteClick = (fieldId: string) => {
    const field = fields.find((f) => f.id === fieldId)
    if (field) {
      setFieldToDelete(field)
      setDeleteDialogOpen(true)
    }
  }

  // Field delete confirm handler (Task #139 Step 8)
  const handleDeleteConfirm = () => {
    if (!fieldToDelete) return

    deleteField.mutate(fieldToDelete.id, {
      onSuccess: () => {
        setDeleteError(null)
        setDeleteDialogOpen(false)
        setFieldToDelete(null)
      },
      onError: (error: any) => {
        const message = error.response?.data?.detail || 'Fehler beim Löschen des Feldes'
        setDeleteError(message)
        // Keep dialog open on error (don't reset state)
      },
    })
  }

  // Schema creation success handler (Task #140 Step 7)
  const handleSchemaCreated = (schema: any) => {
    console.log(`Schema created successfully: "${schema.name}" with ${schema.schema_fields?.length || 0} fields`)
    // TODO: Add toast notification when toast component is available
  }

  // Tag edit handler (Task 6)
  const handleEditTag = (tag: Tag) => {
    setSelectedTag(tag)
    setEditTagDialogOpen(true)
  }

  // Tag delete handler (Task 6)
  const handleDeleteTag = (tag: Tag) => {
    setSelectedTag(tag)
    setDeleteTagDialogOpen(true)
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">Loading schemas...</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
            {activeTab === 'schemas' && (
              <Button onClick={handleCreateSchema}>
                <Plus className="h-4 w-4 mr-2" />
                Create Schema
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'schemas' | 'fields' | 'tags' | 'analytics')}>
          <TabsListUI className="mb-6">
            <TabsTrigger value="schemas">Schemas</TabsTrigger>
            <TabsTrigger value="fields">Fields</TabsTrigger>
            <TabsTrigger value="tags">Tags</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsListUI>

          {/* Schemas Tab */}
          <TabsContent value="schemas">
            {isError ? (
              <div className="text-center py-12">
                <p className="text-red-600 text-lg">Error loading schemas.</p>
              </div>
            ) : schemas && schemas.length > 0 ? (
              <SchemasList schemas={schemas} listId={listId} />
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg mb-4">
                  No schemas yet. Create your first schema to organize custom fields!
                </p>
                <Button onClick={handleCreateSchema}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Schema
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Fields Tab - Task #139 Step 8 */}
          <TabsContent value="fields">
            {/* Edit Error Alert */}
            {editError && (
              <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-red-800">{editError}</p>
                </div>
                <button
                  onClick={() => setEditError(null)}
                  className="text-red-600 hover:text-red-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Delete Error Alert */}
            {deleteError && (
              <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-red-800">{deleteError}</p>
                </div>
                <button
                  onClick={() => setDeleteError(null)}
                  className="text-red-600 hover:text-red-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {fields.length > 0 ? (
              <FieldsList
                fields={fields}
                onEdit={handleEditClick}
                onDelete={handleDeleteClick}
                showUsageCount={true}
                usageCounts={usageCounts}
              />
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg mb-4">
                  No custom fields yet. Create your first field to extend video metadata!
                </p>
              </div>
            )}
          </TabsContent>

          {/* Tags Tab - Task 6 */}
          <TabsContent value="tags">
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Tags</h2>
                <p className="text-muted-foreground">
                  Manage your tags and their schemas
                </p>
              </div>

              {isTagsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-muted-foreground">Loading tags...</p>
                </div>
              ) : (
                <TagsList
                  tags={tags}
                  onEdit={handleEditTag}
                  onDelete={handleDeleteTag}
                />
              )}
            </div>
          </TabsContent>

          {/* Analytics Tab - Task #142 Step 14 */}
          <TabsContent value="analytics">
            <AnalyticsView />
          </TabsContent>
        </Tabs>
      </main>

      {/* Edit Dialog - Task #139 Step 8 */}
      <FieldEditDialog
        open={editDialogOpen}
        field={fieldToEdit}
        onClose={() => {
          setEditDialogOpen(false)
          setFieldToEdit(null)
        }}
        onSave={handleEditSave}
        isLoading={updateField.isPending}
      />

      {/* Delete Confirmation - Task #139 Step 8 */}
      <ConfirmDeleteFieldModal
        open={deleteDialogOpen}
        fieldName={fieldToDelete?.name || null}
        usageCount={fieldToDelete ? usageCounts.get(fieldToDelete.id) || 0 : 0}
        onConfirm={handleDeleteConfirm}
        onCancel={() => {
          setDeleteDialogOpen(false)
          setFieldToDelete(null)
        }}
        isLoading={deleteField.isPending}
      />

      {/* Schema Creation Dialog - Task #140 Step 7 */}
      <SchemaCreationDialog
        listId={listId}
        open={schemaDialogOpen}
        onOpenChange={setSchemaDialogOpen}
        onSchemaCreated={handleSchemaCreated}
      />

      {/* Tag Dialogs - Task 6 */}
      {selectedTag && (
        <>
          <EditTagDialog
            tag={selectedTag}
            open={editTagDialogOpen}
            onClose={() => {
              setEditTagDialogOpen(false)
              setSelectedTag(null)
            }}
            listId={listId}
          />

          <ConfirmDeleteTagDialog
            tag={selectedTag}
            open={deleteTagDialogOpen}
            onConfirm={() => {
              setDeleteTagDialogOpen(false)
              setSelectedTag(null)
            }}
            onCancel={() => {
              setDeleteTagDialogOpen(false)
              setSelectedTag(null)
            }}
          />
        </>
      )}
    </div>
  )
}
