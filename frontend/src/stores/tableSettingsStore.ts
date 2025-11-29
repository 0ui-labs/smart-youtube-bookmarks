/**
 * Table Settings Store - Zustand state management for video table preferences
 *
 * Manages thumbnail size and column visibility with localStorage persistence.
 * User preferences persist across page reloads.
 *
 * @example
 * ```tsx
 * const { thumbnailSize, setThumbnailSize, visibleColumns, toggleColumn } = useTableSettingsStore();
 * ```
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * Thumbnail size options for video thumbnails
 * - small: Compact preview (w-32 = 128px) - current default
 * - medium: Balanced size for comfortable viewing (w-40 = 160px) - +25% larger
 * - large: Larger preview for detailed inspection (w-48 = 192px) - +50% larger
 * - xlarge: YouTube list view size (500x280 = aspect-ratio preserved)
 *
 * REF MCP Improvement #5: w-48 for large (not w-64) ensures:
 * - Smooth size progression (128px → 160px → 192px → 500px)
 * - More thumbnails fit per row (better table layout)
 * - Consistent with YouTube's thumbnail size patterns
 * - xlarge matches YouTube's standard list view thumbnail dimensions
 *
 * Actual pixel sizes are implemented in VideosPage VideoThumbnail component
 * using Tailwind classes with object mapping for PurgeCSS compatibility
 */
export type ThumbnailSize = "small" | "medium" | "large" | "xlarge";

/**
 * View mode for video display (Task #32)
 * - list: Table view with rows (default, current implementation)
 * - grid: Grid view with cards (responsive columns, Task #32)
 *
 * REF MCP Improvement #1: Separate from thumbnailSize for independent control
 * User can choose Grid with small thumbnails OR Table with large thumbnails
 */
export type ViewMode = "list" | "grid";

/**
 * Grid column count options for grid view layout
 * Controls number of columns displayed in VideoGrid component
 *
 * - 2: Wide cards, maximum detail visibility
 * - 3: Balanced layout (DEFAULT - matches YouTube grid default)
 * - 4: Compact, more content visible (matches current lg: breakpoint)
 * - 5: Maximum density, advanced users
 *
 * RESPONSIVE BEHAVIOR (implemented in Task #35):
 * - Mobile (<768px): Always 1-2 cols (CSS override)
 * - Tablet (768-1024px): Max 3 cols (CSS override)
 * - Desktop (>1024px): User's full choice (2-5)
 *
 * REF MCP Validation: Union type preferred over number with runtime validation
 * (compile-time safety, matches existing ThumbnailSize pattern)
 */
export type GridColumnCount = 2 | 3 | 4 | 5;

/**
 * Video details display mode (Task #131)
 * - page: Navigate to separate /videos/:id page (DEFAULT - YouTube-like UX)
 * - modal: Open details in modal dialog (quick preview)
 *
 * REF MCP #1: Extends existing tableSettingsStore pattern
 * REF MCP #5: Default 'page' preserves Task #130 behavior (non-breaking)
 */
export type VideoDetailsView = "page" | "modal";

/**
 * Column visibility configuration for video table
 * Based on existing VideosPage table structure (4 columns as of Task #24)
 *
 * WHY only 4 columns:
 * - Reflects ACTUAL current table structure (thumbnail, title, duration, actions)
 * - Store should match reality, not future plans
 * - Will be extended in Task #27 when status/created_at columns are added
 */
export interface VisibleColumns {
  /** Video thumbnail/preview image */
  thumbnail: boolean;
  /** Video title (clickable YouTube link) */
  title: boolean;
  /** Video duration (when available) */
  duration: boolean;
  /** Action buttons (delete, etc.) */
  actions: boolean;
}

/**
 * Table settings store state and actions
 */
interface TableSettingsStore {
  /** Current thumbnail size setting */
  thumbnailSize: ThumbnailSize;

  /** Column visibility configuration */
  visibleColumns: VisibleColumns;

  /** Current view mode (Task #32) */
  viewMode: ViewMode;

  /** Grid column count (grid view only, Task #33) */
  gridColumns: GridColumnCount;

  /** Video details view mode (Task #131) */
  videoDetailsView: VideoDetailsView;

  /** Update thumbnail size */
  setThumbnailSize: (size: ThumbnailSize) => void;

  /** Toggle visibility of a specific column */
  toggleColumn: (column: keyof VisibleColumns) => void;

  /** Update view mode (Task #32) */
  setViewMode: (mode: ViewMode) => void;

  /** Update grid column count (Task #33) */
  setGridColumns: (count: GridColumnCount) => void;

  /** Update video details view mode (Task #131) */
  setVideoDetailsView: (view: VideoDetailsView) => void;
}

/**
 * Default visible columns configuration
 * Based on current VideosPage.tsx table structure (Task #24)
 * All columns visible by default for full feature discovery
 */
const DEFAULT_VISIBLE_COLUMNS: VisibleColumns = {
  thumbnail: true, // YouTube thumbnail (column id: 'thumbnail')
  title: true, // Video title with link (column id: 'title')
  duration: true, // Video duration (column id: 'duration')
  actions: true, // Delete button (column id: 'actions')
} as const;

/**
 * Table settings store hook with localStorage persistence
 *
 * WHY persist middleware:
 * - User preferences should survive page reloads
 * - Better UX: Users don't need to reconfigure settings every visit
 * - Standard pattern for UI settings (similar to theme preferences)
 *
 * WHY localStorage (not sessionStorage):
 * - Settings should persist across browser sessions
 * - Users expect UI preferences to be "sticky"
 * - Aligns with user mental model (similar to YouTube's player settings)
 *
 * WHY createJSONStorage explicitly:
 * - Best practice per Zustand docs (even though localStorage is default)
 * - Makes intention clear for future maintainers
 * - Future-proof for Zustand v5 migration
 * - Explicit is better than implicit
 *
 * Storage key: 'video-table-settings'
 * - Unique name to avoid conflicts with other stores
 * - Descriptive for debugging localStorage contents
 *
 * @example
 * ```tsx
 * // Get current settings
 * const { thumbnailSize, visibleColumns } = useTableSettingsStore();
 *
 * // Update thumbnail size
 * const { setThumbnailSize } = useTableSettingsStore();
 * setThumbnailSize('large');
 *
 * // Toggle column visibility
 * const { toggleColumn } = useTableSettingsStore();
 * toggleColumn('duration'); // Hide duration column
 * ```
 */
export const useTableSettingsStore = create<TableSettingsStore>()(
  persist(
    (set) => ({
      // State
      thumbnailSize: "small",
      visibleColumns: DEFAULT_VISIBLE_COLUMNS,
      viewMode: "list", // Task #32: Default to list view (preserves current behavior)
      gridColumns: 3, // Task #33: Default to 3 columns (balanced, matches YouTube)
      videoDetailsView: "page", // Task #131: Default to page (preserves existing behavior)

      // Actions
      setThumbnailSize: (size) => set({ thumbnailSize: size }),

      toggleColumn: (column) =>
        set((state) => ({
          visibleColumns: {
            ...state.visibleColumns,
            [column]: !state.visibleColumns[column],
          },
        })),

      setViewMode: (mode) => set({ viewMode: mode }), // Task #32: Set view mode
      setGridColumns: (count) => set({ gridColumns: count }), // Task #33
      setVideoDetailsView: (view) => set({ videoDetailsView: view }), // Task #131
    }),
    {
      name: "video-table-settings", // localStorage key (must be unique)
      storage: createJSONStorage(() => localStorage), // REF MCP #1: Explicit storage for clarity
    }
  )
);
