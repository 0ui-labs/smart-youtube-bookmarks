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
import type { ThumbnailSize } from '@/stores'; // Import type

export const TableSettingsDropdown = () => {
  const { thumbnailSize, setThumbnailSize, visibleColumns, toggleColumn } = useTableSettingsStore();

  // REF MCP Improvement #1: Runtime validation + Type narrowing (NO type casting!)
  const handleThumbnailSizeChange = (value: string) => {
    // Type guard function - TypeScript narrows the type automatically
    if (value === 'small' || value === 'medium' || value === 'large' || value === 'xlarge') {
      setThumbnailSize(value); // TypeScript knows value is ThumbnailSize here
    } else {
      console.warn(`Invalid thumbnail size value: ${value}`);
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
        {/* Thumbnail Size Section */}
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

        {/* REF MCP Improvement #2: Visual separator between sections */}
        <DropdownMenuSeparator />

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
