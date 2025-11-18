/**
 * SortableFieldRow Component (Task #126)
 *
 * Single draggable field row with show_on_card checkbox.
 *
 * Features:
 * - Drag handle with useSortable hook
 * - Field name and type display
 * - Show on card checkbox toggle
 * - Disabled state for max 3 constraint
 * - WCAG 2.1 AA accessible (aria-labels, keyboard nav)
 *
 * REF MCP Improvement #5: Checkbox onCheckedChange uses type guard
 */

import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import type { SchemaFieldResponse } from '@/types/schema'
import { cn } from '@/lib/utils'

interface SortableFieldRowProps {
  field: SchemaFieldResponse
  onToggleShowOnCard: (fieldId: string, checked: boolean | 'indeterminate') => void
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

  // Field type labels (German)
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
        <GripVertical className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
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
          onCheckedChange={(checked) => onToggleShowOnCard(field.field_id, checked)}
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
