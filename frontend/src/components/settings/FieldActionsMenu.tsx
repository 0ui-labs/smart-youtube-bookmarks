// frontend/src/components/settings/FieldActionsMenu.tsx
import { MoreVertical, Pencil, Trash2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
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
 * - Matches SchemaActionsMenu pattern: MoreVertical icon, keyboard handling, tabIndex={-1}
 */
export const FieldActionsMenu = ({ field, onEdit, onDelete }: FieldActionsMenuProps) => {
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
        aria-label={`Actions for ${field.name}`}
      >
        <MoreVertical className="w-4 h-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem
          onClick={(e) => {
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
          onClick={(e) => {
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
