/**
 * FieldOrderManager Component (Task #126)
 *
 * Drag-drop field ordering with show_on_card toggles.
 *
 * REF MCP Improvements Applied:
 * - #2: Direct Mocking (tests use vi.mocked, NOT MSW)
 * - #3: No control prop (local useState, NOT useForm)
 * - #4: dnd-kit announcements (DndContext announcements prop)
 * - #5: Type Guards (Checkbox onCheckedChange with typeof check)
 *
 * Features:
 * - Drag-drop reordering with dnd-kit
 * - Show on card toggles (max 3 constraint)
 * - Save changes button (appears on local edits)
 * - Keyboard navigation (Arrow keys, Escape, Enter)
 * - Screen reader announcements
 * - WCAG 2.1 AA accessible
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  UniqueIdentifier,
  DragOverlay,
  Announcements,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import type { SchemaFieldResponse, SchemaFieldUpdateItem } from '@/types/schema'
import { SortableFieldRow } from './SortableFieldRow'
import { Button } from '@/components/ui/button'
import { Save, AlertCircle } from 'lucide-react'

interface FieldOrderManagerProps {
  listId: string
  schemaId: string
  fields: SchemaFieldResponse[]
  onUpdate: (updates: SchemaFieldUpdateItem[]) => Promise<void>
  isUpdating?: boolean
}

export const FieldOrderManager: React.FC<FieldOrderManagerProps> = ({
  fields,
  onUpdate,
  isUpdating = false,
}) => {
  // REF MCP Improvement #3: Local useState (NOT useForm)
  const [localFields, setLocalFields] = useState<SchemaFieldResponse[]>(fields)
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sync props to local state
  useEffect(() => {
    setLocalFields(fields)
    setHasChanges(false)
  }, [fields])

  // Configure sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Count show_on_card fields
  const showOnCardCount = useMemo(
    () => localFields.filter((f) => f.show_on_card).length,
    [localFields]
  )

  // REF MCP Improvement #4: dnd-kit announcements (NOT manual useState)
  const announcements: Announcements = {
    onDragStart({ active }) {
      const field = localFields.find((f) => f.field_id === active.id)
      return field
        ? `${field.field.name} aufgenommen. Drücken Sie Pfeiltasten zum Verschieben.`
        : 'Feld aufgenommen'
    },
    onDragOver({ active, over }) {
      if (!over) return ''
      const activeField = localFields.find((f) => f.field_id === active.id)
      const overField = localFields.find((f) => f.field_id === over.id)
      return activeField && overField
        ? `${activeField.field.name} über ${overField.field.name}`
        : ''
    },
    onDragEnd({ active, over }) {
      if (!over) return 'Vorgang abgebrochen'
      const activeField = localFields.find((f) => f.field_id === active.id)
      const oldIndex = localFields.findIndex((f) => f.field_id === active.id)
      const newIndex = localFields.findIndex((f) => f.field_id === over.id)
      return activeField
        ? `${activeField.field.name} von Position ${oldIndex + 1} zu Position ${newIndex + 1} verschoben`
        : 'Feld verschoben'
    },
    onDragCancel({ active }) {
      const field = localFields.find((f) => f.field_id === active.id)
      return field ? `Verschieben von ${field.field.name} abgebrochen` : 'Vorgang abgebrochen'
    },
  }

  // Drag handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id)
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over || active.id === over.id) return

    setLocalFields((items) => {
      const oldIndex = items.findIndex((item) => item.field_id === active.id)
      const newIndex = items.findIndex((item) => item.field_id === over.id)
      const reordered = arrayMove(items, oldIndex, newIndex)

      // Recalculate display_order
      return reordered.map((item, index) => ({
        ...item,
        display_order: index,
      }))
    })

    setHasChanges(true)
    setError(null)
  }, [])

  // REF MCP Improvement #5: Type guard for Checkbox (NOT === true coercion)
  const handleToggleShowOnCard = useCallback(
    (fieldId: string, checked: boolean | 'indeterminate') => {
      if (typeof checked !== 'boolean') return // Type guard

      setLocalFields((items) => {
        const currentCount = items.filter((f) => f.show_on_card).length

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

  // Save changes
  const handleSave = useCallback(async () => {
    const updates: SchemaFieldUpdateItem[] = localFields.map((field) => ({
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

  // Active field for overlay
  const activeField = useMemo(
    () => localFields.find((f) => f.field_id === activeId),
    [localFields, activeId]
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {showOnCardCount}/3 Felder auf Karten angezeigt
        </div>
        {hasChanges && (
          <Button onClick={handleSave} disabled={isUpdating} size="sm" className="gap-2">
            <Save className="h-4 w-4" aria-hidden="true" />
            {isUpdating ? 'Speichern...' : 'Änderungen speichern'}
          </Button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div
          className="flex items-center gap-2 rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      {/* Drag-drop list */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToVerticalAxis]}
        accessibility={{ announcements }}
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
                isShowOnCardDisabled={!field.show_on_card && showOnCardCount >= 3}
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

      {/* Empty state */}
      {localFields.length === 0 && (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          Keine Felder vorhanden. Fügen Sie Felder zum Schema hinzu.
        </div>
      )}
    </div>
  )
}
