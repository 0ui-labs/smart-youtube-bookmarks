import { useState, useMemo } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { FieldSelector } from './FieldSelector'
// import { FieldOrderManager } from './FieldOrderManager' // TODO Task #127: Integrate new FieldOrderManager API
import { useCustomFields } from '@/hooks/useCustomFields'
import { NewFieldForm } from './NewFieldForm'
import { validateAllSchemaFields } from '@/validators/schemaValidators'

/**
 * Zod Schema with superRefine for advanced array validation
 * REF MCP Improvement #1: Using superRefine instead of multiple .refine() calls
 * for more precise error messages and better UX
 *
 * Validation logic extracted to @/validators/schemaValidators for:
 * - Better testability (pure functions)
 * - Reusability across components
 * - Cleaner separation of concerns
 */
const schemaFormSchema = z.object({
  name: z.string()
    .min(1, 'Schema-Name ist erforderlich')
    .max(255, 'Schema-Name darf maximal 255 Zeichen lang sein')
    .refine(
      (name) => name.trim().length > 0,
      'Schema-Name darf nicht nur aus Leerzeichen bestehen'
    ),
  description: z.string()
    .max(1000, 'Beschreibung darf maximal 1000 Zeichen lang sein')
    .optional(),
  fields: z.array(z.object({
    field_id: z.string().uuid('Ungültige Feld-ID'),
    display_order: z.number().int().min(0),
    show_on_card: z.boolean(),
  }))
    .min(1, 'Mindestens ein Feld ist erforderlich')
    .max(20, 'Maximal 20 Felder pro Schema erlaubt')
    .superRefine((fields, ctx) => {
      // Delegate to extracted validators for better testability
      validateAllSchemaFields(fields, ctx);
    }),
})

export type SchemaFormData = z.infer<typeof schemaFormSchema>

interface SchemaEditorProps {
  listId: string
  onSave: (data: SchemaFormData) => Promise<void>
  onCancel: () => void
  initialData?: Partial<SchemaFormData>
}

export function SchemaEditor({ listId, onSave, onCancel, initialData }: SchemaEditorProps) {
  const [isCreatingField, setIsCreatingField] = useState(false)

  const form = useForm<SchemaFormData>({
    resolver: zodResolver(schemaFormSchema),
    defaultValues: {
      name: initialData?.name ?? '',
      description: initialData?.description ?? '',
      fields: initialData?.fields ?? [],
    },
  })

  const { fields, append, remove, move, update } = useFieldArray({
    control: form.control,
    name: 'fields',
  })

  // Fetch all custom fields to map field_id -> field details
  const { data: allCustomFields = [] } = useCustomFields(listId)

  // Map fields to FieldItem format with field names and types
  const fieldItems: FieldItem[] = useMemo(() => {
    return fields.map((field) => {
      const customField = allCustomFields.find(cf => cf.id === field.field_id)
      return {
        id: field.id, // Stable key from useFieldArray
        field_id: field.field_id,
        display_order: field.display_order,
        show_on_card: field.show_on_card,
        field_name: customField?.name ?? 'Unknown Field',
        field_type: customField?.field_type ?? 'unknown',
      }
    })
  }, [fields, allCustomFields])

  const handleSubmit = async (data: SchemaFormData) => {
    try {
      await onSave(data)
    } catch (error: any) {
      // Error handling with specific status codes
      // Set error first before any other operations
      if (error.response?.status === 409) {
        form.setError('name', {
          message: 'Ein Schema mit diesem Namen existiert bereits',
        })
      } else if (error.response?.status === 422) {
        // Validation error from backend
        form.setError('root', {
          message: error.response.data.detail || 'Validierungsfehler',
        })
      } else {
        form.setError('root', {
          message: 'Fehler beim Speichern des Schemas. Bitte versuchen Sie es erneut.',
        })
      }
      // Do NOT re-throw error - let form stay in error state
      // Parent component gets notified via onSave promise rejection
    }
  }

  const handleFieldsSelected = (fieldIds: string[]) => {
    // Add newly selected fields to the form
    // Calculate current max display_order
    const maxOrder = fields.length > 0
      ? Math.max(...fields.map(f => f.display_order))
      : -1

    fieldIds.forEach((fieldId, index) => {
      append({
        field_id: fieldId,
        display_order: maxOrder + index + 1,
        show_on_card: false,
      })
    })
  }

  const handleFieldCreated = async (fieldData: any) => {
    // Create the field via API
    const { createCustomField } = await import('@/api/customFields')

    try {
      const newField = await createCustomField(listId, fieldData)

      // Add newly created field to the form
      const maxOrder = fields.length > 0
        ? Math.max(...fields.map(f => f.display_order))
        : -1

      append({
        field_id: newField.id,
        display_order: maxOrder + 1,
        show_on_card: false,
      })

      setIsCreatingField(false)
    } catch (error) {
      console.error('Failed to create field:', error)
      // Error will be handled by NewFieldForm
      throw error
    }
  }

  const handleReorder = (activeId: string, overId: string) => {
    const oldIndex = fields.findIndex(f => f.id === activeId)
    const newIndex = fields.findIndex(f => f.id === overId)

    if (oldIndex !== -1 && newIndex !== -1) {
      // Move field in array
      move(oldIndex, newIndex)

      // Update display_order values for all fields
      const reorderedFields = [...fields]
      const [movedField] = reorderedFields.splice(oldIndex, 1)
      if (movedField) {
        reorderedFields.splice(newIndex, 0, movedField)

        reorderedFields.forEach((field, index) => {
          update(index, { ...field, display_order: index })
        })
      }
    }
  }

  const handleToggleShowOnCard = (fieldId: string, show: boolean) => {
    const index = fields.findIndex(f => f.id === fieldId)
    if (index !== -1) {
      const field = fields[index]
      if (field) {
        update(index, { ...field, show_on_card: show })
      }
    }
  }

  const handleRemove = (fieldId: string) => {
    const index = fields.findIndex(f => f.id === fieldId)
    if (index !== -1) {
      remove(index)
    }
  }

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
      {/* Schema Metadata */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="schema-name">Schema-Name *</Label>
          <Input
            id="schema-name"
            {...form.register('name')}
            placeholder="z.B. Video Quality, Content Metrics"
            aria-invalid={!!form.formState.errors.name}
          />
          {form.formState.errors.name && (
            <p className="text-sm text-red-600 mt-1">{form.formState.errors.name.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="schema-description">Beschreibung (optional)</Label>
          <Textarea
            id="schema-description"
            {...form.register('description')}
            placeholder="Kurze Beschreibung des Schemas..."
            rows={2}
          />
          {form.formState.errors.description && (
            <p className="text-sm text-red-600 mt-1">{form.formState.errors.description.message}</p>
          )}
        </div>
      </div>

      {/* Field Selection & Management */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Felder ({fields.length})</Label>
          <div className="flex gap-2">
            <FieldSelector
              listId={listId}
              selectedFieldIds={fields.map(f => f.field_id)}
              onFieldsSelected={handleFieldsSelected}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCreatingField(true)}
            >
              + Neues Feld
            </Button>
          </div>
        </div>

        {/* NewFieldForm (Task #123) */}
        {isCreatingField && (
          <div className="p-4 border rounded-lg bg-muted/50">
            <NewFieldForm
              listId={listId}
              onSubmit={handleFieldCreated}
              onCancel={() => setIsCreatingField(false)}
            />
          </div>
        )}

        {/* TODO Task #127: Integrate new FieldOrderManager component with batch update API
            Old API (placeholder from Task #83d):
              <FieldOrderManager
                fields={fieldItems}
                onReorder={handleReorder}
                onToggleShowOnCard={handleToggleShowOnCard}
                onRemove={handleRemove}
              />

            New API (Task #126):
              <FieldOrderManager
                listId={listId}
                schemaId={schemaId}
                fields={schema?.schema_fields || []}
                onUpdate={async (updates) => {
                  await updateSchemaFieldsBatch.mutateAsync({ fields: updates })
                }}
                isUpdating={updateSchemaFieldsBatch.isPending}
              />
        */}
        {fields.length > 0 ? (
          <div className="space-y-2">
            {fieldItems.map((field) => (
              <div key={field.field_id} className="flex items-center gap-3 rounded-md border p-3">
                <div className="flex-1">
                  <div className="font-medium">{field.field.name}</div>
                  <div className="text-sm text-muted-foreground">{field.field.field_type}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            Noch keine Felder hinzugefügt. Erstellen Sie ein neues Feld oder wählen Sie vorhandene aus.
          </p>
        )}

        {/* Display field array errors */}
        {form.formState.errors.fields?.root && (
          <p className="text-sm text-red-600">{form.formState.errors.fields.root.message}</p>
        )}
        {form.formState.errors.fields?.message && (
          <p className="text-sm text-red-600">{form.formState.errors.fields.message}</p>
        )}
      </div>

      {/* Root errors */}
      {form.formState.errors.root && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{form.formState.errors.root.message}</p>
        </div>
      )}

      {/* Form Actions */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Abbrechen
        </Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Wird gespeichert...' : 'Schema erstellen'}
        </Button>
      </div>
    </form>
  )
}
