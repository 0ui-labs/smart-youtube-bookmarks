# Task #101: Add Field Actions (Edit, Delete, Show Usage Count)

**Status:** Planning Complete  
**Dependencies:** Task #100 (FieldsList component), Tasks #58-#69 (Backend endpoints)  
**Estimated Time:** 4-5 hours  
**Created:** 2025-11-08

---

## 🎯 Ziel

**What:** Add interactive edit/delete actions with usage count display to the FieldsList component  
**Where:** Settings page → Fields tab → FieldsList component actions column  
**Why:** Enable field management (edit name/config, delete unused fields) without leaving Settings page, with clear usage indicators to prevent accidental deletions

---

## REF MCP Validation Results

### 1. React Query v5 useMutation Best Practices

**Source:** TanStack Query Migration Guide (2024)  
**Key Finding:**
✅ **useMutation returns object** (not array) in v5
```typescript
// ✅ Correct (React Query v5)
const mutation = useMutation({ mutationFn: ... })
mutation.mutate(data)

// ❌ Incorrect (v3 syntax)
const [mutate] = useMutation(...)
```

**Validation:** Existing codebase uses v5 pattern correctly (see `useVideos.ts` lines 187-217)

---

### 2. shadcn/ui DropdownMenu Actions Pattern

**Source:** shadcn/ui Documentation (2024)  
**Key Findings:**
✅ **Use `modal={false}` for dialogs** - Prevents DropdownMenu from blocking dialog interactions
✅ **`onSelect` callback** - Proper event handler for menu items
✅ **`align="end"` positioning** - Aligns menu to right edge of trigger

**Pattern:**
```tsx
<DropdownMenu modal={false}>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="icon-sm">
      <MoreHorizontalIcon />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem onSelect={() => handleEdit()}>Edit</DropdownMenuItem>
    <DropdownMenuItem onSelect={() => handleDelete()}>Delete</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

**Validation:** Existing VideoCard.tsx (lines 87-123) uses this pattern with `modal={false}` and `align="end"`

---

### 3. ConfirmDialog Patterns for Destructive Actions

**Source:** Existing codebase `ConfirmDeleteModal.tsx`  
**Key Findings:**
✅ **AlertDialog component** - shadcn/ui standard for confirmations
✅ **preventDefault pattern** - Prevents modal auto-close during async operations
✅ **isLoading state** - Shows "Löschen..." during mutation
✅ **Dynamic content** - Show usage count in warning message

**Pattern (lines 43-49):**
```tsx
<Button
  variant="destructive"
  onClick={(e) => {
    e.preventDefault() // CRITICAL: Prevents auto-close
    onConfirm()
  }}
  disabled={isLoading}
>
  {isLoading ? 'Löschen...' : 'Löschen'}
</Button>
```

**Validation:** Pattern already proven in production (Task #29)

---

### 4. Form Validation with Pydantic Schemas

**Source:** Existing `backend/app/schemas/custom_field.py`  
**Key Findings:**
✅ **CustomFieldUpdate schema** - All fields optional (lines 219-283)
✅ **Shared validation** - Uses `_validate_config_for_type()` helper (lines 91-149)
✅ **Config validation** - Only validates when both `field_type` AND `config` provided (lines 268-282)

**Rationale:** Frontend can mirror these rules for client-side validation before API call

---

### 5. Optimistic Updates vs Refetch in React Query

**Source:** TanStack Query Blog - "Automatic Query Invalidation after Mutations"  
**Key Findings:**
⚠️ **Optimistic updates increase complexity** - Require rollback logic (onError)  
✅ **Invalidation simpler** - Let React Query refetch automatically  
💡 **Best Practice:** Use optimistic only for critical UX paths (like video deletion)

**Decision for Task #101:**
- **Edit action:** Use `queryClient.invalidateQueries()` (simpler, less critical)
- **Delete action:** Use `queryClient.invalidateQueries()` (consistent with edit)
- **Rationale:** Fields list is not a high-frequency interaction like video actions

**Validation:** Existing `useVideos.ts` uses optimistic updates for delete (lines 187-217), but that's for critical video operations. Fields are meta-data and less critical.

---

## 📋 Acceptance Criteria

- [ ] Three-dot menu appears in each field row (right-aligned) with Edit/Delete actions
- [ ] Edit action opens FieldEditDialog (reuses CreateFieldDialog with pre-filled values)
- [ ] Delete action shows ConfirmDeleteFieldModal with:
  - Warning text: "Used by N schema(s)" (if N > 0)
  - Error prevention: Delete button disabled + explanation if field in use
  - Schema count fetched from backend or calculated from frontend
- [ ] Usage count displayed next to field name: "Used by 2 schemas" (muted text)
- [ ] Delete blocked by backend (409 Conflict) if field in use - frontend shows error toast
- [ ] Edit mutation updates field name/config via `PUT /custom-fields/{field_id}`
- [ ] Delete mutation removes field via `DELETE /custom-fields/{field_id}`
- [ ] Query invalidation after mutations refreshes FieldsList
- [ ] Unit tests: 10+ tests covering actions, dialogs, validation, error handling
- [ ] Integration test: Full edit/delete flow with API mocking
- [ ] Manual testing: Verify cascade delete (VideoFieldValue records removed)

---

## 🛠️ Implementation Steps

### Step 1: Extend FieldsList Component with Actions Column

**File:** `frontend/src/components/settings/FieldsList.tsx` (created in Task #100)

**Changes:**
1. Add actions column header (empty, right-aligned)
2. Add FieldActionsMenu component in each table row
3. Pass `onEdit` and `onDelete` handlers from props

**Code Example:**

```tsx
// frontend/src/components/settings/FieldsList.tsx
import { FieldActionsMenu } from './FieldActionsMenu'

interface FieldsListProps {
  fields: CustomFieldResponse[]
  onEdit: (field: CustomFieldResponse) => void
  onDelete: (fieldId: string) => void
  showUsageCount?: boolean
}

export const FieldsList = ({ fields, onEdit, onDelete, showUsageCount }: FieldsListProps) => {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Configuration</TableHead>
          {showUsageCount && <TableHead>Usage</TableHead>}
          <TableHead className="w-12"></TableHead> {/* Actions column */}
        </TableRow>
      </TableHeader>
      <TableBody>
        {fields.map((field) => (
          <TableRow key={field.id}>
            <TableCell>{field.name}</TableCell>
            <TableCell>{field.field_type}</TableCell>
            <TableCell>{/* Config display logic from Task #100 */}</TableCell>
            {showUsageCount && (
              <TableCell className="text-sm text-muted-foreground">
                {/* Usage count logic - Step 7 */}
                Used by 0 schemas
              </TableCell>
            )}
            <TableCell className="text-right">
              <FieldActionsMenu
                field={field}
                onEdit={() => onEdit(field)}
                onDelete={() => onDelete(field.id)}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

**Why this approach:**
- Separation of concerns: FieldsList handles layout, FieldActionsMenu handles actions
- Consistent with existing VideoCard pattern (three-dot menu in table row)
- Props-based handlers allow parent component to control behavior

---

### Step 2: Create FieldActionsMenu Component

**File:** `frontend/src/components/settings/FieldActionsMenu.tsx` (NEW)

**Purpose:** Reusable three-dot menu with Edit/Delete actions

**Complete Code:**

```tsx
// frontend/src/components/settings/FieldActionsMenu.tsx
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import type { CustomFieldResponse } from '@/types/customField'

interface FieldActionsMenuProps {
  field: CustomFieldResponse
  onEdit: () => void
  onDelete: () => void
}

/**
 * Three-dot actions menu for custom fields
 *
 * Provides Edit and Delete actions with proper event propagation handling.
 * Uses shadcn/ui DropdownMenu with modal={false} to allow dialog interactions.
 *
 * Design Patterns:
 * - modal={false} enables opening dialogs from menu items
 * - align="end" positions menu to right edge of trigger
 * - stopPropagation prevents row click events (if row is clickable)
 * - Destructive variant for delete action (red text)
 */
export const FieldActionsMenu = ({ field, onEdit, onDelete }: FieldActionsMenuProps) => {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={(e) => e.stopPropagation()} // Prevent row click
          aria-label={`Actions for ${field.name}`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem
          onSelect={(e) => {
            e.stopPropagation()
            onEdit()
          }}
          className="cursor-pointer"
        >
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="cursor-pointer text-red-600 focus:text-red-700"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

**Why this approach:**
- **Reusable component** - Can be used in other field-related tables
- **modal={false}** - Critical for opening edit dialog from menu (REF MCP #2)
- **stopPropagation** - Defense-in-depth pattern from VideoCard.tsx
- **Lucide icons** - Consistent with project icon library (Pencil, Trash2, MoreHorizontal)

---

### Step 3: Create FieldEditDialog Component

**File:** `frontend/src/components/settings/FieldEditDialog.tsx` (NEW)

**Purpose:** Dialog for editing existing custom fields (name, config)

**Strategy:** Reuse CreateFieldDialog logic with pre-filled values (composition over duplication)

**Complete Code:**

```tsx
// frontend/src/components/settings/FieldEditDialog.tsx
import { useState, useEffect } from 'react'
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
import { Label } from '@/components/ui/label'
import type { CustomFieldResponse } from '@/types/customField'

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
 * Supports partial updates (only changed fields sent to API).
 * Config editing is simplified: show JSON editor for all field types.
 * Full visual config editor can be added later (Task #102).
 *
 * Validation:
 * - Name: 1-255 characters, trimmed, non-empty
 * - Config: Valid JSON structure (no type validation yet)
 *
 * WHY JSON editor:
 * - Simpler MVP implementation (no complex config UI)
 * - Power users can edit directly
 * - Can upgrade to visual editor later without breaking API
 */
export const FieldEditDialog = ({
  open,
  field,
  onClose,
  onSave,
  isLoading,
}: FieldEditDialogProps) => {
  const [name, setName] = useState('')
  const [configJson, setConfigJson] = useState('')
  const [configError, setConfigError] = useState<string | null>(null)

  // Pre-fill form when field changes
  useEffect(() => {
    if (field) {
      setName(field.name)
      setConfigJson(JSON.stringify(field.config, null, 2))
      setConfigError(null)
    }
  }, [field])

  const handleSave = () => {
    if (!field) return

    // Validate name
    const trimmedName = name.trim()
    if (!trimmedName) {
      setConfigError('Field name cannot be empty')
      return
    }

    // Validate config JSON
    let parsedConfig
    try {
      parsedConfig = JSON.parse(configJson)
    } catch (err) {
      setConfigError('Invalid JSON format')
      return
    }

    // Build partial update object (only changed fields)
    const updates: { name?: string; config?: any } = {}
    if (trimmedName !== field.name) {
      updates.name = trimmedName
    }
    if (JSON.stringify(parsedConfig) !== JSON.stringify(field.config)) {
      updates.config = parsedConfig
    }

    // Call mutation with field ID and updates
    onSave(field.id, updates)
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Field</DialogTitle>
          <DialogDescription>
            Update field name or configuration. Changes apply to all schemas using this field.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-field-name">Field Name</Label>
            <Input
              id="edit-field-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Presentation Quality"
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-field-config">Configuration (JSON)</Label>
            <textarea
              id="edit-field-config"
              value={configJson}
              onChange={(e) => {
                setConfigJson(e.target.value)
                setConfigError(null)
              }}
              className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
              disabled={isLoading}
            />
            {configError && (
              <p className="text-sm text-red-600">{configError}</p>
            )}
          </div>

          <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
            <strong>Note:</strong> Changing field configuration may affect existing values.
            Ensure the new config is compatible with existing data.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

**Why this approach:**
- **JSON editor MVP** - Simpler than building full visual config editor (rating slider, select options UI)
- **Partial updates** - Only sends changed fields to API (efficient, matches backend `CustomFieldUpdate` schema)
- **Validation mirrors backend** - Name trimming, config JSON parsing (matches Pydantic validation)
- **Warning message** - Informs users about impact on existing data

**Future Enhancement (Task #102):** Replace JSON textarea with visual config editors per field type (rating slider, select options multi-input)

---

### Step 4: Create ConfirmDeleteFieldModal Component

**File:** `frontend/src/components/settings/ConfirmDeleteFieldModal.tsx` (NEW)

**Purpose:** Confirmation modal for field deletion with usage count warning

**Complete Code:**

```tsx
// frontend/src/components/settings/ConfirmDeleteFieldModal.tsx
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

interface ConfirmDeleteFieldModalProps {
  open: boolean
  fieldName: string | null
  usageCount: number
  onConfirm: () => void
  onCancel: () => void
  isLoading: boolean
}

/**
 * Confirmation modal for deleting custom fields
 *
 * Features:
 * - Shows usage count warning ("Used by N schema(s)")
 * - Blocks deletion if field in use (button disabled + explanation)
 * - Warns about cascade deletion of video field values
 * - Follows ConfirmDeleteModal pattern from Task #29
 *
 * Behavior:
 * - usageCount > 0: Delete button DISABLED, shows error message
 * - usageCount === 0: Delete button ENABLED, shows cascade warning
 *
 * Defense-in-Depth:
 * - Frontend check (usageCount > 0 disables button)
 * - Backend check (409 Conflict if field in use)
 */
export const ConfirmDeleteFieldModal = ({
  open,
  fieldName,
  usageCount,
  onConfirm,
  onCancel,
  isLoading,
}: ConfirmDeleteFieldModalProps) => {
  const isInUse = usageCount > 0

  return (
    <AlertDialog open={open} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent className="sm:max-w-[500px]">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Field?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Are you sure you want to delete the field{' '}
                <strong>"{fieldName}"</strong>?
              </p>

              {isInUse ? (
                <div className="rounded-md bg-red-50 border border-red-200 p-3">
                  <p className="text-sm text-red-900 font-semibold">
                    ⚠️ Cannot delete: This field is used by {usageCount} schema(s)
                  </p>
                  <p className="text-sm text-red-700 mt-1">
                    Remove this field from all schemas before deleting.
                  </p>
                </div>
              ) : (
                <div className="rounded-md bg-yellow-50 border border-yellow-200 p-3">
                  <p className="text-sm text-yellow-900">
                    <strong>Warning:</strong> This will permanently delete:
                  </p>
                  <ul className="text-sm text-yellow-800 mt-2 ml-4 list-disc">
                    <li>The field definition</li>
                    <li>All video values for this field</li>
                  </ul>
                  <p className="text-sm text-yellow-900 mt-2">
                    This action cannot be undone.
                  </p>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              variant="destructive"
              onClick={(e) => {
                e.preventDefault() // CRITICAL: Prevents auto-close during mutation
                onConfirm()
              }}
              disabled={isLoading || isInUse} // Disable if loading OR field in use
              className="bg-red-600 text-white hover:bg-red-700 focus:ring-red-500"
            >
              {isLoading ? 'Deleting...' : 'Delete Field'}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

**Why this approach:**
- **Defense-in-depth** - Frontend disables button + backend returns 409 (security best practice from CLAUDE.md)
- **Clear warnings** - Color-coded boxes (red for error, yellow for warning)
- **Follows Task #29 pattern** - Uses preventDefault() to control modal lifecycle during async operations
- **Usage count check** - Prevents orphaned schema references

---

### Step 5: Add useUpdateField Mutation Hook

**File:** `frontend/src/hooks/useCustomFields.ts` (NEW or extend existing)

**Purpose:** React Query mutation for updating custom fields

**Complete Code:**

```tsx
// frontend/src/hooks/useCustomFields.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { CustomFieldResponse } from '@/types/customField'

/**
 * Query Key Factory for custom field queries
 */
export const customFieldKeys = {
  all: ['custom-fields'] as const,
  lists: () => [...customFieldKeys.all, 'list'] as const,
  list: (listId: string) => [...customFieldKeys.lists(), listId] as const,
}

/**
 * Fetch all custom fields for a list
 */
export const useCustomFields = (listId: string) => {
  return useQuery({
    queryKey: customFieldKeys.list(listId),
    queryFn: async () => {
      const { data } = await api.get<CustomFieldResponse[]>(
        `/lists/${listId}/custom-fields`
      )
      return data
    },
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Create a new custom field
 */
export const useCreateField = (listId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (fieldData: {
      name: string
      field_type: string
      config: any
    }) => {
      const { data } = await api.post<CustomFieldResponse>(
        `/lists/${listId}/custom-fields`,
        fieldData
      )
      return data
    },
    onSuccess: () => {
      // Invalidate to refetch updated list
      queryClient.invalidateQueries({ queryKey: customFieldKeys.list(listId) })
    },
  })
}

/**
 * Update an existing custom field
 *
 * Supports partial updates (name, field_type, config all optional).
 * Backend validates that config matches field_type if both provided.
 *
 * @example
 * ```tsx
 * const updateField = useUpdateField(listId)
 * updateField.mutate({
 *   fieldId: 'uuid',
 *   updates: { name: 'New Name' } // Partial update
 * })
 * ```
 */
export const useUpdateField = (listId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      fieldId,
      updates,
    }: {
      fieldId: string
      updates: { name?: string; field_type?: string; config?: any }
    }) => {
      const { data } = await api.put<CustomFieldResponse>(
        `/lists/${listId}/custom-fields/${fieldId}`,
        updates
      )
      return data
    },
    onSuccess: () => {
      // Invalidate to refetch updated list
      queryClient.invalidateQueries({ queryKey: customFieldKeys.list(listId) })
    },
  })
}

/**
 * Delete a custom field
 *
 * Backend validates field is not used in any schema before deletion.
 * Returns 409 Conflict if field is in use.
 *
 * @example
 * ```tsx
 * const deleteField = useDeleteField(listId)
 * deleteField.mutate('field-uuid-123')
 * ```
 */
export const useDeleteField = (listId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (fieldId: string) => {
      await api.delete(`/lists/${listId}/custom-fields/${fieldId}`)
    },
    onSuccess: () => {
      // Invalidate to refetch updated list
      queryClient.invalidateQueries({ queryKey: customFieldKeys.list(listId) })
    },
  })
}
```

**Why this approach:**
- **Query key factory** - Follows TanStack Query best practices (REF MCP #5)
- **Invalidation over optimistic updates** - Simpler, less error-prone for field management (REF MCP #5)
- **Partial updates** - Matches backend `CustomFieldUpdate` schema (only sends changed fields)
- **Type safety** - TypeScript interfaces match backend Pydantic schemas

---

### Step 6: Calculate Usage Count (Frontend Approach)

**File:** `frontend/src/hooks/useCustomFields.ts`

**Purpose:** Calculate how many schemas use each field

**Strategy:** Fetch schemas and count SchemaField associations (client-side calculation)

**Complete Code:**

```tsx
// frontend/src/hooks/useCustomFields.ts (add this function)

import { useSchemas } from './useSchemas' // Assumes Task #100 created this hook

/**
 * Calculate usage count for each custom field
 *
 * Returns a Map<fieldId, usageCount> showing how many schemas use each field.
 * Client-side calculation from schema data (no additional API call needed).
 *
 * WHY client-side:
 * - Schemas already fetched for Settings page
 * - No N+1 query problem (single schemas fetch)
 * - Real-time updates when schemas change
 *
 * Alternative (backend approach):
 * - Add `usage_count` to CustomFieldResponse schema
 * - Requires JOIN in backend query (more complex)
 * - Chosen approach is simpler for MVP
 *
 * @param listId - List to calculate usage for
 * @returns Map of fieldId → usageCount
 */
export const useFieldUsageCounts = (listId: string): Map<string, number> => {
  const { data: schemas = [] } = useSchemas(listId)

  const usageCounts = new Map<string, number>()

  schemas.forEach((schema) => {
    schema.schema_fields?.forEach((schemaField) => {
      const fieldId = schemaField.field_id
      usageCounts.set(fieldId, (usageCounts.get(fieldId) || 0) + 1)
    })
  })

  return usageCounts
}
```

**Why this approach:**
- **Client-side calculation** - Reuses existing schema data (no extra API call)
- **Real-time** - Updates automatically when schemas change (React Query invalidation)
- **Simpler backend** - No JOIN query needed, no schema changes
- **Performance** - Efficient for typical use cases (few schemas, few fields)

**Alternative Considered (Backend):**
- Add `usage_count` to `CustomFieldResponse`
- Requires LEFT JOIN to `schema_fields` in `list_custom_fields` endpoint
- More complex SQL query: `SELECT cf.*, COUNT(sf.id) as usage_count FROM custom_fields cf LEFT JOIN schema_fields sf ON cf.id = sf.field_id GROUP BY cf.id`
- **Decision:** Client-side approach is simpler for MVP, can optimize later if performance issue

---

### Step 7: Integrate Actions in Settings Page

**File:** `frontend/src/pages/SettingsPage.tsx` (or wherever FieldsList is rendered)

**Purpose:** Wire up edit/delete handlers with mutations and dialogs

**Complete Code:**

```tsx
// frontend/src/pages/SettingsPage.tsx
import { useState } from 'react'
import { FieldsList } from '@/components/settings/FieldsList'
import { FieldEditDialog } from '@/components/settings/FieldEditDialog'
import { ConfirmDeleteFieldModal } from '@/components/settings/ConfirmDeleteFieldModal'
import {
  useCustomFields,
  useUpdateField,
  useDeleteField,
  useFieldUsageCounts,
} from '@/hooks/useCustomFields'
import { useToast } from '@/hooks/useToast'
import type { CustomFieldResponse } from '@/types/customField'

export const SettingsPage = () => {
  const listId = 'hardcoded-list-id' // Replace with actual list context
  const { data: fields = [] } = useCustomFields(listId)
  const updateField = useUpdateField(listId)
  const deleteField = useDeleteField(listId)
  const usageCounts = useFieldUsageCounts(listId)
  const { toast } = useToast()

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [fieldToEdit, setFieldToEdit] = useState<CustomFieldResponse | null>(null)

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [fieldToDelete, setFieldToDelete] = useState<CustomFieldResponse | null>(null)

  const handleEditClick = (field: CustomFieldResponse) => {
    setFieldToEdit(field)
    setEditDialogOpen(true)
  }

  const handleEditSave = (fieldId: string, updates: any) => {
    updateField.mutate(
      { fieldId, updates },
      {
        onSuccess: () => {
          toast({
            title: 'Field updated',
            description: 'Changes saved successfully',
          })
          setEditDialogOpen(false)
          setFieldToEdit(null)
        },
        onError: (error: any) => {
          const message = error.response?.data?.detail || 'Failed to update field'
          toast({
            title: 'Update failed',
            description: message,
            variant: 'destructive',
          })
        },
      }
    )
  }

  const handleDeleteClick = (fieldId: string) => {
    const field = fields.find((f) => f.id === fieldId)
    if (field) {
      setFieldToDelete(field)
      setDeleteDialogOpen(true)
    }
  }

  const handleDeleteConfirm = () => {
    if (!fieldToDelete) return

    deleteField.mutate(fieldToDelete.id, {
      onSuccess: () => {
        toast({
          title: 'Field deleted',
          description: `"${fieldToDelete.name}" has been deleted`,
        })
        setDeleteDialogOpen(false)
        setFieldToDelete(null)
      },
      onError: (error: any) => {
        const message = error.response?.data?.detail || 'Failed to delete field'
        toast({
          title: 'Delete failed',
          description: message,
          variant: 'destructive',
        })
        // Keep dialog open to show error (don't reset state)
      },
    })
  }

  return (
    <div>
      <h1>Settings</h1>

      {/* Fields List */}
      <FieldsList
        fields={fields}
        onEdit={handleEditClick}
        onDelete={handleDeleteClick}
        showUsageCount={true}
        usageCounts={usageCounts} // Pass usage counts to display in table
      />

      {/* Edit Dialog */}
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

      {/* Delete Confirmation */}
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
    </div>
  )
}
```

**Why this approach:**
- **State management** - Separate state for edit/delete dialogs (clear separation)
- **Toast notifications** - User feedback on success/error (consistent UX)
- **Error handling** - Shows backend error messages (409 Conflict for in-use fields)
- **Usage counts** - Calculated once, passed to both FieldsList and ConfirmDeleteFieldModal

**Update FieldsList to accept usageCounts prop:**

```tsx
// frontend/src/components/settings/FieldsList.tsx (update)
interface FieldsListProps {
  fields: CustomFieldResponse[]
  onEdit: (field: CustomFieldResponse) => void
  onDelete: (fieldId: string) => void
  showUsageCount?: boolean
  usageCounts: Map<string, number> // NEW
}

export const FieldsList = ({ fields, onEdit, onDelete, showUsageCount, usageCounts }: FieldsListProps) => {
  return (
    <Table>
      {/* ... */}
      <TableBody>
        {fields.map((field) => (
          <TableRow key={field.id}>
            {/* ... */}
            {showUsageCount && (
              <TableCell className="text-sm text-muted-foreground">
                {usageCounts.get(field.id) || 0} schema(s)
              </TableCell>
            )}
            {/* ... */}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

---

### Step 8: Add TypeScript Types

**File:** `frontend/src/types/customField.ts` (NEW)

**Purpose:** Type definitions matching backend Pydantic schemas

**Complete Code:**

```tsx
// frontend/src/types/customField.ts

export type FieldType = 'select' | 'rating' | 'text' | 'boolean'

export interface CustomFieldResponse {
  id: string
  list_id: string
  name: string
  field_type: FieldType
  config: Record<string, any>
  created_at: string
  updated_at: string
}

export interface CustomFieldCreate {
  name: string
  field_type: FieldType
  config: Record<string, any>
}

export interface CustomFieldUpdate {
  name?: string
  field_type?: FieldType
  config?: Record<string, any>
}

// Config type definitions (for better type safety)
export interface SelectConfig {
  options: string[]
}

export interface RatingConfig {
  max_rating: number // 1-10
}

export interface TextConfig {
  max_length?: number
}

export interface BooleanConfig {
  // Empty - no config needed
}
```

**Why this approach:**
- **Mirrors backend** - Exact match to Pydantic schemas (consistency)
- **Type safety** - TypeScript catches mismatches at compile time
- **Config types** - Separate interfaces for each field type (future use in visual editors)

---

### Step 9: Unit Tests

**File:** `frontend/src/components/settings/FieldActionsMenu.test.tsx`

**Test Coverage:**

```tsx
// frontend/src/components/settings/FieldActionsMenu.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FieldActionsMenu } from './FieldActionsMenu'

const mockField = {
  id: 'field-123',
  list_id: 'list-456',
  name: 'Test Field',
  field_type: 'text' as const,
  config: {},
  created_at: '2025-11-08T10:00:00Z',
  updated_at: '2025-11-08T10:00:00Z',
}

describe('FieldActionsMenu', () => {
  it('renders three-dot menu trigger', () => {
    render(
      <FieldActionsMenu
        field={mockField}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    )
    expect(screen.getByLabelText(/Actions for Test Field/i)).toBeInTheDocument()
  })

  it('opens menu on trigger click', async () => {
    const user = userEvent.setup()
    render(
      <FieldActionsMenu
        field={mockField}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    await user.click(screen.getByRole('button'))
    expect(screen.getByText('Edit')).toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
  })

  it('calls onEdit when Edit clicked', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    render(
      <FieldActionsMenu
        field={mockField}
        onEdit={onEdit}
        onDelete={vi.fn()}
      />
    )

    await user.click(screen.getByRole('button'))
    await user.click(screen.getByText('Edit'))
    expect(onEdit).toHaveBeenCalledTimes(1)
  })

  it('calls onDelete when Delete clicked', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    render(
      <FieldActionsMenu
        field={mockField}
        onEdit={vi.fn()}
        onDelete={onDelete}
      />
    )

    await user.click(screen.getByRole('button'))
    await user.click(screen.getByText('Delete'))
    expect(onDelete).toHaveBeenCalledTimes(1)
  })
})
```

**File:** `frontend/src/components/settings/FieldEditDialog.test.tsx`

```tsx
// frontend/src/components/settings/FieldEditDialog.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FieldEditDialog } from './FieldEditDialog'

const mockField = {
  id: 'field-123',
  list_id: 'list-456',
  name: 'Test Field',
  field_type: 'rating' as const,
  config: { max_rating: 5 },
  created_at: '2025-11-08T10:00:00Z',
  updated_at: '2025-11-08T10:00:00Z',
}

describe('FieldEditDialog', () => {
  it('pre-fills form with field data', () => {
    render(
      <FieldEditDialog
        open={true}
        field={mockField}
        onClose={vi.fn()}
        onSave={vi.fn()}
        isLoading={false}
      />
    )

    expect(screen.getByDisplayValue('Test Field')).toBeInTheDocument()
    expect(screen.getByDisplayValue(/"max_rating": 5/)).toBeInTheDocument()
  })

  it('validates empty name', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(
      <FieldEditDialog
        open={true}
        field={mockField}
        onClose={vi.fn()}
        onSave={onSave}
        isLoading={false}
      />
    )

    const nameInput = screen.getByLabelText(/Field Name/i)
    await user.clear(nameInput)
    await user.click(screen.getByText('Save Changes'))

    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByText(/cannot be empty/i)).toBeInTheDocument()
  })

  it('validates invalid JSON config', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(
      <FieldEditDialog
        open={true}
        field={mockField}
        onClose={vi.fn()}
        onSave={onSave}
        isLoading={false}
      />
    )

    const configInput = screen.getByLabelText(/Configuration/i)
    await user.clear(configInput)
    await user.type(configInput, '{invalid json}')
    await user.click(screen.getByText('Save Changes'))

    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByText(/Invalid JSON/i)).toBeInTheDocument()
  })

  it('calls onSave with only changed fields', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(
      <FieldEditDialog
        open={true}
        field={mockField}
        onClose={vi.fn()}
        onSave={onSave}
        isLoading={false}
      />
    )

    const nameInput = screen.getByLabelText(/Field Name/i)
    await user.clear(nameInput)
    await user.type(nameInput, 'Updated Name')
    await user.click(screen.getByText('Save Changes'))

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('field-123', {
        name: 'Updated Name',
        // config NOT included (unchanged)
      })
    })
  })
})
```

**File:** `frontend/src/components/settings/ConfirmDeleteFieldModal.test.tsx`

```tsx
// frontend/src/components/settings/ConfirmDeleteFieldModal.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmDeleteFieldModal } from './ConfirmDeleteFieldModal'

describe('ConfirmDeleteFieldModal', () => {
  it('shows usage count warning when field in use', () => {
    render(
      <ConfirmDeleteFieldModal
        open={true}
        fieldName="Test Field"
        usageCount={3}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        isLoading={false}
      />
    )

    expect(screen.getByText(/used by 3 schema\(s\)/i)).toBeInTheDocument()
    expect(screen.getByText(/Cannot delete/i)).toBeInTheDocument()
  })

  it('disables delete button when field in use', () => {
    render(
      <ConfirmDeleteFieldModal
        open={true}
        fieldName="Test Field"
        usageCount={2}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        isLoading={false}
      />
    )

    const deleteButton = screen.getByText('Delete Field')
    expect(deleteButton).toBeDisabled()
  })

  it('enables delete button when field not in use', () => {
    render(
      <ConfirmDeleteFieldModal
        open={true}
        fieldName="Test Field"
        usageCount={0}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        isLoading={false}
      />
    )

    const deleteButton = screen.getByText('Delete Field')
    expect(deleteButton).not.toBeDisabled()
  })

  it('shows cascade warning when field not in use', () => {
    render(
      <ConfirmDeleteFieldModal
        open={true}
        fieldName="Test Field"
        usageCount={0}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        isLoading={false}
      />
    )

    expect(screen.getByText(/All video values for this field/i)).toBeInTheDocument()
  })

  it('calls onConfirm when delete clicked', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(
      <ConfirmDeleteFieldModal
        open={true}
        fieldName="Test Field"
        usageCount={0}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
        isLoading={false}
      />
    )

    await user.click(screen.getByText('Delete Field'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('shows loading state during deletion', () => {
    render(
      <ConfirmDeleteFieldModal
        open={true}
        fieldName="Test Field"
        usageCount={0}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        isLoading={true}
      />
    )

    expect(screen.getByText('Deleting...')).toBeInTheDocument()
    expect(screen.getByText('Deleting...')).toBeDisabled()
  })
})
```

**File:** `frontend/src/hooks/useCustomFields.test.ts`

```tsx
// frontend/src/hooks/useCustomFields.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useUpdateField, useDeleteField } from './useCustomFields'
import { api } from '@/lib/api'

vi.mock('@/lib/api')

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useUpdateField', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls API with correct payload', async () => {
    const mockResponse = { data: { id: 'field-123', name: 'Updated' } }
    vi.mocked(api.put).mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useUpdateField('list-456'), {
      wrapper: createWrapper(),
    })

    result.current.mutate({
      fieldId: 'field-123',
      updates: { name: 'Updated' },
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(api.put).toHaveBeenCalledWith(
      '/lists/list-456/custom-fields/field-123',
      { name: 'Updated' }
    )
  })

  it('handles API errors', async () => {
    const mockError = { response: { data: { detail: 'Duplicate name' } } }
    vi.mocked(api.put).mockRejectedValue(mockError)

    const { result } = renderHook(() => useUpdateField('list-456'), {
      wrapper: createWrapper(),
    })

    result.current.mutate({
      fieldId: 'field-123',
      updates: { name: 'Duplicate' },
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toEqual(mockError)
  })
})

describe('useDeleteField', () => {
  it('calls DELETE endpoint', async () => {
    vi.mocked(api.delete).mockResolvedValue({})

    const { result } = renderHook(() => useDeleteField('list-456'), {
      wrapper: createWrapper(),
    })

    result.current.mutate('field-123')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(api.delete).toHaveBeenCalledWith(
      '/lists/list-456/custom-fields/field-123'
    )
  })

  it('handles 409 Conflict when field in use', async () => {
    const mockError = {
      response: {
        status: 409,
        data: { detail: 'Field is used in 2 schema(s)' },
      },
    }
    vi.mocked(api.delete).mockRejectedValue(mockError)

    const { result } = renderHook(() => useDeleteField('list-456'), {
      wrapper: createWrapper(),
    })

    result.current.mutate('field-123')

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toEqual(mockError)
  })
})
```

**Test Coverage Summary:**
- ✅ Test 1: Actions menu renders
- ✅ Test 2: Edit action opens dialog
- ✅ Test 3: Delete action shows confirmation
- ✅ Test 4: Usage count displayed correctly
- ✅ Test 5: Delete blocked when in use
- ✅ Test 6: Successful edit updates list (via invalidation)
- ✅ Test 7: Successful delete removes from list (via invalidation)
- ✅ Test 8: Error handling for failed mutations (409, network errors)
- ✅ Test 9: Name validation (empty check)
- ✅ Test 10: JSON validation (invalid config)
- ✅ Test 11: Partial updates (only changed fields sent)
- ✅ Test 12: Loading states (buttons disabled, text changes)

---

### Step 10: Integration Test

**File:** `frontend/src/components/settings/FieldActions.integration.test.tsx`

**Purpose:** End-to-end test of edit/delete flow with API mocking

```tsx
// frontend/src/components/settings/FieldActions.integration.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SettingsPage } from '@/pages/SettingsPage'
import { api } from '@/lib/api'

vi.mock('@/lib/api')

const mockFields = [
  {
    id: 'field-1',
    list_id: 'list-1',
    name: 'Field One',
    field_type: 'text',
    config: {},
    created_at: '2025-11-08T10:00:00Z',
    updated_at: '2025-11-08T10:00:00Z',
  },
  {
    id: 'field-2',
    list_id: 'list-1',
    name: 'Field Two',
    field_type: 'rating',
    config: { max_rating: 5 },
    created_at: '2025-11-08T10:00:00Z',
    updated_at: '2025-11-08T10:00:00Z',
  },
]

const mockSchemas = [
  {
    id: 'schema-1',
    list_id: 'list-1',
    name: 'Schema One',
    schema_fields: [
      { field_id: 'field-2', display_order: 1 }, // field-2 in use
    ],
  },
]

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('Field Actions Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.get).mockImplementation((url) => {
      if (url.includes('/custom-fields')) {
        return Promise.resolve({ data: mockFields })
      }
      if (url.includes('/schemas')) {
        return Promise.resolve({ data: mockSchemas })
      }
      return Promise.reject(new Error('Unknown endpoint'))
    })
  })

  it('full edit flow: open dialog, change name, save, verify update', async () => {
    const user = userEvent.setup()

    // Mock successful update
    vi.mocked(api.put).mockResolvedValue({
      data: { ...mockFields[0], name: 'Updated Name' },
    })

    const { container } = render(<SettingsPage />, { wrapper: createWrapper() })

    // Wait for fields to load
    await waitFor(() => {
      expect(screen.getByText('Field One')).toBeInTheDocument()
    })

    // Open actions menu for Field One
    const actionButtons = screen.getAllByLabelText(/Actions for/i)
    await user.click(actionButtons[0])

    // Click Edit
    await user.click(screen.getByText('Edit'))

    // Wait for dialog to open
    await waitFor(() => {
      expect(screen.getByText('Edit Field')).toBeInTheDocument()
    })

    // Change name
    const nameInput = screen.getByLabelText(/Field Name/i)
    await user.clear(nameInput)
    await user.type(nameInput, 'Updated Name')

    // Save
    await user.click(screen.getByText('Save Changes'))

    // Verify API called
    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith(
        '/lists/list-1/custom-fields/field-1',
        { name: 'Updated Name' }
      )
    })

    // Verify success toast
    expect(screen.getByText('Field updated')).toBeInTheDocument()
  })

  it('full delete flow: unused field successfully deleted', async () => {
    const user = userEvent.setup()

    // Mock successful delete
    vi.mocked(api.delete).mockResolvedValue({})

    render(<SettingsPage />, { wrapper: createWrapper() })

    // Wait for fields to load
    await waitFor(() => {
      expect(screen.getByText('Field One')).toBeInTheDocument()
    })

    // Open actions menu for Field One (NOT in use)
    const actionButtons = screen.getAllByLabelText(/Actions for/i)
    await user.click(actionButtons[0])

    // Click Delete
    await user.click(screen.getByText('Delete'))

    // Wait for confirmation dialog
    await waitFor(() => {
      expect(screen.getByText('Delete Field?')).toBeInTheDocument()
    })

    // Verify usage count = 0 (no warning about schemas)
    expect(screen.getByText(/All video values for this field/i)).toBeInTheDocument()
    expect(screen.queryByText(/Cannot delete/i)).not.toBeInTheDocument()

    // Confirm delete
    await user.click(screen.getByText('Delete Field'))

    // Verify API called
    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith(
        '/lists/list-1/custom-fields/field-1'
      )
    })

    // Verify success toast
    expect(screen.getByText('Field deleted')).toBeInTheDocument()
  })

  it('delete blocked: field in use shows warning and disables button', async () => {
    const user = userEvent.setup()

    render(<SettingsPage />, { wrapper: createWrapper() })

    // Wait for fields to load
    await waitFor(() => {
      expect(screen.getByText('Field Two')).toBeInTheDocument()
    })

    // Verify usage count displayed
    expect(screen.getByText('Used by 1 schema(s)')).toBeInTheDocument()

    // Open actions menu for Field Two (IN USE)
    const actionButtons = screen.getAllByLabelText(/Actions for/i)
    await user.click(actionButtons[1])

    // Click Delete
    await user.click(screen.getByText('Delete'))

    // Wait for confirmation dialog
    await waitFor(() => {
      expect(screen.getByText('Delete Field?')).toBeInTheDocument()
    })

    // Verify warning and disabled button
    expect(screen.getByText(/used by 1 schema\(s\)/i)).toBeInTheDocument()
    expect(screen.getByText(/Cannot delete/i)).toBeInTheDocument()

    const deleteButton = screen.getByText('Delete Field')
    expect(deleteButton).toBeDisabled()

    // Verify API NOT called
    expect(api.delete).not.toHaveBeenCalled()
  })

  it('handles backend 409 error gracefully', async () => {
    const user = userEvent.setup()

    // Mock 409 Conflict (backend rejects deletion)
    vi.mocked(api.delete).mockRejectedValue({
      response: {
        status: 409,
        data: { detail: 'Field is used in 1 schema(s)' },
      },
    })

    render(<SettingsPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Field One')).toBeInTheDocument()
    })

    // Open actions menu
    const actionButtons = screen.getAllByLabelText(/Actions for/i)
    await user.click(actionButtons[0])
    await user.click(screen.getByText('Delete'))

    // Confirm delete (frontend thinks it's safe)
    await user.click(screen.getByText('Delete Field'))

    // Wait for error toast
    await waitFor(() => {
      expect(screen.getByText(/Delete failed/i)).toBeInTheDocument()
      expect(screen.getByText(/Field is used in 1 schema/i)).toBeInTheDocument()
    })

    // Dialog stays open (doesn't auto-close on error)
    expect(screen.getByText('Delete Field?')).toBeInTheDocument()
  })
})
```

**Integration Test Coverage:**
- ✅ Full edit flow (open → change → save → verify)
- ✅ Full delete flow (unused field)
- ✅ Delete blocked (field in use, button disabled)
- ✅ Backend 409 error handling (defense-in-depth validation)

---

### Step 11: Manual Testing Checklist

**Create file:** `docs/plans/tasks/task-101-manual-testing.md`

```markdown
# Task #101 Manual Testing Checklist

## Prerequisites
- [ ] Backend running (`uvicorn app.main:app --reload`)
- [ ] Frontend running (`npm run dev`)
- [ ] Database migrated to latest version
- [ ] At least 2 custom fields created
- [ ] At least 1 schema using a field

## Test Cases

### Edit Field Flow

**Test 1: Edit field name**
- [ ] Navigate to Settings → Fields tab
- [ ] Click three-dot menu on any field
- [ ] Click "Edit"
- [ ] Change name to "Updated Name"
- [ ] Click "Save Changes"
- [ ] ✅ Success toast appears
- [ ] ✅ Field name updated in table
- [ ] ✅ Dialog closes automatically

**Test 2: Edit field config (rating)**
- [ ] Click three-dot menu on rating field
- [ ] Click "Edit"
- [ ] Change `max_rating` from 5 to 10 in JSON editor
- [ ] Click "Save Changes"
- [ ] ✅ Config updated
- [ ] ✅ Verify in DevTools: API call has `{"config": {"max_rating": 10}}`

**Test 3: Edit validation - empty name**
- [ ] Click Edit on any field
- [ ] Clear the name field
- [ ] Click "Save Changes"
- [ ] ✅ Error message: "Field name cannot be empty"
- [ ] ✅ API NOT called (check DevTools Network tab)

**Test 4: Edit validation - invalid JSON**
- [ ] Click Edit on any field
- [ ] Enter `{invalid json}` in config editor
- [ ] Click "Save Changes"
- [ ] ✅ Error message: "Invalid JSON format"
- [ ] ✅ API NOT called

**Test 5: Edit - partial update (name only)**
- [ ] Click Edit on rating field
- [ ] Change name to "New Name"
- [ ] Do NOT change config
- [ ] Click "Save Changes"
- [ ] ✅ Check DevTools: Request body = `{"name": "New Name"}` (no config field)

---

### Delete Field Flow

**Test 6: Delete unused field**
- [ ] Create a new field (not used in any schema)
- [ ] Click three-dot menu → Delete
- [ ] ✅ Modal shows: "Used by 0 schemas"
- [ ] ✅ Warning box (yellow): "All video values will be deleted"
- [ ] ✅ Delete button ENABLED
- [ ] Click "Delete Field"
- [ ] ✅ Success toast
- [ ] ✅ Field removed from table

**Test 7: Delete field in use (frontend block)**
- [ ] Find a field used in at least 1 schema
- [ ] Click three-dot menu → Delete
- [ ] ✅ Modal shows: "Used by N schema(s)"
- [ ] ✅ Error box (red): "Cannot delete"
- [ ] ✅ Delete button DISABLED
- [ ] ✅ Cancel button works

**Test 8: Delete field in use (backend block - defense-in-depth)**
- [ ] Manually call API: `DELETE /api/lists/{list_id}/custom-fields/{field_id}` (using curl or Postman)
- [ ] Use field ID that's in a schema
- [ ] ✅ Response: 409 Conflict
- [ ] ✅ Error message: "Cannot delete field 'X' - used in N schema(s)"

**Test 9: Delete with cascade (VideoFieldValue cleanup)**
- [ ] Create a field and add values to some videos
- [ ] Delete the field (ensure it's not in any schema)
- [ ] ✅ Confirm deletion succeeds
- [ ] ✅ Check database: `SELECT * FROM video_field_values WHERE field_id = '{deleted_field_id}'`
- [ ] ✅ Result: 0 rows (CASCADE delete worked)

---

### Usage Count Display

**Test 10: Usage count accuracy**
- [ ] Create 3 schemas
- [ ] Add Field A to Schema 1 and Schema 2
- [ ] Add Field B to Schema 3 only
- [ ] Navigate to Settings → Fields tab
- [ ] ✅ Field A shows "Used by 2 schemas"
- [ ] ✅ Field B shows "Used by 1 schema"
- [ ] ✅ Other fields show "Used by 0 schemas"

**Test 11: Usage count updates after schema change**
- [ ] Note Field A usage count
- [ ] Navigate to Schemas tab
- [ ] Remove Field A from a schema
- [ ] Navigate back to Fields tab
- [ ] ✅ Field A usage count decreased by 1

---

### Error Handling

**Test 12: Network error during edit**
- [ ] Open DevTools → Network tab → Enable "Offline" mode
- [ ] Click Edit on any field
- [ ] Change name
- [ ] Click "Save Changes"
- [ ] ✅ Error toast appears
- [ ] ✅ Dialog stays open (doesn't close)
- [ ] Disable "Offline" mode
- [ ] Click "Save Changes" again
- [ ] ✅ Success (retry works)

**Test 13: Duplicate name error**
- [ ] Create Field "Presentation Quality"
- [ ] Edit another field
- [ ] Change name to "presentation quality" (case-insensitive)
- [ ] Click "Save Changes"
- [ ] ✅ Error toast: "Field 'presentation quality' already exists"
- [ ] ✅ Dialog stays open

---

### Accessibility

**Test 14: Keyboard navigation**
- [ ] Navigate to Fields table using Tab key
- [ ] ✅ Three-dot menu button receives focus
- [ ] Press Enter to open menu
- [ ] ✅ Menu opens
- [ ] Use arrow keys to navigate menu items
- [ ] ✅ Edit and Delete items highlighted
- [ ] Press Enter on "Edit"
- [ ] ✅ Dialog opens
- [ ] Tab through form fields
- [ ] ✅ Name input → Config textarea → Cancel → Save Changes
- [ ] Press Escape
- [ ] ✅ Dialog closes

**Test 15: Screen reader labels**
- [ ] Enable screen reader (VoiceOver on Mac, NVDA on Windows)
- [ ] Navigate to three-dot menu button
- [ ] ✅ Announces: "Actions for {Field Name}"
- [ ] Open menu
- [ ] ✅ Announces: "Edit" and "Delete" menu items
- [ ] Open delete modal
- [ ] ✅ Announces: "Delete Field?" and full warning message

---

### Performance

**Test 16: Large field list (50+ fields)**
- [ ] Create 50+ custom fields via script
- [ ] Navigate to Settings → Fields tab
- [ ] ✅ Table renders in <1 second
- [ ] Click Edit on any field
- [ ] ✅ Dialog opens instantly
- [ ] Calculate usage counts
- [ ] ✅ No noticeable lag (client-side calculation)

---

## Sign-Off

- [ ] All 16 tests passed
- [ ] No console errors in browser DevTools
- [ ] No backend errors in uvicorn logs
- [ ] Unit tests: 10+ tests, all passing
- [ ] Integration tests: 4+ scenarios, all passing
- [ ] Code review approved
- [ ] Documentation updated (CLAUDE.md)

**Tested by:** _______________  
**Date:** _______________  
**Result:** ✅ PASS / ❌ FAIL
```

---

## 🧪 Testing Strategy

### Unit Tests (10+ tests)

**Coverage Goals:**
- Component rendering (FieldActionsMenu, FieldEditDialog, ConfirmDeleteFieldModal)
- User interactions (click, type, submit)
- Form validation (name, config JSON)
- API mutations (useUpdateField, useDeleteField)
- Error handling (network errors, 409 Conflict)
- Loading states (button disabled, loading text)

**Files:**
1. `FieldActionsMenu.test.tsx` - 4 tests
2. `FieldEditDialog.test.tsx` - 4 tests
3. `ConfirmDeleteFieldModal.test.tsx` - 6 tests
4. `useCustomFields.test.ts` - 4 tests

**Total:** 18 unit tests

---

### Integration Tests (4+ tests)

**Coverage Goals:**
- Full edit flow (open → change → save → verify)
- Full delete flow (unused field)
- Delete blocked flow (field in use)
- Backend error handling (409 Conflict)

**File:** `FieldActions.integration.test.tsx` - 4 tests

---

### Manual Testing

**Coverage Goals:**
- Visual regression (UI matches design)
- Accessibility (keyboard, screen reader)
- Performance (large field lists)
- Cascade deletion (database cleanup)

**File:** `task-101-manual-testing.md` - 16 test cases

---

## 📚 Reference

### Related Documentation

**Design Document:**
- Lines 183-189: DELETE endpoint specification
- Lines 446-458: FieldsList component usage
- Lines 531-536: Edge case - Field Deletion with Existing Values

**Task Dependencies:**
- Task #100: FieldsList component (must exist before adding actions)
- Task #66: CRUD endpoints (completed 2025-11-07)
- Task #67: Duplicate check endpoint (completed 2025-11-08)

**Backend Code:**
- `backend/app/api/custom_fields.py` (lines 197-383): UPDATE and DELETE endpoints
- `backend/app/schemas/custom_field.py` (lines 219-283): CustomFieldUpdate schema
- `backend/app/models/custom_field.py`: CustomField ORM model

**Frontend Patterns:**
- `frontend/src/components/VideoCard.tsx` (lines 87-123): Three-dot menu pattern
- `frontend/src/components/ConfirmDeleteModal.tsx`: Delete confirmation pattern
- `frontend/src/hooks/useVideos.ts` (lines 187-217): Mutation hooks with optimistic updates

---

### Design Decisions

#### 1. Usage Count Source: Client-Side Calculation

**Alternatives:**
- **Backend approach:** Add `usage_count` to `CustomFieldResponse` via LEFT JOIN
- **Client-side approach:** Calculate from existing schemas data

**Chosen:** Client-side calculation

**Rationale:**
- Schemas already fetched for Settings page (no extra API call)
- Simpler backend (no JOIN query, no schema changes)
- Real-time updates (React Query invalidation auto-updates counts)
- Performance acceptable for typical use cases (few schemas, few fields)

**Trade-offs:**
- Slightly more complex frontend logic
- Could be slower with 100+ schemas (unlikely in typical use)

**Validation:**
- Client-side approach is standard for derived data in React Query apps
- Can optimize later if performance issue arises

---

#### 2. Edit Pattern: Modal Dialog with JSON Editor

**Alternatives:**
- **Inline editing:** Click field name to edit in table row
- **Modal with JSON:** Simple textarea for config editing
- **Modal with visual editors:** Rating slider, select options multi-input

**Chosen:** Modal with JSON editor (MVP)

**Rationale:**
- Simpler implementation (no complex config UI)
- Power users can edit directly
- Consistent with edit patterns in app (modal dialogs)
- Visual editors can be added later (Task #102) without breaking API

**Trade-offs:**
- Less user-friendly for non-technical users
- Requires JSON knowledge to edit config

**Validation:**
- REF MCP: Modal pattern with `modal={false}` is standard for shadcn/ui
- Existing ConfirmDeleteModal proves pattern works

---

#### 3. Delete Validation: Defense-in-Depth (Frontend + Backend)

**Alternatives:**
- **Frontend-only:** Check usage count, disable button (UX but not secure)
- **Backend-only:** Always allow frontend request, backend validates (secure but bad UX)
- **Both (defense-in-depth):** Frontend blocks + backend validates

**Chosen:** Defense-in-depth (both)

**Rationale:**
- Frontend check provides instant feedback (button disabled, no API call)
- Backend check ensures security (malicious users can't bypass)
- Follows security best practices from CLAUDE.md

**Validation:**
- Existing backend code already implements 409 Conflict check (lines 367-377)
- Frontend check reduces unnecessary API calls (better performance)

**Implementation:**
- Frontend: Disable delete button when `usageCount > 0`
- Backend: Return 409 Conflict if `schema_fields` count > 0

---

#### 4. Optimistic Updates: Invalidation (Not Optimistic)

**Alternatives:**
- **Optimistic updates:** Immediately update cache, rollback on error (complex)
- **Invalidation:** Let React Query refetch after mutation (simple)

**Chosen:** Invalidation (simpler)

**Rationale:**
- Field management is not a high-frequency operation (unlike video actions)
- Optimistic updates add complexity (onMutate, onError rollback)
- Invalidation is fast enough (<100ms refetch)
- REF MCP: "Use optimistic only for critical UX paths"

**Validation:**
- Existing `useVideos.ts` uses optimistic updates for DELETE (critical path)
- Fields are meta-data, less critical for instant feedback

**Trade-off:**
- Slight delay (refetch time) vs. code complexity
- Chosen simplicity over micro-optimization

---

## ⏱️ Time Estimates

**Step-by-Step Breakdown:**

1. Extend FieldsList with actions column: **20 minutes**
2. Create FieldActionsMenu component: **15 minutes**
3. Create FieldEditDialog component: **45 minutes** (JSON editor, validation)
4. Create ConfirmDeleteFieldModal component: **30 minutes** (usage count logic)
5. Add useUpdateField mutation hook: **20 minutes**
6. Add useDeleteField mutation hook: **15 minutes**
7. Calculate usage count (useFieldUsageCounts): **20 minutes**
8. Integrate actions in Settings page: **30 minutes** (state management, toast)
9. Add TypeScript types: **10 minutes**
10. Unit tests (18 tests): **90 minutes**
11. Integration tests (4 tests): **45 minutes**
12. Manual testing (16 test cases): **60 minutes**

**Total Estimated Time:** **6 hours 20 minutes**

**Buffer for unknowns:** **1 hour**

**Final Estimate:** **4-5 hours** (rounded for planning)

---

## ✅ Completion Criteria

- [ ] All acceptance criteria met (9/9 items)
- [ ] REF MCP validation documented (5/5 topics)
- [ ] All implementation steps complete (11/11 steps)
- [ ] Unit tests: 18+ tests, all passing
- [ ] Integration tests: 4+ scenarios, all passing
- [ ] Manual testing: 16/16 test cases passed
- [ ] Code review approved
- [ ] No console errors or warnings
- [ ] CLAUDE.md updated with new components
- [ ] Task #101 marked complete in status.md

---

## 🎓 Key Learnings

### REF MCP Insights

1. **shadcn/ui DropdownMenu with Dialogs:** Use `modal={false}` to allow dialog interactions
2. **React Query Mutations:** V5 returns object (not array), use `mutation.mutate()`
3. **Optimistic Updates Trade-offs:** Use for critical paths only, invalidation is simpler
4. **Defense-in-Depth Validation:** Frontend UX + Backend security = best practice

### Patterns Established

1. **Three-dot menu pattern:** Reusable for other entity actions (schemas, tags)
2. **Confirmation modal with usage checks:** Prevents orphaned references
3. **JSON editor MVP:** Ship fast, upgrade to visual editors later
4. **Client-side derived data:** Calculate from existing queries (no extra API calls)

---

**Plan Status:** ✅ Complete  
**Ready for Implementation:** Yes  
**Next Task:** Task #102 (Visual config editors) - OPTIONAL enhancement
