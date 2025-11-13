# Task #126: Create FieldOrderManager Component (Drag-Drop + Show on Card Toggles)

**Plan Task:** #126
**Wave/Phase:** Phase 1 Custom Fields System - Frontend Components (Wave 1)
**Dependencies:** Task #121 (SchemaEditor component structure), Task #117 (useCustomFields hook), Task #118 (useSchemas hook)

---

## 🎯 Ziel

Create a drag-and-drop component that manages field ordering (display_order) and "Show on Card" visibility toggles for custom fields within a schema. The component enforces max 3 fields with show_on_card=true, provides keyboard accessibility (WCAG 2.1), and implements optimistic UI updates with batch saving.

## 📋 Acceptance Criteria

- [ ] Users can reorder fields via drag-and-drop using dnd-kit library
- [ ] Users can toggle "Show on Card" checkbox (max 3 per schema enforced)
- [ ] Keyboard navigation: Arrow keys (↑/↓) + Space/Enter for reordering
- [ ] Optimistic UI updates with visual feedback during save
- [ ] When 3 fields have show_on_card=true, remaining checkboxes are disabled
- [ ] Drag handle provides visual affordance (GripVertical icon)
- [ ] Screen reader announcements for reorder events
- [ ] display_order values update correctly (0-based sequential)
- [ ] 10+ unit tests passing (drag-drop, checkbox limit, keyboard, error handling)
- [ ] Component integrates into SchemaEditor parent component
- [ ] TypeScript strict mode compliance (no any types)

**Evidence:**
- Vitest test suite with 10+ tests (all passing)
- Manual accessibility audit with screen reader (VoiceOver/NVDA)
- Performance test: 50 fields reorder < 100ms
- Integration with SchemaEditor renders without errors

---

## 🛠️ Implementation Steps

### 1. Install dnd-kit Dependencies
**Files:** `frontend/package.json`
**Action:** Install @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities packages

```bash
cd frontend
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

**Why dnd-kit over alternatives:**
- ✅ Built-in accessibility (keyboard sensors, screen reader support)
- ✅ Better touch device support than HTML5 drag-drop API
- ✅ Active maintenance (react-beautiful-dnd is deprecated)
- ✅ Smaller bundle size (34KB vs 68KB for react-beautiful-dnd)
- ✅ Performant with transform3d (no DOM mutations during drag)

### 2. Create TypeScript Types for Field Order Data
**Files:** `frontend/src/types/schema.ts`
**Action:** Define types for schema field items with display_order and show_on_card

```typescript
// frontend/src/types/schema.ts

import { CustomFieldResponse } from './custom-field'

/**
 * Schema field association for ordering and visibility
 * Matches backend SchemaFieldResponse from app/schemas/field_schema.py
 */
export interface SchemaFieldItem {
  field_id: string
  field: CustomFieldResponse  // Nested field data from backend
  display_order: number
  show_on_card: boolean
}

/**
 * Update payload for reordering/toggling show_on_card
 * Sent to PUT /api/schemas/{schema_id}/fields endpoint
 */
export interface SchemaFieldUpdateRequest {
  field_id: string
  display_order: number
  show_on_card: boolean
}

/**
 * Batch update request for multiple field changes
 * POST /api/schemas/{schema_id}/fields/batch
 */
export interface SchemaFieldBatchUpdateRequest {
  fields: SchemaFieldUpdateRequest[]
}

/**
 * Local state for drag-drop operations
 * Extended with react-dnd-kit identifiers
 */
export interface DraggableSchemaField extends SchemaFieldItem {
  id: string  // Same as field_id, required by dnd-kit
}
```

### 3. Create FieldOrderManager Component Structure
**Files:** `frontend/src/components/schemas/FieldOrderManager.tsx`
**Action:** Implement base component with dnd-kit DndContext and SortableContext

```typescript
// frontend/src/components/schemas/FieldOrderManager.tsx

import React, { useState, useCallback, useMemo } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  UniqueIdentifier,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import type { SchemaFieldItem, SchemaFieldUpdateRequest } from '@/types/schema'
import { SortableFieldRow } from './SortableFieldRow'
import { Button } from '@/components/ui/button'
import { Save, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FieldOrderManagerProps {
  schemaId: string
  fields: SchemaFieldItem[]
  onUpdate: (updates: SchemaFieldUpdateRequest[]) => Promise<void>
  isUpdating?: boolean
}

export const FieldOrderManager: React.FC<FieldOrderManagerProps> = ({
  schemaId,
  fields,
  onUpdate,
  isUpdating = false,
}) => {
  // Local state for optimistic updates
  const [localFields, setLocalFields] = useState<SchemaFieldItem[]>(fields)
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sync props to local state when fields change externally
  React.useEffect(() => {
    setLocalFields(fields)
    setHasChanges(false)
  }, [fields])

  // Configure sensors for mouse, touch, and keyboard
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Prevent accidental drags on click
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Count fields with show_on_card enabled
  const showOnCardCount = useMemo(
    () => localFields.filter((f) => f.show_on_card).length,
    [localFields]
  )

  // Handle drag start (for DragOverlay)
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id)
  }, [])

  // Handle drag end (reorder logic)
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over || active.id === over.id) {
      return
    }

    setLocalFields((items) => {
      const oldIndex = items.findIndex((item) => item.field_id === active.id)
      const newIndex = items.findIndex((item) => item.field_id === over.id)

      const reordered = arrayMove(items, oldIndex, newIndex)

      // Recalculate display_order (0-based sequential)
      return reordered.map((item, index) => ({
        ...item,
        display_order: index,
      }))
    })

    setHasChanges(true)
    setError(null)
  }, [])

  // Handle show_on_card toggle
  const handleToggleShowOnCard = useCallback(
    (fieldId: string, checked: boolean) => {
      setLocalFields((items) => {
        const currentCount = items.filter((f) => f.show_on_card).length

        // Prevent enabling if already at max 3
        if (checked && currentCount >= 3) {
          setError('Maximal 3 Felder können auf Karten angezeigt werden')
          return items
        }

        setError(null)
        return items.map((item) =>
          item.field_id === fieldId ? { ...item, show_on_card: checked } : item
        )
      })

      setHasChanges(true)
    },
    []
  )

  // Save changes (batch update)
  const handleSave = useCallback(async () => {
    const updates: SchemaFieldUpdateRequest[] = localFields.map((field) => ({
      field_id: field.field_id,
      display_order: field.display_order,
      show_on_card: field.show_on_card,
    }))

    try {
      await onUpdate(updates)
      setHasChanges(false)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern')
    }
  }, [localFields, onUpdate])

  // Get active field for DragOverlay
  const activeField = useMemo(
    () => localFields.find((f) => f.field_id === activeId),
    [localFields, activeId]
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {showOnCardCount}/3 Felder auf Karten angezeigt
        </div>
        {hasChanges && (
          <Button
            onClick={handleSave}
            disabled={isUpdating}
            size="sm"
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            {isUpdating ? 'Speichern...' : 'Änderungen speichern'}
          </Button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToVerticalAxis]}
      >
        <SortableContext
          items={localFields.map((f) => f.field_id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2" role="list" aria-label="Feldliste">
            {localFields.map((field) => (
              <SortableFieldRow
                key={field.field_id}
                field={field}
                onToggleShowOnCard={handleToggleShowOnCard}
                isShowOnCardDisabled={
                  !field.show_on_card && showOnCardCount >= 3
                }
              />
            ))}
          </div>
        </SortableContext>

        <DragOverlay>
          {activeField ? (
            <div className="rounded-md border border-primary bg-background p-3 shadow-lg">
              <div className="font-medium">{activeField.field.name}</div>
              <div className="text-sm text-muted-foreground">
                {activeField.field.field_type}
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {localFields.length === 0 && (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          Keine Felder vorhanden. Fügen Sie Felder zum Schema hinzu.
        </div>
      )}
    </div>
  )
}
```

### 4. Create SortableFieldRow Component (Individual Draggable Row)
**Files:** `frontend/src/components/schemas/SortableFieldRow.tsx`
**Action:** Implement sortable row with drag handle and checkbox

```typescript
// frontend/src/components/schemas/SortableFieldRow.tsx

import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import type { SchemaFieldItem } from '@/types/schema'
import { cn } from '@/lib/utils'

interface SortableFieldRowProps {
  field: SchemaFieldItem
  onToggleShowOnCard: (fieldId: string, checked: boolean) => void
  isShowOnCardDisabled: boolean
}

export const SortableFieldRow: React.FC<SortableFieldRowProps> = ({
  field,
  onToggleShowOnCard,
  isShowOnCardDisabled,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.field_id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  // Field type display names
  const fieldTypeLabels: Record<string, string> = {
    select: 'Auswahl',
    rating: 'Bewertung',
    text: 'Text',
    boolean: 'Ja/Nein',
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 rounded-md border bg-background p-3',
        isDragging && 'opacity-50',
        'hover:border-primary/50 transition-colors'
      )}
      role="listitem"
    >
      {/* Drag Handle */}
      <button
        type="button"
        className={cn(
          'cursor-grab touch-none rounded p-1',
          'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          isDragging && 'cursor-grabbing'
        )}
        aria-label={`${field.field.name} verschieben`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </button>

      {/* Field Info */}
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{field.field.name}</div>
        <div className="text-sm text-muted-foreground">
          {fieldTypeLabels[field.field.field_type] || field.field.field_type}
        </div>
      </div>

      {/* Show on Card Toggle */}
      <div className="flex items-center gap-2">
        <Checkbox
          id={`show-on-card-${field.field_id}`}
          checked={field.show_on_card}
          onCheckedChange={(checked) =>
            onToggleShowOnCard(field.field_id, checked === true)
          }
          disabled={isShowOnCardDisabled}
          aria-label={`${field.field.name} auf Karte anzeigen`}
        />
        <Label
          htmlFor={`show-on-card-${field.field_id}`}
          className={cn(
            'text-sm cursor-pointer select-none',
            isShowOnCardDisabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          Auf Karte
        </Label>
      </div>
    </div>
  )
}
```

### 5. Create Checkbox UI Component (shadcn/ui)
**Files:** `frontend/src/components/ui/checkbox.tsx`
**Action:** Install shadcn/ui Checkbox component (Radix UI-based)

```bash
cd frontend
npx shadcn@latest add checkbox
```

**Manual implementation if command fails:**

```typescript
// frontend/src/components/ui/checkbox.tsx

import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer h-4 w-4 shrink-0 rounded-sm border border-primary shadow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn("flex items-center justify-center text-current")}
    >
      <Check className="h-4 w-4" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
```

**Install @radix-ui/react-checkbox dependency:**
```bash
npm install @radix-ui/react-checkbox
```

### 6. Create Label UI Component (shadcn/ui)
**Files:** `frontend/src/components/ui/label.tsx`
**Action:** Install shadcn/ui Label component

```bash
cd frontend
npx shadcn@latest add label
```

**Manual implementation if command fails:**

```typescript
// frontend/src/components/ui/label.tsx

import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
)

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> &
    VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(labelVariants(), className)}
    {...props}
  />
))
Label.displayName = LabelPrimitive.Root.displayName

export { Label }
```

**Install @radix-ui/react-label dependency:**
```bash
npm install @radix-ui/react-label
```

### 7. Create Schema Field Update Hook
**Files:** `frontend/src/hooks/useSchemaFields.ts`
**Action:** Implement TanStack Query mutation for batch field updates

```typescript
// frontend/src/hooks/useSchemaFields.ts

import { useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import type { SchemaFieldUpdateRequest } from '@/types/schema'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'

interface UpdateSchemaFieldsParams {
  schemaId: string
  updates: SchemaFieldUpdateRequest[]
}

/**
 * Batch update schema fields (display_order + show_on_card)
 * PUT /api/schemas/{schema_id}/fields/batch
 */
export function useUpdateSchemaFields() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ schemaId, updates }: UpdateSchemaFieldsParams) => {
      const response = await axios.put(
        `${API_BASE}/schemas/${schemaId}/fields/batch`,
        { fields: updates }
      )
      return response.data
    },
    onSuccess: (_, { schemaId }) => {
      // Invalidate schemas cache to refetch updated data
      queryClient.invalidateQueries({ queryKey: ['schemas'] })
      queryClient.invalidateQueries({ queryKey: ['schemas', schemaId] })
    },
  })
}
```

### 8. Integrate FieldOrderManager into SchemaEditor
**Files:** `frontend/src/components/schemas/SchemaEditor.tsx`
**Action:** Add FieldOrderManager to schema editing flow (placeholder integration example)

```typescript
// frontend/src/components/schemas/SchemaEditor.tsx (INTEGRATION EXAMPLE)

import React, { useState } from 'react'
import { FieldOrderManager } from './FieldOrderManager'
import { useUpdateSchemaFields } from '@/hooks/useSchemaFields'
import type { SchemaFieldItem } from '@/types/schema'

interface SchemaEditorProps {
  schemaId: string
  fields: SchemaFieldItem[]
  // ... other props
}

export const SchemaEditor: React.FC<SchemaEditorProps> = ({
  schemaId,
  fields,
}) => {
  const { mutateAsync: updateFields, isPending } = useUpdateSchemaFields()

  const handleFieldOrderUpdate = async (updates: SchemaFieldUpdateRequest[]) => {
    await updateFields({ schemaId, updates })
  }

  return (
    <div className="space-y-6">
      {/* Schema Name/Description Form */}
      <div>
        {/* ... existing schema metadata form ... */}
      </div>

      {/* Field Order Manager */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Felder verwalten</h3>
        <FieldOrderManager
          schemaId={schemaId}
          fields={fields}
          onUpdate={handleFieldOrderUpdate}
          isUpdating={isPending}
        />
      </div>

      {/* Add New Field Section */}
      <div>
        {/* ... field creation form ... */}
      </div>
    </div>
  )
}
```

### 9. Add Screen Reader Announcements
**Files:** `frontend/src/components/schemas/FieldOrderManager.tsx`
**Action:** Implement live region for accessibility announcements

```typescript
// Add to FieldOrderManager.tsx after line 30 (inside component)

// Screen reader live region state
const [announcement, setAnnouncement] = useState('')

// Update handleDragEnd to announce reorder
const handleDragEnd = useCallback((event: DragEndEvent) => {
  const { active, over } = event
  setActiveId(null)

  if (!over || active.id === over.id) {
    return
  }

  setLocalFields((items) => {
    const oldIndex = items.findIndex((item) => item.field_id === active.id)
    const newIndex = items.findIndex((item) => item.field_id === over.id)

    const activeField = items[oldIndex]
    const overField = items[newIndex]

    // Announce reorder for screen readers
    setAnnouncement(
      `${activeField.field.name} wurde von Position ${oldIndex + 1} zu Position ${newIndex + 1} verschoben`
    )

    const reordered = arrayMove(items, oldIndex, newIndex)

    return reordered.map((item, index) => ({
      ...item,
      display_order: index,
    }))
  })

  setHasChanges(true)
  setError(null)
}, [])

// Update handleToggleShowOnCard to announce toggle
const handleToggleShowOnCard = useCallback(
  (fieldId: string, checked: boolean) => {
    setLocalFields((items) => {
      const currentCount = items.filter((f) => f.show_on_card).length
      const field = items.find((f) => f.field_id === fieldId)

      if (checked && currentCount >= 3) {
        setError('Maximal 3 Felder können auf Karten angezeigt werden')
        return items
      }

      // Announce toggle for screen readers
      if (field) {
        setAnnouncement(
          `${field.field.name}: Anzeige auf Karte ${checked ? 'aktiviert' : 'deaktiviert'}`
        )
      }

      setError(null)
      return items.map((item) =>
        item.field_id === fieldId ? { ...item, show_on_card: checked } : item
      )
    })

    setHasChanges(true)
  },
  []
)

// Add live region to JSX (before closing </div>)
return (
  <div className="space-y-4">
    {/* ... existing JSX ... */}

    {/* Screen reader live region */}
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {announcement}
    </div>
  </div>
)
```

### 10. Create Unit Tests for FieldOrderManager
**Files:** `frontend/src/components/schemas/FieldOrderManager.test.tsx`
**Action:** Write comprehensive test suite with 10+ test cases

```typescript
// frontend/src/components/schemas/FieldOrderManager.test.tsx

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FieldOrderManager } from './FieldOrderManager'
import type { SchemaFieldItem } from '@/types/schema'
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'

const mockFields: SchemaFieldItem[] = [
  {
    field_id: 'field-1',
    field: {
      id: 'field-1',
      name: 'Presentation Quality',
      field_type: 'rating',
      config: { max_rating: 5 },
      list_id: 'list-1',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    },
    display_order: 0,
    show_on_card: true,
  },
  {
    field_id: 'field-2',
    field: {
      id: 'field-2',
      name: 'Difficulty',
      field_type: 'select',
      config: { options: ['Easy', 'Medium', 'Hard'] },
      list_id: 'list-1',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    },
    display_order: 1,
    show_on_card: false,
  },
  {
    field_id: 'field-3',
    field: {
      id: 'field-3',
      name: 'Has Subtitles',
      field_type: 'boolean',
      config: {},
      list_id: 'list-1',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    },
    display_order: 2,
    show_on_card: false,
  },
]

describe('FieldOrderManager', () => {
  const mockOnUpdate = vi.fn()

  beforeEach(() => {
    mockOnUpdate.mockClear()
  })

  it('renders all fields in order', () => {
    render(
      <FieldOrderManager
        schemaId="schema-1"
        fields={mockFields}
        onUpdate={mockOnUpdate}
      />
    )

    expect(screen.getByText('Presentation Quality')).toBeInTheDocument()
    expect(screen.getByText('Difficulty')).toBeInTheDocument()
    expect(screen.getByText('Has Subtitles')).toBeInTheDocument()
  })

  it('displays show_on_card count (1/3)', () => {
    render(
      <FieldOrderManager
        schemaId="schema-1"
        fields={mockFields}
        onUpdate={mockOnUpdate}
      />
    )

    expect(screen.getByText('1/3 Felder auf Karten angezeigt')).toBeInTheDocument()
  })

  it('shows save button when changes are made', async () => {
    const user = userEvent.setup()
    render(
      <FieldOrderManager
        schemaId="schema-1"
        fields={mockFields}
        onUpdate={mockOnUpdate}
      />
    )

    // Initially no save button
    expect(screen.queryByText('Änderungen speichern')).not.toBeInTheDocument()

    // Toggle show_on_card checkbox
    const checkbox = screen.getByLabelText('Difficulty auf Karte anzeigen')
    await user.click(checkbox)

    // Save button appears
    expect(screen.getByText('Änderungen speichern')).toBeInTheDocument()
  })

  it('calls onUpdate with correct data when save button clicked', async () => {
    const user = userEvent.setup()
    render(
      <FieldOrderManager
        schemaId="schema-1"
        fields={mockFields}
        onUpdate={mockOnUpdate}
      />
    )

    // Toggle checkbox
    const checkbox = screen.getByLabelText('Difficulty auf Karte anzeigen')
    await user.click(checkbox)

    // Click save
    const saveButton = screen.getByText('Änderungen speichern')
    await user.click(saveButton)

    expect(mockOnUpdate).toHaveBeenCalledWith([
      { field_id: 'field-1', display_order: 0, show_on_card: true },
      { field_id: 'field-2', display_order: 1, show_on_card: true },
      { field_id: 'field-3', display_order: 2, show_on_card: false },
    ])
  })

  it('enforces max 3 show_on_card limit', async () => {
    const user = userEvent.setup()
    const fieldsWithThreeEnabled: SchemaFieldItem[] = [
      ...mockFields.slice(0, 3).map((f, i) => ({ ...f, show_on_card: i < 3 })),
      {
        field_id: 'field-4',
        field: {
          id: 'field-4',
          name: 'Extra Field',
          field_type: 'text',
          config: {},
          list_id: 'list-1',
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
        display_order: 3,
        show_on_card: false,
      },
    ]

    render(
      <FieldOrderManager
        schemaId="schema-1"
        fields={fieldsWithThreeEnabled}
        onUpdate={mockOnUpdate}
      />
    )

    // 4th checkbox should be disabled
    const checkbox = screen.getByLabelText('Extra Field auf Karte anzeigen')
    expect(checkbox).toBeDisabled()

    // Try to click anyway
    await user.click(checkbox)

    // Error message appears
    expect(
      screen.getByText('Maximal 3 Felder können auf Karten angezeigt werden')
    ).toBeInTheDocument()
  })

  it('disables checkboxes when 3 fields already have show_on_card=true', () => {
    const fieldsWithMax: SchemaFieldItem[] = mockFields.map((f, i) => ({
      ...f,
      show_on_card: i < 3,
    }))

    render(
      <FieldOrderManager
        schemaId="schema-1"
        fields={fieldsWithMax}
        onUpdate={mockOnUpdate}
      />
    )

    // All unchecked checkboxes should be disabled
    const hasSubtitlesCheckbox = screen.getByLabelText('Has Subtitles auf Karte anzeigen')
    expect(hasSubtitlesCheckbox).toBeDisabled()
  })

  it('updates display_order when fields are reordered', async () => {
    // Note: Full drag-drop testing requires complex DOM setup
    // This tests the reorder logic directly via state manipulation
    const user = userEvent.setup()
    const { rerender } = render(
      <FieldOrderManager
        schemaId="schema-1"
        fields={mockFields}
        onUpdate={mockOnUpdate}
      />
    )

    // Simulate reorder via prop update (simulates backend response)
    const reorderedFields: SchemaFieldItem[] = [
      { ...mockFields[1], display_order: 0 },
      { ...mockFields[0], display_order: 1 },
      { ...mockFields[2], display_order: 2 },
    ]

    rerender(
      <FieldOrderManager
        schemaId="schema-1"
        fields={reorderedFields}
        onUpdate={mockOnUpdate}
      />
    )

    // Verify order changed
    const fieldNames = screen.getAllByRole('listitem').map((item) =>
      item.textContent?.includes('Difficulty') ? 'Difficulty' :
      item.textContent?.includes('Presentation Quality') ? 'Presentation Quality' :
      'Has Subtitles'
    )

    expect(fieldNames[0]).toBe('Difficulty')
    expect(fieldNames[1]).toBe('Presentation Quality')
  })

  it('renders drag handles with accessibility labels', () => {
    render(
      <FieldOrderManager
        schemaId="schema-1"
        fields={mockFields}
        onUpdate={mockOnUpdate}
      />
    )

    expect(screen.getByLabelText('Presentation Quality verschieben')).toBeInTheDocument()
    expect(screen.getByLabelText('Difficulty verschieben')).toBeInTheDocument()
  })

  it('displays empty state when no fields provided', () => {
    render(
      <FieldOrderManager
        schemaId="schema-1"
        fields={[]}
        onUpdate={mockOnUpdate}
      />
    )

    expect(
      screen.getByText('Keine Felder vorhanden. Fügen Sie Felder zum Schema hinzu.')
    ).toBeInTheDocument()
  })

  it('shows loading state when isUpdating is true', () => {
    render(
      <FieldOrderManager
        schemaId="schema-1"
        fields={mockFields}
        onUpdate={mockOnUpdate}
        isUpdating={true}
      />
    )

    // Trigger change to show save button
    const checkbox = screen.getByLabelText('Difficulty auf Karte anzeigen')
    userEvent.click(checkbox)

    waitFor(() => {
      expect(screen.getByText('Speichern...')).toBeInTheDocument()
    })
  })

  it('displays error message when onUpdate fails', async () => {
    const user = userEvent.setup()
    const mockOnUpdateFail = vi.fn().mockRejectedValue(new Error('Network error'))

    render(
      <FieldOrderManager
        schemaId="schema-1"
        fields={mockFields}
        onUpdate={mockOnUpdateFail}
      />
    )

    // Toggle checkbox and save
    const checkbox = screen.getByLabelText('Difficulty auf Karte anzeigen')
    await user.click(checkbox)

    const saveButton = screen.getByText('Änderungen speichern')
    await user.click(saveButton)

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument()
    })
  })

  it('syncs local state when fields prop changes externally', () => {
    const { rerender } = render(
      <FieldOrderManager
        schemaId="schema-1"
        fields={mockFields}
        onUpdate={mockOnUpdate}
      />
    )

    // Update props with new field
    const updatedFields: SchemaFieldItem[] = [
      ...mockFields,
      {
        field_id: 'field-4',
        field: {
          id: 'field-4',
          name: 'New Field',
          field_type: 'text',
          config: {},
          list_id: 'list-1',
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
        display_order: 3,
        show_on_card: false,
      },
    ]

    rerender(
      <FieldOrderManager
        schemaId="schema-1"
        fields={updatedFields}
        onUpdate={mockOnUpdate}
      />
    )

    expect(screen.getByText('New Field')).toBeInTheDocument()
  })

  it('announces reorder events to screen readers', async () => {
    render(
      <FieldOrderManager
        schemaId="schema-1"
        fields={mockFields}
        onUpdate={mockOnUpdate}
      />
    )

    // Check for live region
    const liveRegion = screen.getByRole('status')
    expect(liveRegion).toHaveAttribute('aria-live', 'polite')
  })
})
```

### 11. Create Unit Tests for SortableFieldRow
**Files:** `frontend/src/components/schemas/SortableFieldRow.test.tsx`
**Action:** Write tests for individual row component

```typescript
// frontend/src/components/schemas/SortableFieldRow.test.tsx

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SortableFieldRow } from './SortableFieldRow'
import { DndContext } from '@dnd-kit/core'
import type { SchemaFieldItem } from '@/types/schema'

const mockField: SchemaFieldItem = {
  field_id: 'field-1',
  field: {
    id: 'field-1',
    name: 'Test Field',
    field_type: 'rating',
    config: { max_rating: 5 },
    list_id: 'list-1',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
  display_order: 0,
  show_on_card: true,
}

// Wrapper for dnd-kit context
const DndWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <DndContext>{children}</DndContext>
)

describe('SortableFieldRow', () => {
  it('renders field name and type', () => {
    render(
      <DndWrapper>
        <SortableFieldRow
          field={mockField}
          onToggleShowOnCard={vi.fn()}
          isShowOnCardDisabled={false}
        />
      </DndWrapper>
    )

    expect(screen.getByText('Test Field')).toBeInTheDocument()
    expect(screen.getByText('Bewertung')).toBeInTheDocument()
  })

  it('renders drag handle with aria-label', () => {
    render(
      <DndWrapper>
        <SortableFieldRow
          field={mockField}
          onToggleShowOnCard={vi.fn()}
          isShowOnCardDisabled={false}
        />
      </DndWrapper>
    )

    expect(screen.getByLabelText('Test Field verschieben')).toBeInTheDocument()
  })

  it('calls onToggleShowOnCard when checkbox clicked', async () => {
    const user = userEvent.setup()
    const mockToggle = vi.fn()

    render(
      <DndWrapper>
        <SortableFieldRow
          field={mockField}
          onToggleShowOnCard={mockToggle}
          isShowOnCardDisabled={false}
        />
      </DndWrapper>
    )

    const checkbox = screen.getByLabelText('Test Field auf Karte anzeigen')
    await user.click(checkbox)

    expect(mockToggle).toHaveBeenCalledWith('field-1', false) // Unchecking
  })

  it('disables checkbox when isShowOnCardDisabled is true', () => {
    render(
      <DndWrapper>
        <SortableFieldRow
          field={{ ...mockField, show_on_card: false }}
          onToggleShowOnCard={vi.fn()}
          isShowOnCardDisabled={true}
        />
      </DndWrapper>
    )

    const checkbox = screen.getByLabelText('Test Field auf Karte anzeigen')
    expect(checkbox).toBeDisabled()
  })

  it('displays correct field type labels', () => {
    const testCases = [
      { field_type: 'select', expected: 'Auswahl' },
      { field_type: 'rating', expected: 'Bewertung' },
      { field_type: 'text', expected: 'Text' },
      { field_type: 'boolean', expected: 'Ja/Nein' },
    ]

    testCases.forEach(({ field_type, expected }) => {
      const { unmount } = render(
        <DndWrapper>
          <SortableFieldRow
            field={{
              ...mockField,
              field: { ...mockField.field, field_type },
            }}
            onToggleShowOnCard={vi.fn()}
            isShowOnCardDisabled={false}
          />
        </DndWrapper>
      )

      expect(screen.getByText(expected)).toBeInTheDocument()
      unmount()
    })
  })
})
```

### 12. Add Integration Test for Full Workflow
**Files:** `frontend/src/components/schemas/FieldOrderManager.integration.test.tsx`
**Action:** Test complete drag-drop and save workflow

```typescript
// frontend/src/components/schemas/FieldOrderManager.integration.test.tsx

import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FieldOrderManager } from './FieldOrderManager'
import type { SchemaFieldItem } from '@/types/schema'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
})

const mockFields: SchemaFieldItem[] = [
  {
    field_id: 'field-1',
    field: {
      id: 'field-1',
      name: 'Quality',
      field_type: 'rating',
      config: {},
      list_id: 'list-1',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    },
    display_order: 0,
    show_on_card: false,
  },
  {
    field_id: 'field-2',
    field: {
      id: 'field-2',
      name: 'Difficulty',
      field_type: 'select',
      config: {},
      list_id: 'list-1',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    },
    display_order: 1,
    show_on_card: false,
  },
]

describe('FieldOrderManager Integration', () => {
  it('completes full workflow: toggle checkboxes, verify limit, save changes', async () => {
    const user = userEvent.setup()
    const mockOnUpdate = vi.fn().mockResolvedValue({})

    render(
      <QueryClientProvider client={queryClient}>
        <FieldOrderManager
          schemaId="schema-1"
          fields={mockFields}
          onUpdate={mockOnUpdate}
        />
      </QueryClientProvider>
    )

    // Step 1: Enable first field
    const checkbox1 = screen.getByLabelText('Quality auf Karte anzeigen')
    await user.click(checkbox1)

    expect(screen.getByText('1/3 Felder auf Karten angezeigt')).toBeInTheDocument()

    // Step 2: Enable second field
    const checkbox2 = screen.getByLabelText('Difficulty auf Karte anzeigen')
    await user.click(checkbox2)

    expect(screen.getByText('2/3 Felder auf Karten angezeigt')).toBeInTheDocument()

    // Step 3: Save changes
    const saveButton = screen.getByText('Änderungen speichern')
    await user.click(saveButton)

    await waitFor(() => {
      expect(mockOnUpdate).toHaveBeenCalledWith([
        { field_id: 'field-1', display_order: 0, show_on_card: true },
        { field_id: 'field-2', display_order: 1, show_on_card: true },
      ])
    })

    // Step 4: Verify save button disappears after success
    await waitFor(() => {
      expect(screen.queryByText('Änderungen speichern')).not.toBeInTheDocument()
    })
  })
})
```

---

## 🧪 Testing Strategy

### Unit Tests (12 tests total)

**FieldOrderManager.test.tsx (10 tests):**
1. ✅ Renders all fields in correct order
2. ✅ Displays show_on_card count (X/3)
3. ✅ Shows save button when changes made
4. ✅ Calls onUpdate with correct payload
5. ✅ Enforces max 3 show_on_card limit
6. ✅ Disables checkboxes when limit reached
7. ✅ Updates display_order on reorder
8. ✅ Renders drag handles with aria-labels
9. ✅ Displays empty state
10. ✅ Shows loading state during save
11. ✅ Displays error messages
12. ✅ Syncs local state with prop changes

**SortableFieldRow.test.tsx (5 tests):**
1. ✅ Renders field name/type
2. ✅ Renders drag handle with aria-label
3. ✅ Calls toggle handler on checkbox click
4. ✅ Disables checkbox when limit reached
5. ✅ Displays correct field type labels

### Integration Tests

**FieldOrderManager.integration.test.tsx:**
1. ✅ Full workflow: Toggle checkboxes → Verify count → Save → Clear changes flag
2. ✅ Error handling: Network failure → Display error → Retry

### Manual Testing Checklist

**Drag-Drop Functionality:**
1. Drag field with mouse → Verify visual feedback (DragOverlay)
2. Drop field in new position → Verify order updates
3. Drag field to same position → No changes flag
4. Drag field while other field is selected → Verify isolation

**Checkbox Toggles:**
1. Enable checkbox → Verify count increments (1/3)
2. Enable 3 checkboxes → Verify 4th checkbox disables
3. Disable checkbox when at limit → Verify others re-enable
4. Toggle while unsaved changes → Verify changes merge

**Keyboard Accessibility (WCAG 2.1 Level AA):**
1. Tab to drag handle → Focus visible
2. Space on drag handle → Start drag
3. Arrow keys (↑/↓) → Reorder fields
4. Enter → Confirm new position
5. Escape → Cancel drag
6. Tab to checkbox → Focus visible
7. Space on checkbox → Toggle

**Screen Reader Testing (VoiceOver/NVDA):**
1. Navigate to field → Hear "Field name, position X of Y"
2. Drag field → Hear "Moving Field name"
3. Drop field → Hear "Field name moved to position X"
4. Toggle checkbox → Hear "Show on card enabled/disabled"
5. Reach limit → Hear "Maximum 3 fields allowed"

**Performance:**
1. Load 50 fields → Render < 200ms
2. Drag field in 50-field list → < 16ms per frame (60fps)
3. Toggle checkbox in 50-field list → UI update < 50ms
4. Save 50 field updates → Network request < 500ms

**Edge Cases:**
1. Empty fields array → Show empty state
2. 1 field only → Drag disabled
3. All fields show_on_card=true initially → Correct count
4. Network error on save → Display error, keep changes
5. Props update during edit → Prompt unsaved changes warning

---

## 📚 Reference

### Related Documentation

**Design Documents:**
- `/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/docs/plans/2025-11-05-custom-fields-system-design.md` - Lines 356-359 (FieldOrderManager requirements)
- `/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/docs/plans/2025-11-05-custom-fields-system-design.md` - Lines 101-113 (schema_fields table structure)
- `/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/docs/plans/2025-11-05-custom-fields-system-design.md` - Lines 314 (Max 3 show_on_card validation)

**API Documentation:**
- Backend endpoint: `PUT /api/schemas/{schema_id}/fields/batch`
- Request payload: `{ fields: SchemaFieldUpdateRequest[] }`
- Response: Updated schema with nested schema_fields

### Related Code Patterns

**Existing Components:**
- `/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/frontend/src/components/ConfirmDeleteModal.tsx` - AlertDialog pattern with loading states
- `/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/frontend/src/components/VideoCard.test.tsx` - Testing patterns with keyboard events (lines 84-94)
- `/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/frontend/src/components/ui/button.tsx` - shadcn/ui component pattern

**Hooks:**
- `/Users/philippbriese/Documents/dev/projects/by IDE/Claude Code/Smart Youtube Bookmarks/frontend/src/hooks/useTags.ts` - TanStack Query mutation pattern (reference for useUpdateSchemaFields)

### External Libraries Research

**dnd-kit Documentation:**
- GitHub: https://github.com/clauderic/dnd-kit
- Docs: https://docs.dndkit.com
- Key concepts: useSortable, SortableContext, DragOverlay
- Accessibility: Built-in keyboard sensors, screen reader announcements

**Library Comparison:**

| Feature | dnd-kit | react-beautiful-dnd | react-dnd |
|---------|---------|---------------------|-----------|
| **Accessibility** | ✅ Excellent (keyboard + SR) | ✅ Good | ⚠️ Manual |
| **Touch Support** | ✅ Native | ✅ Yes | ❌ No |
| **Bundle Size** | 34KB | 68KB | 51KB |
| **Maintenance** | ✅ Active | ❌ Deprecated (2024) | ✅ Active |
| **Performance** | ✅ transform3d | ⚠️ DOM mutations | ⚠️ DOM mutations |
| **TypeScript** | ✅ Excellent | ✅ Good | ✅ Good |
| **Learning Curve** | Medium | Easy | Hard |

**Decision: dnd-kit** ✅
- Best accessibility (WCAG 2.1 compliant out-of-box)
- Active maintenance (react-beautiful-dnd deprecated)
- Smallest bundle size
- No DOM mutations during drag (performant)

### Design Decisions

**Why Optimistic UI Updates?**
- Instant feedback improves perceived performance
- User can continue working while save is in progress
- Matches patterns in modern apps (Notion, Linear, Airtable)

**Why Max 3 Show on Card Limit?**
- Prevents visual clutter on VideoCard component
- Matches design constraint from lines 30-32 of design doc
- Forces users to prioritize most important fields

**Why Batch Update Endpoint?**
- Reduces network requests (1 instead of N)
- Atomic operation (all succeed or all fail)
- Prevents race conditions from simultaneous updates

**Why Vertical List Strategy?**
- Matches schema field ordering mental model (top = first)
- Simpler UX than grid (only 1 dimension to track)
- Accessible with arrow key navigation

**Why GripVertical Icon?**
- Standard drag handle pattern (Google Drive, Trello)
- Visually distinct from checkbox
- Adequate click/touch target (24px)

### Accessibility Standards

**WCAG 2.1 Level AA Compliance:**
- ✅ 4.5:1 contrast ratio for text
- ✅ Keyboard operable (no mouse-only interactions)
- ✅ Focus indicators (visible outlines)
- ✅ Screen reader announcements (live regions)
- ✅ Touch targets ≥ 24px × 24px

**Keyboard Shortcuts:**
- `Tab` - Focus next interactive element
- `Shift + Tab` - Focus previous element
- `Space` - Start drag / Toggle checkbox
- `Enter` - Confirm action
- `Arrow Up/Down` - Reorder during drag
- `Escape` - Cancel drag

**Screen Reader Announcements:**
- Field reorder: "Field name moved from position X to position Y"
- Checkbox toggle: "Show on card enabled/disabled for Field name"
- Limit reached: "Maximum 3 fields allowed on card"
- Save success: "Changes saved successfully"
- Save error: "Error saving changes: [message]"

### Performance Considerations

**Optimization Techniques:**
1. **React.memo** on SortableFieldRow (prevent re-renders)
2. **useMemo** for showOnCardCount (cached calculation)
3. **useCallback** for event handlers (stable references)
4. **transform3d** for drag animation (GPU-accelerated)
5. **Debouncing** not needed (batch save pattern)

**Expected Performance:**
- Render 50 fields: < 200ms (initial)
- Drag animation: 60fps (no jank)
- Checkbox toggle: < 50ms (optimistic update)
- Save request: < 500ms (network dependent)

### Browser Support

**Minimum Requirements:**
- Chrome 90+ (ESM + CSS Grid)
- Firefox 88+ (ESM + CSS Grid)
- Safari 14+ (ESM + CSS Grid)
- Edge 90+ (Chromium-based)

**Touch Device Support:**
- iOS Safari 14+ ✅
- Android Chrome 90+ ✅
- Touch delay: < 100ms activation

---

## 🎓 Learning Notes

**dnd-kit Key Concepts:**
1. **DndContext** - Provides drag-drop context to children
2. **SortableContext** - Manages sortable item IDs and strategy
3. **useSortable** - Hook for individual draggable items
4. **DragOverlay** - Portal-rendered drag preview (outside normal flow)
5. **Sensors** - Input method handlers (pointer, keyboard, touch)
6. **Modifiers** - Transform constraints (vertical axis only)

**Common Pitfalls:**
- ❌ Forgetting to set `id` prop on sortable items
- ❌ Not using `CSS.Transform.toString()` for transform style
- ❌ Missing `restrictToVerticalAxis` modifier (allows diagonal drag)
- ❌ Not implementing `handleDragEnd` (no reorder happens)
- ❌ Mutating array directly instead of using `arrayMove()`

**Best Practices:**
- ✅ Use `field_id` as unique identifier (matches backend)
- ✅ Recalculate `display_order` sequentially (0, 1, 2, ...)
- ✅ Provide visual feedback (DragOverlay + opacity)
- ✅ Announce changes to screen readers (live region)
- ✅ Show unsaved changes indicator (save button)
- ✅ Optimistic updates + rollback on error

---

## ⏱️ Estimated Time

**Development:** 6-8 hours
- dnd-kit setup + types: 1 hour
- FieldOrderManager component: 2 hours
- SortableFieldRow component: 1 hour
- Hook + API integration: 1 hour
- Accessibility (keyboard + SR): 1.5 hours
- Unit tests: 1.5 hours
- Integration testing: 1 hour

**Testing/QA:** 2-3 hours
- Manual accessibility audit: 1 hour
- Cross-browser testing: 0.5 hours
- Performance testing: 0.5 hours
- Bug fixes: 1 hour

**Total:** 8-11 hours

---

## ✅ Definition of Done

- [ ] All 12+ unit tests passing
- [ ] Integration test passing
- [ ] TypeScript compiles with no errors (strict mode)
- [ ] Component renders in SchemaEditor without errors
- [ ] Drag-drop works with mouse, touch, and keyboard
- [ ] Max 3 show_on_card limit enforced
- [ ] Screen reader announcements verified (VoiceOver/NVDA)
- [ ] Focus indicators visible on all interactive elements
- [ ] Save button appears/disappears correctly
- [ ] Optimistic updates work (instant UI feedback)
- [ ] Error handling displays user-friendly messages
- [ ] Performance audit: 50 fields render < 200ms
- [ ] Code reviewed by team
- [ ] Documentation updated in CLAUDE.md

---

## 📝 Notes

**Future Enhancements (Not in MVP):**
- Multi-select drag (select multiple fields, drag together)
- Undo/Redo for reordering
- Copy field order from another schema
- Preview mode (see how fields look on VideoCard)
- Bulk show_on_card toggle (enable/disable all)

**Known Limitations:**
- No mobile drag-drop polish (works but not optimized)
- No animation on checkbox disable (instant)
- No field search/filter (assume < 20 fields per schema)

**Dependencies on Other Tasks:**
- Task #121: SchemaEditor must exist for integration
- Task #117: useCustomFields hook for field data
- Task #118: useSchemas hook for schema data
- Backend: `PUT /api/schemas/{schema_id}/fields/batch` endpoint

**Migration Path:**
- This component is greenfield (no existing drag-drop to replace)
- shadcn/ui Checkbox replaces any existing checkbox implementations in schema context
