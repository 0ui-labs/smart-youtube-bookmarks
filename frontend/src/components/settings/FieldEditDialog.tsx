import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, FieldLabel, FieldError, FieldDescription } from '@/components/ui/field'
import type { CustomFieldResponse } from '@/types/customField'

/**
 * Zod schema for field edit form validation
 *
 * Validates:
 * - name: Required, 1-255 characters, trimmed, non-empty
 * - config: Valid JSON string that parses to object
 */
const editFieldSchema = z.object({
  name: z.string()
    .min(1, 'Field name cannot be empty')
    .max(255, 'Field name must be 255 characters or less')
    .refine(val => val.trim().length > 0, 'Field name cannot be only whitespace'),
  config: z.string()
    .min(1, 'Configuration cannot be empty')
    .refine(
      (val) => {
        try {
          JSON.parse(val)
          return true
        } catch {
          return false
        }
      },
      { message: 'Invalid JSON format' }
    ),
})

type EditFieldFormData = z.infer<typeof editFieldSchema>

/**
 * Deep equality comparison for objects
 * Handles nested objects and arrays recursively
 * Avoids false positives from property order differences
 */
const deepEqual = (obj1: any, obj2: any): boolean => {
  if (obj1 === obj2) return true
  if (obj1 == null || obj2 == null) return false
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return false

  // Handle arrays separately
  const isArray1 = Array.isArray(obj1)
  const isArray2 = Array.isArray(obj2)

  if (isArray1 !== isArray2) return false

  if (isArray1 && isArray2) {
    if (obj1.length !== obj2.length) return false
    return obj1.every((item: any, index: number) => deepEqual(item, obj2[index]))
  }

  const keys1 = Object.keys(obj1)
  const keys2 = Object.keys(obj2)

  if (keys1.length !== keys2.length) return false

  for (const key of keys1) {
    if (!Object.prototype.hasOwnProperty.call(obj2, key)) return false
    if (!deepEqual(obj1[key], obj2[key])) return false
  }

  return true
}

interface FieldEditDialogProps {
  open: boolean
  field: CustomFieldResponse | null
  onClose: () => void
  onSave: (fieldId: string, updates: { name?: string; config?: any }) => void
  isLoading: boolean
}

/**
 * Dialog for editing custom field name and configuration
 *
 * Uses React Hook Form + Field Component Pattern (mandatory per CLAUDE.md)
 *
 * Features:
 * - Partial updates (only changed fields sent to API)
 * - JSON editor for config (power users can edit directly)
 * - Form validation via React Hook Form + Zod
 * - Field Component Pattern for accessibility
 *
 * Validation:
 * - Name: 1-255 characters, trimmed, non-empty
 * - Config: Valid JSON structure (no type validation yet)
 *
 * @example
 * ```tsx
 * const updateField = useUpdateCustomField(listId)
 *
 * <FieldEditDialog
 *   open={isOpen}
 *   field={selectedField}
 *   onClose={() => setIsOpen(false)}
 *   onSave={(fieldId, updates) => updateField.mutate({ fieldId, data: updates })}
 *   isLoading={updateField.isPending}
 * />
 * ```
 */
export const FieldEditDialog = ({
  open,
  field,
  onClose,
  onSave,
  isLoading,
}: FieldEditDialogProps) => {
  const form = useForm<EditFieldFormData>({
    resolver: zodResolver(editFieldSchema),
    defaultValues: {
      name: '',
      config: '{}',
    },
  })

  // Sync form with field prop when it changes
  useEffect(() => {
    if (field) {
      form.reset({
        name: field.name,
        config: JSON.stringify(field.config, null, 2), // Pretty-print JSON
      })
    }
  }, [field, form])

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      form.reset({ name: '', config: '{}' })
    }
  }, [open, form])

  const handleSubmit = (data: EditFieldFormData) => {
    if (!field) return

    // Parse config JSON (already validated by Zod)
    const parsedConfig = JSON.parse(data.config)

    // Build partial update object (only changed fields)
    const updates: { name?: string; config?: any } = {}

    const trimmedName = data.name.trim()
    if (trimmedName !== field.name) {
      updates.name = trimmedName
    }

    if (!deepEqual(parsedConfig, field.config)) {
      updates.config = parsedConfig
    }

    // Call mutation with field ID and updates
    onSave(field.id, updates)
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <DialogHeader>
            <DialogTitle>Edit Field</DialogTitle>
            <DialogDescription>
              Update field name or configuration. Changes apply to all schemas using this field.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Name Field */}
            <Controller
              control={form.control}
              name="name"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="edit-field-name">
                    Field Name <span className="text-red-500">*</span>
                  </FieldLabel>
                  <Input
                    {...field}
                    id="edit-field-name"
                    placeholder="e.g., Presentation Quality"
                    maxLength={255}
                    disabled={isLoading}
                    autoFocus
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldDescription>
                    {field.value?.length || 0}/255 characters
                  </FieldDescription>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

            {/* Config Field (JSON Editor) */}
            <Controller
              control={form.control}
              name="config"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="edit-field-config">
                    Configuration (JSON) <span className="text-red-500">*</span>
                  </FieldLabel>
                  <Textarea
                    {...field}
                    id="edit-field-config"
                    placeholder='{ "max_rating": 5 }'
                    rows={6}
                    disabled={isLoading}
                    className="font-mono text-sm"
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldDescription>
                    Edit the field configuration in JSON format
                  </FieldDescription>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

            {/* Warning Message */}
            <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
              <strong>Note:</strong> Changing field configuration may affect existing values.
              Ensure the new config is compatible with existing data.
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!form.formState.isValid || isLoading}>
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
