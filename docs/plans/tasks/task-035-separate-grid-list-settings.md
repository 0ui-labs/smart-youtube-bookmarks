# Task #35: Separate Grid/List View Settings (gridColumns vs thumbnailSize)

**Plan Task:** #35
**Wave/Phase:** Wave 3 Grid View Enhancement
**Dependencies:** Task #33 (gridColumns state), Task #34 (GridColumnControl UI)

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
- [ ] VideosPage übergibt `gridColumns` vom Store an VideoGrid
- [ ] Unit Tests für alle 4 Spalten-Konfigurationen (4 neue Tests)
- [ ] Integration Test bestätigt dass GridColumnControl das Grid-Layout updated
- [ ] Manual Testing: Änderung der Spaltenzahl updated Grid visuell
- [ ] Keine TypeScript Errors
- [ ] PurgeCSS entfernt keine grid-Klassen im Production Build
- [ ] Code Review approved (Subagent)

---

## 🛠️ Implementation Steps

### 1. Update VideoGrid Props Interface

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

**Why:**
- Type-safe prop ensures only valid values (2, 3, 4, 5) can be passed
- Import from store ensures consistency with state type
- Follows existing props pattern (videos, onVideoClick, onDelete)

---

### 2. Implement Dynamic Grid Class Mapping (PurgeCSS-Safe)

**Files:** `frontend/src/components/VideoGrid.tsx`

**Action:** Replace hardcoded `grid-cols-2 md:grid-cols-3 lg:grid-cols-4` with dynamic mapping

**Code:**
```typescript
export const VideoGrid = ({ videos, gridColumns, onVideoClick, onDelete }: VideoGridProps) => {
  // PurgeCSS-safe: All classes explicitly written in object (no template literals)
  // Responsive behavior: mobile 1-2, tablet 2-3, desktop user choice (2-5)
  // Pattern from Task #31 (proven working with thumbnailSize)
  const gridColumnClasses = {
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-1 md:grid-cols-3 lg:grid-cols-5',
  } as const

  // REF MCP #5: Enhanced empty state (unchanged)
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

**Why:**
- ✅ **PurgeCSS-Safe:** All classes explicitly written in object (Tailwind scans object keys)
- ✅ **No Template Literals:** Avoids `grid-cols-${gridColumns}` which breaks PurgeCSS
- ✅ **Type-Safe:** `as const` ensures compile-time checking
- ✅ **Proven Pattern:** Follows Task #31 thumbnailSize mapping pattern
- ✅ **Responsive Design:** Mobile override (grid-cols-1) preserved, desktop allows user choice

**Alternatives Rejected:**
- ❌ Template literals `grid-cols-${gridColumns}` - PurgeCSS removes classes
- ❌ Switch statement - Verbose, less maintainable
- ❌ Conditional ternary chains - Hard to read, error-prone

---

### 3. Add Unit Tests for Grid Column Classes

**Files:** `frontend/src/components/VideoGrid.test.tsx`

**Action:** Add tests for each grid column count (2, 3, 4, 5)

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
    expect(grid).toHaveClass('grid-cols-1', 'md:grid-cols-2')
    expect(grid).not.toHaveClass('lg:grid-cols-3')
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
  })

  it('applies correct grid classes for 5 columns', () => {
    const { container } = render(
      <VideoGrid
        videos={mockVideos}
        gridColumns={5}
        onVideoClick={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    const grid = container.querySelector('.video-grid')
    expect(grid).toHaveClass('grid-cols-1', 'md:grid-cols-3', 'lg:grid-cols-5')
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

**Why:**
- Tests all 4 column configurations (2, 3, 4, 5)
- Verifies responsive classes for each breakpoint
- Tests empty state is unaffected by gridColumns prop
- Uses negative assertions to ensure wrong classes aren't applied

---

### 4. Update Existing VideoGrid Tests

**Files:** `frontend/src/components/VideoGrid.test.tsx`

**Action:** Add `gridColumns={3}` prop to all existing test renders

**Code:**
```typescript
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
    gridColumns={3}  // NEW: Default value
    onVideoClick={mockOnVideoClick}
    onDelete={mockOnDelete}
  />
)
```

**Why:**
- Existing tests will break after adding required `gridColumns` prop
- Default to 3 (matches store default from Task #33)
- Minimal change to existing tests (one line per render)

---

### 5. Update VideosPage to Pass gridColumns Prop

**Files:** `frontend/src/components/VideosPage.tsx`

**Action:** Import `gridColumns` from store and pass to VideoGrid

**Code:**
```typescript
// Around line 212 - Update useTableSettingsStore hook
const { viewMode, gridColumns } = useTableSettingsStore(
  useShallow((state) => ({
    viewMode: state.viewMode,
    gridColumns: state.gridColumns,
  }))
)

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

**Why:**
- Uses existing `useShallow` pattern from Task #32 (ViewMode)
- Only extracts needed state fields (viewMode, gridColumns) for optimal re-render
- gridColumns already defaults to 3 in store (Task #33)
- No localStorage setup needed (persist middleware already configured)

---

### 6. Add Integration Test

**Files:** `frontend/src/components/VideosPage.integration.test.tsx`

**Action:** Test that GridColumnControl updates VideoGrid layout

**Code:**
```typescript
describe('GridColumnControl integration with VideoGrid', () => {
  it('updates VideoGrid classes when column count changes', async () => {
    const user = userEvent.setup()
    render(<VideosPage listId="test-list-id" />)

    // Switch to grid view
    const gridButton = screen.getByRole('button', { name: /grid/i })
    await user.click(gridButton)

    // Verify default 3 columns
    let grid = document.querySelector('.video-grid')
    expect(grid).toHaveClass('lg:grid-cols-3')

    // Change to 5 columns
    const button5 = screen.getByRole('button', { name: '5 Spalten' })
    await user.click(button5)

    // Verify grid classes updated
    grid = document.querySelector('.video-grid')
    expect(grid).toHaveClass('lg:grid-cols-5')
    expect(grid).not.toHaveClass('lg:grid-cols-3')
  })

  it('preserves gridColumns when switching between list and grid views', async () => {
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

    // Should still be 4 columns (setting preserved)
    const button4Again = screen.getByRole('button', { name: '4 Spalten' })
    expect(button4Again).toHaveAttribute('aria-pressed', 'true')

    const grid = document.querySelector('.video-grid')
    expect(grid).toHaveClass('lg:grid-cols-4')
  })
})
```

**Why:**
- Tests full user flow: grid view → change columns → see update
- Tests state persistence when switching between views
- Uses actual DOM queries (not mocks) for real integration test
- Verifies GridColumnControl UI actually controls VideoGrid layout

---

### 7. Verify Tailwind Configuration (Optional)

**Files:** `frontend/tailwind.config.js`

**Action:** Check if safelist is needed for grid classes

**Code:**
```javascript
// Only add if production build removes grid classes (unlikely with explicit object mapping)
module.exports = {
  // ... existing config
  safelist: [
    // Grid base and responsive classes for VideoGrid (Task #35)
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

**Why:**
- Modern Tailwind (v3+) with JIT mode should detect classes in object keys
- Only needed if production build test shows missing classes
- Safelist is backup safety net (no harm if not needed)
- Better to have safelist than debug "why are my classes missing in prod?"

**When to Add:**
- Run `npm run build` after Step 2
- Check if build warnings mention grid-cols classes
- Test production build in browser (grid should look correct)
- If grid breaks in prod → add safelist

---

## 🧪 Testing Strategy

### Unit Tests (VideoGrid.test.tsx)

**Test 1: 2 Columns**
- Render VideoGrid with `gridColumns={2}`
- Verify classes: `grid-cols-1 md:grid-cols-2`
- Verify NO lg: breakpoint classes

**Test 2: 3 Columns (Default)**
- Render VideoGrid with `gridColumns={3}`
- Verify classes: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`

**Test 3: 4 Columns**
- Render VideoGrid with `gridColumns={4}`
- Verify classes: `grid-cols-1 md:grid-cols-2 lg:grid-cols-4`

**Test 4: 5 Columns**
- Render VideoGrid with `gridColumns={5}`
- Verify classes: `grid-cols-1 md:grid-cols-3 lg:grid-cols-5`
- Note: md: changes to 3 cols for tablet (not 2)

**Test 5: Empty State**
- Render VideoGrid with empty videos array
- Verify empty state renders regardless of gridColumns value
- Verify no grid classes applied to empty state div

### Integration Tests (VideosPage.integration.test.tsx)

**Test 6: GridColumnControl Updates Grid**
- Switch to grid view (default 3 cols)
- Click "5 Spalten" button
- Verify VideoGrid classes change to lg:grid-cols-5
- Verify old classes removed (lg:grid-cols-3)

**Test 7: Setting Persists Across View Switches**
- Switch to grid view
- Change to 4 columns
- Switch to list view (GridColumnControl hidden)
- Switch back to grid view
- Verify still 4 columns (setting preserved)

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

3. **Responsive Behavior**
   - [ ] Resize browser to tablet width (~800px)
   - [ ] Verify grid shows 2-3 columns max (not 5)
   - [ ] Resize to mobile width (~400px)
   - [ ] Verify grid shows 1 column (regardless of setting)

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

6. **Production Build**
   - [ ] Run `npm run build`
   - [ ] Run `npm run preview`
   - [ ] Test grid column changes in production build
   - [ ] Verify all grid classes render correctly

---

## 📚 Reference

### Related Docs

**Master Plan:**
- `docs/plans/2025-10-31-ID-05-ux-optimization-implementation-plan.md` - Task #35 context

**Design Documents:**
- `docs/plans/2025-11-04-grid-column-control-design.md` - Full design rationale

**Previous Tasks:**
- Task #33 Report: `docs/reports/2025-11-04-task-033-report.md` - gridColumns state
- Task #34 Report: `docs/reports/2025-11-04-task-034-report.md` - GridColumnControl UI
- Task #32 Report: `docs/reports/2025-11-04-task-032-report.md` - ViewMode toggle pattern
- Task #31 Report: `docs/reports/2025-11-03-task-031-report.md` - thumbnailSize mapping pattern (proven)

**External Docs:**
- Tailwind CSS Grid: https://tailwindcss.com/docs/grid-template-columns
- Tailwind PurgeCSS: https://tailwindcss.com/docs/optimizing-for-production

### Related Code

**Similar Pattern (Proven Working):**
- `frontend/src/components/VideoThumbnail` (Task #31) - Object mapping for thumbnailSize
  ```typescript
  const sizeClasses = {
    small: 'w-32 aspect-video object-cover rounded shadow-sm',
    medium: 'w-40 aspect-video object-cover rounded shadow-sm',
    large: 'w-48 aspect-video object-cover rounded shadow-sm',
    xlarge: 'w-[500px] aspect-video object-cover rounded shadow-sm',
  } as const
  ```

**Store Integration Pattern:**
- `frontend/src/components/VideosPage.tsx` (Task #32) - useShallow pattern for viewMode
  ```typescript
  const { viewMode, setViewMode } = useTableSettingsStore(
    useShallow((state) => ({
      viewMode: state.viewMode,
      setViewMode: state.setViewMode,
    }))
  )
  ```

**GridColumnControl UI:**
- `frontend/src/components/TableSettingsDropdown.tsx` (Task #34) - Radio buttons for column selection

### Design Decisions

#### Decision 1: Object Mapping vs Template Literals

**Problem:** How to apply dynamic Tailwind classes based on gridColumns value?

**Alternatives:**
1. ❌ Template literals: `className={grid-cols-${gridColumns}}`
2. ❌ Switch statement with return strings
3. ✅ Object mapping: `gridColumnClasses[gridColumns]`

**Chosen:** Object mapping

**Rationale:**
- Tailwind PurgeCSS removes classes not found in source code
- Template literals generate strings at runtime → PurgeCSS can't detect
- Object keys are literal strings → PurgeCSS scans them
- Pattern proven in Task #31 (thumbnailSize)
- Type-safe with TypeScript `as const`

**Validation:**
- REF MCP confirmed object mapping is Tailwind best practice
- Task #31 implementation shows pattern works in production
- No safelist needed with explicit object keys (Tailwind v3+)

---

#### Decision 2: Responsive Breakpoints Strategy

**Problem:** Should all breakpoints use user's gridColumns value, or override on small screens?

**Alternatives:**
1. ❌ All breakpoints user-controlled: `grid-cols-${gridColumns} md:grid-cols-${gridColumns} lg:grid-cols-${gridColumns}`
2. ✅ Mobile override, desktop user choice: `grid-cols-1 md:grid-cols-2/3 lg:grid-cols-${gridColumns}`

**Chosen:** Mobile override (grid-cols-1), desktop user choice

**Rationale:**
- Mobile screens (~375px): 1 column is only usable layout
- Tablet screens (~768px): 2-3 columns max for readability
- Desktop screens (>1024px): User can choose 2-5 columns
- Prevents poor UX: 5 columns on mobile = unreadable

**Responsive Classes:**
```
2 cols: grid-cols-1 md:grid-cols-2
3 cols: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
4 cols: grid-cols-1 md:grid-cols-2 lg:grid-cols-4
5 cols: grid-cols-1 md:grid-cols-3 lg:grid-cols-5  ← Note: md:3 for tablet
```

**Validation:**
- YouTube uses similar responsive strategy (1-2-4 columns)
- UX best practice: don't trust user on mobile (too small for choice)
- Balances user control with usability

---

#### Decision 3: Default Column Count

**Problem:** What should be the default gridColumns value?

**Alternatives:**
1. 2 columns (max detail)
2. ✅ 3 columns (balanced)
3. 4 columns (max density)

**Chosen:** 3 columns

**Rationale:**
- Already set in Task #33 (store default)
- Matches YouTube grid default (3 columns)
- Balanced: not too sparse (2), not too dense (4-5)
- Most users expect 3-column grid (industry standard)

**Evidence:**
- YouTube: 3 columns
- Netflix: 3-4 columns
- Spotify: 3 columns
- User testing (not done, but 3 is safe default)

---

#### Decision 4: Type Safety Strategy

**Problem:** How to ensure only valid gridColumns values are used?

**Alternatives:**
1. ❌ `number` type with runtime validation
2. ✅ Union type `2 | 3 | 4 | 5` with compile-time checking

**Chosen:** Union type `GridColumnCount = 2 | 3 | 4 | 5`

**Rationale:**
- Compile-time safety prevents invalid values at write-time
- TypeScript error if trying to pass 6, 0, -1, etc.
- Consistent with existing pattern (ThumbnailSize, ViewMode)
- No runtime validation needed (type system prevents errors)

**Implementation:**
```typescript
export type GridColumnCount = 2 | 3 | 4 | 5;

// TypeScript prevents this:
const invalid: GridColumnCount = 6;  // ERROR: Type '6' is not assignable
```

---

#### Decision 5: Safelist Necessity

**Problem:** Do we need to add grid-cols classes to Tailwind safelist?

**Alternatives:**
1. ✅ No safelist (trust object mapping)
2. Add safelist proactively
3. Add safelist only if prod build fails

**Chosen:** No safelist initially (Step 7 is optional)

**Rationale:**
- Modern Tailwind (v3+) with JIT scans all source code
- Object literal keys are detected by PurgeCSS scanner
- Task #31 thumbnailSize pattern works without safelist
- Can add later if production build has issues

**Verification Strategy:**
- Implement without safelist
- Run production build (`npm run build`)
- Test in browser with `npm run preview`
- Only add safelist if classes missing in prod

**When Safelist IS Needed:**
- Dynamic class generation (template literals) ← NOT our case
- Classes from external sources (API, database) ← NOT our case
- Older Tailwind versions (<3.0) ← Check package.json

---

## ⚙️ Technical Details

### PurgeCSS Safety Pattern

**Why Object Mapping Works:**
```typescript
// ✅ SAFE: Tailwind scans object literal keys
const gridColumnClasses = {
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  5: 'grid-cols-1 md:grid-cols-3 lg:grid-cols-5',
} as const

// Tailwind sees these strings at build time:
// 'grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3', etc.
```

**Why Template Literals DON'T Work:**
```typescript
// ❌ UNSAFE: Tailwind can't predict runtime values
const gridColumnClasses = `grid-cols-${gridColumns}`

// Tailwind sees: grid-cols-${gridColumns}
// Tailwind doesn't know gridColumns can be 2, 3, 4, 5
// Result: All grid-cols-X classes removed in production
```

### Responsive Breakpoints Explained

**Tailwind Default Breakpoints:**
- `sm`: 640px (small tablet)
- `md`: 768px (tablet)
- `lg`: 1024px (desktop)
- `xl`: 1280px (large desktop)

**Our Grid Strategy:**
```
Mobile (<768px):     grid-cols-1    (always 1 column)
Tablet (768-1024px): md:grid-cols-2/3 (2-3 columns max)
Desktop (>1024px):   lg:grid-cols-X  (user choice: 2-5)
```

**Example: User selects 5 columns**
- Mobile: Shows 1 column (grid-cols-1 overrides lg:)
- Tablet: Shows 3 columns (md:grid-cols-3)
- Desktop: Shows 5 columns (lg:grid-cols-5)

---

## 🚀 Execution Plan

**Estimated Time:** 45-60 minutes

**Batch 1: Core Implementation (20 min)**
- Step 1: Update VideoGrid props interface
- Step 2: Implement dynamic grid class mapping
- Step 3: Fix existing VideoGrid tests (add gridColumns prop)
- Run tests: `npm test VideoGrid.test.tsx`

**Batch 2: New Tests (15 min)**
- Step 3: Add 5 new unit tests (grid column classes)
- Run tests: `npm test VideoGrid.test.tsx`
- Expected: All tests passing

**Batch 3: Integration (15 min)**
- Step 5: Update VideosPage to pass gridColumns prop
- Step 6: Add integration test
- Run tests: `npm test VideosPage.integration.test.tsx`

**Batch 4: Verification (10 min)**
- Manual testing in browser (all checklist items)
- Run full test suite: `npm test`
- Check TypeScript: `npx tsc --noEmit`

**Batch 5: Optional Safelist (5 min, if needed)**
- Step 7: Add safelist to tailwind.config.js if prod build fails
- Test: `npm run build && npm run preview`

---

## ✅ Definition of Done

- [ ] VideoGrid component accepts gridColumns prop
- [ ] Dynamic grid classes implemented with object mapping
- [ ] All unit tests passing (5 new tests for grid columns)
- [ ] Integration test passing (GridColumnControl → VideoGrid)
- [ ] VideosPage passes gridColumns from store
- [ ] Manual testing checklist completed (6 scenarios)
- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] Production build works (`npm run build`)
- [ ] Code Review approved (Subagent)
- [ ] Implementation report created (REPORT-035)
- [ ] status.md updated (Task #35 completed, LOG entry)
- [ ] Changes committed with proper message

---

## 📝 Notes

**Key Learning from Task #31:**
The thumbnailSize object mapping pattern proved that explicit class strings in objects are PurgeCSS-safe. This task uses the exact same pattern for gridColumns.

**Key Learning from Task #34:**
The separate selectors pattern (`useTableSettingsStore(state => state.X)`) prevents unnecessary re-renders. VideosPage will use this pattern for gridColumns.

**Dependencies Complete:**
- ✅ Task #33: gridColumns state exists in store (default: 3)
- ✅ Task #34: GridColumnControl UI exists in TableSettingsDropdown
- ✅ Task #32: ViewMode toggle pattern established (similar integration)
- ✅ Task #31: thumbnailSize mapping pattern proven (PurgeCSS-safe)

**No Breaking Changes:**
- VideoGrid is only used in VideosPage (Task #32)
- Adding required prop will only break VideosPage (we control this)
- Fix is one line: `gridColumns={gridColumns}`
- No external consumers of VideoGrid component

**Backwards Compatibility:**
- New users: gridColumns defaults to 3 (Task #33)
- Existing users: localStorage auto-updates with default value 3
- No migration script needed (Zustand persist handles it)
