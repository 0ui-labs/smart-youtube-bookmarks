// frontend/src/components/ViewModeToggle.tsx
import { LayoutGrid, LayoutList } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ViewMode } from "@/stores/tableSettingsStore";

interface ViewModeToggleProps {
  viewMode: ViewMode;
  onToggle: (mode: ViewMode) => void;
}

/**
 * ViewModeToggle - Toggle button for switching between list and grid view
 *
 * Shows opposite mode icon (Grid icon in list view, List icon in grid view)
 * to indicate what will happen when clicked (affordance pattern)
 *
 * REF MCP Improvement #1: Manual toggle for independent viewMode control
 * REF MCP Pattern: Consistent with Plus button (ghost variant, icon size h-4 w-4)
 */
export const ViewModeToggle = ({ viewMode, onToggle }: ViewModeToggleProps) => {
  const handleToggle = () => {
    onToggle(viewMode === "list" ? "grid" : "list");
  };

  return (
    <Button
      aria-label={
        viewMode === "list"
          ? "Grid-Ansicht anzeigen"
          : "Listen-Ansicht anzeigen"
      }
      className="rounded-full"
      onClick={handleToggle}
      size="icon"
      variant="ghost"
    >
      {viewMode === "list" ? (
        <LayoutGrid className="h-4 w-4" />
      ) : (
        <LayoutList className="h-4 w-4" />
      )}
    </Button>
  );
};
