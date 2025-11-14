# Task #137: Schema Actions Implementation - ADAPTED PLAN (REF MCP Validated)

**Original Plan:** `task-137-schema-actions-implementation-plan.md`
**REF MCP Validation Date:** 2025-11-13
**Status:** Ready for Implementation
**Adaptations Applied:** 3 critical fixes based on REF MCP validation

---

## REF MCP Validation Summary

✅ **Validated Against:**
- Radix UI DropdownMenu documentation (2024)
- Radix UI AlertDialog documentation (2024)
- TanStack Query v5 optimistic updates patterns (2024)
- React Hook Form + Field Component Pattern (CLAUDE.md requirement)

⚠️ **Critical Issues Found & Fixed:**
1. **React Query v5 API** - Old v4 signature → New v5 context API
2. **Form Pattern** - useState → React Hook Form + Field Component (CLAUDE.md mandatory)
3. **Icons** - Inline SVG → lucide-react imports (project standard)

---

## Adaptation #1: React Query v5 Context API

### ❌ Original Plan (Incorrect):
```typescript
onMutate: async ({ schemaId, data }) => {
  await queryClient.cancelQueries({ queryKey: schemasOptions(listId).queryKey })
  const previous = queryClient.getQueryData(...)
  return { previous }
}
```

### ✅ Adapted (REF MCP Validated):
```typescript
onMutate: async (variables, context) => {
  // ✅ Use context.client instead of direct queryClient
  await context.client.cancelQueries({ queryKey: ['schemas', listId] })
  const previousSchemas = context.client.getQueryData(['schemas', listId])

  // Optimistically update
  if (previousSchemas) {
    context.client.setQueryData(['schemas', listId], (old) =>
      old.map((s) =>
        s.id === variables.schemaId
          ? { ...s, ...variables.data, updated_at: new Date().toISOString() }
          : s
      )
    )
  }

  return { previousSchemas }
},
onError: (err, variables, onMutateResult, context) => {
  // ✅ Both onMutateResult AND context available
  if (onMutateResult?.previousSchemas) {
    context.client.setQueryData(['schemas', listId], onMutateResult.previousSchemas)
  }
},
onSettled: (data, error, variables, onMutateResult, context) => {
  // ✅ Context parameter for invalidation
  context.client.invalidateQueries({ queryKey: ['schemas', listId] })
}
```

**Why:** React Query v5 changed mutation callback signatures to include `context` parameter with `context.client` for better isolation and testing.

---

## Adaptation #2: React Hook Form + Field Component Pattern

### ❌ Original Plan (Violates CLAUDE.md):
```typescript
const [name, setName] = useState('')
const [description, setDescription] = useState('')

<Input value={name} onChange={(e) => setName(e.target.value)} />
```

### ✅ Adapted (CLAUDE.md Compliant):
```typescript
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Field, FieldLabel, FieldError, FieldDescription } from '@/components/ui/field'

const editSchemaSchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich').max(255),
  description: z.string().max(1000).nullable().optional(),
})

const form = useForm({
  resolver: zodResolver(editSchemaSchema),
  defaultValues: {
    name: schema?.name || '',
    description: schema?.description || '',
  },
})

<Controller
  control={form.control}
  name="name"
  render={({ field, fieldState }) => (
    <Field data-invalid={fieldState.invalid}>
      <FieldLabel htmlFor="name">Name *</FieldLabel>
      <Input {...field} id="name" disabled={isLoading} />
      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
    </Field>
  )}
/>
```

**Why:** CLAUDE.md explicitly states: "⚠️ All forms MUST use Field Component pattern (2025 shadcn/ui)". This is a mandatory project standard (see `docs/patterns/field-component-pattern.md`).

---

## Adaptation #3: lucide-react Icons

### ❌ Original Plan (Inconsistent):
```typescript
<svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
  <path d="M11 4H4a2 2 0 0 0-2 2v14..." />
</svg>
```

### ✅ Adapted (Project Standard):
```typescript
import { Edit2, Copy, BarChart3, Trash2, MoreVertical } from 'lucide-react'

<Edit2 className="w-4 h-4 mr-2" />
<Copy className="w-4 h-4 mr-2" />
<BarChart3 className="w-4 h-4 mr-2" />
<Trash2 className="w-4 h-4 mr-2" />
```

**Why:** Project already uses lucide-react everywhere (VideoCard, CreateTagDialog). Tree-shakable, consistent icon set, easier maintenance.

---

## Implementation Plan (10 Tasks)

### Phase 1: Core Components (Tasks 1-5)

#### **Task 1: Create SchemaActionsMenu Component**

**File:** `frontend/src/components/SchemaActionsMenu.tsx`

**Implementation:**
```typescript
import { MoreVertical, Edit2, Copy, BarChart3, Trash2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { FieldSchemaResponse } from '@/types/schema'

interface SchemaActionsMenuProps {
  schema: FieldSchemaResponse
  usageCount: number
  onEdit: () => void
  onDelete: () => void
  onDuplicate: () => void
  onViewUsage: () => void
}

export const SchemaActionsMenu = ({
  schema,
  usageCount,
  onEdit,
  onDelete,
  onDuplicate,
  onViewUsage,
}: SchemaActionsMenuProps) => {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.stopPropagation()
          }
        }}
        tabIndex={-1}
        className="inline-flex items-center justify-center w-8 h-8 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0"
        aria-label={`Actions for ${schema.name}`}
      >
        <MoreVertical className="w-4 h-4" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
          className="cursor-pointer"
        >
          <Edit2 className="w-4 h-4 mr-2" />
          Schema bearbeiten
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation()
            onDuplicate()
          }}
          className="cursor-pointer"
        >
          <Copy className="w-4 h-4 mr-2" />
          Schema duplizieren
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation()
            onViewUsage()
          }}
          className="cursor-pointer"
        >
          <BarChart3 className="w-4 h-4 mr-2" />
          Verwendungsstatistik
          {usageCount > 0 && (
            <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
              {usageCount}
            </span>
          )}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="text-red-600 focus:text-red-700 cursor-pointer"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Schema löschen
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

**Key Points:**
- `modal={false}` for nested dialog compatibility
- Defense-in-depth stopPropagation (click + keyboard)
- Dynamic aria-label with schema name
- lucide-react icons (Edit2, Copy, BarChart3, Trash2)
- Usage count badge (blue pill)

---

#### **Task 2: Create EditSchemaDialog with React Hook Form**

**File:** `frontend/src/components/EditSchemaDialog.tsx`

**Implementation:**
```typescript
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
            <Button type="submit" disabled={!form.formState.isValid || isLoading}>
              {isLoading ? 'Speichern...' : 'Speichern'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

**Key Points:**
- React Hook Form with zodResolver validation
- Field Component Pattern (CLAUDE.md compliant)
- Character counters via FieldDescription
- Auto-focus on name field
- Form reset on open/close

---

#### **Task 3: Create ConfirmDeleteSchemaDialog**

**File:** `frontend/src/components/ConfirmDeleteSchemaDialog.tsx`

**Implementation:**
```typescript
import { AlertTriangle } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import type { FieldSchemaResponse } from '@/types/schema'

interface ConfirmDeleteSchemaDialogProps {
  open: boolean
  schema: FieldSchemaResponse | null
  usageStats: {
    count: number
    tagNames: string[]
  }
  onConfirm: () => void
  onCancel: () => void
  isLoading: boolean
}

export const ConfirmDeleteSchemaDialog = ({
  open,
  schema,
  usageStats,
  onConfirm,
  onCancel,
  isLoading,
}: ConfirmDeleteSchemaDialogProps) => {
  const schemaName = schema?.name || 'dieses Schema'
  const isUsed = usageStats.count > 0

  return (
    <AlertDialog open={open} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent className="sm:max-w-[500px]">
        <AlertDialogHeader>
          <AlertDialogTitle>Schema löschen?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              {isUsed ? (
                <>
                  {/* Usage Warning */}
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="font-medium text-orange-900">
                          Dieses Schema wird von {usageStats.count} Tag{usageStats.count !== 1 ? 's' : ''} verwendet:
                        </p>
                        <ul className="mt-2 space-y-1">
                          {usageStats.tagNames.slice(0, 5).map((tagName) => (
                            <li key={tagName} className="text-sm text-orange-800">
                              • {tagName}
                            </li>
                          ))}
                          {usageStats.tagNames.length > 5 && (
                            <li className="text-sm text-orange-700 font-medium">
                              ... und {usageStats.tagNames.length - 5} weitere
                            </li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>

                  <p className="text-sm">
                    Möchten Sie <strong>"{schemaName}"</strong> wirklich löschen?
                    Diese Tags verlieren ihre Schemaverbindung.
                  </p>
                </>
              ) : (
                <p>
                  Möchten Sie das Schema <strong>"{schemaName}"</strong> wirklich löschen?
                  Diese Aktion kann nicht rückgängig gemacht werden.
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Abbrechen</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              variant="destructive"
              onClick={(e) => {
                e.preventDefault() // Prevent auto-close during async
                onConfirm()
              }}
              disabled={isLoading}
              className="bg-red-600 text-white hover:bg-red-700 focus:ring-red-500"
            >
              {isLoading ? 'Löschen...' : 'Schema löschen'}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

**Key Points:**
- AlertDialog for destructive action
- Orange warning box with AlertTriangle icon (lucide-react)
- Show first 5 tags, then "... und X weitere"
- preventDefault() on confirm button (REF MCP pattern)
- Different messaging for used vs unused schemas

---

#### **Task 4: Create DuplicateSchemaDialog**

**File:** `frontend/src/components/DuplicateSchemaDialog.tsx`

**Implementation:**
```typescript
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
```

**Key Points:**
- React Hook Form with validation
- Auto-generate name with "(Kopie)" suffix
- Info badge showing field count (lucide-react Info icon)
- Field Component Pattern compliant

---

#### **Task 5: Create SchemaUsageStatsModal**

**File:** `frontend/src/components/SchemaUsageStatsModal.tsx`

**Implementation:**
```typescript
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
import type { FieldSchemaResponse } from '@/types/schema'
import type { Tag } from '@/types/tag'

interface SchemaUsageStatsModalProps {
  open: boolean
  schema: FieldSchemaResponse | null
  tags: Tag[]
  onClose: () => void
}

export const SchemaUsageStatsModal = ({
  open,
  schema,
  tags,
  onClose,
}: SchemaUsageStatsModalProps) => {
  // Compute which tags use this schema
  const usedByTags = tags.filter((tag) => tag.schema_id === schema?.id)

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Verwendungsstatistik</DialogTitle>
          <DialogDescription>
            Schema: <strong>{schema?.name}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {usedByTags.length > 0 ? (
            <div className="space-y-3">
              <p className="text-sm font-medium">
                Verwendet von {usedByTags.length} Tag{usedByTags.length !== 1 ? 's' : ''}:
              </p>

              <ul className="space-y-2 max-h-[300px] overflow-y-auto">
                {usedByTags.map((tag) => (
                  <li
                    key={tag.id}
                    className="flex items-center gap-2 p-2 rounded-md hover:bg-gray-50"
                  >
                    {/* Tag Color Badge */}
                    {tag.color && (
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                    )}
                    {/* Tag Name */}
                    <span className="text-sm">{tag.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
              <Info className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-gray-600">
                Dieses Schema wird aktuell nicht von Tags verwendet.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Schließen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

**Key Points:**
- Read-only modal (no form)
- Client-side filtering of tags
- Tag color badges
- Empty state with Info icon (lucide-react)
- Scrollable list (max-h-[300px])

---

### Phase 2: Mutation Hooks (Task 6)

#### **Task 6: Add Mutation Hooks to useSchemas.ts**

**File:** `frontend/src/hooks/useSchemas.ts` (extend existing)

**Implementation:**
```typescript
import { useQuery, useMutation, useQueryClient, queryOptions } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { FieldSchemaResponse, FieldSchemaCreate, FieldSchemaUpdate } from '@/types/schema'

/**
 * Query options factory for schemas
 */
export function schemasOptions(listId: string) {
  return queryOptions({
    queryKey: ['schemas', listId],
    queryFn: async () => {
      const { data } = await api.get<FieldSchemaResponse[]>(`/lists/${listId}/schemas`)
      return data
    },
  })
}

/**
 * Hook to fetch all schemas for a list
 */
export const useSchemas = (listId: string) => {
  return useQuery(schemasOptions(listId))
}

/**
 * Hook to update schema metadata (name and/or description)
 *
 * ✅ REF MCP Validated: Uses React Query v5 context API
 */
export const useUpdateSchema = (listId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ['updateSchema'],
    mutationFn: async ({
      schemaId,
      data,
    }: {
      schemaId: string
      data: FieldSchemaUpdate
    }) => {
      const response = await api.put<FieldSchemaResponse>(
        `/lists/${listId}/schemas/${schemaId}`,
        data
      )
      return response.data
    },
    // ✅ v5 signature: (variables, context)
    onMutate: async (variables, context) => {
      await context.client.cancelQueries({ queryKey: ['schemas', listId] })

      const previousSchemas = context.client.getQueryData<FieldSchemaResponse[]>(['schemas', listId])

      if (previousSchemas) {
        context.client.setQueryData<FieldSchemaResponse[]>(
          ['schemas', listId],
          previousSchemas.map((schema) =>
            schema.id === variables.schemaId
              ? { ...schema, ...variables.data, updated_at: new Date().toISOString() }
              : schema
          )
        )
      }

      return { previousSchemas }
    },
    // ✅ v5 signature: (err, variables, onMutateResult, context)
    onError: (err, variables, onMutateResult, context) => {
      console.error('Failed to update schema:', err)
      if (onMutateResult?.previousSchemas) {
        context.client.setQueryData(['schemas', listId], onMutateResult.previousSchemas)
      }
    },
    // ✅ v5 signature: includes context
    onSettled: (data, error, variables, onMutateResult, context) => {
      context.client.invalidateQueries({ queryKey: ['schemas', listId] })
    },
  })
}

/**
 * Hook to delete a schema
 *
 * ✅ REF MCP Validated: Uses React Query v5 context API
 */
export const useDeleteSchema = (listId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ['deleteSchema'],
    mutationFn: async ({ schemaId }: { schemaId: string }) => {
      await api.delete(`/lists/${listId}/schemas/${schemaId}`)
    },
    onMutate: async (variables, context) => {
      await context.client.cancelQueries({ queryKey: ['schemas', listId] })

      const previousSchemas = context.client.getQueryData<FieldSchemaResponse[]>(['schemas', listId])

      if (previousSchemas) {
        context.client.setQueryData<FieldSchemaResponse[]>(
          ['schemas', listId],
          previousSchemas.filter((schema) => schema.id !== variables.schemaId)
        )
      }

      return { previousSchemas }
    },
    onError: (err, variables, onMutateResult, context) => {
      console.error('Failed to delete schema:', err)
      if (onMutateResult?.previousSchemas) {
        context.client.setQueryData(['schemas', listId], onMutateResult.previousSchemas)
      }
    },
    onSettled: (data, error, variables, onMutateResult, context) => {
      context.client.invalidateQueries({ queryKey: ['schemas', listId] })
      // Also invalidate tags (schema_id may be SET NULL)
      context.client.invalidateQueries({ queryKey: ['tags'] })
    },
  })
}

/**
 * Hook to duplicate a schema
 *
 * Client-side implementation:
 * 1. GET schema by ID (to get full schema_fields data)
 * 2. POST new schema with copied fields
 *
 * ✅ REF MCP Validated: Uses React Query v5 context API
 */
export const useDuplicateSchema = (listId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ['duplicateSchema'],
    mutationFn: async ({
      schemaId,
      newName,
    }: {
      schemaId: string
      newName: string
    }) => {
      // Step 1: GET original schema
      const { data: originalSchema } = await api.get<FieldSchemaResponse>(
        `/lists/${listId}/schemas/${schemaId}`
      )

      // Step 2: Create new schema with copied fields
      const createData: FieldSchemaCreate = {
        name: newName,
        description: originalSchema.description,
        fields: originalSchema.schema_fields.map((sf) => ({
          field_id: sf.field_id,
          display_order: sf.display_order,
          show_on_card: sf.show_on_card,
        })),
      }

      const { data: newSchema } = await api.post<FieldSchemaResponse>(
        `/lists/${listId}/schemas`,
        createData
      )

      return newSchema
    },
    // No optimistic update (too complex with nested data)
    onError: (err) => {
      console.error('Failed to duplicate schema:', err)
    },
    onSuccess: (data, variables, context) => {
      context.client.invalidateQueries({ queryKey: ['schemas', listId] })
    },
  })
}

/**
 * Compute usage statistics for a schema
 *
 * Client-side computation from tags array (no backend call)
 */
export const useSchemaUsageStats = (schemaId: string | null, tags: any[] = []) => {
  if (!schemaId || !tags) {
    return { count: 0, tagNames: [] }
  }

  const usedByTags = tags.filter((tag) => tag.schema_id === schemaId)
  return {
    count: usedByTags.length,
    tagNames: usedByTags.map((tag) => tag.name),
  }
}
```

**Key Points:**
- ✅ React Query v5 context API signatures
- Optimistic updates for edit/delete (instant UI)
- Client-side duplication (GET + POST)
- Client-side usage stats (no backend call)
- Tag invalidation on delete

---

### Phase 3: Integration (Task 7)

#### **Task 7: Integrate SchemaActionsMenu into SchemaCard**

**File:** `frontend/src/components/SchemaCard.tsx` (extend from Task #136)

**Implementation:**
```typescript
import { useState } from 'react'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { SchemaActionsMenu } from './SchemaActionsMenu'
import { EditSchemaDialog } from './EditSchemaDialog'
import { ConfirmDeleteSchemaDialog } from './ConfirmDeleteSchemaDialog'
import { DuplicateSchemaDialog } from './DuplicateSchemaDialog'
import { SchemaUsageStatsModal } from './SchemaUsageStatsModal'
import { useUpdateSchema, useDeleteSchema, useDuplicateSchema, useSchemaUsageStats } from '@/hooks/useSchemas'
import { useTags } from '@/hooks/useTags'
import type { FieldSchemaResponse } from '@/types/schema'

interface SchemaCardProps {
  schema: FieldSchemaResponse
  listId: string
  onClick?: (schema: FieldSchemaResponse) => void
}

export const SchemaCard = ({ schema, listId, onClick }: SchemaCardProps) => {
  const { data: tags = [] } = useTags()
  const usageStats = useSchemaUsageStats(schema.id, tags)

  // Mutations
  const updateSchema = useUpdateSchema(listId)
  const deleteSchema = useDeleteSchema(listId)
  const duplicateSchema = useDuplicateSchema(listId)

  // Modal states
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [duplicateOpen, setDuplicateOpen] = useState(false)
  const [usageStatsOpen, setUsageStatsOpen] = useState(false)

  // Action handlers
  const handleEdit = (data: { name: string; description: string | null }) => {
    updateSchema.mutate(
      { schemaId: schema.id, data },
      {
        onSuccess: () => {
          setEditOpen(false)
        },
        // Keep modal open on error for retry
      }
    )
  }

  const handleDelete = () => {
    deleteSchema.mutate(
      { schemaId: schema.id },
      {
        onSuccess: () => {
          setDeleteOpen(false)
        },
        // Keep modal open on error (e.g., 409 Conflict)
      }
    )
  }

  const handleDuplicate = (newName: string) => {
    duplicateSchema.mutate(
      { schemaId: schema.id, newName },
      {
        onSuccess: () => {
          setDuplicateOpen(false)
        },
        // Keep modal open on error for retry
      }
    )
  }

  return (
    <>
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-start gap-2">
          <div className="flex-1">
            <h3 className="text-lg font-semibold">{schema.name}</h3>
            {schema.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {schema.description}
              </p>
            )}
          </div>

          {/* Actions Menu */}
          <SchemaActionsMenu
            schema={schema}
            usageCount={usageStats.count}
            onEdit={() => setEditOpen(true)}
            onDelete={() => setDeleteOpen(true)}
            onDuplicate={() => setDuplicateOpen(true)}
            onViewUsage={() => setUsageStatsOpen(true)}
          />
        </CardHeader>

        <CardContent>
          {/* Field preview (from Task #136) */}
          <p className="text-sm text-muted-foreground">
            {schema.schema_fields.length} Feld{schema.schema_fields.length !== 1 ? 'er' : ''}
          </p>
        </CardContent>
      </Card>

      {/* Modals */}
      <EditSchemaDialog
        open={editOpen}
        schema={schema}
        onConfirm={handleEdit}
        onCancel={() => setEditOpen(false)}
        isLoading={updateSchema.isPending}
      />

      <ConfirmDeleteSchemaDialog
        open={deleteOpen}
        schema={schema}
        usageStats={usageStats}
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
        isLoading={deleteSchema.isPending}
      />

      <DuplicateSchemaDialog
        open={duplicateOpen}
        schema={schema}
        onConfirm={handleDuplicate}
        onCancel={() => setDuplicateOpen(false)}
        isLoading={duplicateSchema.isPending}
      />

      <SchemaUsageStatsModal
        open={usageStatsOpen}
        schema={schema}
        tags={tags}
        onClose={() => setUsageStatsOpen(false)}
      />
    </>
  )
}
```

**Key Points:**
- Four modal states (edit/delete/duplicate/usage)
- Usage stats computed from useTags()
- Close on success, stay open on error
- Loading states via isPending

---

### Phase 4: Testing (Tasks 8-9)

#### **Task 8: Write Unit Tests**

**Files to Create:**
1. `frontend/src/components/SchemaActionsMenu.test.tsx` (6 tests)
2. `frontend/src/components/EditSchemaDialog.test.tsx` (7 tests)
3. `frontend/src/components/ConfirmDeleteSchemaDialog.test.tsx` (6 tests)
4. `frontend/src/components/DuplicateSchemaDialog.test.tsx` (5 tests)
5. `frontend/src/components/SchemaUsageStatsModal.test.tsx` (4 tests)

**Test Patterns (REF MCP from Task #135):**
- `userEvent.setup({ delay: null })` for fast tests
- `afterEach(() => vi.clearAllMocks())` cleanup
- Mock hooks with `vi.mock()`
- Test accessibility (aria-labels, keyboard navigation)
- Test form validation with React Hook Form

---

#### **Task 9: Write Integration Tests**

**File:** `frontend/src/components/SchemaCard.integration.test.tsx` (14 tests)

**Test Flows:**
1. Edit flow (open → change → submit → verify)
2. Delete flow (open → confirm → verify, with usage warning)
3. Duplicate flow (open → change name → submit → verify)
4. Usage stats flow (open → verify tag list → close)

---

### Phase 5: Final Review (Task 10)

#### **Task 10: Final Review & Verification**

1. Run all tests: `npm test -- SchemaCard SchemaActions EditSchema ConfirmDelete Duplicate SchemaUsage`
2. Verify 42/42 tests passing
3. Type check: `npx tsc --noEmit`
4. Manual testing: Edit/delete/duplicate schemas
5. Accessibility check: Keyboard-only navigation

---

## Success Criteria

### Functional
- ✅ Edit schema name/description via three-dot menu
- ✅ Delete schema (blocked if used by tags with clear error)
- ✅ Duplicate schema with all field associations
- ✅ View which tags use a schema
- ✅ Instant feedback via optimistic updates
- ✅ Keyboard-only operation

### Technical
- ✅ 42/42 tests passing
- ✅ Zero TypeScript errors
- ✅ WCAG 2.1 Level AA compliance
- ✅ React Query v5 context API used correctly
- ✅ React Hook Form + Field Component Pattern (CLAUDE.md)
- ✅ lucide-react icons (project standard)

### Performance
- ✅ Optimistic updates < 50ms
- ✅ Client-side usage stats (no extra API call)
- ✅ Proper error rollback

---

## Estimated Timeline

| Phase | Tasks | Time |
|-------|-------|------|
| 1. Core Components | 1-5 | 3h |
| 2. Mutation Hooks | 6 | 1h |
| 3. Integration | 7 | 45min |
| 4. Testing | 8-9 | 2.5h |
| 5. Final Review | 10 | 30min |
| **Total** | | **~8h** |

*Note: Slightly longer than original estimate (5-6h) due to React Hook Form integration, but ensures CLAUDE.md compliance.*

---

## Key Differences from Original Plan

| Aspect | Original Plan | Adapted Plan | Reason |
|--------|--------------|--------------|--------|
| React Query API | v4 signature | v5 context API | REF MCP validation |
| Form Pattern | useState controlled | React Hook Form + Field | CLAUDE.md requirement |
| Icons | Inline SVG | lucide-react | Project standard |
| Estimated Time | 5-6h | ~8h | React Hook Form overhead |

---

**End of Adapted Plan**

Generated: 2025-11-13
Status: Ready for Implementation with Subagent-Driven Development
REF MCP Validated: ✅ All patterns verified against 2024 documentation
