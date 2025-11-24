import { useState, useEffect } from 'react'
import { Info, X, Plus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useSchema, useCreateSchema, useUpdateSchemaFieldsBatch, schemasKeys } from '@/hooks/useSchemas'
import { useCreateCustomField } from '@/hooks/useCustomFields'
import { useUpdateList, listsOptions } from '@/hooks/useLists'
import { useQueryClient } from '@tanstack/react-query'
import { FieldTypeBadge } from './FieldTypeBadge'
import type { CustomField, FieldType, CustomFieldCreate } from '@/types/customField'

/** German labels for field types */
const FIELD_TYPE_OPTIONS: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'rating', label: 'Bewertung' },
  { value: 'boolean', label: 'Ja/Nein' },
  { value: 'select', label: 'Auswahl' },
]

/** Default config for each field type */
const DEFAULT_CONFIGS: Record<FieldType, object> = {
  text: {},  // max_length is optional, omit instead of null
  rating: { max_rating: 5 },
  boolean: {},
  select: { options: ['Option 1', 'Option 2'] },
}

interface WorkspaceFieldsEditorProps {
  listId: string
  defaultSchemaId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Dialog for editing workspace-level fields that apply to all videos.
 *
 * Features:
 * - Shows existing fields with remove button
 * - Add new fields inline with name and type
 * - Info tip about workspace-level fields
 * - Save/Cancel with local state management
 *
 * @example
 * ```tsx
 * <WorkspaceFieldsEditor
 *   listId={currentList.id}
 *   defaultSchemaId={currentList.default_schema_id}
 *   open={workspaceEditorOpen}
 *   onOpenChange={setWorkspaceEditorOpen}
 * />
 * ```
 */
export function WorkspaceFieldsEditor({
  listId,
  defaultSchemaId,
  open,
  onOpenChange,
}: WorkspaceFieldsEditorProps) {
  const queryClient = useQueryClient()

  // Fetch schema with nested fields
  const { data: schema, isLoading } = useSchema(listId, defaultSchemaId ?? undefined)

  // Mutations
  const createField = useCreateCustomField(listId)
  const createSchema = useCreateSchema(listId)
  const updateSchemaFields = useUpdateSchemaFieldsBatch(listId, defaultSchemaId ?? '')
  const updateList = useUpdateList()

  // Local state for fields being edited
  const [localFields, setLocalFields] = useState<CustomField[]>([])
  const [showAddField, setShowAddField] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // New field form state
  const [newFieldName, setNewFieldName] = useState('')
  const [newFieldType, setNewFieldType] = useState<FieldType>('text')

  // Sync local state when schema loads or dialog opens
  useEffect(() => {
    if (schema && open) {
      const fields = schema.schema_fields
        ?.slice()
        .sort((a, b) => a.display_order - b.display_order)
        .map((sf) => sf.field) ?? []
      setLocalFields(fields)
    }
  }, [schema, open])

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setShowAddField(false)
      setNewFieldName('')
      setNewFieldType('text')
      setSaveError(null)
      setSaveSuccess(false)
    }
  }, [open])

  const handleRemoveField = (fieldId: string) => {
    setLocalFields((prev) => prev.filter((f) => f.id !== fieldId))
  }

  const handleAddField = () => {
    const trimmedName = newFieldName.trim()
    if (!trimmedName) return

    // Create temporary field object (will be persisted in save step)
    const tempField: CustomField = {
      id: `temp-${Date.now()}`,
      list_id: listId,
      name: trimmedName,
      field_type: newFieldType,
      config: DEFAULT_CONFIGS[newFieldType],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    setLocalFields((prev) => [...prev, tempField])
    setNewFieldName('')
    setNewFieldType('text')
    setShowAddField(false)
  }

  const handleSave = async () => {
    setIsSaving(true)
    setSaveError(null)
    setSaveSuccess(false)

    try {
      // Step 1: Create new fields (those with temp-* IDs)
      const tempFields = localFields.filter((f) => f.id.startsWith('temp-'))
      const existingFields = localFields.filter((f) => !f.id.startsWith('temp-'))

      // Create new fields and collect their real IDs
      const createdFieldIds: string[] = []
      for (const tempField of tempFields) {
        const fieldData: CustomFieldCreate = {
          name: tempField.name,
          field_type: tempField.field_type,
          config: tempField.config,
        }
        const created = await createField.mutateAsync(fieldData)
        createdFieldIds.push(created.id)
      }

      // Combine existing field IDs with newly created field IDs
      const allFieldIds = [
        ...existingFields.map((f) => f.id),
        ...createdFieldIds,
      ]

      // Step 2: Update or create schema with fields
      if (defaultSchemaId && allFieldIds.length > 0) {
        // Update existing schema
        await updateSchemaFields.mutateAsync({
          fields: allFieldIds.map((fieldId, index) => ({
            field_id: fieldId,
            display_order: index,
            show_on_card: false,
          })),
        })
      } else if (!defaultSchemaId && allFieldIds.length > 0) {
        // Create new workspace schema and update list
        const newSchema = await createSchema.mutateAsync({
          name: 'Workspace Felder',
          description: 'Standard-Felder für alle Videos',
          fields: allFieldIds.map((fieldId, index) => ({
            field_id: fieldId,
            display_order: index,
            show_on_card: false,
          })),
        })

        // Update list with new default_schema_id
        await updateList.mutateAsync({
          listId,
          data: { default_schema_id: newSchema.id },
        })

        // Invalidate lists query to refresh UI
        await queryClient.invalidateQueries({ queryKey: listsOptions().queryKey })
      }

      // Invalidate queries to refresh data
      await queryClient.invalidateQueries({ queryKey: schemasKeys.all() })

      // Show success feedback briefly before closing
      // TODO: Replace with toast notification when toast component is available
      setSaveSuccess(true)
      setTimeout(() => {
        onOpenChange(false)
      }, 500)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unbekannter Fehler'
      setSaveError(`Speichern fehlgeschlagen: ${message}`)
    } finally {
      setIsSaving(false)
    }
  }

  const isAddDisabled = !newFieldName.trim()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Informationen für alle Videos</DialogTitle>
          <DialogDescription>
            Diese Felder sind für ALLE Videos in diesem Workspace verfügbar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info Alert */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Tipp: Felder die für alle Kategorien nützlich sind (z.B. Bewertung, Notizen)
            </AlertDescription>
          </Alert>

          {/* Field List */}
          <div className="space-y-2">
            <Label>Felder:</Label>

            {isLoading ? (
              <p className="text-sm text-muted-foreground">Lade Felder...</p>
            ) : localFields.length > 0 ? (
              <div className="space-y-2">
                {localFields.map((field) => (
                  <div
                    key={field.id}
                    className="flex items-center justify-between rounded border p-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{field.name}</span>
                      <FieldTypeBadge
                        fieldType={field.field_type}
                        className="text-[10px] px-1.5 py-0"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleRemoveField(field.id)}
                      aria-label={`${field.name} entfernen`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Keine Felder definiert
              </p>
            )}
          </div>

          {/* Add Field Button */}
          {!showAddField && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowAddField(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Information hinzufügen
            </Button>
          )}

          {/* Add Field Form */}
          {showAddField && (
            <div className="space-y-3 rounded border p-3 bg-muted/50">
              <div className="space-y-2">
                <Label htmlFor="new-field-name">Feldname</Label>
                <Input
                  id="new-field-name"
                  placeholder="z.B. Notizen, Bewertung"
                  value={newFieldName}
                  onChange={(e) => setNewFieldName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-field-type">Typ</Label>
                <Select
                  value={newFieldType}
                  onValueChange={(value) => setNewFieldType(value as FieldType)}
                >
                  <SelectTrigger id="new-field-type">
                    <SelectValue placeholder="Typ auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddField} disabled={isAddDisabled}>
                  Hinzufügen
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowAddField(false)
                    setNewFieldName('')
                    setNewFieldType('text')
                  }}
                >
                  Abbrechen
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Success display */}
        {saveSuccess && (
          <Alert className="border-green-500 bg-green-50 text-green-800">
            <AlertDescription>Felder erfolgreich gespeichert!</AlertDescription>
          </Alert>
        )}

        {/* Error display */}
        {saveError && (
          <Alert variant="destructive">
            <AlertDescription>{saveError}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Speichern...' : 'Speichern'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
