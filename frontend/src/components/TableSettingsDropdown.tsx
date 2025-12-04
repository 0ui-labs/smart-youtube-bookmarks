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
import { Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useTableSettingsStore } from "@/stores"; // REF MCP Improvement #5: Central import

export const TableSettingsDropdown = () => {
  // Track mobile breakpoint for responsive settings
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);
  // REF MCP Improvement #1: Use separate selectors (NOT useShallow object pattern)
  const viewMode = useTableSettingsStore((state) => state.viewMode);
  const thumbnailSize = useTableSettingsStore((state) => state.thumbnailSize);
  const setThumbnailSize = useTableSettingsStore(
    (state) => state.setThumbnailSize
  );
  const gridColumns = useTableSettingsStore((state) => state.gridColumns);
  const setGridColumns = useTableSettingsStore((state) => state.setGridColumns);
  const visibleColumns = useTableSettingsStore((state) => state.visibleColumns);
  const toggleColumn = useTableSettingsStore((state) => state.toggleColumn);

  // Task #131 Step 5: Video details view mode setting
  const videoDetailsView = useTableSettingsStore(
    (state) => state.videoDetailsView
  );
  const setVideoDetailsView = useTableSettingsStore(
    (state) => state.setVideoDetailsView
  );

  // REF MCP Improvement #1: Runtime validation + Type narrowing (NO type casting!)
  const handleThumbnailSizeChange = (value: string) => {
    // Type guard function - TypeScript narrows the type automatically
    if (
      value === "small" ||
      value === "medium" ||
      value === "large" ||
      value === "xlarge"
    ) {
      setThumbnailSize(value); // TypeScript knows value is ThumbnailSize here
    } else {
      console.warn(`Invalid thumbnail size value: ${value}`);
    }
  };

  // Task #34: Runtime validation for GridColumnCount
  const handleGridColumnsChange = (value: string) => {
    const parsed = Number.parseInt(value, 10);
    // Type guard - TypeScript narrows type automatically (including 1 for mobile)
    if (
      parsed === 1 ||
      parsed === 2 ||
      parsed === 3 ||
      parsed === 4 ||
      parsed === 5
    ) {
      setGridColumns(parsed); // TypeScript knows parsed is GridColumnCount here
    } else {
      console.warn(`Invalid grid column count: ${value}`);
    }
  };

  // Task #131 Step 5: Runtime validation for VideoDetailsView
  const handleVideoDetailsViewChange = (value: string) => {
    // Type guard - TypeScript narrows type automatically
    if (value === "page" || value === "modal") {
      setVideoDetailsView(value); // TypeScript knows value is 'page' | 'modal' here
    } else {
      console.warn(`Invalid video details view value: ${value}`);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label="Einstellungen"
          className="rounded-full"
          size="icon"
          variant="ghost"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-64 max-w-[calc(100vw-2rem)]"
      >
        {/* Thumbnail Size Section - Only visible in list view (Task #35 Fix) */}
        {viewMode === "list" && (
          <>
            <DropdownMenuLabel>Thumbnail-Größe</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              onValueChange={handleThumbnailSizeChange}
              value={thumbnailSize} // Use type-safe handler
            >
              <DropdownMenuRadioItem value="small">Klein</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="medium">
                Mittel
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="large">Groß</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="xlarge">
                YouTube Größe (500x280)
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
          </>
        )}

        {/* Grid Column Count Section - Only visible in grid view (Task #34) */}
        {viewMode === "grid" && (
          <>
            <DropdownMenuLabel>Spaltenanzahl</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              aria-label="Spaltenanzahl für Grid-Ansicht" // Convert number to string for Radix API
              onValueChange={handleGridColumnsChange}
              value={String(gridColumns)}
            >
              {/* Mobile: Only show 1-2 columns */}
              {isMobile && (
                <DropdownMenuRadioItem value="1">
                  1 Spalte
                </DropdownMenuRadioItem>
              )}
              <DropdownMenuRadioItem value="2">
                2 Spalten {isMobile ? "" : "(Breit)"}
              </DropdownMenuRadioItem>
              {/* Desktop: Show 3-5 columns */}
              {!isMobile && (
                <>
                  <DropdownMenuRadioItem value="3">
                    3 Spalten (Standard)
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="4">
                    4 Spalten (Kompakt)
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="5">
                    5 Spalten (Dicht)
                  </DropdownMenuRadioItem>
                </>
              )}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
          </>
        )}

        {/* Column Visibility Section - Only visible in list view */}
        {viewMode === "list" && (
          <>
            <DropdownMenuLabel>Sichtbare Spalten</DropdownMenuLabel>

            {/* REF MCP Improvement #3: Correct Radix API - checked prop + onCheckedChange */}
            <DropdownMenuCheckboxItem
              checked={visibleColumns.thumbnail}
              onCheckedChange={() => toggleColumn("thumbnail")}
            >
              Thumbnail
            </DropdownMenuCheckboxItem>

            <DropdownMenuCheckboxItem
              checked={visibleColumns.title}
              onCheckedChange={() => toggleColumn("title")}
            >
              Titel
            </DropdownMenuCheckboxItem>

            <DropdownMenuCheckboxItem
              checked={visibleColumns.duration}
              onCheckedChange={() => toggleColumn("duration")}
            >
              Dauer
            </DropdownMenuCheckboxItem>

            <DropdownMenuCheckboxItem
              checked={visibleColumns.actions}
              onCheckedChange={() => toggleColumn("actions")}
            >
              Aktionen
            </DropdownMenuCheckboxItem>

            <DropdownMenuSeparator />
          </>
        )}

        {/* Video Details Ansicht Section (Task #131 Step 5) - Desktop only */}
        {/* REF MCP #4: RadioGroup for mutually exclusive choice (page OR modal) */}
        {/* Mobile: Always use "page" view, no toggle needed */}
        {!isMobile && (
          <div className="px-2 py-1.5">
            <Label className="font-medium text-xs">Video Details</Label>
            <RadioGroup
              className="mt-2 space-y-2"
              onValueChange={handleVideoDetailsViewChange}
              value={videoDetailsView}
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem id="view-page" value="page" />
                <Label
                  className="cursor-pointer font-normal"
                  htmlFor="view-page"
                >
                  Eigene Seite (Standard)
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem id="view-modal" value="modal" />
                <Label
                  className="cursor-pointer font-normal"
                  htmlFor="view-modal"
                >
                  Modal Dialog
                </Label>
              </div>
            </RadioGroup>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
