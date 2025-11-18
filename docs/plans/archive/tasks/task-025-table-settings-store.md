# Task #25: Create Table Settings Store with Thumbnail Size and Column Visibility

**Plan Task:** #25  
**Wave/Phase:** Wave 2 - UI Cleanup (Polish)  
**Dependencies:** Task #24 (Feature Flags established)

---

## 🎯 Ziel

Erstelle einen Zustand Store für Table Settings mit localStorage Persistence, der Thumbnail-Größen (small/medium/large) und Spalten-Sichtbarkeit verwaltet. User-Präferenzen bleiben über Page Reloads hinweg erhalten.

**Erwartetes Ergebnis:** `useTableSettingsStore` Hook mit persisted state, der in Task #26 (TableSettingsDropdown) und Task #27 (VideoTable) verwendet wird.

## 📋 Acceptance Criteria

- [ ] **Stores Verzeichnis erstellt:** `frontend/src/stores/` Ordner angelegt
- [ ] Zustand Store mit TypeScript erstellt (`tableSettingsStore.ts`) - **Zustand v4.5.0 kompatibel**
- [ ] Persist middleware korrekt konfiguriert (localStorage, name: 'video-table-settings')
- [ ] Thumbnail size state mit 3 Optionen (small, medium, large) - default: small
- [ ] Visible columns state mit **6 Spalten** (preview, title, duration, status, created_at, actions) - alle default: true
- [ ] `setThumbnailSize()` Action für Größenänderung
- [ ] `toggleColumn()` Action für Spalten-Sichtbarkeit
- [ ] Comprehensive unit tests (**10 tests**) mit Column Namen Alignment Test
- [ ] Tests passing (100% coverage für neuen Code)
- [ ] localStorage Persistence getestet (Rehydration after reload)
- [ ] JSDoc Dokumentation für alle exports
- [ ] **Spalten Namen aligned mit existierender VideosPage Tabelle**

---

## 🛠️ Implementation Steps

### 1. Create Stores Directory and TableSettingsStore

**Files:** `frontend/src/stores/tableSettingsStore.ts` (neues Verzeichnis)  
**Action:** Zustand Store mit persist middleware für v4.5.0 erstellen

**Code:**

```typescript
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
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Thumbnail size options for video thumbnails
 * - small: 128x72px (16:9 aspect ratio, compact)
 * - medium: 160x96px (balanced size)
 * - large: 192x112px (larger preview)
 */
export type ThumbnailSize = 'small' | 'medium' | 'large';

/**
 * Column visibility configuration for video table
 * Based on existing VideosPage table structure
 */
export interface VisibleColumns {
  /** Video thumbnail/preview image */
  preview: boolean;
  /** Video title (clickable YouTube link) */
  title: boolean;
  /** Video duration (when available) */
  duration: boolean;
  /** Processing status badge */
  status: boolean;
  /** Date when video was added */
  created_at: boolean;
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

  /** Update thumbnail size */
  setThumbnailSize: (size: ThumbnailSize) => void;

  /** Toggle visibility of a specific column */
  toggleColumn: (column: keyof VisibleColumns) => void;
}

/**
 * Default visible columns configuration
 * Based on current VideosPage.tsx table structure
 * All columns visible by default for full feature discovery
 */
const DEFAULT_VISIBLE_COLUMNS: VisibleColumns = {
  preview: true,    // YouTube thumbnail placeholder
  title: true,      // Video title with link
  duration: true,   // Video duration
  status: true,     // Processing status
  created_at: true, // Date added
  actions: true,    // Delete button
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
      thumbnailSize: 'small',
      visibleColumns: DEFAULT_VISIBLE_COLUMNS,

      // Actions
      setThumbnailSize: (size) => set({ thumbnailSize: size }),

      toggleColumn: (column) =>
        set((state) => ({
          visibleColumns: {
            ...state.visibleColumns,
            [column]: !state.visibleColumns[column],
          },
        })),
    }),
    {
      name: 'video-table-settings', // localStorage key (must be unique)
    }
  )
);
```

**Why this approach:**

1. **TypeScript `as const` for DEFAULT_VISIBLE_COLUMNS:** Ensures immutability and prevents accidental modification
2. **Zustand v4.5.0 syntax:** Compatible with installed version (no `createJSONStorage` needed)
3. **JSDoc with WHY comments:** Documents rationale for persist middleware, localStorage choice, and storage key naming
4. **Union type for ThumbnailSize:** Type-safe size options, prevents invalid values
5. **Interface for VisibleColumns:** Self-documenting structure with JSDoc descriptions
6. **Column names aligned:** Matches existing VideosPage table structure

**Alternatives considered:**
- **sessionStorage:** Rejected - settings should persist across sessions
- **IndexedDB:** Overkill for simple key-value storage
- **No persistence:** Poor UX - users would lose preferences on reload

---

### 2. Create Comprehensive Unit Tests

**Files:** `frontend/src/stores/tableSettingsStore.test.ts`  
**Action:** Test alle store actions und localStorage persistence

**Code:**

```typescript
import { renderHook, act } from '@testing-library/react';
import { useTableSettingsStore } from './tableSettingsStore';

describe('useTableSettingsStore', () => {
  // Clear localStorage before each test for isolation
  beforeEach(() => {
    localStorage.clear();
    // Reset store to initial state
    useTableSettingsStore.setState({
      thumbnailSize: 'small',
      visibleColumns: {
        preview: true,
        title: true,
        duration: true,
        status: true,
        created_at: true,
        actions: true,
      },
    });
  });

  describe('Thumbnail Size', () => {
    it('has default thumbnail size of "small"', () => {
      const { result } = renderHook(() => useTableSettingsStore());

      expect(result.current.thumbnailSize).toBe('small');
    });

    it('changes thumbnail size via setThumbnailSize', () => {
      const { result } = renderHook(() => useTableSettingsStore());

      act(() => {
        result.current.setThumbnailSize('large');
      });

      expect(result.current.thumbnailSize).toBe('large');
    });

    it('persists thumbnail size to localStorage', () => {
      const { result } = renderHook(() => useTableSettingsStore());

      act(() => {
        result.current.setThumbnailSize('medium');
      });

      // Check localStorage directly
      const stored = JSON.parse(localStorage.getItem('video-table-settings') || '{}');
      expect(stored.state.thumbnailSize).toBe('medium');
    });
  });

  describe('Column Visibility', () => {
    it('has all columns visible by default', () => {
      const { result } = renderHook(() => useTableSettingsStore());

      expect(result.current.visibleColumns).toEqual({
        preview: true,
        title: true,
        duration: true,
        status: true,
        created_at: true,
        actions: true,
      });
    });

    it('toggles column visibility via toggleColumn', () => {
      const { result } = renderHook(() => useTableSettingsStore());

      act(() => {
        result.current.toggleColumn('duration');
      });

      expect(result.current.visibleColumns.duration).toBe(false);
      expect(result.current.visibleColumns.title).toBe(true); // Others unchanged
    });

    it('toggles column back to visible when called twice', () => {
      const { result } = renderHook(() => useTableSettingsStore());

      act(() => {
        result.current.toggleColumn('status');
      });
      expect(result.current.visibleColumns.status).toBe(false);

      act(() => {
        result.current.toggleColumn('status');
      });
      expect(result.current.visibleColumns.status).toBe(true);
    });

    it('persists column visibility to localStorage', () => {
      const { result } = renderHook(() => useTableSettingsStore());

      act(() => {
        result.current.toggleColumn('preview');
        result.current.toggleColumn('actions');
      });

      // Check localStorage
      const stored = JSON.parse(localStorage.getItem('video-table-settings') || '{}');
      expect(stored.state.visibleColumns.preview).toBe(false);
      expect(stored.state.visibleColumns.actions).toBe(false);
      expect(stored.state.visibleColumns.title).toBe(true); // Unchanged
    });
  });

  describe('Persistence & Rehydration', () => {
    it('rehydrates state from localStorage on mount', () => {
      // Simulate existing localStorage data (Zustand v4 format)
      const existingData = {
        state: {
          thumbnailSize: 'large',
          visibleColumns: {
            preview: true,
            title: false,
            duration: true,
            status: false,
            created_at: true,
            actions: true,
          },
        },
        version: 0,
      };
      localStorage.setItem('video-table-settings', JSON.stringify(existingData));

      // Create new hook instance (simulates page reload)
      const { result } = renderHook(() => useTableSettingsStore());

      // Should load persisted values
      expect(result.current.thumbnailSize).toBe('large');
      expect(result.current.visibleColumns.title).toBe(false);
      expect(result.current.visibleColumns.status).toBe(false);
    });

    it('uses default values when localStorage is empty', () => {
      // Ensure localStorage is empty
      localStorage.clear();

      const { result } = renderHook(() => useTableSettingsStore());

      expect(result.current.thumbnailSize).toBe('small');
      expect(result.current.visibleColumns.preview).toBe(true);
    });
  });

  describe('Column Names Alignment', () => {
    it('has column names that match VideosPage table structure', () => {
      const { result } = renderHook(() => useTableSettingsStore());

      const columnNames = Object.keys(result.current.visibleColumns);
      
      // These should match the column IDs used in VideosPage.tsx
      expect(columnNames).toContain('preview');    // matches 'preview' column
      expect(columnNames).toContain('title');      // matches 'title' column  
      expect(columnNames).toContain('duration');   // matches 'duration' column
      expect(columnNames).toContain('status');     // matches 'status' column
      expect(columnNames).toContain('created_at'); // matches 'created_at' column
      expect(columnNames).toContain('actions');    // matches 'actions' column
    });

    it('has exactly 6 columns configured', () => {
      const { result } = renderHook(() => useTableSettingsStore());
      
      const columnCount = Object.keys(result.current.visibleColumns).length;
      expect(columnCount).toBe(6);
    });
  });
});
```

**Why these tests:**

1. **localStorage.clear() in beforeEach:** Test isolation - prevents flaky tests from shared state
2. **Direct localStorage inspection:** Verifies persist middleware actually writes to storage
3. **Rehydration test:** Critical for persistence - simulates page reload scenario
4. **Default values test:** Ensures graceful handling of empty/new localStorage
5. **Multiple toggles test:** Verifies toggle logic works bidirectionally
6. **Column alignment tests:** Ensures store matches existing table structure

**Test Coverage:**
- ✅ Default state initialization
- ✅ Action mutations (setThumbnailSize, toggleColumn)
- ✅ localStorage persistence (write)
- ✅ localStorage rehydration (read on mount)
- ✅ Empty localStorage handling (defaults)
- ✅ Multiple operations (toggle twice)
- ✅ Column names alignment with VideosPage
- ✅ Column count verification

---

### 3. Create Stores Index File

**Files:** `frontend/src/stores/index.ts` (neu erstellen)  
**Action:** Central export point für alle stores

**Code:**

```typescript
/**
 * Centralized exports for all Zustand stores
 * 
 * This index file provides a single import point for all store hooks and types,
 * making it easier to import multiple stores and refactor store structure.
 * 
 * @example
 * ```tsx
 * import { useTableSettingsStore, type ThumbnailSize } from '@/stores';
 * ```
 */
export { useTableSettingsStore } from './tableSettingsStore';
export type { ThumbnailSize, VisibleColumns } from './tableSettingsStore';
```

**Why:**
- Single import path for multiple stores: `import { useTableSettingsStore } from '@/stores'`
- Easier refactoring if store structure changes
- Standard pattern in modern React projects
- Type exports for component props

---

### 4. Run Tests and Verify

**Files:** N/A (command execution)  
**Action:** Run tests und verify 100% passing

**Commands:**

```bash
cd frontend

# 1. Create stores directory first
mkdir -p src/stores

# 2. Run specific test file (after implementation)
npm test -- tableSettingsStore.test.ts --run

# Expected output:
# ✓ src/stores/tableSettingsStore.test.ts  (10 tests) XXXms
#   ✓ useTableSettingsStore