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
import type { FieldSchemaResponse } from '@/types/schema'

const editSchemaSchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich').max(255, 'Name zu lang (max 255 Zeichen)'),
  description: z.string().max(1000, 'Beschreibung zu lang (max 1000 Zeichen)').nullable().optional(),
})

type EditSchemaFormData = z.infer<typeof editSchemaSchema>

interface EditSchemaDialogProps {
  open: boolean
  schema: FieldSchemaResponse | null
  onConfirm: (data: { name: string; description: string | null }) => void
  onCancel: () => void
  isLoading: boolean
}

export const EditSchemaDialog = ({
  open,
  schema,
  onConfirm,
  onCancel,
  isLoading,
}: EditSchemaDialogProps) => {
  const form = useForm<EditSchemaFormData>({
    resolver: zodResolver(editSchemaSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  })

  // Sync form with schema prop
  useEffect(() => {
    if (schema) {
      form.reset({
        name: schema.name,
        description: schema.description || '',
      })
    }
  }, [schema, form])

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      form.reset({ name: '', description: '' })
    }
  }, [open, form])

  const handleSubmit = (data: EditSchemaFormData) => {
    onConfirm({
      name: data.name.trim(),
      description: data.description?.trim() || null,
    })
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <DialogHeader>
            <DialogTitle>Schema bearbeiten</DialogTitle>
            <DialogDescription>
              Ändern Sie den Namen oder die Beschreibung des Schemas.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Name Field */}
            <Controller
              control={form.control}
              name="name"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="edit-schema-name">
                    Name <span className="text-red-500">*</span>
                  </FieldLabel>
                  <Input
                    {...field}
                    id="edit-schema-name"
                    placeholder="z.B. Video Quality"
                    maxLength={255}
                    disabled={isLoading}
                    autoFocus
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldDescription>
                    {field.value?.length || 0}/255 Zeichen
                  </FieldDescription>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

            {/* Description Field */}
            <Controller
              control={form.control}
              name="description"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="edit-schema-description">
                    Beschreibung (optional)
                  </FieldLabel>
                  <Textarea
                    {...field}
                    value={field.value || ''}
                    id="edit-schema-description"
                    placeholder="z.B. Standard quality metrics for evaluating videos"
                    rows={3}
                    maxLength={1000}
                    disabled={isLoading}
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldDescription>
                    {field.value?.length || 0}/1000 Zeichen
                  </FieldDescription>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
            >
              Abbrechen
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Speichern...' : 'Speichern'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
