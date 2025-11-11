# Task #35: Separate Grid/List View Settings (gridColumns vs thumbnailSize) - UPDATED with REF MCP Improvements

**Plan Task:** #35
**Wave/Phase:** Wave 3 Grid View Enhancement
**Dependencies:** Task #33 (gridColumns state), Task #34 (GridColumnControl UI)
**REF MCP Validated:** 2025-11-04 18:45 CET (5 improvements applied)

---

## 🎯 Ziel

VideoGrid-Komponente soll den dynamischen `gridColumns`-State aus dem tableSettingsStore konsumieren statt hardcoded grid-Klassen zu nutzen. Dies ermöglicht Benutzern die Spaltenanzahl über das GridColumnControl-UI zu ändern (2, 3, 4, 5 Spalten).

**Erwartetes Ergebnis:**
- VideoGrid rendert Grid mit 2/3/4/5 Spalten basierend auf User-Präferenz
- Responsive Verhalten bleibt erhalten (Mobile: 1-2 cols, Tablet: 2-3 cols, Desktop: User Choice)
- Tailwind-Klassen sind PurgeCSS-safe (alle explizit geschrieben)
- Setting persistiert über localStorage (bereits durch Task #33 implementiert)

---

## 📋 Acceptance Criteria

- [ ] VideoGrid akzeptiert `gridColumns` prop mit Type `GridColumnCount` (2 | 3 | 4 | 5)
- [ ] Dynamische Grid-Klassen werden basierend auf `gridColumns`-Wert angewendet
- [ ] Alle 4 Spaltenzahlen (2, 3, 4, 5) haben korrekte responsive Tailwind-Klassen
- [ ] VideosPage übergibt `gridColumns` vom Store an VideoGrid mit **separaten Selektoren** (REF Improvement #1)
- [ ] Unit Tests für alle 4 Spalten-Konfigurationen mit **toContain() assertions** (REF Improvement #3)
- [ ] Integration Test mit **echtem Store** bestätigt dass GridColumnControl das Grid-Layout updated (REF Improvement #4)
- [ ] Manual Testing: Änderung der Spaltenzahl updated Grid visuell
- [ ] Keine TypeScript Errors
- [ ] Production Build funktioniert **ohne Safelist** (REF Improvement #5 - Task #31 Pattern)
- [ ] Code Review approved (Subagent)

---

## 🛠️ Implementation Steps (Updated with 5 REF MCP Improvements)

### Step 1: Update VideoGrid Props Interface

**Files:** `frontend/src/components/VideoGrid.tsx`

**Action:** Add `gridColumns` prop to VideoGrid interface

**Code:**
```typescript
import type { GridColumnCount } from '@/stores/tableSettingsStore'

interface VideoGridProps {
  videos: VideoResponse[]
  gridColumns: GridColumnCount  // NEW: Dynamic column count from store
  onVideoClick: (video: VideoResponse) => void
  onDelete: (videoId: string) => void
}
```

---

### Step 2: Implement Dynamic Grid Class Mapping (REF Improvement #2 Applied)

**Files:** `frontend/src/components/VideoGrid.tsx`

**Action:** Replace hardcoded `grid-cols-2 md:grid-cols-3 lg:grid-cols-4` with dynamic mapping

**REF Improvement #2:** Changed `md:grid-cols-3` to `md:grid-cols-2` for 5-column config (better Tablet UX)

**Code:**
```typescript
export const VideoGrid = ({ videos, gridColumns, onVideoClick, onDelete }: VideoGridProps) => {
  // PurgeCSS-safe: All classes explicitly written in object (no template literals)
  // Responsive behavior: mobile 1-2, tablet 2, desktop user choice (2-5)
  // Pattern from Task #31 (proven working with thumbnailSize)
  // REF IMPROVEMENT #2: 5 cols uses md:grid-cols-2 instead of md:grid-cols-3 for better Tablet UX
  const gridColumnClasses = {
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-5', // Changed from md:grid-cols-3
  } as const

  // Enhanced empty state (unchanged)
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

**Why REF Improvement #2:**
- Tablet screens (768px-1024px): 2 columns are safer than 3 columns for 5-column setting
- Prevents overcrowded cards on tablet devices
- Smoother progression: 1 col (mobile) → 2 cols (tablet) → 5 cols (desktop)

---

### Step 3: Add Unit Tests for Grid Column Classes (REF Improvement #3 Applied)

**Files:** `frontend/src/components/VideoGrid.test.tsx`

**Action:** Add tests for each grid column count (2, 3, 4, 5)

**REF Improvement #3:** Use both `toHaveClass()` AND `toContain()` for robust testing

**Code:**
```typescript
import type { GridColumnCount } from '@/stores/tableSettingsStore'

describe('grid column configuration', () => {
  const mockVideos: VideoResponse[] = [
    {
      id: '1',
      youtube_id: 'dQw4w9WgXcQ',
      title: 'Test Video 1',
      thumbnail_url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/default.jpg',
      duration: 180,
      channel_name: 'Test Channel',
      published_at: '2024-01-01T00:00:00Z',
      tags: [],
    },
  ]

  it('applies correct grid classes for 2 columns', () => {
    const { container } = render(
      <VideoGrid
        videos={mockVideos}
        gridColumns={2}
        onVideoClick={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    const grid = container.querySelector('.video-grid')

    // REF IMPROVEMENT #3: Use both toHaveClass and toContain for robust testing
    expect(grid).toHaveClass('grid-cols-1', 'md:grid-cols-2')

    const classes = grid?.className || ''
    expect(classes).toContain('grid-cols-1')
    expect(classes).toContain('md:grid-cols-2')
    expect(classes).not.toContain('lg:grid-cols') // No lg: breakpoint for 2 cols
  })

  it('applies correct grid classes for 3 columns', () => {
    const { container } = render(
      <VideoGrid
        videos={mockVideos}
        gridColumns={3}
        onVideoClick={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    const grid = container.querySelector('.video-grid')
    expect(grid).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3')

    const classes = grid?.className || ''
    expect(classes).toContain('grid-cols-1')
    expect(classes).toContain('md:grid-cols-2')
    expect(classes).toContain('lg:grid-cols-3')
  })

  it('applies correct grid classes for 4 columns', () => {
    const { container } = render(
      <VideoGrid
        videos={mockVideos}
        gridColumns={4}
        onVideoClick={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    const grid = container.querySelector('.video-grid')
    expect(grid).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-4')

    const classes = grid?.className || ''
    expect(classes).toContain('grid-cols-1')
    expect(classes).toContain('md:grid-cols-2')
    expect(classes).toContain('lg:grid-cols-4')
  })

  it('applies correct grid classes for 5 columns (REF Improvement #2: md:grid-cols-2)', () => {
    const { container } = render(
      <VideoGrid
        videos={mockVideos}
        gridColumns={5}
        onVideoClick={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    const grid = container.querySelector('.video-grid')

    // REF IMPROVEMENT #2: 5 cols now uses md:grid-cols-2 (not 3) for better Tablet UX
    expect(grid).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-5')

    const classes = grid?.className || ''
    expect(classes).toContain('grid-cols-1')
    expect(classes).toContain('md:grid-cols-2') // Tablet: 2 cols (not 3)
    expect(classes).toContain('lg:grid-cols-5')
    expect(classes).not.toContain('md:grid-cols-3') // Verify NOT 3 cols on tablet
  })

  it('renders empty state correctly regardless of gridColumns value', () => {
    const { container } = render(
      <VideoGrid
        videos={[]}
        gridColumns={5}
        onVideoClick={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    expect(screen.getByText('Keine Videos im Grid')).toBeInTheDocument()
    // Empty state should not have grid classes
    const emptyState = container.querySelector('.flex.flex-col')
    expect(emptyState).not.toHaveClass('video-grid')
  })
})
```

**Why REF Improvement #3:**
- `toHaveClass()` ensures exact class presence
- `toContain()` is more flexible for refactorings (e.g., if we add more classes like `gap-6`)
- Negative assertions (`not.toContain`) verify wrong classes aren't applied

---

### Step 4: Update Existing VideoGrid Tests

**Files:** `frontend/src/components/VideoGrid.test.tsx`

**Action:** Add `gridColumns={3}` prop to all existing test renders

**Code:**
```typescript
// Find all existing render() calls in VideoGrid.test.tsx and add gridColumns prop

// Before (WILL FAIL after Step 2):
render(
  <VideoGrid
    videos={mockVideos}
    onVideoClick={mockOnVideoClick}
    onDelete={mockOnDelete}
  />
)

// After (FIXED):
render(
  <VideoGrid
    videos={mockVideos}
    gridColumns={3}  // NEW: Default value (matches store default from Task #33)
    onVideoClick={mockOnVideoClick}
    onDelete={mockOnDelete}
  />
)
```

---

### Step 5: Update VideosPage to Pass gridColumns Prop (REF Improvement #1 Applied)

**Files:** `frontend/src/components/VideosPage.tsx`

**Action:** Import `gridColumns` from store and pass to VideoGrid

**REF Improvement #1:** Use **separate selectors** instead of `useShallow` with object pattern (consistent with Task #34)

**Code:**
```typescript
// Around line 212 - Update useTableSettingsStore hook
// REF IMPROVEMENT #1: Use separate selectors (not useShallow with object)
// This is consistent with Task #34 and provides better performance
const viewMode = useTableSettingsStore((state) => state.viewMode)
const gridColumns = useTableSettingsStore((state) => state.gridColumns)

// Remove the old useShallow pattern if it exists:
// ❌ Don't do this:
// const { viewMode, gridColumns } = useTableSettingsStore(
//   useShallow((state) => ({
//     viewMode: state.viewMode,
//     gridColumns: state.gridColumns,
//   }))
// )

// Around line 664 - Pass gridColumns to VideoGrid component
{viewMode === 'grid' ? (
  <VideoGrid
    videos={videos}
    gridColumns={gridColumns}  // NEW: Dynamic column count from store
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
) : (
  // Table view rendering...
)}
```

**Why REF Improvement #1:**
- Separate selectors: Zustand does automatic `Object.is` reference comparison for primitives
- Component only re-renders when specific value changes (not when any store value changes)
- No object allocation on every store update (unlike useShallow with object pattern)
- Consistent with Task #34 implementation (GridColumnControl uses same pattern)

---

### Step 6: Add Integration Test (REF Improvement #4 Applied)

**Files:** `frontend/src/components/VideosPage.integration.test.tsx`

**Action:** Test that GridColumnControl updates VideoGrid layout

**REF Improvement #4:** Use **real store** with proper cleanup, not mocks

**Code:**
```typescript
import { useTableSettingsStore } from '@/stores/tableSettingsStore'

describe('GridColumnControl integration with VideoGrid', () => {
  // REF IMPROVEMENT #4: Use real store with cleanup (not mocks)
  beforeEach(() => {
    // Reset localStorage to ensure clean state
    localStorage.clear()

    // Reset Zustand store to default state
    useTableSettingsStore.setState({
      viewMode: 'list',
      gridColumns: 3,
      thumbnailSize: 'medium',
      visibleColumns: {
        thumbnail: true,
        title: true,
        duration: true,
        actions: true,
      },
    })
  })

  it('updates VideoGrid classes when column count changes', async () => {
    const user = userEvent.setup()
    render(<VideosPage listId="test-list-id" />)

    // Switch to grid view
    const gridButton = screen.getByRole('button', { name: /grid/i })
    await user.click(gridButton)

    // Verify default 3 columns
    let grid = document.querySelector('.video-grid')
    expect(grid).toHaveClass('lg:grid-cols-3')

    // Open TableSettingsDropdown
    const settingsButton = screen.getByRole('button', { name: /einstellungen/i })
    await user.click(settingsButton)

    // Change to 5 columns
    const button5 = screen.getByRole('radio', { name: /5 spalten/i })
    await user.click(button5)

    // Verify grid classes updated (REF IMPROVEMENT #2: md:grid-cols-2 for 5 cols)
    grid = document.querySelector('.video-grid')
    expect(grid).toHaveClass('lg:grid-cols-5')
    expect(grid).toHaveClass('md:grid-cols-2') // Tablet: 2 cols (not 3)
    expect(grid).not.toHaveClass('lg:grid-cols-3')
  })

  it('preserves gridColumns when switching between list and grid views', async () => {
    const user = userEvent.setup()
    render(<VideosPage listId="test-list-id" />)

    // Switch to grid view
    const gridButton = screen.getByRole('button', { name: /grid/i })
    await user.click(gridButton)

    // Open settings and change to 4 columns
    const settingsButton = screen.getByRole('button', { name: /einstellungen/i })
    await user.click(settingsButton)

    const button4 = screen.getByRole('radio', { name: /4 spalten/i })
    await user.click(button4)

    // Close dropdown
    await user.keyboard('{Escape}')

    // Switch to list view
    const listButton = screen.getByRole('button', { name: /list/i })
    await user.click(listButton)

    // Switch back to grid view
    await user.click(gridButton)

    // Should still be 4 columns (setting preserved via localStorage)
    const grid = document.querySelector('.video-grid')
    expect(grid).toHaveClass('lg:grid-cols-4')

    // Verify in store
    const state = useTableSettingsStore.getState()
    expect(state.gridColumns).toBe(4)
  })

  it('persists gridColumns setting across page reloads', async () => {
    const user = userEvent.setup()

    // Set up initial state
    const { unmount } = render(<VideosPage listId="test-list-id" />)

    // Switch to grid and set 5 columns
    const gridButton = screen.getByRole('button', { name: /grid/i })
    await user.click(gridButton)

    const settingsButton = screen.getByRole('button', { name: /einstellungen/i })
    await user.click(settingsButton)

    const button5 = screen.getByRole('radio', { name: /5 spalten/i })
    await user.click(button5)

    // Unmount component (simulates page navigation)
    unmount()

    // Re-render component (simulates page reload)
    render(<VideosPage listId="test-list-id" />)

    // Verify setting persisted (localStorage + Zustand persist middleware)
    const state = useTableSettingsStore.getState()
    expect(state.gridColumns).toBe(5)

    // Switch to grid view to verify DOM
    const gridButtonAgain = screen.getByRole('button', { name: /grid/i })
    await user.click(gridButtonAgain)

    const grid = document.querySelector('.video-grid')
    expect(grid).toHaveClass('lg:grid-cols-5')
  })
})
```

**Why REF Improvement #4:**
- Real store tests actual behavior (localStorage persistence, store updates, DOM rendering)
- No mocks = higher confidence that production code works
- Finds bugs in store logic (e.g., if persist middleware fails)
- Tests full integration: GridColumnControl → Store → VideosPage → VideoGrid

---

### Step 7: Verify Production Build (REF Improvement #5 Applied)

**Files:** None (verification only)

**Action:** Verify production build works WITHOUT safelist

**REF Improvement #5:** Document that safelist is **NOT needed** based on Task #31 success

**Verification Steps:**
```bash
# 1. Build production bundle
npm run build

# Expected: No warnings about missing grid-cols classes

# 2. Preview production build
npm run preview

# Expected: Grid column changes work correctly in production build

# 3. Manual verification (optional)
# - Open browser to preview URL
# - Switch to grid view
# - Test all 4 column counts (2, 3, 4, 5)
# - Verify responsive behavior on different screen sizes
# - Check browser DevTools for correct classes
```

**Why NO Safelist Needed (REF Improvement #5):**
- Object literal keys are detected by Tailwind scanner (proven in Task #31)
- Modern Tailwind (v3+) with JIT mode scans all source files
- Task #31 thumbnailSize pattern works without safelist (same pattern)
- All classes are complete strings in object values (no template literals)

**IF Safelist IS Needed (Unlikely):**
Only add safelist if production build test shows missing classes:

```javascript
// frontend/tailwind.config.js
module.exports = {
  // ... existing config
  safelist: [
    // Grid base and responsive classes for VideoGrid (Task #35)
    // ONLY ADD IF PRODUCTION BUILD FAILS (should not be needed)
    'grid-cols-1',
    'grid-cols-2',
    'md:grid-cols-2',
    'md:grid-cols-3',
    'lg:grid-cols-3',
    'lg:grid-cols-4',
    'lg:grid-cols-5',
  ],
}
```

---

## 🧪 Testing Strategy

### Unit Tests (VideoGrid.test.tsx)

**Total: 5 new tests + updates to existing tests**

1. ✅ Test 2 columns: `grid-cols-1 md:grid-cols-2`
2. ✅ Test 3 columns: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
3. ✅ Test 4 columns: `grid-cols-1 md:grid-cols-2 lg:grid-cols-4`
4. ✅ Test 5 columns: `grid-cols-1 md:grid-cols-2 lg:grid-cols-5` (REF Improvement #2)
5. ✅ Test empty state: No grid classes applied

**All tests use REF Improvement #3:** Both `toHaveClass()` AND `toContain()` assertions

### Integration Tests (VideosPage.integration.test.tsx)

**Total: 3 new integration tests**

1. ✅ GridColumnControl updates VideoGrid DOM classes
2. ✅ gridColumns persists when switching views
3. ✅ gridColumns persists across page reloads (localStorage)

**All tests use REF Improvement #4:** Real store with beforeEach cleanup

### Manual Testing Checklist

1. **Default State**
   - [ ] Navigate to /videos
   - [ ] Switch to grid view
   - [ ] Verify 3 columns displayed (default)

2. **Change Columns**
   - [ ] Click "2" in GridColumnControl
   - [ ] Verify grid changes to 2 columns (wider cards)
   - [ ] Click "5"
   - [ ] Verify grid changes to 5 columns (narrower cards)

3. **Responsive Behavior (REF Improvement #2 - Tablet UX)**
   - [ ] Set grid to 5 columns
   - [ ] Resize browser to tablet width (~800px)
   - [ ] Verify grid shows **2 columns** on tablet (not 3)
   - [ ] Resize to mobile width (~400px)
   - [ ] Verify grid shows 1 column (regardless of setting)
   - [ ] Resize to desktop (>1024px)
   - [ ] Verify grid shows 5 columns (user choice)

4. **Persistence**
   - [ ] Set grid to 4 columns
   - [ ] Reload page (F5)
   - [ ] Verify still 4 columns (localStorage works)

5. **View Switching**
   - [ ] Set grid to 5 columns
   - [ ] Switch to list view
   - [ ] Change thumbnail size to "Groß"
   - [ ] Switch back to grid
   - [ ] Verify still 5 columns (independent settings)

6. **Production Build (REF Improvement #5)**
   - [ ] Run `npm run build`
   - [ ] Verify no warnings about grid-cols classes
   - [ ] Run `npm run preview`
   - [ ] Test grid column changes in production build
   - [ ] Verify all grid classes render correctly
   - [ ] Confirm NO safelist needed

---

## 📚 REF MCP Improvements Summary

| # | Improvement | Applied in Step | Benefit |
|---|-------------|-----------------|---------|
| 1 | Separate selectors (not useShallow with object) | Step 5 | Consistency with Task #34, better performance, simpler code |
| 2 | 5 cols uses `md:grid-cols-2` (not `md:grid-cols-3`) | Step 2, 3 | Better Tablet UX, prevents overcrowded cards |
| 3 | Tests use both `toHaveClass()` AND `toContain()` | Step 3 | Robust tests, less fragile to refactorings |
| 4 | Integration tests use real store with cleanup | Step 6 | Higher test quality, finds more bugs, tests real behavior |
| 5 | Document safelist NOT needed (Task #31 proof) | Step 7 | Realistic expectation, cleaner config, saves time |

**REF MCP Sources Used:**
- Tailwind CSS Dynamic Classes: https://tailwindcss.com/docs/detecting-classes-in-source-files#dynamic-class-names
- Tailwind CSS Responsive Design: https://tailwindcss.com/docs/responsive-design#basic-example
- Zustand Prevent Rerenders: https://zustand.docs.pmnd.rs/guides/prevent-rerenders-with-use-shallow
- Vitest Component Testing: https://vitest.dev/guide/browser/component-testing

---

## ✅ Definition of Done

- [ ] VideoGrid component accepts gridColumns prop with type safety
- [ ] Dynamic grid classes implemented with object mapping (PurgeCSS-safe)
- [ ] REF Improvement #2 applied: 5 cols uses `md:grid-cols-2` for better Tablet UX
- [ ] All unit tests passing (5 new tests with REF Improvement #3)
- [ ] REF Improvement #3 applied: Tests use both `toHaveClass()` and `toContain()`
- [ ] Integration tests passing (3 new tests with REF Improvement #4)
- [ ] REF Improvement #4 applied: Real store with beforeEach cleanup
- [ ] VideosPage uses separate selectors (REF Improvement #1)
- [ ] REF Improvement #1 applied: Consistent with Task #34 pattern
- [ ] Manual testing checklist completed (6 scenarios)
- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] Production build works WITHOUT safelist (REF Improvement #5)
- [ ] REF Improvement #5 verified: Task #31 pattern confirmed working
- [ ] Code Review approved (Subagent)
- [ ] Implementation report created (REPORT-035)
- [ ] status.md updated (Task #35 completed, LOG entry)
- [ ] Changes committed with proper message

---

## 📝 Implementation Notes

**All 5 REF MCP Improvements Incorporated:**

1. ✅ **Separate Selectors** (Step 5) - Follows Task #34 proven pattern
2. ✅ **Tablet Breakpoint** (Step 2, 3) - Better UX on tablets for 5-column mode
3. ✅ **Robust Tests** (Step 3) - Both `toHaveClass()` and `toContain()` assertions
4. ✅ **Real Store Testing** (Step 6) - No mocks, tests actual behavior
5. ✅ **No Safelist Needed** (Step 7) - Task #31 proof, cleaner configuration

**Task #31 Pattern Reused:**
Object mapping for dynamic classes is proven to work without safelist in production.

**Task #34 Pattern Reused:**
Separate selectors for Zustand store subscriptions provide optimal re-render prevention.

**Dependencies Complete:**
- ✅ Task #33: gridColumns state exists in store (default: 3)
- ✅ Task #34: GridColumnControl UI exists in TableSettingsDropdown
- ✅ Task #32: ViewMode toggle pattern established
- ✅ Task #31: thumbnailSize mapping pattern proven (same approach)
