import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Info } from 'lucide-react'
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
import { Field, FieldLabel, FieldError, FieldDescription } from '@/components/ui/field'
import type { FieldSchemaResponse } from '@/types/schema'

const duplicateSchemaSchema = z.object({
  newName: z.string().min(1, 'Name ist erforderlich').max(255, 'Name zu lang (max 255 Zeichen)'),
})

type DuplicateSchemaFormData = z.infer<typeof duplicateSchemaSchema>

interface DuplicateSchemaDialogProps {
  open: boolean
  schema: FieldSchemaResponse | null
  onConfirm: (newName: string) => void
  onCancel: () => void
  isLoading: boolean
}

export const DuplicateSchemaDialog = ({
  open,
  schema,
  onConfirm,
  onCancel,
  isLoading,
}: DuplicateSchemaDialogProps) => {
  const form = useForm<DuplicateSchemaFormData>({
    resolver: zodResolver(duplicateSchemaSchema),
    defaultValues: {
      newName: '',
    },
  })

  // Generate default name when dialog opens
  useEffect(() => {
    if (schema && open) {
      form.reset({
        newName: `${schema.name} (Kopie)`,
      })
    }
  }, [schema, open, form])

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      form.reset({ newName: '' })
    }
  }, [open, form])

  const handleSubmit = (data: DuplicateSchemaFormData) => {
    onConfirm(data.newName.trim())
  }

  const fieldCount = schema?.schema_fields?.length || 0

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <DialogHeader>
            <DialogTitle>Schema duplizieren</DialogTitle>
            <DialogDescription>
              Erstellen Sie eine Kopie von "{schema?.name}" mit einem neuen Namen.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Name Field */}
            <Controller
              control={form.control}
              name="newName"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="duplicate-schema-name">
                    Neuer Name <span className="text-red-500">*</span>
                  </FieldLabel>
                  <Input
                    {...field}
                    id="duplicate-schema-name"
                    placeholder="z.B. Video Quality (Kopie)"
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

            {/* Info Badge */}
            {fieldCount > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Info className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  <p className="text-sm text-blue-900">
                    Alle {fieldCount} Feld{fieldCount !== 1 ? 'er' : ''} werden kopiert
                    (inkl. Reihenfolge und Kartenanzeige-Einstellungen).
                  </p>
                </div>
              </div>
            )}
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
            <Button type="submit" disabled={!form.formState.isValid || isLoading}>
              {isLoading ? 'Duplizieren...' : 'Duplizieren'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
