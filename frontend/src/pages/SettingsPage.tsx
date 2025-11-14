import { useState } from 'react'
import { useSchemas } from '@/hooks/useSchemas'
import { useLists } from '@/hooks/useLists' // ✨ FIX #4: Import useLists
import {
  useCustomFields,
  useUpdateCustomField,
  useDeleteCustomField,
  useFieldUsageCounts,
} from '@/hooks/useCustomFields'
import { SchemasList } from '@/components/SchemasList'
import { SchemaCreationDialog } from '@/components/schemas/SchemaCreationDialog'
import { FieldsList } from '@/components/settings/FieldsList'
import { FieldEditDialog } from '@/components/settings/FieldEditDialog'
import { ConfirmDeleteFieldModal } from '@/components/settings/ConfirmDeleteFieldModal'
import { Button } from '@/components/ui/button'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { Plus } from 'lucide-react'
import type { CustomField } from '@/types/customField'

/**
 * SettingsPage - Centralized settings management
 *
 * Provides tabbed interface for:
 * - Schemas: Manage field schema templates (Task #135)
 * - Fields: Manage custom field definitions (Future)
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
  const [activeTab, setActiveTab] = useState<'schemas' | 'fields'>('schemas')

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

  // Schema creation dialog state (Task #140 Step 7)
  const [schemaDialogOpen, setSchemaDialogOpen] = useState(false)

  // Edit dialog state (Task #139 Step 8)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [fieldToEdit, setFieldToEdit] = useState<CustomField | null>(null)

  // Delete dialog state (Task #139 Step 8)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [fieldToDelete, setFieldToDelete] = useState<CustomField | null>(null)

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
          console.log('Field updated successfully')
          setEditDialogOpen(false)
          setFieldToEdit(null)
        },
        onError: (error: any) => {
          const message = error.response?.data?.detail || 'Failed to update field'
          console.error('Update failed:', message)
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
        console.log(`Field "${fieldToDelete.name}" deleted successfully`)
        setDeleteDialogOpen(false)
        setFieldToDelete(null)
      },
      onError: (error: any) => {
        const message = error.response?.data?.detail || 'Failed to delete field'
        console.error('Delete failed:', message)
        // Keep dialog open on error (don't reset state)
      },
    })
  }

  // Schema creation success handler (Task #140 Step 7)
  const handleSchemaCreated = (schema: any) => {
    console.log(`Schema created successfully: "${schema.name}" with ${schema.schema_fields?.length || 0} fields`)
    // TODO: Add toast notification when toast component is available
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
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'schemas' | 'fields')}>
          <TabsList className="mb-6">
            <TabsTrigger value="schemas">Schemas</TabsTrigger>
            <TabsTrigger value="fields">Fields</TabsTrigger>
          </TabsList>

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
    </div>
  )
}
