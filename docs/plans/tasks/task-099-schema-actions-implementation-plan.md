# Task #99: Add Schema Actions (Edit, Delete, Duplicate, Usage Stats) - Implementation Plan

**Created:** 2025-11-08
**Status:** Planning Complete - Ready for Execution
**Phase:** Phase 2 - Settings & Management UI (Custom Fields System)
**Dependencies:** Task #98 (SchemasList component), Task #68 (Field Schemas CRUD endpoints)
**Estimated Time:** 5-6 hours
**Complexity:** Medium-High
**Pattern:** Action Menu with Modals (follows VideoCard Task #27 + ConfirmDeleteModal Task #29 patterns)

---

## Executive Summary

This plan provides complete implementation details for adding action menu functionality to SchemaCard components. The implementation extends the SchemaCard from Task #98 with a three-dot dropdown menu offering four actions: Edit, Delete, Duplicate, and Usage Statistics.

**What Gets Built:**
- SchemaActionsMenu component with DropdownMenu (four action items)
- EditSchemaDialog modal for inline schema editing
- ConfirmDeleteSchemaDialog with enhanced usage warnings
- DuplicateSchemaDialog for schema cloning
- SchemaUsageStatsModal showing which tags use the schema
- React Query mutations for edit/delete/duplicate operations
- 42 comprehensive tests (28 unit + 14 integration)

**Key Innovation:**
- Usage statistics computed client-side from existing useTags() hook (no backend changes needed)
- Optimistic updates for instant UI feedback on edit/delete/duplicate
- Defense-in-depth stopPropagation pattern prevents card click interference
- WCAG 2.1 Level AA keyboard navigation throughout

---

## Context Analysis

### Existing Patterns to Follow

From codebase research, we have established patterns:

1. **Three-Dot Menu Pattern** (VideoCard.tsx lines 87-123):
   - Radix UI DropdownMenu with `modal={false}` to prevent portal conflicts
   - MoreVertical icon (vertical dots) as trigger
   - Defense-in-depth `stopPropagation()` on both trigger click AND keyboard events
   - `tabIndex={-1}` for better tab flow (skip menu in tab order, use arrow keys)
   - `aria-label` for screen reader accessibility

2. **Modal Pattern** (ConfirmDeleteModal.tsx):
   - Radix UI AlertDialog for destructive actions
   - Controlled state with `open` prop and `onOpenChange` callback
   - `preventDefault()` on confirm button to prevent auto-close during async operations
   - Loading state with disabled buttons and "Loading..." text
   - Close modal only on success (keep open on error for retry)

3. **React Query Mutation Pattern** (useVideos.ts lines 187-216):
   - Optimistic updates with `onMutate` for instant UI feedback
   - Error rollback with context preservation
   - Query invalidation with `onSettled` (runs on both success and error)
   - Mutation keys for debugging and testing
   - Type-safe with Zod schema validation

4. **Error Handling Pattern** (backend schemas.py lines 405-419):
   - Backend returns 409 Conflict when schema is used by tags
   - Error message includes usage count: "it is currently used by {tag_count} tag(s)"
   - Frontend must parse this and display prominently in delete confirmation

### Backend API Endpoints (Already Implemented - Task #68)

From `/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/backend/app/api/schemas.py`:

```python
# All endpoints are list-scoped (require list_id)
GET    /api/lists/{list_id}/schemas                  # List all schemas
POST   /api/lists/{list_id}/schemas                  # Create new schema
GET    /api/lists/{list_id}/schemas/{schema_id}      # Get single schema
PUT    /api/lists/{list_id}/schemas/{schema_id}      # Update metadata (name, description)
DELETE /api/lists/{list_id}/schemas/{schema_id}      # Delete (409 if used by tags)
```

**PUT Update Endpoint Details** (lines 278-350):
- Only updates name and/or description (both optional)
- Does NOT modify field associations (that's Task #69)
- Returns full FieldSchemaResponse with nested schema_fields
- 404 if schema not found or belongs to different list

**DELETE Endpoint Details** (lines 353-425):
- Checks tag usage before deletion (lines 407-419)
- Returns 409 Conflict with error message: `"Cannot delete schema '{name}': it is currently used by {tag_count} tag(s). Please unbind the schema from all tags before deletion."`
- CASCADE deletes schema_fields automatically (database constraint)
- Returns 204 No Content on success

**No Duplicate Endpoint Yet:**
- Backend has no `/duplicate` endpoint
- We'll implement client-side duplication: GET schema → POST new schema with "(Copy)" suffix
- Alternative: Add backend endpoint in future (Task #100+)

### Usage Statistics Strategy

**Client-Side Computation (No Backend Changes):**

From `useTags()` hook, we get all tags with `schema_id` field:
```typescript
// frontend/src/types/tag.ts (inferred from useTags.ts)
interface Tag {
  id: string
  name: string
  color: string | null
  schema_id: string | null  // ← This is the key field
  list_id: string
  created_at: string
  updated_at: string
}
```

**Usage Stats Computation:**
```typescript
// Compute usage statistics from tags
const usageStats = useMemo(() => {
  if (!tags || !schema) return { count: 0, tagNames: [] }

  const usedByTags = tags.filter(tag => tag.schema_id === schema.id)
  return {
    count: usedByTags.length,
    tagNames: usedByTags.map(tag => tag.name)
  }
}, [tags, schema])
```

**No Backend Endpoint Needed:**
- Frontend already has all tags via `useTags()` hook
- Simple filter operation is fast (< 1ms for 1000 tags)
- Avoids additional network round-trip
- Future optimization: Add `/schemas/{id}/usage` endpoint if performance becomes issue

---

## Component Architecture

### Visual Structure

```
┌─────────────────────────────────────────────────┐
│ SchemaCard                                       │
│ ┌─────────────────────────────────────────────┐ │
│ │ Header                                       │ │
│ │ ┌────────────────────────┐  ┌────────────┐ │ │
│ │ │ Video Quality          │  │ ⋮ (menu)   │ │ │
│ │ │ Standard quality       │  └─┬──────────┘ │ │
│ │ └────────────────────────┘    │            │ │
│ │                                │            │ │
│ │ ┌──────────────────────────────▼──────────┐│ │
│ │ │ DropdownMenu (SchemaActionsMenu)        ││ │
│ │ │ ┌─────────────────────────────────────┐ ││ │
│ │ │ │ ✏️  Schema bearbeiten              │ ││ │
│ │ │ ├─────────────────────────────────────┤ ││ │
│ │ │ │ 📋 Schema duplizieren              │ ││ │
│ │ │ ├─────────────────────────────────────┤ ││ │
│ │ │ │ 📊 Verwendungsstatistik (3 Tags)   │ ││ │
│ │ │ ├─────────────────────────────────────┤ ││ │
│ │ │ │ 🗑️  Schema löschen (red text)      │ ││ │
│ │ │ └─────────────────────────────────────┘ ││ │
│ │ └─────────────────────────────────────────┘│ │
│ └─────────────────────────────────────────────┘ │
│                                                  │
│ Body (3 fields preview from Task #98)           │
└──────────────────────────────────────────────────┘

Modals (shown when actions triggered):

┌──────────────────────────────────────────┐
│ EditSchemaDialog                         │
│ ┌──────────────────────────────────────┐ │
│ │ Schema bearbeiten                    │ │
│ ├──────────────────────────────────────┤ │
│ │ Name: [Video Quality            ]   │ │
│ │ Beschreibung:                        │ │
│ │ [Standard quality metrics for    ]   │ │
│ │ [videos                          ]   │ │
│ ├──────────────────────────────────────┤ │
│ │ [Abbrechen]  [Speichern (loading)]  │ │
│ └──────────────────────────────────────┘ │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│ ConfirmDeleteSchemaDialog                │
│ ┌──────────────────────────────────────┐ │
│ │ Schema löschen?                      │ │
│ ├──────────────────────────────────────┤ │
│ │ ⚠️ Dieses Schema wird von 3 Tags     │ │
│ │    verwendet:                        │ │
│ │    • Keto Rezepte                    │ │
│ │    • Makeup Tutorials                │ │
│ │    • React Videos                    │ │
│ │                                       │ │
│ │ Möchten Sie wirklich fortfahren?    │ │
│ ├──────────────────────────────────────┤ │
│ │ [Abbrechen]  [Löschen (loading)]    │ │
│ └──────────────────────────────────────┘ │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│ DuplicateSchemaDialog                    │
│ ┌──────────────────────────────────────┐ │
│ │ Schema duplizieren                   │ │
│ ├──────────────────────────────────────┤ │
│ │ Neuer Name:                          │ │
│ │ [Video Quality (Kopie)          ]   │ │
│ │                                       │ │
│ │ ℹ️ Alle 5 Felder werden kopiert     │ │
│ ├──────────────────────────────────────┤ │
│ │ [Abbrechen]  [Duplizieren (loading)]│ │
│ └──────────────────────────────────────┘ │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│ SchemaUsageStatsModal                    │
│ ┌──────────────────────────────────────┐ │
│ │ Verwendungsstatistik                 │ │
│ │ Schema: Video Quality                │ │
│ ├──────────────────────────────────────┤ │
│ │ Verwendet von 3 Tags:                │ │
│ │ • 🔵 Keto Rezepte                    │ │
│ │ • 🟢 Makeup Tutorials                │ │
│ │ • 🟡 React Videos                    │ │
│ │                                       │ │
│ │ (oder)                               │ │
│ │ ℹ️ Dieses Schema wird aktuell nicht  │ │
│ │    von Tags verwendet.               │ │
│ ├──────────────────────────────────────┤ │
│ │ [Schließen]                          │ │
│ └──────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

### Component Hierarchy

```
SchemaCard (Task #98)
├── SchemaActionsMenu (NEW - this task)
│   ├── DropdownMenu (Radix UI)
│   │   ├── DropdownMenuTrigger (MoreVertical icon)
│   │   └── DropdownMenuContent
│   │       ├── DropdownMenuItem (Edit)
│   │       ├── DropdownMenuItem (Duplicate)
│   │       ├── DropdownMenuItem (Usage Stats with badge)
│   │       ├── DropdownMenuSeparator
│   │       └── DropdownMenuItem (Delete - red text)
│   │
│   ├── EditSchemaDialog (NEW)
│   │   └── Dialog (Radix UI)
│   │       ├── DialogHeader
│   │       ├── Form (name + description inputs)
│   │       └── DialogFooter (cancel/save buttons)
│   │
│   ├── ConfirmDeleteSchemaDialog (NEW - extends Task #29 pattern)
│   │   └── AlertDialog (Radix UI)
│   │       ├── AlertDialogHeader
│   │       ├── Usage Warning Section (conditional)
│   │       └── AlertDialogFooter (cancel/delete buttons)
│   │
│   ├── DuplicateSchemaDialog (NEW)
│   │   └── Dialog (Radix UI)
│   │       ├── DialogHeader
│   │       ├── Form (new name input with "(Kopie)" suffix)
│   │       ├── Field Count Info Badge
│   │       └── DialogFooter (cancel/duplicate buttons)
│   │
│   └── SchemaUsageStatsModal (NEW)
│       └── Dialog (Radix UI)
│           ├── DialogHeader
│           ├── Tag List (with colors) or Empty State
│           └── DialogFooter (close button)
│
└── useSchemaActions() hook (NEW)
    ├── useUpdateSchema() mutation
    ├── useDeleteSchema() mutation
    ├── useDuplicateSchema() mutation (client-side: GET + POST)
    └── useSchemaUsageStats() computed state
```

---

## Implementation Steps

### Step 1: Create SchemaActionsMenu Component

**File:** `frontend/src/components/SchemaActionsMenu.tsx`

**Purpose:** Three-dot dropdown menu with four action items

**Pattern:** VideoCard.tsx lines 87-123 (MoreVertical icon, modal={false}, stopPropagation)

**Implementation:**

```typescript
// frontend/src/components/SchemaActionsMenu.tsx
import { MoreVertical } from 'lucide-react'
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
  usageCount: number // Computed from useTags()
  onEdit: () => void
  onDelete: () => void
  onDuplicate: () => void
  onViewUsage: () => void
}

/**
 * SchemaActionsMenu Component - Three-dot menu for schema actions
 *
 * REF MCP Patterns Applied:
 * - modal={false} prevents portal conflicts with nested dialogs
 * - Defense-in-depth stopPropagation on trigger + keyboard events
 * - tabIndex={-1} for better tab flow (skip in tab order)
 * - ARIA labels for screen reader accessibility
 *
 * Design Patterns:
 * - Follows VideoCard three-dot menu pattern (Task #27)
 * - MoreVertical icon for consistency with VideoCard
 * - Usage count badge shows number of tags using schema
 * - Delete action has red text to indicate destructive operation
 * - Separator before delete to visually separate destructive action
 */
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
        aria-label="Schema-Aktionen"
      >
        <MoreVertical className="w-4 h-4" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        {/* Edit Action */}
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
          className="cursor-pointer"
        >
          <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          Schema bearbeiten
        </DropdownMenuItem>

        {/* Duplicate Action */}
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation()
            onDuplicate()
          }}
          className="cursor-pointer"
        >
          <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          Schema duplizieren
        </DropdownMenuItem>

        {/* Usage Stats Action */}
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation()
            onViewUsage()
          }}
          className="cursor-pointer"
        >
          <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 20V10" />
            <path d="M12 20V4" />
            <path d="M6 20v-6" />
          </svg>
          Verwendungsstatistik
          {usageCount > 0 && (
            <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
              {usageCount}
            </span>
          )}
        </DropdownMenuItem>

        {/* Separator before destructive action */}
        <DropdownMenuSeparator />

        {/* Delete Action */}
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="text-red-600 focus:text-red-700 cursor-pointer"
        >
          <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18" />
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
          Schema löschen
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

**Key Design Decisions:**

1. **modal={false}**: Prevents Radix UI portal conflicts when opening dialogs from dropdown
2. **stopPropagation**: Defense-in-depth on both click AND keyboard to prevent SchemaCard onClick
3. **tabIndex={-1}**: Skip menu in tab order (use arrow keys to navigate after opening)
4. **Usage Count Badge**: Shows number of tags using schema (blue pill badge)
5. **Separator Before Delete**: Visual separation for destructive action
6. **Red Text for Delete**: Consistent with destructive action patterns

---

### Step 2: Create EditSchemaDialog Component

**File:** `frontend/src/components/EditSchemaDialog.tsx`

**Purpose:** Modal dialog for editing schema name and description

**Pattern:** Radix UI Dialog with controlled state (similar to ConfirmDeleteModal but with form inputs)

**Implementation:**

```typescript
// frontend/src/components/EditSchemaDialog.tsx
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
import { Textarea } from '@/components/ui/textarea'
import type { FieldSchemaResponse } from '@/types/schema'

interface EditSchemaDialogProps {
  open: boolean
  schema: FieldSchemaResponse | null
  onConfirm: (data: { name: string; description: string | null }) => void
  onCancel: () => void
  isLoading: boolean
}

/**
 * EditSchemaDialog Component - Modal for editing schema metadata
 *
 * REF MCP Patterns Applied:
 * - Controlled Dialog state with open prop
 * - Local form state with useState (not uncontrolled inputs)
 * - useEffect to sync form state when schema changes
 * - Validation: name required, max 255 chars
 * - Description optional, max 1000 chars
 *
 * Design Patterns:
 * - Similar to ConfirmDeleteModal but with form inputs
 * - Save button disabled during loading and invalid state
 * - Reset form state when dialog closes
 * - German labels and placeholders
 */
export const EditSchemaDialog = ({
  open,
  schema,
  onConfirm,
  onCancel,
  isLoading,
}: EditSchemaDialogProps) => {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  // Sync form state when schema prop changes
  useEffect(() => {
    if (schema) {
      setName(schema.name)
      setDescription(schema.description || '')
    }
  }, [schema])

  // Reset form state when dialog closes
  useEffect(() => {
    if (!open) {
      setName('')
      setDescription('')
    }
  }, [open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || name.length > 255) return

    onConfirm({
      name: name.trim(),
      description: description.trim() || null,
    })
  }

  const isValid = name.trim().length > 0 && name.length <= 255 && description.length <= 1000

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Schema bearbeiten</DialogTitle>
            <DialogDescription>
              Ändern Sie den Namen oder die Beschreibung des Schemas.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Name Input */}
            <div className="grid gap-2">
              <Label htmlFor="name">
                Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z.B. Video Quality"
                maxLength={255}
                disabled={isLoading}
                autoFocus
              />
              <span className="text-xs text-muted-foreground">
                {name.length}/255 Zeichen
              </span>
            </div>

            {/* Description Input */}
            <div className="grid gap-2">
              <Label htmlFor="description">Beschreibung (optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="z.B. Standard quality metrics for evaluating videos"
                rows={3}
                maxLength={1000}
                disabled={isLoading}
              />
              <span className="text-xs text-muted-foreground">
                {description.length}/1000 Zeichen
              </span>
            </div>
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
            <Button type="submit" disabled={!isValid || isLoading}>
              {isLoading ? 'Speichern...' : 'Speichern'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

**Key Design Decisions:**

1. **Controlled Inputs**: Use useState for form state (not uncontrolled refs)
2. **useEffect Sync**: Update form state when schema prop changes
3. **Reset on Close**: Clear form state when dialog closes
4. **Validation**: Name required (1-255 chars), description optional (0-1000 chars)
5. **Character Counter**: Show remaining characters for both fields
6. **autoFocus**: Focus name input when dialog opens
7. **Form Submit**: Handle Enter key submission

---

### Step 3: Create ConfirmDeleteSchemaDialog Component

**File:** `frontend/src/components/ConfirmDeleteSchemaDialog.tsx`

**Purpose:** Enhanced confirmation dialog with usage warnings

**Pattern:** Extends ConfirmDeleteModal (Task #29) with usage stats section

**Implementation:**

```typescript
// frontend/src/components/ConfirmDeleteSchemaDialog.tsx
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

/**
 * ConfirmDeleteSchemaDialog Component - Enhanced delete confirmation
 *
 * REF MCP Patterns Applied:
 * - AlertDialog for destructive actions (not regular Dialog)
 * - preventDefault() on confirm to prevent auto-close during async
 * - Controlled state with open prop
 * - Usage warning section with tag list
 *
 * Design Patterns:
 * - Extends ConfirmDeleteModal pattern (Task #29)
 * - Shows usage statistics BEFORE confirmation
 * - Different messaging for used vs unused schemas
 * - Red destructive button for delete action
 * - Close modal only on success (keep open on error)
 */
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
                      <svg
                        className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
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
                e.preventDefault() // Prevent auto-close during async operation
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

**Key Design Decisions:**

1. **Usage Warning Section**: Orange alert box with warning icon for used schemas
2. **Tag List Display**: Show first 5 tags, then "... und X weitere"
3. **Different Messaging**: Different text for used vs unused schemas
4. **Visual Hierarchy**: Warning box stands out with color and icon
5. **preventDefault()**: Prevent auto-close during async delete operation
6. **Keep Open on Error**: Only close on success (error handling in parent)

---

### Step 4: Create DuplicateSchemaDialog Component

**File:** `frontend/src/components/DuplicateSchemaDialog.tsx`

**Purpose:** Dialog for duplicating schema with new name

**Pattern:** Similar to EditSchemaDialog but simpler (only name input)

**Implementation:**

```typescript
// frontend/src/components/DuplicateSchemaDialog.tsx
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
import type { FieldSchemaResponse } from '@/types/schema'

interface DuplicateSchemaDialogProps {
  open: boolean
  schema: FieldSchemaResponse | null
  onConfirm: (newName: string) => void
  onCancel: () => void
  isLoading: boolean
}

/**
 * DuplicateSchemaDialog Component - Modal for duplicating schema
 *
 * REF MCP Patterns Applied:
 * - Auto-generate name with "(Kopie)" suffix
 * - Show field count info badge
 * - Validation: name required, max 255 chars
 *
 * Design Patterns:
 * - Similar to EditSchemaDialog but simpler (name only)
 * - Pre-filled with "{originalName} (Kopie)"
 * - Info badge shows how many fields will be copied
 * - User can edit name before confirming
 */
export const DuplicateSchemaDialog = ({
  open,
  schema,
  onConfirm,
  onCancel,
  isLoading,
}: DuplicateSchemaDialogProps) => {
  const [newName, setNewName] = useState('')

  // Generate default name when dialog opens
  useEffect(() => {
    if (schema && open) {
      setNewName(`${schema.name} (Kopie)`)
    }
  }, [schema, open])

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      setNewName('')
    }
  }, [open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim() || newName.length > 255) return
    onConfirm(newName.trim())
  }

  const isValid = newName.trim().length > 0 && newName.length <= 255
  const fieldCount = schema?.schema_fields?.length || 0

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Schema duplizieren</DialogTitle>
            <DialogDescription>
              Erstellen Sie eine Kopie von "{schema?.name}" mit einem neuen Namen.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Name Input */}
            <div className="grid gap-2">
              <Label htmlFor="newName">
                Neuer Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="newName"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="z.B. Video Quality (Kopie)"
                maxLength={255}
                disabled={isLoading}
                autoFocus
              />
              <span className="text-xs text-muted-foreground">
                {newName.length}/255 Zeichen
              </span>
            </div>

            {/* Info Badge */}
            {fieldCount > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <svg
                    className="w-5 h-5 text-blue-600 flex-shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
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
            <Button type="submit" disabled={!isValid || isLoading}>
              {isLoading ? 'Duplizieren...' : 'Duplizieren'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

**Key Design Decisions:**

1. **Auto-Generate Name**: Pre-fill with "{originalName} (Kopie)"
2. **Editable Name**: User can customize name before confirming
3. **Field Count Badge**: Blue info box shows how many fields will be copied
4. **Simple Form**: Only name input (description copied automatically)
5. **Character Counter**: Show remaining characters

---

### Step 5: Create SchemaUsageStatsModal Component

**File:** `frontend/src/components/SchemaUsageStatsModal.tsx`

**Purpose:** Display which tags use this schema

**Pattern:** Read-only Dialog with tag list or empty state

**Implementation:**

```typescript
// frontend/src/components/SchemaUsageStatsModal.tsx
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
  tags: Tag[] // All tags from useTags()
  onClose: () => void
}

/**
 * SchemaUsageStatsModal Component - Display schema usage statistics
 *
 * REF MCP Patterns Applied:
 * - Client-side computation from tags array (no backend call)
 * - Tag color badges for visual identification
 * - Empty state when no tags use schema
 *
 * Design Patterns:
 * - Read-only modal (no form, just display)
 * - Tag list with color indicators
 * - Graceful empty state
 * - Single "Schließen" button in footer
 */
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
              <svg
                className="w-12 h-12 text-gray-400 mx-auto mb-3"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
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

**Key Design Decisions:**

1. **Client-Side Computation**: Filter tags array (no backend call)
2. **Tag Color Badges**: Show tag color for visual identification
3. **Empty State**: Graceful message when no tags use schema
4. **Max Height**: Scrollable list if many tags (max-h-[300px])
5. **Read-Only**: No actions, just informational display

---

### Step 6: Create useSchemaActions Hook

**File:** `frontend/src/hooks/useSchemas.ts` (extend existing file)

**Purpose:** React Query mutations for schema actions

**Pattern:** Follows useVideos.ts mutation patterns (lines 187-216)

**Implementation:**

```typescript
// frontend/src/hooks/useSchemas.ts (extend existing file)
import { useQuery, useMutation, useQueryClient, queryOptions } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { FieldSchemaResponse, FieldSchemaCreate, FieldSchemaUpdate } from '@/types/schema'

/**
 * Query options factory for schemas
 * Enables type-safe reuse of query configuration
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
 * @param listId - UUID of the parent list
 * @returns Mutation hook for updating schema
 *
 * @example
 * ```tsx
 * const updateSchema = useUpdateSchema(listId)
 * updateSchema.mutate({
 *   schemaId: 'uuid',
 *   data: { name: 'Updated Name', description: 'New description' }
 * })
 * ```
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
    // Optimistic update
    onMutate: async ({ schemaId, data }) => {
      await queryClient.cancelQueries({ queryKey: schemasOptions(listId).queryKey })
      const previous = queryClient.getQueryData<FieldSchemaResponse[]>(
        schemasOptions(listId).queryKey
      )

      // Optimistically update cache
      if (previous) {
        queryClient.setQueryData<FieldSchemaResponse[]>(
          schemasOptions(listId).queryKey,
          previous.map((schema) =>
            schema.id === schemaId
              ? { ...schema, ...data, updated_at: new Date().toISOString() }
              : schema
          )
        )
      }

      return { previous }
    },
    // Rollback on error
    onError: (err, _variables, context) => {
      console.error('Failed to update schema:', err)
      if (context?.previous) {
        queryClient.setQueryData(schemasOptions(listId).queryKey, context.previous)
      }
    },
    // Refetch to ensure consistency
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: schemasOptions(listId).queryKey })
    },
  })
}

/**
 * Hook to delete a schema
 *
 * @param listId - UUID of the parent list
 * @returns Mutation hook for deleting schema
 *
 * @example
 * ```tsx
 * const deleteSchema = useDeleteSchema(listId)
 * deleteSchema.mutate({ schemaId: 'uuid' })
 * ```
 */
export const useDeleteSchema = (listId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ['deleteSchema'],
    mutationFn: async ({ schemaId }: { schemaId: string }) => {
      await api.delete(`/lists/${listId}/schemas/${schemaId}`)
    },
    // Optimistic update
    onMutate: async ({ schemaId }) => {
      await queryClient.cancelQueries({ queryKey: schemasOptions(listId).queryKey })
      const previous = queryClient.getQueryData<FieldSchemaResponse[]>(
        schemasOptions(listId).queryKey
      )

      // Optimistically remove from cache
      if (previous) {
        queryClient.setQueryData<FieldSchemaResponse[]>(
          schemasOptions(listId).queryKey,
          previous.filter((schema) => schema.id !== schemaId)
        )
      }

      return { previous }
    },
    // Rollback on error
    onError: (err, _variables, context) => {
      console.error('Failed to delete schema:', err)
      if (context?.previous) {
        queryClient.setQueryData(schemasOptions(listId).queryKey, context.previous)
      }
    },
    // Refetch to ensure consistency
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: schemasOptions(listId).queryKey })
      // Also invalidate tags query (schema_id may have been SET NULL)
      queryClient.invalidateQueries({ queryKey: ['tags'] })
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
 * @param listId - UUID of the parent list
 * @returns Mutation hook for duplicating schema
 *
 * @example
 * ```tsx
 * const duplicateSchema = useDuplicateSchema(listId)
 * duplicateSchema.mutate({
 *   schemaId: 'uuid',
 *   newName: 'Video Quality (Kopie)'
 * })
 * ```
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
    // Refetch on success
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: schemasOptions(listId).queryKey })
    },
  })
}

/**
 * Compute usage statistics for a schema
 *
 * @param schemaId - UUID of the schema
 * @param tags - All tags from useTags()
 * @returns Object with count and tag names
 *
 * @example
 * ```tsx
 * const { data: tags } = useTags()
 * const usageStats = useSchemaUsageStats(schema.id, tags)
 * console.log(`Used by ${usageStats.count} tags: ${usageStats.tagNames.join(', ')}`)
 * ```
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

**Key Design Decisions:**

1. **Optimistic Updates**: Edit and delete use optimistic updates for instant feedback
2. **Rollback on Error**: Context preserves previous state for error recovery
3. **Query Invalidation**: Always invalidate on settled (both success and error)
4. **Duplicate Strategy**: Client-side GET + POST (no backend endpoint)
5. **Usage Stats**: Computed function (not a hook, since it's synchronous)
6. **Tag Invalidation**: Delete also invalidates tags query (schema_id SET NULL)

---

### Step 7: Integrate into SchemaCard Component

**File:** `frontend/src/components/SchemaCard.tsx` (extend from Task #98)

**Purpose:** Add SchemaActionsMenu to card header

**Pattern:** Similar to VideoCard three-dot menu integration

**Implementation:**

```typescript
// frontend/src/components/SchemaCard.tsx (extend from Task #98)
import { useState } from 'react'
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
      <div className="schema-card border rounded-lg p-4 hover:shadow-md transition-shadow">
        {/* Header with title and actions menu */}
        <div className="flex items-start gap-2 mb-3">
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
        </div>

        {/* Field preview (from Task #98) */}
        {/* ... existing field preview code ... */}
      </div>

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

**Key Design Decisions:**

1. **Four Modal States**: Separate useState for each modal (edit/delete/duplicate/usage)
2. **Usage Stats Computed**: Call useSchemaUsageStats() for badge count
3. **Close on Success**: Modals close on success, stay open on error
4. **Loading States**: Pass mutation.isPending to modal components
5. **Tags from useTags**: Single source of truth for all tags

---

## TypeScript Types

### Frontend Type Definitions

**File:** `frontend/src/types/schema.ts` (may already exist from Task #80)

```typescript
// frontend/src/types/schema.ts
export interface FieldSchemaResponse {
  id: string
  list_id: string
  name: string
  description: string | null
  schema_fields: SchemaFieldResponse[]
  created_at: string
  updated_at: string
}

export interface SchemaFieldResponse {
  field_id: string
  schema_id: string
  display_order: number
  show_on_card: boolean
  field: CustomFieldResponse // Nested field data
}

export interface CustomFieldResponse {
  id: string
  list_id: string
  name: string
  field_type: 'select' | 'rating' | 'text' | 'boolean'
  config: Record<string, any>
  created_at: string
  updated_at: string
}

export interface FieldSchemaCreate {
  name: string
  description?: string | null
  fields?: SchemaFieldItem[]
}

export interface FieldSchemaUpdate {
  name?: string
  description?: string | null
}

export interface SchemaFieldItem {
  field_id: string
  display_order: number
  show_on_card: boolean
}
```

---

## Testing Strategy

### Unit Tests (28 tests total)

#### 1. SchemaActionsMenu.test.tsx (6 tests)

```typescript
describe('SchemaActionsMenu', () => {
  it('renders four action items', () => {
    // Verify: Edit, Duplicate, Usage Stats, Delete items present
  })

  it('displays usage count badge when count > 0', () => {
    // Verify: Badge shows "3" when usageCount={3}
  })

  it('hides usage count badge when count is 0', () => {
    // Verify: No badge when usageCount={0}
  })

  it('calls onEdit when edit action clicked', () => {
    // Verify: onEdit callback triggered
  })

  it('calls onDelete when delete action clicked', () => {
    // Verify: onDelete callback triggered
  })

  it('prevents event propagation on menu trigger click', () => {
    // Verify: stopPropagation called on trigger click
  })
})
```

#### 2. EditSchemaDialog.test.tsx (7 tests)

```typescript
describe('EditSchemaDialog', () => {
  it('renders form with name and description inputs', () => {
    // Verify: Both inputs present with labels
  })

  it('pre-fills inputs with schema data', () => {
    // Verify: Initial values from schema prop
  })

  it('validates name required (min 1 char)', () => {
    // Verify: Save button disabled when name empty
  })

  it('validates name max 255 characters', () => {
    // Verify: Input maxLength enforced, save disabled when > 255
  })

  it('allows empty description (optional field)', () => {
    // Verify: Save enabled when description empty
  })

  it('calls onConfirm with trimmed values on submit', () => {
    // Verify: Whitespace trimmed, null for empty description
  })

  it('resets form when dialog closes', () => {
    // Verify: Form cleared when open=false
  })
})
```

#### 3. ConfirmDeleteSchemaDialog.test.tsx (6 tests)

```typescript
describe('ConfirmDeleteSchemaDialog', () => {
  it('shows usage warning when schema is used by tags', () => {
    // Verify: Orange warning box visible when usageStats.count > 0
  })

  it('displays first 5 tag names in usage list', () => {
    // Verify: Shows tags 1-5 when 10 tags use schema
  })

  it('shows "... und X weitere" when more than 5 tags', () => {
    // Verify: Footer text when > 5 tags
  })

  it('shows simple confirmation when schema not used', () => {
    // Verify: No warning box when usageStats.count === 0
  })

  it('calls onConfirm when delete button clicked', () => {
    // Verify: onConfirm callback triggered
  })

  it('disables buttons during loading state', () => {
    // Verify: Both buttons disabled when isLoading=true
  })
})
```

#### 4. DuplicateSchemaDialog.test.tsx (5 tests)

```typescript
describe('DuplicateSchemaDialog', () => {
  it('pre-fills name with "(Kopie)" suffix', () => {
    // Verify: Default name is "{schema.name} (Kopie)"
  })

  it('allows editing the new name', () => {
    // Verify: User can type different name
  })

  it('shows field count info badge', () => {
    // Verify: "Alle 5 Felder werden kopiert" when 5 fields
  })

  it('validates name required', () => {
    // Verify: Submit disabled when name empty
  })

  it('calls onConfirm with trimmed name', () => {
    // Verify: Whitespace trimmed before submission
  })
})
```

#### 5. SchemaUsageStatsModal.test.tsx (4 tests)

```typescript
describe('SchemaUsageStatsModal', () => {
  it('displays list of tags using schema', () => {
    // Verify: Tag names rendered when usedByTags.length > 0
  })

  it('shows tag color badges', () => {
    // Verify: Colored circles rendered for each tag
  })

  it('shows empty state when no tags use schema', () => {
    // Verify: Info icon and message when usedByTags.length === 0
  })

  it('scrolls when many tags (>10)', () => {
    // Verify: max-h-[300px] overflow-y-auto applied
  })
})
```

### Integration Tests (14 tests total)

#### 6. SchemaCard.integration.test.tsx (14 tests)

```typescript
describe('SchemaCard Integration', () => {
  // Edit Flow
  it('opens edit dialog when edit action clicked', () => {
    // Click menu → Edit → Verify dialog opens
  })

  it('updates schema when edit form submitted', async () => {
    // Open edit → Change name → Submit → Verify mutation called
  })

  it('closes edit dialog on success', async () => {
    // Submit edit → Wait for success → Verify dialog closed
  })

  // Delete Flow
  it('opens delete dialog when delete action clicked', () => {
    // Click menu → Delete → Verify dialog opens
  })

  it('shows usage warning in delete dialog when schema used', () => {
    // Schema with 3 tags → Open delete → Verify warning box
  })

  it('deletes schema when delete confirmed', async () => {
    // Open delete → Confirm → Verify mutation called
  })

  it('closes delete dialog on success', async () => {
    // Confirm delete → Wait for success → Verify dialog closed
  })

  // Duplicate Flow
  it('opens duplicate dialog when duplicate action clicked', () => {
    // Click menu → Duplicate → Verify dialog opens
  })

  it('duplicates schema with new name', async () => {
    // Open duplicate → Change name → Submit → Verify mutation called
  })

  it('closes duplicate dialog on success', async () => {
    // Submit duplicate → Wait for success → Verify dialog closed
  })

  // Usage Stats Flow
  it('opens usage stats modal when usage stats clicked', () => {
    // Click menu → Usage Stats → Verify modal opens
  })

  it('displays correct tag list in usage stats', () => {
    // Schema with 3 tags → Open stats → Verify 3 tags shown
  })

  it('shows empty state in usage stats when no tags', () => {
    // Schema with 0 tags → Open stats → Verify empty message
  })

  it('closes usage stats modal when close clicked', () => {
    // Open stats → Click close → Verify modal closed
  })
})
```

---

## Error Handling

### Backend Error Scenarios

1. **404 Not Found** (schema doesn't exist or wrong list):
   ```json
   {
     "detail": "Schema with id {schema_id} not found in list {list_id}"
   }
   ```
   - **Frontend Handling**: Show error toast, keep modal open for retry

2. **409 Conflict** (schema used by tags):
   ```json
   {
     "detail": "Cannot delete schema 'Video Quality': it is currently used by 3 tag(s). Please unbind the schema from all tags before deletion."
   }
   ```
   - **Frontend Handling**: Display error in delete modal, keep modal open

3. **400 Bad Request** (validation error):
   ```json
   {
     "detail": [
       {
         "loc": ["body", "name"],
         "msg": "field required",
         "type": "value_error.missing"
       }
     ]
   }
   ```
   - **Frontend Handling**: Show field-level error in form

### Error Display Patterns

**Toast Notifications (Future Enhancement - Task #100+):**
- Currently no toast library installed
- For now: Use console.error() and keep modal open
- Future: Install `sonner` or `react-hot-toast` for user-friendly notifications

**Modal Error Display:**
```typescript
// Example: Edit dialog with inline error
const [error, setError] = useState<string | null>(null)

const handleEdit = (data) => {
  setError(null)
  updateSchema.mutate(
    { schemaId: schema.id, data },
    {
      onSuccess: () => {
        setEditOpen(false)
      },
      onError: (err: any) => {
        const message = err.response?.data?.detail || 'Ein Fehler ist aufgetreten'
        setError(message)
        // Modal stays open for retry
      },
    }
  )
}

// In EditSchemaDialog:
{error && (
  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
    {error}
  </div>
)}
```

---

## Accessibility (WCAG 2.1 Level AA)

### Keyboard Navigation

1. **DropdownMenu (SchemaActionsMenu)**:
   - Tab to menu trigger (but skipped via tabIndex={-1})
   - Arrow keys to navigate menu items
   - Enter/Space to select item
   - Escape to close menu

2. **Dialogs (All Modals)**:
   - Auto-focus first input on open (autoFocus prop)
   - Tab cycles through form fields
   - Escape closes dialog
   - Enter submits form (in edit/duplicate dialogs)

3. **Delete AlertDialog**:
   - Tab cycles between Cancel and Delete buttons
   - Enter on Delete button triggers confirmation
   - Escape closes dialog

### ARIA Labels

```typescript
// DropdownMenuTrigger
aria-label="Schema-Aktionen"

// Form labels
<Label htmlFor="name">Name *</Label>
<Input id="name" ... />

// Buttons
<Button aria-label="Schema bearbeiten">...</Button>
```

### Screen Reader Announcements

- **Loading States**: "Speichern..." / "Löschen..." / "Duplizieren..."
- **Error Messages**: Displayed as text (not aria-live, user re-reads on retry)
- **Modal Titles**: Announced when modal opens (DialogTitle is ARIA heading)

---

## Performance Considerations

### Optimistic Updates

**Benefits:**
- Instant UI feedback (no loading spinner for 200ms)
- Perceived performance improvement
- Better UX for fast operations

**Example: Edit Schema**
```typescript
onMutate: async ({ schemaId, data }) => {
  // 1. Cancel in-flight queries to prevent race conditions
  await queryClient.cancelQueries({ queryKey: schemasOptions(listId).queryKey })

  // 2. Save previous state for rollback
  const previous = queryClient.getQueryData<FieldSchemaResponse[]>(
    schemasOptions(listId).queryKey
  )

  // 3. Optimistically update cache
  if (previous) {
    queryClient.setQueryData<FieldSchemaResponse[]>(
      schemasOptions(listId).queryKey,
      previous.map((schema) =>
        schema.id === schemaId
          ? { ...schema, ...data, updated_at: new Date().toISOString() }
          : schema
      )
    )
  }

  return { previous }
},
onError: (err, _variables, context) => {
  // 4. Rollback on error
  if (context?.previous) {
    queryClient.setQueryData(schemasOptions(listId).queryKey, context.previous)
  }
},
```

### Client-Side Computation

**Usage Statistics:**
- Computed from existing tags query (no additional network call)
- Fast filter operation (< 1ms for 1000 tags)
- Memoized in component to prevent re-computation

```typescript
const usageStats = useMemo(() => {
  if (!tags || !schema) return { count: 0, tagNames: [] }

  const usedByTags = tags.filter(tag => tag.schema_id === schema.id)
  return {
    count: usedByTags.length,
    tagNames: usedByTags.map(tag => tag.name)
  }
}, [tags, schema])
```

### Query Invalidation Strategy

**Selective Invalidation:**
```typescript
// Delete schema invalidates:
// 1. Schemas query (schema removed)
queryClient.invalidateQueries({ queryKey: schemasOptions(listId).queryKey })

// 2. Tags query (schema_id SET NULL on tags)
queryClient.invalidateQueries({ queryKey: ['tags'] })

// NOT invalidated:
// - Videos query (no impact)
// - Custom fields query (no impact)
```

---

## REF MCP Validation

### Pre-Implementation Validation

Before writing code, validate these patterns against official documentation:

1. **Radix UI Dropdown Menu** (2024 best practices):
   - ✅ `modal={false}` for nested dialogs
   - ✅ `align="end"` for right-aligned dropdown
   - ✅ stopPropagation on trigger click AND keyboard events

2. **Radix UI AlertDialog** (destructive actions):
   - ✅ Use AlertDialog (not Dialog) for delete confirmation
   - ✅ preventDefault() on AlertDialogAction to prevent auto-close
   - ✅ DialogDescription with asChild for custom content

3. **React Query v5** (2024 mutation patterns):
   - ✅ queryOptions() factory for type-safe query keys
   - ✅ onMutate for optimistic updates
   - ✅ onError with context rollback
   - ✅ onSettled for guaranteed invalidation

4. **Zustand Best Practices** (if needed):
   - ✅ Separate selectors (not useShallow object pattern)
   - ✅ Type guards for runtime validation

### REF MCP Query Checklist

Before implementation, run these queries:

```
Query 1: "Radix UI DropdownMenu modal prop 2024 nested dialogs"
→ Verify: modal={false} is still recommended for nested modals

Query 2: "Radix UI AlertDialog prevent auto close 2024"
→ Verify: preventDefault() on action button is still best practice

Query 3: "React Query v5 optimistic updates onMutate context"
→ Verify: Context return pattern for error rollback

Query 4: "React Hook Form vs controlled inputs 2024"
→ Decision: Controlled inputs (simpler for small forms)
```

---

## Implementation Checklist

### Phase 1: Core Components (2-3 hours)

- [ ] Create SchemaActionsMenu.tsx with four action items
- [ ] Create EditSchemaDialog.tsx with name/description inputs
- [ ] Create ConfirmDeleteSchemaDialog.tsx with usage warnings
- [ ] Create DuplicateSchemaDialog.tsx with name input
- [ ] Create SchemaUsageStatsModal.tsx with tag list
- [ ] Extend useSchemas.ts with mutations (update/delete/duplicate)
- [ ] Add useSchemaUsageStats utility function

### Phase 2: Integration (1-2 hours)

- [ ] Integrate SchemaActionsMenu into SchemaCard.tsx
- [ ] Wire up modal states in SchemaCard
- [ ] Connect mutations to modal handlers
- [ ] Add error handling with console.error
- [ ] Test manual flow: edit → delete → duplicate → usage stats

### Phase 3: Testing (2-3 hours)

- [ ] Write 6 unit tests for SchemaActionsMenu
- [ ] Write 7 unit tests for EditSchemaDialog
- [ ] Write 6 unit tests for ConfirmDeleteSchemaDialog
- [ ] Write 5 unit tests for DuplicateSchemaDialog
- [ ] Write 4 unit tests for SchemaUsageStatsModal
- [ ] Write 14 integration tests for full flows
- [ ] Verify accessibility with keyboard-only navigation
- [ ] Test with screen reader (VoiceOver on macOS)

### Phase 4: Documentation (30 minutes)

- [ ] Update CLAUDE.md with new components
- [ ] Document action menu patterns for future tasks
- [ ] Create handoff log (docs/handoffs/YYYY-MM-DD-task-099.md)
- [ ] Create comprehensive report (docs/reports/YYYY-MM-DD-task-099.md)

---

## Time Estimate Breakdown

| Phase | Task | Estimated Time |
|-------|------|----------------|
| 1 | SchemaActionsMenu component | 30 min |
| 1 | EditSchemaDialog component | 45 min |
| 1 | ConfirmDeleteSchemaDialog component | 45 min |
| 1 | DuplicateSchemaDialog component | 30 min |
| 1 | SchemaUsageStatsModal component | 30 min |
| 1 | useSchemas mutations | 45 min |
| 2 | Integration into SchemaCard | 45 min |
| 2 | Error handling setup | 30 min |
| 2 | Manual testing | 30 min |
| 3 | Unit tests (28 tests) | 2 hours |
| 3 | Integration tests (14 tests) | 1.5 hours |
| 3 | Accessibility testing | 30 min |
| 4 | Documentation | 30 min |
| **Total** | | **5-6 hours** |

**Breakdown:**
- **Implementation:** 3-4 hours (components + integration)
- **Testing:** 2 hours (42 tests total)
- **Documentation:** 30 minutes

---

## Known Limitations & Future Enhancements

### Current Limitations

1. **No Toast Notifications**:
   - Currently using console.error() for error display
   - Errors shown inline in modals only
   - **Future:** Install `sonner` toast library (Task #100+)

2. **Client-Side Duplication**:
   - Uses GET + POST pattern (two network calls)
   - No atomic transaction guarantee
   - **Future:** Add backend `/schemas/{id}/duplicate` endpoint

3. **No Undo/Redo**:
   - Optimistic updates have rollback on error
   - No user-triggered undo for successful deletes
   - **Future:** Add undo toast with timeout

4. **Usage Stats Client-Side Only**:
   - Computed from tags query (fast but requires tags loaded)
   - If tags query fails, usage stats unavailable
   - **Future:** Add backend `/schemas/{id}/usage` endpoint

### Future Enhancements (Post-MVP)

1. **Batch Operations** (Task #103):
   - Select multiple schemas → Bulk delete
   - Apply schema to multiple tags at once

2. **Schema Templates** (Task #102):
   - Pre-defined common schemas (Video Quality, Recipe Rating, etc.)
   - One-click create from template

3. **Analytics** (Task #104):
   - Most-used fields across schemas
   - Unused schemas dashboard
   - Field usage heatmap

4. **Force Delete** (Backend Enhancement):
   - Add `?force=true` query param to DELETE endpoint
   - Unbind tags automatically (SET NULL)
   - Require confirmation with "Force Delete" button

---

## Success Criteria

### Functional Requirements

- ✅ User can edit schema name/description via three-dot menu
- ✅ User can delete schema (blocked if used by tags with clear error)
- ✅ User can duplicate schema with all field associations
- ✅ User can view which tags use a schema
- ✅ All actions provide instant feedback via optimistic updates
- ✅ Error states are clearly communicated to user
- ✅ All modals can be operated with keyboard only

### Technical Requirements

- ✅ 42/42 tests passing (28 unit + 14 integration)
- ✅ Zero TypeScript errors
- ✅ WCAG 2.1 Level AA compliance
- ✅ Optimistic updates for edit/delete operations
- ✅ Proper error rollback on mutation failure
- ✅ No N+1 query issues (usage stats computed client-side)

### User Experience Requirements

- ✅ Actions respond within 50ms (optimistic updates)
- ✅ Loading states shown for async operations
- ✅ Error messages are actionable (e.g., "unbind schema from tags")
- ✅ Confirmation dialogs prevent accidental deletions
- ✅ Keyboard navigation works throughout

---

## Appendix: Code Examples

### Example: Optimistic Update with Rollback

```typescript
const updateSchema = useUpdateSchema(listId)

const handleEdit = (data: { name: string; description: string | null }) => {
  updateSchema.mutate(
    { schemaId: schema.id, data },
    {
      onSuccess: () => {
        setEditOpen(false)
      },
      // Error handled by onError in mutation definition
      // Modal stays open for retry
    }
  )
}

// In useUpdateSchema:
onMutate: async ({ schemaId, data }) => {
  // Cancel in-flight queries
  await queryClient.cancelQueries({ queryKey: schemasOptions(listId).queryKey })

  // Save previous state
  const previous = queryClient.getQueryData<FieldSchemaResponse[]>(
    schemasOptions(listId).queryKey
  )

  // Optimistically update
  if (previous) {
    queryClient.setQueryData<FieldSchemaResponse[]>(
      schemasOptions(listId).queryKey,
      previous.map((s) =>
        s.id === schemaId ? { ...s, ...data, updated_at: new Date().toISOString() } : s
      )
    )
  }

  return { previous }
},
onError: (err, _variables, context) => {
  console.error('Failed to update schema:', err)
  // Rollback to previous state
  if (context?.previous) {
    queryClient.setQueryData(schemasOptions(listId).queryKey, context.previous)
  }
},
```

### Example: Usage Stats Computation

```typescript
// In SchemaCard component
const { data: tags = [] } = useTags()
const usageStats = useSchemaUsageStats(schema.id, tags)

// In useSchemas.ts
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

// Usage in component
<SchemaActionsMenu
  schema={schema}
  usageCount={usageStats.count} // Badge shows "3"
  onViewUsage={() => setUsageStatsOpen(true)}
/>

<SchemaUsageStatsModal
  schema={schema}
  tags={tags}
  open={usageStatsOpen}
  onClose={() => setUsageStatsOpen(false)}
/>
```

### Example: Delete with 409 Conflict Handling

```typescript
// Backend returns (schemas.py lines 411-419):
{
  "detail": "Cannot delete schema 'Video Quality': it is currently used by 3 tag(s). Please unbind the schema from all tags before deletion."
}

// Frontend handling:
const handleDelete = () => {
  deleteSchema.mutate(
    { schemaId: schema.id },
    {
      onSuccess: () => {
        setDeleteOpen(false)
      },
      onError: (err: any) => {
        // Parse error message from backend
        const errorMessage = err.response?.data?.detail || 'Fehler beim Löschen'

        // Extract tag count if available
        const match = errorMessage.match(/(\d+) tag\(s\)/)
        const tagCount = match ? parseInt(match[1]) : usageStats.count

        // Keep modal open, error displayed in ConfirmDeleteSchemaDialog
        // Orange warning box already shows tag list from usageStats
        console.error('Delete failed:', errorMessage)
      }
    }
  )
}
```

---

## References

### Design Documents
- Custom Fields System Design: `/docs/plans/2025-11-05-custom-fields-system-design.md`
- Task #98 Plan: `/task-098-full-plan.md`

### Implementation Reports
- Task #68 Report: `/docs/reports/2025-11-08-task-068-field-schemas-crud-endpoints.md`

### Codebase Patterns
- VideoCard Three-Dot Menu: `/frontend/src/components/VideoCard.tsx` (lines 87-123)
- ConfirmDeleteModal: `/frontend/src/components/ConfirmDeleteModal.tsx`
- TableSettingsDropdown: `/frontend/src/components/TableSettingsDropdown.tsx`
- useVideos Mutations: `/frontend/src/hooks/useVideos.ts` (lines 187-216)
- useTags Hook: `/frontend/src/hooks/useTags.ts`

### Backend API
- Field Schemas Endpoints: `/backend/app/api/schemas.py`

---

**Plan Status:** ✅ Complete - Ready for Execution
**Next Step:** Run REF MCP validation queries, then begin Phase 1 implementation
**Estimated Completion:** 5-6 hours from start
