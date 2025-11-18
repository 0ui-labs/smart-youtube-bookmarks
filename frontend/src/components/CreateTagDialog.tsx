/**
 * CreateTagDialog Component
 *
 * Modal dialog for creating new tags with name, optional color, and optional schema.
 * Uses AlertDialog from Radix UI for accessibility.
 *
 * @example
 * ```tsx
 * <CreateTagDialog
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   listId={listId}
 * />
 * ```
 */
import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { useCreateTag } from '@/hooks/useTags'
import { SchemaSelector } from './SchemaSelector'
import { schemasOptions, useCreateSchema } from '@/hooks/useSchemas'
import { useQuery } from '@tanstack/react-query'
import { SchemaEditor, type SchemaFormData } from './schemas/SchemaEditor'

interface CreateTagDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  listId: string
}

export const CreateTagDialog = ({ open, onOpenChange, listId }: CreateTagDialogProps) => {
  const [name, setName] = useState('')
  const [color, setColor] = useState('#3B82F6') // Default blue
  const [error, setError] = useState<string | null>(null)
  // Task #82: Schema ID state for SchemaSelector
  // null = "Kein Schema", 'new' = Create new schema, UUID string = Existing schema
  const [schemaId, setSchemaId] = useState<string | null>(null)

  const createTag = useCreateTag()
  const createSchema = useCreateSchema(listId)

  // Task #82 Batch 3: Fetch schemas with dependent query
  const { data: schemas = [], isLoading: isSchemasLoading } = useQuery({
    ...schemasOptions(listId),
    enabled: !!listId,  // REF MCP Improvement #4: Dependent query pattern
  })

  // Bug #001 Fix: Handlers for inline schema creation
  const handleSchemaCreated = async (schemaData: SchemaFormData) => {
    try {
      const newSchema = await createSchema.mutateAsync({
        name: schemaData.name,
        description: schemaData.description,
        fields: schemaData.fields,
      })

      // Set schemaId to newly created schema
      setSchemaId(newSchema.id)
    } catch (error) {
      // Error is handled by SchemaEditor component
      // Re-throw to let SchemaEditor display the error
      throw error
    }
  }

  const handleSchemaCancelled = () => {
    // Reset to "no schema" when user cancels
    setSchemaId(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!name.trim()) {
      setError('Bitte geben Sie einen Tag-Namen ein')
      return
    }

    if (name.length > 50) {
      setError('Tag-Name darf maximal 50 Zeichen lang sein')
      return
    }

    // Bug #001 Fix: Validate 'new' mode (edge case protection)
    if (schemaId === 'new') {
      setError('Bitte erstellen Sie das Schema oder brechen Sie die Erstellung ab')
      return
    }

    try {
      await createTag.mutateAsync({
        name: name.trim(),
        color: color || undefined, // Send undefined if empty
        schema_id: schemaId,  // Task #82 Batch 3: Include schema_id
      })

      // Success - reset form and close dialog
      setName('')
      setColor('#3B82F6')
      setSchemaId(null)
      setError(null)
      onOpenChange(false)
    } catch (err: any) {
      // Handle errors
      if (err.response?.status === 409) {
        setError('Ein Tag mit diesem Namen existiert bereits')
      } else {
        setError('Fehler beim Erstellen des Tags. Bitte versuchen Sie es erneut.')
      }
    }
  }

  const handleCancel = () => {
    setName('')
    setColor('#3B82F6')
    setSchemaId(null)
    setError(null)
    onOpenChange(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Neuen Tag erstellen</AlertDialogTitle>
        </AlertDialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Tag Name Input */}
            <div>
              <label
                htmlFor="tag-name"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Name *
              </label>
              <input
                id="tag-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z.B. Python, Tutorial, Wichtig"
                className={`w-full px-3 py-2 border ${
                  error ? 'border-red-500' : 'border-gray-300'
                } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                autoFocus
                maxLength={50}
              />
              {error && (
                <p className="mt-1 text-sm text-red-600">{error}</p>
              )}
            </div>

            {/* Color Picker */}
            <div>
              <label
                htmlFor="tag-color"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Farbe (optional)
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="tag-color"
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-10 w-20 rounded cursor-pointer border border-gray-300"
                />
                <span className="text-sm text-gray-600">{color}</span>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Wählen Sie eine Farbe zur visuellen Unterscheidung
              </p>
            </div>

            {/* Task #82 Batch 3: Schema Selector */}
            <div>
              <label
                htmlFor="tag-schema"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Schema (optional)
              </label>
              <SchemaSelector
                value={schemaId}
                schemas={schemas}
                onChange={setSchemaId}
                disabled={isSchemasLoading}
              />
              <p className="mt-1 text-sm text-gray-500">
                Verknüpfen Sie benutzerdefinierte Felder mit diesem Tag
              </p>

              {/* Bug #001 Fix: Show SchemaEditor when schemaId === 'new' */}
              {schemaId === 'new' && (
                <div className="mt-4 p-4 border rounded-lg bg-gray-50">
                  <SchemaEditor
                    listId={listId}
                    onSave={handleSchemaCreated}
                    onCancel={handleSchemaCancelled}
                  />
                </div>
              )}
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel} type="button">
              Abbrechen
            </AlertDialogCancel>
            <Button
              type="submit"
              disabled={createTag.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {createTag.isPending ? 'Wird erstellt...' : 'Erstellen'}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}
