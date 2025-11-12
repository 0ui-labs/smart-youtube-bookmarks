import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Trash2 } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * FieldItem represents a field in the schema with its metadata
 */
export interface FieldItem {
  id: string // Unique key from useFieldArray
  field_id: string // UUID of the custom field
  display_order: number
  show_on_card: boolean
  field_name: string
  field_type: string
}

interface FieldOrderManagerProps {
  fields: FieldItem[]
  onReorder: (activeId: string, overId: string) => void
  onToggleShowOnCard: (fieldId: string, show: boolean) => void
  onRemove: (fieldId: string) => void
}

/**
 * Sortable field item component with drag handle, show-on-card toggle, and remove button
 */
function SortableFieldItem({
  field,
  canEnableShowOnCard,
  onToggleShowOnCard,
  onRemove,
}: {
  field: FieldItem
  canEnableShowOnCard: boolean
  onToggleShowOnCard: (show: boolean) => void
  onRemove: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  // Helper to get field type display text
  const getFieldTypeDisplay = (fieldType: string) => {
    switch (fieldType) {
      case 'rating':
        return 'Rating'
      case 'select':
        return 'Auswahl'
      case 'text':
        return 'Text'
      case 'boolean':
        return 'Ja/Nein'
      default:
        return fieldType
    }
  }

  // Disable switch when:
  // - Already at max 3 AND this field is not checked
  // - Always allow unchecking
  const switchDisabled = !canEnableShowOnCard && !field.show_on_card

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 p-3 bg-white border rounded-lg',
        isDragging && 'ring-2 ring-primary'
      )}
    >
      {/* Drag Handle */}
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors touch-none"
        aria-label={`${field.field_name} verschieben`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" />
      </button>

      {/* Field Info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{field.field_name}</p>
        <p className="text-xs text-muted-foreground">
          {getFieldTypeDisplay(field.field_type)}
        </p>
      </div>

      {/* Show on Card Toggle */}
      <div className="flex items-center gap-2">
        <Switch
          id={`show-on-card-${field.id}`}
          checked={field.show_on_card}
          onCheckedChange={onToggleShowOnCard}
          disabled={switchDisabled}
          aria-label={`${field.field_name} auf Karte anzeigen`}
        />
        <Label
          htmlFor={`show-on-card-${field.id}`}
          className={cn(
            'text-xs cursor-pointer select-none',
            switchDisabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          Auf Karte
        </Label>
      </div>

      {/* Remove Button */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onRemove}
        aria-label={`${field.field_name} entfernen`}
        className="text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )
}

/**
 * FieldOrderManager - Drag-and-drop sortable field list with show_on_card toggles
 *
 * REF MCP Improvement: Uses restrictToVerticalAxis modifier for clearer UX
 *
 * Features:
 * - Drag-and-drop reordering with @dnd-kit/sortable
 * - Show-on-card toggles (max 3 enforcement)
 * - Remove field buttons
 * - Keyboard navigation (Arrow keys + Space/Enter)
 * - Visual feedback during drag (opacity 0.5)
 *
 * @example
 * <FieldOrderManager
 *   fields={fields}
 *   onReorder={(activeId, overId) => {
 *     const oldIndex = fields.findIndex(f => f.id === activeId)
 *     const newIndex = fields.findIndex(f => f.id === overId)
 *     move(oldIndex, newIndex)
 *   }}
 *   onToggleShowOnCard={(fieldId, show) => {
 *     const index = fields.findIndex(f => f.id === fieldId)
 *     update(index, { ...fields[index], show_on_card: show })
 *   }}
 *   onRemove={(fieldId) => {
 *     const index = fields.findIndex(f => f.id === fieldId)
 *     remove(index)
 *   }}
 * />
 */
export function FieldOrderManager({
  fields,
  onReorder,
  onToggleShowOnCard,
  onRemove,
}: FieldOrderManagerProps) {
  // Configure sensors for mouse + keyboard navigation
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      onReorder(active.id as string, over.id as string)
    }
  }

  // Count fields with show_on_card enabled
  const showOnCardCount = fields.filter(f => f.show_on_card).length
  const canEnableShowOnCard = showOnCardCount < 3

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      modifiers={[restrictToVerticalAxis]} // REF MCP Improvement
    >
      <SortableContext
        items={fields.map(f => f.id)} // Use stable field.id keys
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2" role="list" aria-label="Felder">
          {fields.map((field) => (
            <SortableFieldItem
              key={field.id}
              field={field}
              canEnableShowOnCard={canEnableShowOnCard}
              onToggleShowOnCard={(show) => onToggleShowOnCard(field.id, show)}
              onRemove={() => onRemove(field.id)}
            />
          ))}
        </div>
      </SortableContext>

      {/* Helper text for show-on-card limit */}
      {showOnCardCount >= 3 && (
        <p className="text-xs text-muted-foreground mt-2">
          Maximal 3 Felder können auf der Karte angezeigt werden ({showOnCardCount}/3)
        </p>
      )}
    </DndContext>
  )
}
