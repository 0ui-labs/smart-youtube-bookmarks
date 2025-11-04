# Grid Column Control Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add independent grid view column configuration (2, 3, 4, 5 columns) separate from list view thumbnail size settings.

**Architecture:** Extend existing `tableSettingsStore` with `gridColumns` field, create `GridColumnControl` component similar to `ViewModeToggle`, update `VideoGrid` to use column count from store with responsive Tailwind classes.

**Tech Stack:** React, TypeScript, Zustand, Vitest, Tailwind CSS, @testing-library/react

---

## Task 1: Extend tableSettingsStore with gridColumns

**Files:**
- Modify: `frontend/src/stores/tableSettingsStore.ts`
- Test: `frontend/src/stores/tableSettingsStore.test.ts`

**Step 1: Write failing test for gridColumns default value**

Add to `frontend/src/stores/tableSettingsStore.test.ts` after existing tests:

```typescript
describe('gridColumns', () => {
  it('should have default gridColumns value of 3', () => {
    const { gridColumns } = useTableSettingsStore.getState()
    expect(gridColumns).toBe(3)
  })
})
```

**Step 2: Run test to verify it fails**

```bash
cd frontend && npm test -- tableSettingsStore.test.ts
```

Expected: FAIL - "Property 'gridColumns' does not exist"

**Step 3: Add gridColumns type and state to tableSettingsStore**

In `frontend/src/stores/tableSettingsStore.ts`, add after line 31:

```typescript
/**
 * Grid column count options for grid view layout
 * - 2: Wide cards, fewer columns
 * - 3: Balanced layout (default)
 * - 4: Compact layout, more content visible
 * - 5: Maximum density
 *
 * Responsive behavior:
 * - Mobile: Always 1 column
 * - Tablet: 2-3 columns max
 * - Desktop: User's full choice (2-5)
 */
export type GridColumnCount = 2 | 3 | 4 | 5;
```

Update `TableSettingsStore` interface (around line 66):

```typescript
interface TableSettingsStore {
  /** Current thumbnail size setting */
  thumbnailSize: ThumbnailSize;

  /** Column visibility configuration */
  visibleColumns: VisibleColumns;

  /** Current view mode (Task #32) */
  viewMode: ViewMode;

  /** Grid column count (grid view only) */
  gridColumns: GridColumnCount;

  /** Update thumbnail size */
  setThumbnailSize: (size: ThumbnailSize) => void;

  /** Toggle visibility of a specific column */
  toggleColumn: (column: keyof VisibleColumns) => void;

  /** Update view mode (Task #32) */
  setViewMode: (mode: ViewMode) => void;

  /** Update grid column count */
  setGridColumns: (count: GridColumnCount) => void;
}
```

Update store implementation (around line 137):

```typescript
export const useTableSettingsStore = create<TableSettingsStore>()(
  persist(
    (set) => ({
      // State
      thumbnailSize: 'small',
      visibleColumns: DEFAULT_VISIBLE_COLUMNS,
      viewMode: 'list',
      gridColumns: 3, // NEW: Default to 3 columns

      // Actions
      setThumbnailSize: (size) => set({ thumbnailSize: size }),

      toggleColumn: (column) =>
        set((state) => ({
          visibleColumns: {
            ...state.visibleColumns,
            [column]: !state.visibleColumns[column],
          },
        })),

      setViewMode: (mode) => set({ viewMode: mode }),

      setGridColumns: (count) => set({ gridColumns: count }), // NEW
    }),
    {
      name: 'video-table-settings',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
```

**Step 4: Run test to verify it passes**

```bash
cd frontend && npm test -- tableSettingsStore.test.ts
```

Expected: PASS

**Step 5: Write test for setGridColumns action**

Add to test file:

```typescript
it('should update gridColumns when setGridColumns is called', () => {
  const { setGridColumns } = useTableSettingsStore.getState()

  setGridColumns(5)
  expect(useTableSettingsStore.getState().gridColumns).toBe(5)

  setGridColumns(2)
  expect(useTableSettingsStore.getState().gridColumns).toBe(2)
})
```

**Step 6: Run test to verify it passes**

```bash
cd frontend && npm test -- tableSettingsStore.test.ts
```

Expected: PASS

**Step 7: Write test for localStorage persistence**

Add to test file:

```typescript
it('should persist gridColumns to localStorage', () => {
  const { setGridColumns } = useTableSettingsStore.getState()

  setGridColumns(4)

  // Simulate page reload by creating new store instance
  const storedData = localStorage.getItem('video-table-settings')
  expect(storedData).toBeTruthy()

  const parsed = JSON.parse(storedData!)
  expect(parsed.state.gridColumns).toBe(4)
})
```

**Step 8: Run test to verify it passes**

```bash
cd frontend && npm test -- tableSettingsStore.test.ts
```

Expected: PASS

**Step 9: Commit**

```bash
git add frontend/src/stores/tableSettingsStore.ts frontend/src/stores/tableSettingsStore.test.ts
git commit -m "feat(store): add gridColumns to tableSettingsStore

Add gridColumns state (2, 3, 4, 5) for independent grid view
configuration. Separate from thumbnailSize to prevent settings
bleeding between list and grid views.

- Add GridColumnCount type
- Add gridColumns state with default value 3
- Add setGridColumns action
- Add tests for default value, action, and persistence"
```

---

## Task 2: Create GridColumnControl component

**Files:**
- Create: `frontend/src/components/GridColumnControl.tsx`
- Create: `frontend/src/components/GridColumnControl.test.tsx`

**Step 1: Write failing test for GridColumnControl rendering**

Create `frontend/src/components/GridColumnControl.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GridColumnControl } from './GridColumnControl'

describe('GridColumnControl', () => {
  it('renders 4 column count buttons', () => {
    const mockOnChange = vi.fn()
    render(<GridColumnControl columnCount={3} onColumnCountChange={mockOnChange} />)

    expect(screen.getByRole('button', { name: '2 Spalten' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '3 Spalten' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '4 Spalten' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '5 Spalten' })).toBeInTheDocument()
  })

  it('highlights the active column count', () => {
    const mockOnChange = vi.fn()
    render(<GridColumnControl columnCount={3} onColumnCountChange={mockOnChange} />)

    const button3 = screen.getByRole('button', { name: '3 Spalten' })
    expect(button3).toHaveClass('bg-blue-600', 'text-white')
  })

  it('calls onColumnCountChange when button is clicked', async () => {
    const user = userEvent.setup()
    const mockOnChange = vi.fn()
    render(<GridColumnControl columnCount={3} onColumnCountChange={mockOnChange} />)

    const button5 = screen.getByRole('button', { name: '5 Spalten' })
    await user.click(button5)

    expect(mockOnChange).toHaveBeenCalledWith(5)
  })

  it('does not call onColumnCountChange when active button is clicked', async () => {
    const user = userEvent.setup()
    const mockOnChange = vi.fn()
    render(<GridColumnControl columnCount={3} onColumnCountChange={mockOnChange} />)

    const button3 = screen.getByRole('button', { name: '3 Spalten' })
    await user.click(button3)

    expect(mockOnChange).not.toHaveBeenCalled()
  })
})
```

**Step 2: Run test to verify it fails**

```bash
cd frontend && npm test -- GridColumnControl.test.tsx
```

Expected: FAIL - "Cannot find module './GridColumnControl'"

**Step 3: Create GridColumnControl component**

Create `frontend/src/components/GridColumnControl.tsx`:

```typescript
import type { GridColumnCount } from '@/stores/tableSettingsStore'

interface GridColumnControlProps {
  columnCount: GridColumnCount
  onColumnCountChange: (count: GridColumnCount) => void
}

/**
 * GridColumnControl - Button group for selecting grid column count
 *
 * Allows users to choose between 2, 3, 4, or 5 columns in grid view.
 * Similar design to ViewModeToggle component.
 */
export const GridColumnControl = ({
  columnCount,
  onColumnCountChange,
}: GridColumnControlProps) => {
  const options: GridColumnCount[] = [2, 3, 4, 5]

  return (
    <div className="inline-flex rounded-lg border border-gray-300 bg-white" role="group">
      {options.map((count) => {
        const isActive = columnCount === count

        return (
          <button
            key={count}
            onClick={() => {
              if (!isActive) {
                onColumnCountChange(count)
              }
            }}
            className={`
              px-4 py-2 text-sm font-medium transition-colors
              first:rounded-l-lg last:rounded-r-lg
              ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }
            `}
            aria-label={`${count} Spalten`}
            aria-pressed={isActive}
          >
            {count}
          </button>
        )
      })}
    </div>
  )
}
```

**Step 4: Run test to verify it passes**

```bash
cd frontend && npm test -- GridColumnControl.test.tsx
```

Expected: PASS

**Step 5: Add keyboard navigation test**

Add to test file:

```typescript
it('supports keyboard navigation', async () => {
  const user = userEvent.setup()
  const mockOnChange = vi.fn()
  render(<GridColumnControl columnCount={3} onColumnCountChange={mockOnChange} />)

  const button2 = screen.getByRole('button', { name: '2 Spalten' })
  button2.focus()
  await user.keyboard('{Enter}')

  expect(mockOnChange).toHaveBeenCalledWith(2)
})
```

**Step 6: Run test to verify it passes**

```bash
cd frontend && npm test -- GridColumnControl.test.tsx
```

Expected: PASS

**Step 7: Commit**

```bash
git add frontend/src/components/GridColumnControl.tsx frontend/src/components/GridColumnControl.test.tsx
git commit -m "feat(ui): add GridColumnControl component

Create button group component for selecting grid column count (2-5).
Similar design to ViewModeToggle with active state highlighting.

- 4 buttons for 2, 3, 4, 5 columns
- Active state with blue background
- Keyboard navigation support
- Full test coverage"
```

---

## Task 3: Update VideoGrid to use gridColumns prop

**Files:**
- Modify: `frontend/src/components/VideoGrid.tsx`
- Modify: `frontend/src/components/VideoGrid.test.tsx`

**Step 1: Write failing test for gridColumns prop**

Add to `frontend/src/components/VideoGrid.test.tsx`:

```typescript
import type { GridColumnCount } from '@/stores/tableSettingsStore'

// Add to existing tests
describe('grid column configuration', () => {
  it('applies correct grid classes for 2 columns', () => {
    const { container } = render(
      <VideoGrid
        videos={mockVideos}
        gridColumns={2}
        onVideoClick={mockOnVideoClick}
        onDelete={mockOnDelete}
      />
    )

    const grid = container.querySelector('.video-grid')
    expect(grid).toHaveClass('grid-cols-1', 'md:grid-cols-2')
  })

  it('applies correct grid classes for 3 columns', () => {
    const { container } = render(
      <VideoGrid
        videos={mockVideos}
        gridColumns={3}
        onVideoClick={mockOnVideoClick}
        onDelete={mockOnDelete}
      />
    )

    const grid = container.querySelector('.video-grid')
    expect(grid).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3')
  })

  it('applies correct grid classes for 4 columns', () => {
    const { container } = render(
      <VideoGrid
        videos={mockVideos}
        gridColumns={4}
        onVideoClick={mockOnVideoClick}
        onDelete={mockOnDelete}
      />
    )

    const grid = container.querySelector('.video-grid')
    expect(grid).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-4')
  })

  it('applies correct grid classes for 5 columns', () => {
    const { container } = render(
      <VideoGrid
        videos={mockVideos}
        gridColumns={5}
        onVideoClick={mockOnVideoClick}
        onDelete={mockOnDelete}
      />
    )

    const grid = container.querySelector('.video-grid')
    expect(grid).toHaveClass('grid-cols-1', 'md:grid-cols-3', 'lg:grid-cols-5')
  })
})
```

**Step 2: Run test to verify it fails**

```bash
cd frontend && npm test -- VideoGrid.test.tsx
```

Expected: FAIL - "Property 'gridColumns' does not exist on type 'VideoGridProps'"

**Step 3: Update VideoGrid interface and implementation**

In `frontend/src/components/VideoGrid.tsx`, update the interface (line 5):

```typescript
import type { GridColumnCount } from '@/stores/tableSettingsStore'

interface VideoGridProps {
  videos: VideoResponse[]
  gridColumns: GridColumnCount  // NEW
  onVideoClick: (video: VideoResponse) => void
  onDelete: (videoId: string) => void
}
```

Update the component implementation (line 28):

```typescript
export const VideoGrid = ({ videos, gridColumns, onVideoClick, onDelete }: VideoGridProps) => {
  // Tailwind grid classes based on column count
  // Mobile: always 1 column
  // Tablet: 2-3 columns max
  // Desktop: user's full choice (2-5)
  const gridColumnClasses = {
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-1 md:grid-cols-3 lg:grid-cols-5',
  } as const

  if (videos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <LayoutGrid className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Keine Videos im Grid</h3>
        <p className="text-muted-foreground max-w-sm">
          Füge Videos hinzu oder ändere deine Filter, um Inhalte in der Grid-Ansicht zu sehen.
        </p>
      </div>
    )
  }

  return (
    <div
      className={`video-grid grid ${gridColumnClasses[gridColumns]} gap-4 md:gap-6`}
      role="list"
      aria-label="Video Grid"
    >
      {videos.map((video) => (
        <VideoCard
          key={video.id}
          video={video}
          onClick={onVideoClick}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}
```

**Step 4: Run test to verify it passes**

```bash
cd frontend && npm test -- VideoGrid.test.tsx
```

Expected: PASS

**Step 5: Fix existing tests that don't pass gridColumns prop**

In `frontend/src/components/VideoGrid.test.tsx`, add `gridColumns={3}` to all existing test renders.

Example:

```typescript
// Before
render(
  <VideoGrid
    videos={mockVideos}
    onVideoClick={mockOnVideoClick}
    onDelete={mockOnDelete}
  />
)

// After
render(
  <VideoGrid
    videos={mockVideos}
    gridColumns={3}
    onVideoClick={mockOnVideoClick}
    onDelete={mockOnDelete}
  />
)
```

**Step 6: Run test to verify all pass**

```bash
cd frontend && npm test -- VideoGrid.test.tsx
```

Expected: ALL PASS

**Step 7: Commit**

```bash
git add frontend/src/components/VideoGrid.tsx frontend/src/components/VideoGrid.test.tsx
git commit -m "feat(grid): add gridColumns prop to VideoGrid

Update VideoGrid to accept gridColumns prop and apply responsive
Tailwind classes based on user's column count selection.

Responsive behavior:
- 2 cols: mobile 1, desktop 2
- 3 cols: mobile 1, tablet 2, desktop 3
- 4 cols: mobile 1, tablet 2, desktop 4
- 5 cols: mobile 1, tablet 3, desktop 5

PurgeCSS-safe: all classes explicitly written."
```

---

## Task 4: Integrate GridColumnControl into VideosPage

**Files:**
- Modify: `frontend/src/components/VideosPage.tsx`
- Modify: `frontend/src/components/VideosPage.integration.test.tsx`

**Step 1: Write failing integration test**

Add to `frontend/src/components/VideosPage.integration.test.tsx`:

```typescript
describe('GridColumnControl integration', () => {
  it('shows GridColumnControl only when in grid view', async () => {
    const user = userEvent.setup()
    render(<VideosPage listId="test-list-id" />)

    // Should not show in list view (default)
    expect(screen.queryByRole('button', { name: '2 Spalten' })).not.toBeInTheDocument()

    // Switch to grid view
    const gridButton = screen.getByRole('button', { name: /grid/i })
    await user.click(gridButton)

    // Should now show GridColumnControl
    expect(screen.getByRole('button', { name: '2 Spalten' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '3 Spalten' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '4 Spalten' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '5 Spalten' })).toBeInTheDocument()
  })

  it('updates VideoGrid when column count changes', async () => {
    const user = userEvent.setup()
    render(<VideosPage listId="test-list-id" />)

    // Switch to grid view
    const gridButton = screen.getByRole('button', { name: /grid/i })
    await user.click(gridButton)

    // Change to 5 columns
    const button5 = screen.getByRole('button', { name: '5 Spalten' })
    await user.click(button5)

    // Verify grid has correct classes
    const grid = document.querySelector('.video-grid')
    expect(grid).toHaveClass('lg:grid-cols-5')
  })

  it('preserves column count when switching between views', async () => {
    const user = userEvent.setup()
    render(<VideosPage listId="test-list-id" />)

    // Switch to grid view
    const gridButton = screen.getByRole('button', { name: /grid/i })
    await user.click(gridButton)

    // Change to 4 columns
    const button4 = screen.getByRole('button', { name: '4 Spalten' })
    await user.click(button4)

    // Switch to list view
    const listButton = screen.getByRole('button', { name: /list/i })
    await user.click(listButton)

    // Switch back to grid view
    await user.click(gridButton)

    // Should still be 4 columns
    const button4Again = screen.getByRole('button', { name: '4 Spalten' })
    expect(button4Again).toHaveAttribute('aria-pressed', 'true')
  })
})
```

**Step 2: Run test to verify it fails**

```bash
cd frontend && npm test -- VideosPage.integration.test.tsx
```

Expected: FAIL - GridColumnControl not rendered

**Step 3: Import GridColumnControl and update VideosPage**

In `frontend/src/components/VideosPage.tsx`, add import (around line 22):

```typescript
import { GridColumnControl } from './GridColumnControl'
```

Update store hook to include gridColumns (around line 212):

```typescript
const { viewMode, setViewMode, gridColumns, setGridColumns } = useTableSettingsStore(
  useShallow((state) => ({
    viewMode: state.viewMode,
    setViewMode: state.setViewMode,
    gridColumns: state.gridColumns,
    setGridColumns: state.setGridColumns,
  }))
)
```

Add GridColumnControl to action buttons (around line 533):

```typescript
{/* View Mode Toggle - Task #32 */}
<ViewModeToggle viewMode={viewMode} onToggle={setViewMode} />

{/* Grid Column Control - Only show in grid view */}
{viewMode === 'grid' && (
  <GridColumnControl
    columnCount={gridColumns}
    onColumnCountChange={setGridColumns}
  />
)}
```

Update VideoGrid component call (around line 664):

```typescript
<VideoGrid
  videos={videos}
  gridColumns={gridColumns}
  onVideoClick={handleVideoClick}
  onDelete={(videoId) => {
    const video = videos.find((v) => v.id === videoId)
    if (video) {
      setDeleteModal({
        open: true,
        videoId: video.id,
        videoTitle: video.title,
      })
    }
  }}
/>
```

**Step 4: Run test to verify it passes**

```bash
cd frontend && npm test -- VideosPage.integration.test.tsx
```

Expected: PASS

**Step 5: Run all frontend tests to verify nothing broke**

```bash
cd frontend && npm test
```

Expected: ALL PASS

**Step 6: Commit**

```bash
git add frontend/src/components/VideosPage.tsx frontend/src/components/VideosPage.integration.test.tsx
git commit -m "feat(ui): integrate GridColumnControl into VideosPage

Add GridColumnControl to toolbar, conditionally visible when in
grid view. Updates VideoGrid with selected column count.

- Show GridColumnControl only when viewMode === 'grid'
- Pass gridColumns from store to VideoGrid
- Settings persist when switching between views
- Full integration test coverage"
```

---

## Task 5: Manual testing and verification

**Files:**
- N/A (manual testing only)

**Step 1: Start development server**

```bash
cd frontend && npm run dev
```

**Step 2: Test in browser**

Navigate to `http://localhost:5173/videos`

**Test Checklist:**
- [ ] Default view is list (no GridColumnControl visible)
- [ ] Switch to grid view → GridColumnControl appears
- [ ] Default grid shows 3 columns (desktop)
- [ ] Click "2" → Grid changes to 2 columns
- [ ] Click "5" → Grid changes to 5 columns
- [ ] Switch to list view → GridColumnControl disappears
- [ ] Change thumbnail size in list view → Grid not affected
- [ ] Switch back to grid → Still shows 5 columns (preserved)
- [ ] Reload page → Grid still shows 5 columns (localStorage works)
- [ ] Test responsive: Resize to tablet width → Grid scales down
- [ ] Test responsive: Resize to mobile width → Shows 1 column

**Step 3: Test in different browsers**

Test in at least Chrome and Safari (or Firefox).

**Step 4: Document any issues found**

If issues found, create follow-up tasks.

**Step 5: No commit (manual testing only)**

---

## Task 6: Update documentation

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Document the new feature in CLAUDE.md**

Add to the "State Management" section in `CLAUDE.md` (around line 43):

```markdown
**Zustand (Client State):**
- Tag selection state: `frontend/src/stores/tagStore.ts`
- Table/Grid settings: `frontend/src/stores/tableSettingsStore.ts`
  - List view: `thumbnailSize` (small, medium, large, xlarge)
  - Grid view: `gridColumns` (2, 3, 4, 5 columns)
  - Both views share `viewMode` and `visibleColumns`
  - Settings are independent: changing thumbnail size doesn't affect grid
```

Add to "Known Patterns & Conventions" section (around line 140):

```markdown
### Grid Column Configuration

- Grid view has independent column control (2, 3, 4, 5)
- `GridColumnControl` component only visible when `viewMode === 'grid'`
- Responsive behavior: Mobile (1 col) → Tablet (2-3 cols) → Desktop (user choice)
- Thumbnails auto-scale to fill column width (CSS-based)
- Settings persist in localStorage via Zustand persist middleware
```

**Step 2: Commit documentation**

```bash
git add CLAUDE.md
git commit -m "docs: document grid column control feature

Update CLAUDE.md with grid column configuration patterns:
- Independent grid/list view settings
- GridColumnControl component visibility
- Responsive behavior
- localStorage persistence"
```

---

## Task 7: Create handoff log

**Files:**
- Create: `docs/handoffs/2025-11-04-grid-column-control.md`

**Step 1: Create handoff document**

Create `docs/handoffs/2025-11-04-grid-column-control.md`:

```markdown
# Grid Column Control Implementation - Handoff Log

**Date:** 2025-11-04
**Feature:** Independent grid view column configuration
**Status:** ✅ Complete

## What Was Built

Added independent column count control for grid view (2, 3, 4, 5 columns) that doesn't affect list view thumbnail size settings.

## Changes Made

### 1. State Management
- **File:** `frontend/src/stores/tableSettingsStore.ts`
- Added `GridColumnCount` type (2 | 3 | 4 | 5)
- Added `gridColumns` state field (default: 3)
- Added `setGridColumns` action
- Full test coverage in `tableSettingsStore.test.ts`

### 2. UI Component
- **File:** `frontend/src/components/GridColumnControl.tsx`
- Button group with 4 buttons (2, 3, 4, 5)
- Active state highlighting (blue background)
- Keyboard navigation support
- Full test coverage in `GridColumnControl.test.tsx`

### 3. Grid Layout
- **File:** `frontend/src/components/VideoGrid.tsx`
- Accepts `gridColumns` prop
- Responsive Tailwind classes:
  - 2 cols: `grid-cols-1 md:grid-cols-2`
  - 3 cols: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
  - 4 cols: `grid-cols-1 md:grid-cols-2 lg:grid-cols-4`
  - 5 cols: `grid-cols-1 md:grid-cols-3 lg:grid-cols-5`
- Updated tests in `VideoGrid.test.tsx`

### 4. Integration
- **File:** `frontend/src/components/VideosPage.tsx`
- GridColumnControl conditionally rendered when `viewMode === 'grid'`
- Passes `gridColumns` from store to VideoGrid
- Integration tests in `VideosPage.integration.test.tsx`

### 5. Documentation
- **File:** `CLAUDE.md`
- Documented independent settings pattern
- Documented responsive behavior
- Added to state management section

## Testing

All tests passing:
- ✅ Store tests (default, action, persistence)
- ✅ Component tests (rendering, interaction, keyboard)
- ✅ Grid tests (column classes for each count)
- ✅ Integration tests (visibility, state updates, view switching)
- ✅ Manual testing (browser, responsive, localStorage)

## Known Limitations

None. Feature works as designed.

## Migration Notes

- Existing users: `gridColumns` auto-populates with default value 3
- No migration script needed
- Non-breaking change
- localStorage updated automatically on first load

## Future Enhancements

Potential additions (not in scope):
- Grid card style variants (compact, comfortable, spacious)
- Custom thumbnail aspect ratios
- Per-view sort preferences

## Related Files

**Modified:**
- `frontend/src/stores/tableSettingsStore.ts`
- `frontend/src/stores/tableSettingsStore.test.ts`
- `frontend/src/components/VideoGrid.tsx`
- `frontend/src/components/VideoGrid.test.tsx`
- `frontend/src/components/VideosPage.tsx`
- `frontend/src/components/VideosPage.integration.test.tsx`
- `CLAUDE.md`

**Created:**
- `frontend/src/components/GridColumnControl.tsx`
- `frontend/src/components/GridColumnControl.test.tsx`
- `docs/plans/2025-11-04-grid-column-control-design.md`
- `docs/plans/2025-11-04-grid-column-control-implementation.md`
- `docs/handoffs/2025-11-04-grid-column-control.md` (this file)

## Handoff Complete

Feature is production-ready. All tests passing. Documentation updated.
```

**Step 2: Commit handoff log**

```bash
git add docs/handoffs/2025-11-04-grid-column-control.md
git commit -m "docs: add grid column control handoff log

Create handoff document summarizing implementation:
- Changes made to each file
- Testing coverage
- Migration notes
- Related files list"
```

---

## Verification

**Final Test Run:**

```bash
cd frontend && npm test && npm run build
```

Expected: All tests pass, build succeeds with no errors.

**Git Log Check:**

```bash
git log --oneline -7
```

Should show 7 commits from this implementation.

**Implementation Complete!**
