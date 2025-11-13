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
