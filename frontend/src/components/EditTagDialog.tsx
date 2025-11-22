/**
 * EditTagDialog Component
 *
 * Modal dialog for editing existing tags with name, color, and schema.
 * Uses AlertDialog from Radix UI for accessibility.
 * Follows React Hook Form + Zod pattern for validation.
 *
 * @example
 * ```tsx
 * <EditTagDialog
 *   tag={selectedTag}
 *   open={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   listId={listId}
 * />
 * ```
 */
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useUpdateTag } from '@/hooks/useTags'
import { schemasOptions } from '@/hooks/useSchemas'
import { useQuery } from '@tanstack/react-query'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import type { Tag } from '@/types/tag'

/**
 * Zod schema for tag edit form validation
 *
 * Validates:
 * - name: Required, 1-100 characters
 * - color: Valid hex color or null
 * - schema_id: Valid UUID or null
 * - is_video_type: Boolean for category (true) vs label (false)
 */
const TagFormSchema = z.object({
  name: z.string()
    .min(1, 'Tag name is required')
    .max(100, 'Tag name must be 100 characters or less'),
  color: z.string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format. Use hex format like #3B82F6')
    .nullable(),
  schema_id: z.string().uuid().nullable(),
  is_video_type: z.boolean(),
})

type TagFormData = z.infer<typeof TagFormSchema>

interface EditTagDialogProps {
  tag: Tag
  open: boolean
  onClose: () => void
  listId: string
}

export function EditTagDialog({ tag, open, onClose, listId }: EditTagDialogProps) {
  const updateTag = useUpdateTag()

  // Fetch schemas for dropdown
  const { data: schemas = [] } = useQuery({
    ...schemasOptions(listId),
    enabled: !!listId && open,
  })

  const form = useForm<TagFormData>({
    resolver: zodResolver(TagFormSchema),
    defaultValues: {
      name: tag.name,
      color: tag.color || '#3B82F6',
      schema_id: tag.schema_id || null,
      is_video_type: tag.is_video_type,
    },
  })

  // Reset form when tag changes or dialog opens
  useEffect(() => {
    if (open && tag) {
      form.reset({
        name: tag.name,
        color: tag.color || '#3B82F6',
        schema_id: tag.schema_id || null,
        is_video_type: tag.is_video_type,
      })
    }
  }, [tag, open, form])

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      form.reset({
        name: tag.name,
        color: tag.color || '#3B82F6',
        schema_id: tag.schema_id || null,
        is_video_type: tag.is_video_type,
      })
    }
  }, [open, tag, form])

  const handleSubmit = form.handleSubmit(async (data) => {
    try {
      await updateTag.mutateAsync({
        tagId: tag.id,
        data: {
          name: data.name.trim(),
          color: data.color ?? undefined,
          schema_id: data.schema_id,
          is_video_type: data.is_video_type,
        },
      })
      onClose()
    } catch (error: any) {
      // Handle API errors
      const errorMessage = error.response?.data?.detail || 'Failed to update tag'
      form.setError('name', {
        type: 'server',
        message: errorMessage,
      })
    }
  })

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      onClose()
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Edit Tag</AlertDialogTitle>
          <AlertDialogDescription>
            Update tag name, color, or schema assignment.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name Field */}
          <div>
            <Label htmlFor="edit-tag-name">Name *</Label>
            <Input
              id="edit-tag-name"
              {...form.register('name')}
              placeholder="Enter tag name"
              maxLength={100}
              disabled={updateTag.isPending}
              autoFocus
            />
            {form.formState.errors.name && (
              <p className="text-sm text-red-600 mt-1">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          {/* Type Selection - Category vs Label */}
          <div>
            <Label className="mb-2 block">Typ</Label>
            <RadioGroup
              value={form.watch('is_video_type') ? 'category' : 'label'}
              onValueChange={(value) => form.setValue('is_video_type', value === 'category')}
              className="flex gap-4"
              disabled={updateTag.isPending}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="category" id="edit-type-category" />
                <Label htmlFor="edit-type-category" className="font-normal cursor-pointer">
                  Kategorie
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="label" id="edit-type-label" />
                <Label htmlFor="edit-type-label" className="font-normal cursor-pointer">
                  Label
                </Label>
              </div>
            </RadioGroup>
            <p className="mt-1 text-sm text-gray-500">
              {form.watch('is_video_type')
                ? 'Ein Video kann nur eine Kategorie haben'
                : 'Ein Video kann mehrere Labels haben'}
            </p>
          </div>

          {/* Color Field */}
          <div>
            <Label htmlFor="edit-tag-color">Farbe</Label>
            <div className="flex gap-2">
              <input
                type="color"
                id="edit-tag-color"
                value={form.watch('color') || '#3B82F6'}
                onChange={(e) => form.setValue('color', e.target.value)}
                className="h-10 w-16 rounded border cursor-pointer"
                disabled={updateTag.isPending}
              />
              <Input
                {...form.register('color')}
                placeholder="#3B82F6"
                className="flex-1"
                disabled={updateTag.isPending}
              />
            </div>
            {form.formState.errors.color && (
              <p className="text-sm text-red-600 mt-1">
                {form.formState.errors.color.message}
              </p>
            )}
          </div>

          {/* Schema Field */}
          <div>
            <Label htmlFor="edit-tag-schema">Schema (optional)</Label>
            <Select
              value={form.watch('schema_id') || 'none'}
              onValueChange={(value) =>
                form.setValue('schema_id', value === 'none' ? null : value)
              }
              disabled={updateTag.isPending}
            >
              <SelectTrigger id="edit-tag-schema">
                <SelectValue placeholder="Select schema" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Schema</SelectItem>
                {schemas.map((schema) => (
                  <SelectItem key={schema.id} value={schema.id}>
                    {schema.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-sm text-gray-500">
              Link custom fields to this tag
            </p>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={onClose} type="button">
              Cancel
            </AlertDialogCancel>
            <Button type="submit" disabled={updateTag.isPending}>
              {updateTag.isPending ? 'Saving...' : 'Save'}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}
