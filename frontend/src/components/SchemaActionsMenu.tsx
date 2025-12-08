import {
  BarChart3,
  Copy,
  Edit2,
  Grid2x2,
  MoreVertical,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { FieldSchemaResponse } from "@/types/schema";

interface SchemaActionsMenuProps {
  schema: FieldSchemaResponse;
  usageCount: number;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onViewUsage: () => void;
  onBulkApply: () => void;
}

export const SchemaActionsMenu = ({
  schema,
  usageCount,
  onEdit,
  onDelete,
  onDuplicate,
  onViewUsage,
  onBulkApply,
}: SchemaActionsMenuProps) => (
  <DropdownMenu modal={false}>
    <DropdownMenuTrigger
      aria-label={`Actions for ${schema.name}`}
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

    <DropdownMenuContent align="end" className="w-56">
      <DropdownMenuItem
        className="cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
      >
        <Edit2 className="mr-2 h-4 w-4" />
        Schema bearbeiten
      </DropdownMenuItem>

      <DropdownMenuItem
        className="cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          onDuplicate();
        }}
      >
        <Copy className="mr-2 h-4 w-4" />
        Schema duplizieren
      </DropdownMenuItem>

      <DropdownMenuItem
        className="cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          onBulkApply();
        }}
      >
        <Grid2x2 className="mr-2 h-4 w-4" />
        Auf Tags anwenden
      </DropdownMenuItem>

      <DropdownMenuItem
        className="cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          onViewUsage();
        }}
      >
        <BarChart3 className="mr-2 h-4 w-4" />
        Verwendungsstatistik
        {usageCount > 0 && (
          <span className="ml-auto rounded-full bg-blue-100 px-2 py-0.5 text-blue-700 text-xs">
            {usageCount}
          </span>
        )}
      </DropdownMenuItem>

      <DropdownMenuSeparator />

      <DropdownMenuItem
        className="cursor-pointer text-red-600 focus:text-red-700"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        <Trash2 className="mr-2 h-4 w-4" />
        Schema löschen
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);
