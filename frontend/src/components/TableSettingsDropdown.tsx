// frontend/src/components/TableSettingsDropdown.tsx
/**
 * TableSettingsDropdown Component
 *
 * Provides UI controls for table display settings (thumbnail size, column visibility).
 * Connected to tableSettingsStore for state management and localStorage persistence.
 *
 * Settings apply immediately - no save button needed due to automatic store persistence.
 *
 * @example
 * ```tsx
 * <TableSettingsDropdown />
 * ```
 */
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTableSettingsStore } from '@/stores'; // REF MCP Improvement #5: Central import

export const TableSettingsDropdown = () => {
  // REF MCP Improvement #1: Use separate selectors (NOT useShallow object pattern)
  const viewMode = useTableSettingsStore((state) => state.viewMode);
  const thumbnailSize = useTableSettingsStore((state) => state.thumbnailSize);
  const setThumbnailSize = useTableSettingsStore((state) => state.setThumbnailSize);
  const gridColumns = useTableSettingsStore((state) => state.gridColumns);
  const setGridColumns = useTableSettingsStore((state) => state.setGridColumns);
  const visibleColumns = useTableSettingsStore((state) => state.visibleColumns);
  const toggleColumn = useTableSettingsStore((state) => state.toggleColumn);

  // REF MCP Improvement #1: Runtime validation + Type narrowing (NO type casting!)
  const handleThumbnailSizeChange = (value: string) => {
    // Type guard function - TypeScript narrows the type automatically
    if (value === 'small' || value === 'medium' || value === 'large' || value === 'xlarge') {
      setThumbnailSize(value); // TypeScript knows value is ThumbnailSize here
    } else {
      console.warn(`Invalid thumbnail size value: ${value}`);
    }
  };

  // Task #34: Runtime validation for GridColumnCount
  const handleGridColumnsChange = (value: string) => {
    const parsed = parseInt(value, 10);
    // Type guard - TypeScript narrows type automatically
    if (parsed === 2 || parsed === 3 || parsed === 4 || parsed === 5) {
      setGridColumns(parsed); // TypeScript knows parsed is GridColumnCount here
    } else {
      console.warn(`Invalid grid column count: ${value}`);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Einstellungen">
          <Settings className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64 max-w-[calc(100vw-2rem)]">
        {/* Thumbnail Size Section - Only visible in list view (Task #35 Fix) */}
        {viewMode === 'list' && (
          <>
            <DropdownMenuLabel>Thumbnail-Größe</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={thumbnailSize}
              onValueChange={handleThumbnailSizeChange} // Use type-safe handler
            >
              <DropdownMenuRadioItem value="small">Klein</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="medium">Mittel</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="large">Groß</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="xlarge">YouTube Größe (500x280)</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
          </>
        )}

        {/* Grid Column Count Section - Only visible in grid view (Task #34) */}
        {viewMode === 'grid' && (
          <>
            <DropdownMenuLabel>Spaltenanzahl</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={String(gridColumns)} // Convert number to string for Radix API
              onValueChange={handleGridColumnsChange}
              aria-label="Spaltenanzahl für Grid-Ansicht"
            >
              <DropdownMenuRadioItem value="2">
                2 Spalten (Breit)
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="3">
                3 Spalten (Standard)
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="4">
                4 Spalten (Kompakt)
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="5">
                5 Spalten (Dicht)
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
          </>
        )}

        {/* Column Visibility Section */}
        <DropdownMenuLabel>Sichtbare Spalten</DropdownMenuLabel>

        {/* REF MCP Improvement #3: Correct Radix API - checked prop + onCheckedChange */}
        <DropdownMenuCheckboxItem
          checked={visibleColumns.thumbnail}
          onCheckedChange={() => toggleColumn('thumbnail')}
        >
          Thumbnail
        </DropdownMenuCheckboxItem>

        <DropdownMenuCheckboxItem
          checked={visibleColumns.title}
          onCheckedChange={() => toggleColumn('title')}
        >
          Titel
        </DropdownMenuCheckboxItem>

        <DropdownMenuCheckboxItem
          checked={visibleColumns.duration}
          onCheckedChange={() => toggleColumn('duration')}
        >
          Dauer
        </DropdownMenuCheckboxItem>

        <DropdownMenuCheckboxItem
          checked={visibleColumns.actions}
          onCheckedChange={() => toggleColumn('actions')}
        >
          Aktionen
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
