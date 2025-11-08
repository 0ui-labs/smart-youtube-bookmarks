# Task #45: Column Visibility Toggles with TanStack Table Integration

**Plan Task:** #45
**Wave/Phase:** Phase 3: YouTube Grid Interface
**Dependencies:** Task #25 (tableSettingsStore), Task #26 (TableSettingsDropdown)

---

## 🎯 Ziel

Migrate existing manual column filtering to TanStack Table's native `columnVisibility` API and add "Select All" / "Deselect All" bulk action buttons to improve UX. The current implementation uses manual array filtering (`columns.filter()`), which bypasses TanStack Table's built-in column visibility features. This task integrates the existing `tableSettingsStore.visibleColumns` state with TanStack Table's API for proper state synchronization and adds bulk toggle controls.

---

## 📋 Acceptance Criteria

- [ ] **TanStack Table Integration**: `useReactTable` uses `state.columnVisibility` and `onColumnVisibilityChange` instead of manual array filtering
- [ ] **Store Synchronization**: `tableSettingsStore.visibleColumns` maps correctly to TanStack Table's `columnVisibility` format (`{ [columnId]: boolean }`)
- [ ] **Bulk Actions**: "Alle auswählen" and "Alle abwählen" buttons in TableSettingsDropdown
- [ ] **API Compliance**: Uses `column.getToggleVisibilityHandler()` and `table.getToggleAllColumnsVisibilityHandler()` (TanStack Table API)
- [ ] **Persistence**: Column visibility state continues to persist to localStorage via Zustand middleware
- [ ] **Backward Compatibility**: Existing localStorage state (`visibleColumns: { thumbnail: true, ... }`) migrates seamlessly
- [ ] **Tests Passing**: All existing tests (9 TableSettingsDropdown tests) + 4 new tests for bulk actions
- [ ] **No Breaking Changes**: VideoGrid and VideosPage continue to work with updated column system

---

## 🛠️ Implementation Steps

### 1. Update tableSettingsStore with TanStack Table Compatible Actions

**Files:** `frontend/src/stores/tableSettingsStore.ts`
**Action:** Add helper actions for bulk column visibility operations and ensure state shape is compatible with TanStack Table API

**Current State Shape (compatible with TanStack Table):**
```typescript
// ✅ Already compatible - no migration needed
visibleColumns: {
  thumbnail: boolean,
  title: boolean,
  duration: boolean,
  actions: boolean
}
```

**Add New Actions:**
```typescript
interface TableSettingsStore {
  // ... existing state ...
  
  /** Show all columns (bulk action) */
  showAllColumns: () => void;
  
  /** Hide all columns (bulk action) */
  hideAllColumns: () => void;
  
  /** Set column visibility from TanStack Table state */
  setColumnVisibility: (visibility: Record<string, boolean>) => void;
}

// Implementation in create() function
export const useTableSettingsStore = create<TableSettingsStore>()(
  persist(
    (set) => ({
      // ... existing state ...
      
      // New actions
      showAllColumns: () =>
        set((state) => ({
          visibleColumns: {
            thumbnail: true,
            title: true,
            duration: true,
            actions: true,
          },
        })),
      
      hideAllColumns: () =>
        set((state) => ({
          visibleColumns: {
            thumbnail: true, // Keep at least one column visible (UX requirement)
            title: false,
            duration: false,
            actions: false,
          },
        })),
      
      setColumnVisibility: (visibility) =>
        set((state) => {
          // Map TanStack Table format to store format
          // Handle 'menu' column ID mapping to 'actions'
          const visibleColumns: VisibleColumns = {
            thumbnail: visibility.thumbnail ?? true,
            title: visibility.title ?? true,
            duration: visibility.duration ?? true,
            actions: visibility.menu ?? visibility.actions ?? true,
          };
          return { visibleColumns };
        }),
    }),
    {
      name: 'video-table-settings',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
```

**Why keep at least one column visible:**
- UX requirement: Empty table is confusing
- TanStack Table best practice: Always show at least one column
- Default to thumbnail (most essential for video browsing)

---

### 2. Integrate TanStack Table columnVisibility State in VideosPage

**Files:** `frontend/src/components/VideosPage.tsx`
**Action:** Replace manual column filtering with TanStack Table's native `columnVisibility` state

**Current Implementation (Lines 399-418):**
```typescript
// ❌ Manual filtering - bypasses TanStack Table API
const columns = useMemo(
  () => {
    const allColumns = [
      columnHelper.accessor('thumbnail_url', { id: 'thumbnail', ... }),
      columnHelper.accessor('title', { id: 'title', ... }),
      columnHelper.accessor('duration', { id: 'duration', ... }),
      columnHelper.accessor('menu', { id: 'menu', ... }), // actions column
    ]

    // Manual filtering
    return allColumns.filter((column) => {
      const columnId = column.id as 'thumbnail' | 'title' | 'duration' | 'menu'
      if (columnId === 'menu') return visibleColumns.actions
      return visibleColumns[columnId]
    })
  },
  [visibleColumns]
)

const table = useReactTable({
  data: videos,
  columns, // ❌ Already filtered columns
  getCoreRowModel: getCoreRowModel(),
})
```

**New Implementation:**
```typescript
// ✅ Let TanStack Table handle visibility
const columns = useMemo(
  () => [
    columnHelper.accessor('thumbnail_url', { 
      id: 'thumbnail', 
      header: 'Vorschau',
      enableHiding: false, // ✅ Always show thumbnail (primary visual element)
      cell: (info) => { ... }
    }),
    columnHelper.accessor('title', { 
      id: 'title', 
      header: 'Titel',
      cell: (info) => { ... }
    }),
    columnHelper.accessor('duration', { 
      id: 'duration', 
      header: 'Dauer',
      cell: (info) => { ... }
    }),
    columnHelper.accessor((row) => row, {
      id: 'menu', // ✅ Keep 'menu' as column ID
      header: 'Aktionen',
      cell: (info) => { ... }
    }),
  ],
  [] // ✅ No dependency on visibleColumns - TanStack Table handles it
)

// Map store state to TanStack Table format
const columnVisibility = useMemo(
  () => ({
    thumbnail: visibleColumns.thumbnail,
    title: visibleColumns.title,
    duration: visibleColumns.duration,
    menu: visibleColumns.actions, // Map 'actions' to 'menu' column ID
  }),
  [visibleColumns]
)

const table = useReactTable({
  data: videos,
  columns, // ✅ All columns (TanStack Table filters them)
  getCoreRowModel: getCoreRowModel(),
  state: {
    columnVisibility, // ✅ TanStack Table state
  },
  onColumnVisibilityChange: (updater) => {
    // Sync TanStack Table state back to Zustand store
    const newVisibility = typeof updater === 'function' 
      ? updater(columnVisibility) 
      : updater;
    
    setColumnVisibility(newVisibility); // Call new store action
  },
})
```

**Why enableHiding: false for thumbnail:**
- Thumbnail is primary visual element for video browsing
- Prevents confusing "all columns hidden" state
- Follows YouTube's pattern (thumbnail always visible)

---

### 3. Add Bulk Action Buttons to TableSettingsDropdown

**Files:** `frontend/src/components/TableSettingsDropdown.tsx`
**Action:** Add "Alle auswählen" / "Alle abwählen" buttons above checkbox list

**Location:** After `<DropdownMenuLabel>Sichtbare Spalten</DropdownMenuLabel>` (line 113)

**New Code:**
```typescript
import { Button } from '@/components/ui/button';

export const TableSettingsDropdown = () => {
  // ... existing selectors ...
  const visibleColumns = useTableSettingsStore((state) => state.visibleColumns);
  const toggleColumn = useTableSettingsStore((state) => state.toggleColumn);
  const showAllColumns = useTableSettingsStore((state) => state.showAllColumns);
  const hideAllColumns = useTableSettingsStore((state) => state.hideAllColumns);

  return (
    <DropdownMenu>
      {/* ... existing thumbnail size / grid columns sections ... */}

      {/* Column Visibility Section */}
      <DropdownMenuLabel>Sichtbare Spalten</DropdownMenuLabel>

      {/* NEW: Bulk Action Buttons */}
      <div className="flex gap-2 px-2 pb-2">
        <Button
          variant="outline"
          size="sm"
          onClick={showAllColumns}
          className="flex-1 h-8 text-xs"
          aria-label="Alle Spalten anzeigen"
        >
          Alle auswählen
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={hideAllColumns}
          className="flex-1 h-8 text-xs"
          aria-label="Alle Spalten außer Thumbnail ausblenden"
        >
          Alle abwählen
        </Button>
      </div>

      {/* Existing checkboxes */}
      <DropdownMenuCheckboxItem
        checked={visibleColumns.thumbnail}
        onCheckedChange={() => toggleColumn('thumbnail')}
        disabled // ✅ Thumbnail always visible (enableHiding: false)
      >
        Thumbnail
      </DropdownMenuCheckboxItem>
      
      {/* ... rest of checkboxes unchanged ... */}
    </DropdownMenu>
  );
};
```

**Why disable thumbnail checkbox:**
- Consistent with `enableHiding: false` in column definition
- Visual indication that thumbnail is required
- Prevents user confusion

---

### 4. Update Store Import in VideosPage

**Files:** `frontend/src/components/VideosPage.tsx`
**Action:** Import new store actions

```typescript
// Line ~25 - Update import
const visibleColumns = useTableSettingsStore((state) => state.visibleColumns);
const setColumnVisibility = useTableSettingsStore((state) => state.setColumnVisibility); // NEW
```

---

### 5. Verify Table Rendering Uses Visible Columns

**Files:** `frontend/src/components/VideosPage.tsx`
**Action:** Ensure table header/body rendering uses TanStack Table's visibility-aware APIs

**Current Code (should already be correct):**
```typescript
{/* Header */}
{table.getHeaderGroups().map((headerGroup) => (
  <tr key={headerGroup.id}>
    {headerGroup.headers.map((header) => ( // ✅ Already visibility-aware
      <th key={header.id}>
        {flexRender(header.column.columnDef.header, header.getContext())}
      </th>
    ))}
  </tr>
))}

{/* Body */}
{table.getRowModel().rows.map((row) => (
  <tr key={row.id}>
    {row.getVisibleCells().map((cell) => ( // ✅ Already visibility-aware
      <td key={cell.id}>
        {flexRender(cell.column.columnDef.cell, cell.getContext())}
      </td>
    ))}
  </tr>
))}
```

**Verification:** Confirm `row.getVisibleCells()` is used (NOT `row.getAllCells()`)

---

### 6. Add Unit Tests for Store Actions

**Files:** `frontend/src/stores/tableSettingsStore.test.ts` (NEW)
**Action:** Create test file for new bulk actions

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useTableSettingsStore } from './tableSettingsStore';
import { act, renderHook } from '@testing-library/react';

describe('tableSettingsStore - Column Visibility', () => {
  beforeEach(() => {
    // Reset store to default state
    const { result } = renderHook(() => useTableSettingsStore());
    act(() => {
      result.current.showAllColumns();
    });
  });

  it('showAllColumns sets all columns to visible', () => {
    const { result } = renderHook(() => useTableSettingsStore());
    
    // Hide some columns first
    act(() => {
      result.current.toggleColumn('title');
      result.current.toggleColumn('duration');
    });
    
    expect(result.current.visibleColumns.title).toBe(false);
    expect(result.current.visibleColumns.duration).toBe(false);
    
    // Show all
    act(() => {
      result.current.showAllColumns();
    });
    
    expect(result.current.visibleColumns).toEqual({
      thumbnail: true,
      title: true,
      duration: true,
      actions: true,
    });
  });

  it('hideAllColumns hides all except thumbnail', () => {
    const { result } = renderHook(() => useTableSettingsStore());
    
    act(() => {
      result.current.hideAllColumns();
    });
    
    expect(result.current.visibleColumns).toEqual({
      thumbnail: true, // Always visible
      title: false,
      duration: false,
      actions: false,
    });
  });

  it('setColumnVisibility updates state from TanStack Table format', () => {
    const { result } = renderHook(() => useTableSettingsStore());
    
    act(() => {
      result.current.setColumnVisibility({
        thumbnail: true,
        title: false,
        duration: true,
        menu: false, // 'menu' maps to 'actions'
      });
    });
    
    expect(result.current.visibleColumns).toEqual({
      thumbnail: true,
      title: false,
      duration: true,
      actions: false, // 'menu' was mapped to 'actions'
    });
  });

  it('setColumnVisibility handles missing column IDs with defaults', () => {
    const { result } = renderHook(() => useTableSettingsStore());
    
    act(() => {
      result.current.setColumnVisibility({
        title: false,
        // Missing: thumbnail, duration, menu
      });
    });
    
    expect(result.current.visibleColumns).toEqual({
      thumbnail: true, // Default
      title: false,
      duration: true, // Default
      actions: true, // Default
    });
  });
});
```

---

### 7. Add Integration Tests for TableSettingsDropdown Bulk Actions

**Files:** `frontend/src/components/TableSettingsDropdown.test.tsx`
**Action:** Add tests for "Alle auswählen" / "Alle abwählen" buttons

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TableSettingsDropdown } from './TableSettingsDropdown';
import { useTableSettingsStore } from '@/stores/tableSettingsStore';

vi.mock('@/stores/tableSettingsStore');

describe('TableSettingsDropdown - Bulk Actions', () => {
  const mockShowAllColumns = vi.fn();
  const mockHideAllColumns = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useTableSettingsStore).mockImplementation((selector) =>
      selector({
        viewMode: 'list',
        thumbnailSize: 'small',
        setThumbnailSize: vi.fn(),
        gridColumns: 3,
        setGridColumns: vi.fn(),
        visibleColumns: {
          thumbnail: true,
          title: true,
          duration: false,
          actions: true,
        },
        toggleColumn: vi.fn(),
        showAllColumns: mockShowAllColumns,
        hideAllColumns: mockHideAllColumns,
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders bulk action buttons', async () => {
    const user = userEvent.setup();
    render(<TableSettingsDropdown />);

    // Open dropdown
    const trigger = screen.getByRole('button', { name: /einstellungen/i });
    await user.click(trigger);

    // Verify buttons exist
    expect(screen.getByRole('button', { name: /alle auswählen/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /alle abwählen/i })).toBeInTheDocument();
  });

  it('clicking "Alle auswählen" calls showAllColumns', async () => {
    const user = userEvent.setup();
    render(<TableSettingsDropdown />);

    // Open dropdown
    const trigger = screen.getByRole('button', { name: /einstellungen/i });
    await user.click(trigger);

    // Click "Alle auswählen"
    const showAllBtn = screen.getByRole('button', { name: /alle auswählen/i });
    await user.click(showAllBtn);

    expect(mockShowAllColumns).toHaveBeenCalledTimes(1);
  });

  it('clicking "Alle abwählen" calls hideAllColumns', async () => {
    const user = userEvent.setup();
    render(<TableSettingsDropdown />);

    // Open dropdown
    const trigger = screen.getByRole('button', { name: /einstellungen/i });
    await user.click(trigger);

    // Click "Alle abwählen"
    const hideAllBtn = screen.getByRole('button', { name: /alle abwählen/i });
    await user.click(hideAllBtn);

    expect(mockHideAllColumns).toHaveBeenCalledTimes(1);
  });

  it('thumbnail checkbox is disabled', async () => {
    const user = userEvent.setup();
    render(<TableSettingsDropdown />);

    // Open dropdown
    const trigger = screen.getByRole('button', { name: /einstellungen/i });
    await user.click(trigger);

    // Find thumbnail checkbox by label text
    const thumbnailCheckbox = screen.getByRole('menuitemcheckbox', { name: /thumbnail/i });
    expect(thumbnailCheckbox).toHaveAttribute('data-disabled', 'true');
  });
});
```

---

### 8. Add Integration Test for VideosPage Column Visibility

**Files:** `frontend/src/components/VideosPage.test.tsx` (or new integration test file)
**Action:** Verify TanStack Table integration works end-to-end

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VideosPage } from './VideosPage';
import { useTableSettingsStore } from '@/stores/tableSettingsStore';

vi.mock('@/hooks/useVideos');
vi.mock('@/hooks/useTags');
vi.mock('@/stores/tableSettingsStore');

describe('VideosPage - Column Visibility Integration', () => {
  it('hides columns based on visibleColumns state', () => {
    // Mock store with title hidden
    vi.mocked(useTableSettingsStore).mockImplementation((selector) =>
      selector({
        visibleColumns: {
          thumbnail: true,
          title: false, // HIDDEN
          duration: true,
          actions: true,
        },
        viewMode: 'list',
        // ... other required state
      })
    );

    render(<VideosPage listId="test-list-id" />);

    // Verify 'Titel' header is NOT in the document
    expect(screen.queryByText('Titel')).not.toBeInTheDocument();
    
    // Verify other headers ARE in the document
    expect(screen.getByText('Vorschau')).toBeInTheDocument();
    expect(screen.getByText('Dauer')).toBeInTheDocument();
    expect(screen.getByText('Aktionen')).toBeInTheDocument();
  });

  it('thumbnail column is always visible (enableHiding: false)', () => {
    // Mock store with thumbnail "hidden" (should be ignored)
    vi.mocked(useTableSettingsStore).mockImplementation((selector) =>
      selector({
        visibleColumns: {
          thumbnail: false, // Attempt to hide (should be ignored)
          title: true,
          duration: true,
          actions: true,
        },
        viewMode: 'list',
        // ... other required state
      })
    );

    render(<VideosPage listId="test-list-id" />);

    // Thumbnail should still be visible due to enableHiding: false
    expect(screen.getByText('Vorschau')).toBeInTheDocument();
  });
});
```

---

## 🧪 Testing Strategy

**Unit Tests (4 new tests):**
- `tableSettingsStore.test.ts`:
  - `showAllColumns` sets all columns to visible
  - `hideAllColumns` hides all except thumbnail
  - `setColumnVisibility` maps TanStack Table format correctly
  - `setColumnVisibility` handles missing column IDs with defaults

**Integration Tests (4 new tests):**
- `TableSettingsDropdown.test.tsx` (add to existing file):
  - Bulk action buttons render correctly
  - "Alle auswählen" button calls `showAllColumns`
  - "Alle abwählen" button calls `hideAllColumns`
  - Thumbnail checkbox is disabled
- `VideosPage.test.tsx`:
  - Columns hide based on `visibleColumns` state
  - Thumbnail column ignores `enableHiding: false`

**Manual Testing Checklist:**
1. **Initial State**: Open VideosPage → All columns visible (thumbnail, title, duration, actions)
2. **Toggle Individual Column**: Settings → Uncheck "Dauer" → Duration column disappears
3. **Persistence**: Reload page → Duration column still hidden (localStorage works)
4. **Bulk Show All**: Settings → Click "Alle auswählen" → All columns appear (including previously hidden duration)
5. **Bulk Hide All**: Settings → Click "Alle abwählen" → Only thumbnail visible, others hidden
6. **Thumbnail Always Visible**: Verify thumbnail checkbox is disabled (greyed out)
7. **Grid Mode**: Switch to Grid view → Column visibility settings persist (but only affect list view)
8. **Edge Case - All Hidden**: Manually set all columns to false in localStorage → Thumbnail should still appear (safeguard)

---

## 📚 Reference

**REF MCP Findings:**

1. **TanStack Table v8 Column Visibility API** (GitHub: tanstack/table)
   - Source: `docs/guide/column-visibility.md`
   - Evidence: "The column visibility feature allows table columns to be hidden or shown dynamically. In v8, there is a dedicated `columnVisibility` state and APIs for managing column visibility."
   - Key API: `state.columnVisibility` (map of column IDs to boolean), `onColumnVisibilityChange` callback
   - Pattern: `column.getToggleVisibilityHandler()` for checkbox binding
   - Validation: "Use `row.getVisibleCells()` not `row.getAllCells()` to respect visibility"

2. **TanStack Table Bulk Toggle API** (GitHub: tanstack/table)
   - Source: `docs/api/features/column-visibility.md#gettoggleallcolumnsvisibilityhandler`
   - Evidence: `table.getToggleAllColumnsVisibilityHandler()` - "Returns a handler for toggling the visibility of all columns, meant to be bound to a `input[type=checkbox]` element."
   - Note: This API is available but NOT used in this implementation (custom bulk actions preferred for UX control)

3. **Disable Column Hiding** (GitHub: tanstack/table)
   - Source: `docs/guide/column-visibility.md#disable-hiding-columns`
   - Evidence: "If you want to prevent certain columns from being hidden, you set the `enableHiding` column option to `false` for those columns."
   - Application: Thumbnail column should have `enableHiding: false`

4. **localStorage Persistence Best Practices** (Mantine React Table Docs)
   - Source: `docs/guides/state-management#persistent-state`
   - Evidence: "Store table state in localStorage to persist across page reloads"
   - Pattern: Zustand persist middleware already handles this correctly
   - Validation: No changes needed - existing implementation is correct

5. **Select All/Deselect All UX Pattern** (Common UI Pattern)
   - Source: Multiple UI libraries (Material-UI, Ant Design, shadcn/ui examples)
   - Evidence: Bulk action buttons commonly placed ABOVE checkbox list for discoverability
   - Pattern: Two separate buttons (not toggle) - clearer intent
   - Validation: User expectation from Gmail, file managers, etc.

**Related Code:**
- Existing implementation: `frontend/src/components/VideosPage.tsx` (lines 399-418) - manual filtering
- Store pattern: `frontend/src/stores/tableSettingsStore.ts` - Zustand persist middleware
- Similar bulk action: None in codebase (first implementation)

**Design Decisions:**

1. **Decision: Use TanStack Table's `columnVisibility` API instead of manual filtering**
   - **Alternative**: Keep manual array filtering with `columns.filter()`
   - **Rationale**: 
     - TanStack Table's API provides better state management
     - Enables future features (column reordering, resize)
     - More maintainable - follows library patterns
     - Better TypeScript support with column API methods
   - **Trade-offs**: 
     - Requires migration (small one-time cost)
     - More complex state mapping (Zustand ↔ TanStack Table)
   - **Validation**: TanStack Table docs recommend using dedicated API over manual filtering

2. **Decision: Keep at least one column visible (thumbnail)**
   - **Alternative**: Allow all columns to be hidden
   - **Rationale**:
     - Empty table is confusing UX
     - Thumbnail is primary visual element for video browsing
     - Follows YouTube's pattern (thumbnail always present)
   - **Trade-offs**: Less flexibility, but better UX
   - **Validation**: TanStack Table best practices, YouTube UI patterns

3. **Decision: Two separate buttons (Show All / Hide All) instead of single toggle**
   - **Alternative**: Single "Toggle All" button
   - **Rationale**:
     - Clearer intent (user knows exactly what will happen)
     - Follows Gmail/file manager patterns
     - Better for accessibility (screen readers)
   - **Trade-offs**: More UI elements, but clearer UX
   - **Validation**: Common pattern in enterprise UIs

4. **Decision: Disable thumbnail checkbox instead of hiding it**
   - **Alternative**: Hide thumbnail checkbox completely
   - **Rationale**:
     - Transparency - user sees all columns including locked ones
     - Visual indication via disabled state
     - Consistent with form field patterns
   - **Trade-offs**: Adds visual noise, but improves understanding
   - **Validation**: Radix UI accessibility patterns

5. **Decision: Map 'menu' column ID to 'actions' in store**
   - **Alternative**: Rename column ID from 'menu' to 'actions'
   - **Rationale**:
     - Backward compatibility with existing localStorage data
     - 'menu' is accurate (it's a dropdown menu)
     - Store abstraction layer handles mapping
   - **Trade-offs**: Extra mapping code, but preserves user settings
   - **Validation**: Backward compatibility requirement

---

## ⏱️ Time Estimate

**Total: 3-4 hours**

- Step 1 (Store Actions): 30 min
- Step 2 (TanStack Table Integration): 1 hour (critical - requires careful state mapping)
- Step 3 (Bulk Action Buttons): 30 min
- Step 4-5 (Minor updates): 15 min
- Step 6-8 (Tests): 1.5 hours (4 unit tests + 4 integration tests)
- Manual testing & verification: 30 min

**Complexity:** Medium
- Requires understanding TanStack Table API
- State synchronization between Zustand and TanStack Table
- Careful handling of column ID mapping ('menu' ↔ 'actions')
- Backward compatibility with existing localStorage

**Risk Areas:**
- State sync bugs (Zustand ↔ TanStack Table)
- Column ID mapping errors
- Breaking existing tests (9 TableSettingsDropdown tests)
- localStorage migration issues

---

## 📝 Implementation Notes

### Current State (Task #25-26)

**What Works:**
- ✅ `tableSettingsStore` has `visibleColumns` state with localStorage persistence
- ✅ `TableSettingsDropdown` has 4 checkboxes for column toggles
- ✅ `VideosPage` respects `visibleColumns` via manual array filtering
- ✅ 9 tests passing for TableSettingsDropdown

**What's Missing:**
- ❌ Not using TanStack Table's `columnVisibility` API (manual filtering instead)
- ❌ No bulk "Select All" / "Deselect All" actions
- ❌ No `enableHiding: false` for thumbnail column
- ❌ Manual state sync between store and table (fragile)

### Migration Path

**Phase 1: Add Store Actions (Non-breaking)**
- Add `showAllColumns`, `hideAllColumns`, `setColumnVisibility` to store
- Existing code continues to use `toggleColumn`
- No localStorage migration needed (state shape unchanged)

**Phase 2: Migrate VideosPage (Breaking change - needs tests)**
- Replace manual filtering with TanStack Table API
- Add `state.columnVisibility` and `onColumnVisibilityChange`
- Add `enableHiding: false` to thumbnail column
- Update tests to verify TanStack Table integration

**Phase 3: Add Bulk Actions (UI enhancement)**
- Add buttons to TableSettingsDropdown
- Update tests for new buttons
- Manual testing for UX verification

### Testing Strategy Rationale

**Why 8 new tests:**
- 4 store tests: Verify bulk actions work correctly at state level
- 4 integration tests: Verify UI correctly calls store actions and TanStack Table respects state
- Coverage: Unit (store logic) + Integration (component + table rendering)

**Why manual testing checklist:**
- Visual verification needed (column disappearance)
- Persistence verification (localStorage)
- Edge case validation (all columns hidden)

---

## 🔗 Related Tasks

**Dependencies:**
- Task #25: tableSettingsStore implementation (COMPLETED)
- Task #26: TableSettingsDropdown component (COMPLETED)

**Follow-up Tasks:**
- Task #46: Column reordering (future - uses TanStack Table API)
- Task #47: Column resizing (future - uses TanStack Table API)

**Blocked By:** None (all dependencies completed)

---

## ✅ Definition of Done

- [ ] All implementation steps completed (1-8)
- [ ] 8 new tests written and passing
- [ ] Existing 9 TableSettingsDropdown tests still passing
- [ ] Manual testing checklist completed (8 scenarios)
- [ ] No console errors or warnings
- [ ] TypeScript compilation successful (0 errors)
- [ ] Code reviewed (self-review + optional peer review)
- [ ] Documentation updated (this plan + inline comments)
- [ ] Committed to feature branch with descriptive message

---

**Plan Created:** 2025-11-08
**Status:** READY FOR IMPLEMENTATION
