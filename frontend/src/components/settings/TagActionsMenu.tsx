// frontend/src/components/settings/TagActionsMenu.tsx
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Tag } from "@/types/tag";

interface TagActionsMenuProps {
  tag: Tag;
  onEdit: (tag: Tag) => void;
  onDelete: (tag: Tag) => void;
}

/**
 * Three-dot actions menu for tags
 *
 * Provides Edit and Delete actions with proper event propagation handling.
 * Uses shadcn/ui DropdownMenu with modal={false} to allow dialog interactions.
 *
 * Design Patterns:
 * - modal={false} enables opening dialogs from menu items
 * - align="end" positions menu to right edge of trigger
 * - stopPropagation prevents row click events (if row is clickable)
 * - Destructive variant for delete action (red text)
 * - Matches FieldActionsMenu pattern: MoreVertical icon, keyboard handling, tabIndex={-1}
 *
 * @example
 * <TagActionsMenu
 *   tag={tag}
 *   onEdit={(tag) => openEditDialog(tag)}
 *   onDelete={(tag) => openDeleteDialog(tag)}
 * />
 */
export const TagActionsMenu = ({
  tag,
  onEdit,
  onDelete,
}: TagActionsMenuProps) => (
  <DropdownMenu modal={false}>
    <DropdownMenuTrigger
      aria-label={`Actions for ${tag.name}`}
      className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.stopPropagation();
        }
      }}
      tabIndex={-1}
    >
      <MoreVertical className="h-4 w-4" />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-40">
      <DropdownMenuItem
        className="cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          onEdit(tag);
        }}
      >
        <Pencil className="mr-2 h-4 w-4" />
        Edit
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        className="cursor-pointer text-red-600 focus:text-red-700"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(tag);
        }}
      >
        <Trash2 className="mr-2 h-4 w-4" />
        Delete
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);
