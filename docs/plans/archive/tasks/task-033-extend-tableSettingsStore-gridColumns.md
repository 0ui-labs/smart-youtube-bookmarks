# Task #33: Extend tableSettingsStore with gridColumns State

> **For Claude:** This is a bite-sized task plan. Follow TDD approach with RED-GREEN-REFACTOR cycles.
> **CORRECTED:** This task EXTENDS existing store (not creates new one). Store already exists from Task #32.

**Parent Plan:** `docs/plans/2025-11-04-grid-column-control-implementation.md` (Task 1)

**Goal:** Extend existing `tableSettingsStore` (created in Task #32) with `gridColumns` state field to control number of columns in grid view layout. This enables dynamic grid column control instead of hardcoded responsive breakpoints.

**Current State:**
- Store exists at `frontend/src/stores/tableSettingsStore.ts` with `viewMode`, `thumbnailSize`, `visibleColumns`
- VideoGrid component (Task #32) uses hardcoded columns: `grid-cols-2 md:grid-cols-3 lg:grid-cols-4`
- Store has localStorage persistence via Zustand persist middleware
- 24 existing tests passing (4 test suites)

**After Task #33:**
- Store has new `gridColumns` state (type: 2 | 3 | 4 | 5, default: 3)
- Store has new `setGridColumns` action
- gridColumns persists to localStorage with existing fields
- All existing tests still pass (regression test)
- 4 new tests added (default, action, persistence, regression)

**Tech Stack:** Zustand v4.5.0, TypeScript, Vitest, localStorage (already configured)

---

## 🎯 Acceptance Criteria

- [ ] `GridColumnCount` type exported (2 | 3 | 4 | 5)
- [ ] `TableSettingsStore` interface extended with `gridColumns: GridColumnCount` field
- [ ] `setGridColumns` action implemented and working
- [ ] Default value: `gridColumns: 3` (balanced layout, matches YouTube grid default)
- [ ] localStorage persistence works for gridColumns (survives page reload)
- [ ] All 24 existing tests still pass (no regressions)
- [ ] 4 new tests passing (default, action, persistence, regression)
- [ ] TypeScript strict mode compliance (no `any` types)
- [ ] gridColumns works independently from viewMode (user can change columns while in list OR grid view)

**Evidence:**
```bash
npm test -- tableSettingsStore.test.ts
# Expected: 28 tests passing (24 existing + 4 new)
```

---

## 📚 REF MCP Validation Results

### ✅ Validated Against Zustand v4 Official Docs

**Source:** https://zustand.docs.pmnd.rs/middlewares/persist

1. **Persist Middleware Pattern:** ✅ Store already uses correct `create<Type>()(persist(...))` syntax
2. **Storage Key:** ✅ Store uses `'video-table-settings'` (unique, app-specific)
3. **State Merging:** ✅ Zustand automatically merges new fields with existing persisted state
4. **Type Safety:** ✅ Adding field to interface ensures compile-time validation

### ✅ Validated Against Existing Codebase Patterns

**Existing Store Analysis** (tableSettingsStore.ts:1-162):
- Uses `create<TableSettingsStore>()(persist(...))` pattern ✅
- Has 3 existing state fields: `thumbnailSize`, `visibleColumns`, `viewMode` ✅
- Has 3 existing actions: `setThumbnailSize`, `toggleColumn`, `setViewMode` ✅
- Uses union types for fixed values: `type ThumbnailSize = 'small' | 'medium' | 'large' | 'xlarge'` ✅
- Comprehensive JSDoc comments explaining purpose and behavior ✅
- Test file has 24 passing tests with `renderHook` pattern ✅

**Pattern to Follow:**
```typescript
// Existing pattern (thumbnailSize):
export type ThumbnailSize = 'small' | 'medium' | 'large' | 'xlarge'
interface TableSettingsStore {
  thumbnailSize: ThumbnailSize
  setThumbnailSize: (size: ThumbnailSize) => void
}
// Store: thumbnailSize: 'small', // Default
// Action: setThumbnailSize: (size) => set({ thumbnailSize: size })

// New pattern (gridColumns) - SAME STRUCTURE:
export type GridColumnCount = 2 | 3 | 4 | 5
interface TableSettingsStore {
  gridColumns: GridColumnCount
  setGridColumns: (count: GridColumnCount) => void
}
// Store: gridColumns: 3, // Default
// Action: setGridColumns: (count) => set({ gridColumns: count })
```

### ✅ Validated Responsive Behavior

**Current VideoGrid Implementation** (VideoGrid.tsx:46):
```tsx
<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
```

**gridColumns Mapping Strategy** (to be implemented in Task #35):
- `gridColumns: 2` → Desktop shows 2 columns
- `gridColumns: 3` → Desktop shows 3 columns (current md: breakpoint default)
- `gridColumns: 4` → Desktop shows 4 columns (current lg: breakpoint default)
- `gridColumns: 5` → Desktop shows 5 columns (NEW, requires CSS in Task #35)

**Mobile/Tablet Override** (CSS will force overrides regardless of gridColumns):
- Mobile (<768px): Always 1-2 columns (CSS: `grid-cols-1 sm:grid-cols-2`)
- Tablet (768-1024px): Max 3 columns (CSS: `md:grid-cols-${Math.min(gridColumns, 3)}`)
- Desktop (>1024px): User's full choice (CSS: `lg:grid-cols-${gridColumns}`)

**Note:** Task #33 only adds STATE. Task #35 will implement the CSS mapping logic.

---

## 🛠️ Implementation Steps

### Step 1: Write failing test for gridColumns default value

**File:** `frontend/src/stores/tableSettingsStore.test.ts`

**Action:** Add new describe block at end of file (after line 241, after "View Mode (Task #32)" block)

```typescript
// Task #33: TDD tests for gridColumns state
describe('Grid Columns (Task #33)', () => {
  it('defaults to 3 columns (balanced layout)', () => {
    const { result } = renderHook(() => useTableSettingsStore())
    expect(result.current.gridColumns).toBe(3)
  })
})
```

**Why:**
- TDD RED phase: Test will fail because `gridColumns` doesn't exist yet
- Default of 3 matches YouTube grid default and current `md:grid-cols-3` breakpoint
- Follows existing test pattern (same structure as "View Mode" tests)

---

### Step 2: Run test to verify it fails

**Command:**
```bash
cd frontend && npm test -- tableSettingsStore.test.ts
```

**Expected Output:**
```
FAIL  src/stores/tableSettingsStore.test.ts
  ● Grid Columns (Task #33) › defaults to 3 columns (balanced layout)
    Property 'gridColumns' does not exist on type 'TableSettingsStore'
```

**Why:** Confirms test is correctly checking for non-existent field

---

### Step 3: Add GridColumnCount type and extend store interface

**File:** `frontend/src/stores/tableSettingsStore.ts`

**Action 1:** Add type after line 41 (after `ViewMode` type definition):

```typescript
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
export type GridColumnCount = 2 | 3 | 4 | 5
```

**Action 2:** Extend interface after line 74 (after `viewMode: ViewMode` field):

```typescript
interface TableSettingsStore {
  // ... existing fields: thumbnailSize, visibleColumns, viewMode

  /** Grid column count (grid view only, Task #33) */
  gridColumns: GridColumnCount

  // ... existing actions: setThumbnailSize, toggleColumn, setViewMode

  /** Update grid column count (Task #33) */
  setGridColumns: (count: GridColumnCount) => void
}
```

**Why:**
- JSDoc explains purpose, default value, responsive behavior
- Union type prevents invalid values (6, 0, -1, etc.) at compile time
- Matches existing pattern for ThumbnailSize type
- Type positioned logically with other view-related types (after ViewMode)

---

### Step 4: Add gridColumns state and action to store implementation

**File:** `frontend/src/stores/tableSettingsStore.ts`

**Action 1:** Add state field after line 141 (after `viewMode: 'list'` field):

```typescript
export const useTableSettingsStore = create<TableSettingsStore>()(
  persist(
    (set) => ({
      // State
      thumbnailSize: 'small',
      visibleColumns: DEFAULT_VISIBLE_COLUMNS,
      viewMode: 'list', // Task #32: Default to list view
      gridColumns: 3, // Task #33: Default to 3 columns (balanced, matches YouTube)

      // Actions
      setThumbnailSize: (size) => set({ thumbnailSize: size }),
      toggleColumn: (column) =>
        set((state) => ({
          visibleColumns: {
            ...state.visibleColumns,
            [column]: !state.visibleColumns[column],
          },
        })),
      setViewMode: (mode) => set({ viewMode: mode }), // Task #32
      setGridColumns: (count) => set({ gridColumns: count }), // Task #33
    }),
    // ... persist config (unchanged)
  )
)
```

**Why:**
- Default 3 matches YouTube grid default and current responsive behavior
- Action follows same simple pattern as `setThumbnailSize` and `setViewMode`
- persist middleware automatically handles new field (no config changes needed)
- Minimal implementation (GREEN phase: make test pass)

---

### Step 5: Run test to verify it passes

**Command:**
```bash
cd frontend && npm test -- tableSettingsStore.test.ts
```

**Expected Output:**
```
PASS  src/stores/tableSettingsStore.test.ts
  Grid Columns (Task #33)
    ✓ defaults to 3 columns (balanced layout)

Test Suites: 1 passed, 1 total
Tests:       25 passed, 25 total
```

**Why:** TDD GREEN phase - minimal implementation makes test pass

---

### Step 6: Write test for setGridColumns action

**File:** `frontend/src/stores/tableSettingsStore.test.ts`

**Action:** Add test to "Grid Columns (Task #33)" describe block:

```typescript
it('changes grid columns via setGridColumns', () => {
  const { result } = renderHook(() => useTableSettingsStore())

  // Test all valid values (2, 3, 4, 5)
  act(() => {
    result.current.setGridColumns(5)
  })
  expect(result.current.gridColumns).toBe(5)

  act(() => {
    result.current.setGridColumns(2)
  })
  expect(result.current.gridColumns).toBe(2)

  act(() => {
    result.current.setGridColumns(4)
  })
  expect(result.current.gridColumns).toBe(4)
})
```

**Why:**
- Tests all boundary values (2 min, 5 max) and middle value (4)
- Verifies action updates state correctly
- Follows existing pattern from "View Mode" tests (lines 192-206)

---

### Step 7: Run test to verify it passes

**Command:**
```bash
cd frontend && npm test -- tableSettingsStore.test.ts
```

**Expected Output:**
```
PASS  src/stores/tableSettingsStore.test.ts
  Grid Columns (Task #33)
    ✓ defaults to 3 columns (balanced layout)
    ✓ changes grid columns via setGridColumns

Tests: 26 passed, 26 total
```

**Why:** Action already implemented in Step 4, test confirms it works

---

### Step 8: Write test for localStorage persistence

**File:** `frontend/src/stores/tableSettingsStore.test.ts`

**Action:** Add test to "Grid Columns (Task #33)" describe block:

```typescript
it('persists gridColumns to localStorage', () => {
  const { result } = renderHook(() => useTableSettingsStore())

  act(() => {
    result.current.setGridColumns(4)
  })

  // Unmount and remount to test persistence (simulates page reload)
  const { result: result2 } = renderHook(() => useTableSettingsStore())
  expect(result2.current.gridColumns).toBe(4)
})
```

**Why:**
- Verifies persist middleware works for new field
- Uses "unmount and remount" pattern from existing tests (line 215-217)
- Simulates real user experience (page reload preserves setting)

---

### Step 9: Run test to verify it passes

**Command:**
```bash
cd frontend && npm test -- tableSettingsStore.test.ts
```

**Expected Output:**
```
PASS  src/stores/tableSettingsStore.test.ts
  Grid Columns (Task #33)
    ✓ defaults to 3 columns (balanced layout)
    ✓ changes grid columns via setGridColumns
    ✓ persists gridColumns to localStorage

Tests: 27 passed, 27 total
```

**Why:** Persist middleware automatically persists new field (no config changes needed)

---

### Step 10: Write regression test (verify existing fields still work)

**File:** `frontend/src/stores/tableSettingsStore.test.ts`

**Action:** Add test to "Grid Columns (Task #33)" describe block:

```typescript
it('works independently with all other settings (regression test)', () => {
  const { result } = renderHook(() => useTableSettingsStore())

  // Set multiple fields including gridColumns
  act(() => {
    result.current.setGridColumns(5)
    result.current.setViewMode('grid')
    result.current.setThumbnailSize('large')
    result.current.toggleColumn('duration')
  })

  // Verify ALL fields updated correctly
  expect(result.current.gridColumns).toBe(5)
  expect(result.current.viewMode).toBe('grid')
  expect(result.current.thumbnailSize).toBe('large')
  expect(result.current.visibleColumns.duration).toBe(false)
  expect(result.current.visibleColumns.title).toBe(true) // Unchanged

  // Verify localStorage persisted ALL fields
  const stored = JSON.parse(localStorage.getItem('video-table-settings') || '{}')
  expect(stored.state.gridColumns).toBe(5)
  expect(stored.state.viewMode).toBe('grid')
  expect(stored.state.thumbnailSize).toBe('large')
  expect(stored.state.visibleColumns.duration).toBe(false)
})
```

**Why:**
- **CRITICAL:** Verifies extension doesn't break existing functionality
- Tests independence: gridColumns works alongside viewMode, thumbnailSize, visibleColumns
- Validates localStorage persists ALL fields correctly (not just gridColumns)
- Follows REF MCP Improvement #2: Test with existing fields, not in isolation

---

### Step 11: Run test to verify it passes

**Command:**
```bash
cd frontend && npm test -- tableSettingsStore.test.ts
```

**Expected Output:**
```
PASS  src/stores/tableSettingsStore.test.ts
  Grid Columns (Task #33)
    ✓ defaults to 3 columns (balanced layout)
    ✓ changes grid columns via setGridColumns
    ✓ persists gridColumns to localStorage
    ✓ works independently with all other settings (regression test)

Test Suites: 1 passed, 1 total
Tests: 28 passed, 28 total (4 new + 24 existing)
```

**Why:** Confirms extension is complete and doesn't break existing features

---

### Step 12: Run full test suite (verify no regressions elsewhere)

**Command:**
```bash
cd frontend && npm test
```

**Expected Output:**
```
Test Files  X passed (X total)
     Tests  Y passed (Y total including 28 tableSettingsStore tests)
```

**Why:**
- Ensures store extension doesn't break components using the store
- VideosPage, ViewModeToggle, VideoCard, VideoGrid tests should still pass
- Comprehensive regression check

---

### Step 13: Type check (verify no TypeScript errors)

**Command:**
```bash
cd frontend && npx tsc --noEmit
```

**Expected Output:**
```
(Same pre-existing errors as before, NO new errors)
```

**Why:**
- Verifies type additions are correct
- Ensures `GridColumnCount` type is properly used
- Confirms no `any` types introduced

---

### Step 14: Update barrel export (optional but recommended)

**File:** `frontend/src/stores/index.ts` (create if doesn't exist)

**Action:**

```typescript
/**
 * Barrel export for all store modules
 * Provides clean import path for store hooks and types
 */
export {
  useTableSettingsStore,
  type GridColumnCount,
  type ViewMode,
  type ThumbnailSize,
  type VisibleColumns
} from './tableSettingsStore'
```

**Why:**
- Enables clean imports: `import { useTableSettingsStore, type GridColumnCount } from '@/stores'`
- Consolidates all store-related types in one place
- Follows REF MCP Improvement #4: Consistent type export pattern
- Future-proof: Easy to add more stores (tagStore, filterStore, etc.)

**Note:** If you add barrel export, update imports in components:
```typescript
// Before:
import { useTableSettingsStore } from './stores/tableSettingsStore'

// After (cleaner):
import { useTableSettingsStore, type GridColumnCount } from '@/stores'
```

---

### Step 15: Manual testing (verify in browser)

**Commands:**
```bash
# Ensure dev server is running
cd frontend && npm run dev
```

**Browser Testing:**
1. Open DevTools → Application → Local Storage → `http://localhost:5173`
2. Find key: `video-table-settings`
3. Inspect value → `state` object should have:
   - `gridColumns: 3` (default)
   - `viewMode: "list"`
   - `thumbnailSize: "small"`
   - `visibleColumns: { thumbnail: true, title: true, duration: true, actions: true }`

**Console Testing:**
```javascript
// In browser console:
const store = window.__ZUSTAND_STORES__?.['video-table-settings'] ||
              JSON.parse(localStorage.getItem('video-table-settings'))

console.log(store.state.gridColumns) // Should be 3

// Change value via React DevTools or by importing store:
// (Note: This won't work in console, just for illustration)
// import { useTableSettingsStore } from './stores/tableSettingsStore'
// useTableSettingsStore.getState().setGridColumns(5)
```

**Why:**
- Validates real browser behavior
- Confirms localStorage structure is correct
- Ensures persist middleware works in actual environment

---

### Step 16: Commit changes

**Command:**
```bash
git add frontend/src/stores/
git commit -m "$(cat <<'EOF'
feat(store): extend tableSettingsStore with gridColumns state (Task #33)

Extend existing Zustand store (from Task #32) with gridColumns field
to enable dynamic grid column control. Foundation for GridColumnControl
component (Task #34) and VideoGrid dynamic columns (Task #35).

Changes:
- Add GridColumnCount type (2 | 3 | 4 | 5) with comprehensive JSDoc
- Extend TableSettingsStore interface with gridColumns field
- Add setGridColumns action (follows existing pattern)
- Add 4 new tests (default, action, persistence, regression)
- Add barrel export for clean imports (stores/index.ts)
- All 28 tests passing (24 existing + 4 new)
- Zero TypeScript errors
- localStorage persistence verified

Technical Details:
- Default: gridColumns = 3 (balanced, matches YouTube grid default)
- Type: Union type (2 | 3 | 4 | 5) for compile-time safety
- Persistence: Zustand persist middleware (automatic, no config changes)
- Independence: Works alongside viewMode, thumbnailSize, visibleColumns
- Storage key: 'video-table-settings' (unchanged)

Responsive Strategy (to be implemented in Task #35):
- Mobile: 1-2 cols (CSS override)
- Tablet: Max 3 cols (CSS override)
- Desktop: User's full choice (2-5)

Next Tasks:
- Task #34: Create GridColumnControl dropdown component (UI to change setting)
- Task #35: Update VideoGrid to read gridColumns from store (replace hardcoded classes)

Related: Task #33 (Grid Column Control Implementation Plan)
Parent: docs/plans/2025-11-04-grid-column-control-implementation.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

**Why:**
- Atomic commit (single feature, fully tested)
- Descriptive message explains what, why, and how
- References task number and parent plan for traceability
- Includes technical details for future reference
- Documents next steps for context

---

## 🧪 Testing Strategy

**Test Coverage (4 new tests):**

1. **Default Value Test** (Step 1)
   - Verifies `gridColumns` initializes to 3
   - Validates default aligns with YouTube grid standard

2. **Action Test** (Step 6)
   - Verifies `setGridColumns` updates state correctly
   - Tests all valid values (2, 3, 4, 5)
   - Validates boundaries (min: 2, max: 5)

3. **Persistence Test** (Step 8)
   - Verifies localStorage stores gridColumns
   - Simulates page reload (unmount/remount pattern)
   - Validates persist middleware works for new field

4. **Regression Test** (Step 10) - **CRITICAL**
   - Verifies existing features (viewMode, thumbnailSize, visibleColumns) still work
   - Tests all fields together (independence validation)
   - Validates localStorage persists ALL fields correctly
   - Prevents "extension breaks existing functionality" bugs

**Test Pattern:**
- Uses `renderHook` from @testing-library/react (existing pattern)
- Uses `act()` for state updates (React 18 compliance)
- Uses `beforeEach` with `persist.clearStorage()` for isolation
- Follows existing test structure (consistency with Task #32 tests)

**Manual Testing Checklist:**
- [ ] DevTools → Local Storage shows `gridColumns: 3`
- [ ] Change to 5, reload page → value persists
- [ ] Other fields (viewMode, thumbnailSize) still persist correctly
- [ ] No console errors or warnings

---

## 🔗 Related Files

**Modified:**
- `frontend/src/stores/tableSettingsStore.ts` (+28 lines)
  - Add `GridColumnCount` type (1 line + JSDoc)
  - Extend `TableSettingsStore` interface (+2 fields)
  - Add state field: `gridColumns: 3` (+1 line)
  - Add action: `setGridColumns` (+1 line)

- `frontend/src/stores/tableSettingsStore.test.ts` (+38 lines)
  - Add "Grid Columns (Task #33)" describe block
  - Add 4 new tests (default, action, persistence, regression)

**Created:**
- `frontend/src/stores/index.ts` (NEW, +9 lines)
  - Barrel export for store hooks and types

**Dependencies:**
- Zustand v4.5.0 (already installed, no changes)
- Zustand persist middleware (already configured, no changes)
- localStorage (browser API, no install needed)
- Vitest (already configured, no changes)

**Next Tasks (use gridColumns state):**
- Task #34: Create GridColumnControl dropdown component
  - Reads `gridColumns` from store
  - Calls `setGridColumns` on user selection
  - Shows current value as selected option

- Task #35: Update VideoGrid component
  - Replace hardcoded `grid-cols-2 md:grid-cols-3 lg:grid-cols-4`
  - Use dynamic className based on `gridColumns` value
  - Implement PurgeCSS-safe object mapping pattern
  - Add responsive overrides (mobile/tablet max columns)

**Files that will USE gridColumns (future tasks):**
- `frontend/src/components/GridColumnControl.tsx` (Task #34) - dropdown UI
- `frontend/src/components/VideoGrid.tsx` (Task #35) - dynamic grid classes

---

## 📝 Design Decisions

### Decision 1: Store Extension vs Separate GridSettingsStore

**Alternatives:**
- A: Extend existing `tableSettingsStore` (chosen)
- B: Create separate `gridSettingsStore`
- C: Add to component-level useState

**Rationale:**
- Grid settings are UI preferences like thumbnailSize and viewMode (same category)
- Single source of truth for all display settings (easier to manage)
- Already have localStorage persistence infrastructure (no duplication)
- gridColumns conceptually related to viewMode (both affect layout)

**Trade-offs:**
- Extension: Slightly larger store, but better cohesion
- Separate store: More modular, but more localStorage keys and duplication

**Validation:** Existing store has viewMode (list/grid) so gridColumns logically belongs there

---

### Decision 2: GridColumnCount Type (2 | 3 | 4 | 5)

**Alternatives:**
- A: `type GridColumnCount = 2 | 3 | 4 | 5` (chosen)
- B: `type GridColumnCount = number` with runtime validation
- C: `enum GridColumnCount { Two = 2, Three = 3, Four = 4, Five = 5 }`

**Rationale:**
- Union type enforces valid values at compile time (type safety)
- Matches existing pattern: `ThumbnailSize = 'small' | 'medium' | 'large' | 'xlarge'`
- No runtime validation needed (TypeScript prevents invalid values)
- More concise than enum for small fixed set
- Number type allows invalid values (0, 1, 6, 100, -1)

**Trade-offs:**
- Union type: Simple, type-safe, idiomatic (matches codebase)
- Number: More flexible but no safety (requires runtime checks)
- Enum: More verbose but potentially more descriptive

**Validation:** REF MCP docs recommend union types for small fixed sets (compile-time safety)

---

### Decision 3: Default Value (3 columns)

**Alternatives:**
- A: 3 columns (chosen)
- B: 4 columns (more compact)
- C: 2 columns (fewer items, larger cards)

**Rationale:**
- 3 columns matches YouTube grid default (user familiarity)
- Balanced: Not too wide (2 cols), not too narrow (4-5 cols)
- Matches current `md:grid-cols-3` responsive breakpoint (consistency)
- Desktop users see ~9-12 videos without scrolling (good first impression)
- Readable on laptop screens (1366px+, most common resolution)

**Trade-offs:**
- 3 cols: Best balance for most screen sizes and content density
- 4 cols: More videos visible, but cards get small on <1600px screens
- 2 cols: Very comfortable viewing, but wastes space on large screens

**Validation:** User can override via GridColumnControl (Task #34) - default should fit 80% use case

---

### Decision 4: Independence from viewMode

**Alternatives:**
- A: gridColumns independent of viewMode (chosen)
- B: gridColumns only applies when viewMode = 'grid'
- C: gridColumns resets to default when switching viewMode

**Rationale:**
- User might switch between list/grid frequently (preserve column preference)
- Simpler mental model: "I like 4 columns" (doesn't change when toggling views)
- Follows existing pattern: thumbnailSize is independent of viewMode (Task #32)
- State management simpler: No conditional logic needed

**Trade-offs:**
- Independence: User preference persists (better UX for frequent view switchers)
- Conditional: Slightly more intuitive (grid columns only matter in grid view)
- Reset on toggle: Simpler but annoying (user has to re-select column count)

**Validation:** Task #32 made viewMode independent from thumbnailSize (REF MCP Improvement #1)

---

### Decision 5: Range (2-5 columns vs 2-4 columns)

**Alternatives:**
- A: 2-5 columns (chosen)
- B: 2-4 columns (matches current CSS)
- C: 2-6 columns (more options)

**Rationale:**
- 5 columns useful for power users with large monitors (1920px+)
- Matches common grid patterns (Pinterest allows 5-7 cols on wide screens)
- Minimal CSS addition in Task #35 (just add `lg:grid-cols-5` case)
- 6+ columns gets too narrow (cards become unreadable)

**Trade-offs:**
- 2-5 cols: Good range for most users, requires new CSS in Task #35
- 2-4 cols: Matches current CSS, but limits power users
- 2-6 cols: More options, but 6 cols likely too narrow

**Validation:** Current VideoGrid CSS has `lg:grid-cols-4` - extending to 5 is straightforward

---

### Decision 6: Responsive Behavior Strategy

**Current VideoGrid CSS (VideoGrid.tsx:46):**
```tsx
className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
```

**New Strategy (to be implemented in Task #35):**
- Mobile (<768px): Force 1-2 cols (ignore gridColumns, CSS override)
- Tablet (768-1024px): Force max 3 cols (ignore gridColumns if >3, CSS override)
- Desktop (>1024px): Use user's gridColumns value (2-5)

**Rationale:**
- Mobile: Narrow screen, 3+ cols unreadable (always override)
- Tablet: Medium screen, 4+ cols too cramped (cap at 3)
- Desktop: Wide screen, user has full control (respect preference)

**Implementation (Task #35):**
```typescript
const { gridColumns } = useTableSettingsStore()

const gridClass = {
  2: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
  5: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5',
}[gridColumns]
```

**Why Documented in Task #33:**
- Explains why type includes 5 (even though current CSS doesn't support it)
- Clarifies Task #33 is STATE only, Task #35 is IMPLEMENTATION
- Prevents "wait, CSS doesn't have grid-cols-5 yet" confusion

---

## 📊 Estimated Time

**Total:** 35-45 minutes

**Breakdown:**
- Steps 1-2 (Write/run failing test): 3 min
- Steps 3-5 (Add type, extend interface, implement): 10 min
- Steps 6-7 (Action test): 3 min
- Steps 8-9 (Persistence test): 3 min
- Steps 10-11 (Regression test): 5 min
- Step 12 (Full test suite): 2 min
- Step 13 (Type check): 1 min
- Step 14 (Barrel export): 3 min
- Step 15 (Manual testing): 5 min
- Step 16 (Commit): 5 min

**Dependencies:** None (all dependencies already installed and configured)

**Parallel Work Possible:** No (each step depends on previous step completing)

---

## ✅ Completion Checklist

**Code Changes:**
- [ ] `GridColumnCount` type added with JSDoc
- [ ] `TableSettingsStore` interface extended with gridColumns field
- [ ] `setGridColumns` action implemented
- [ ] Default value `gridColumns: 3` added to store state
- [ ] Barrel export created (`frontend/src/stores/index.ts`)

**Testing:**
- [ ] 4 new tests added (default, action, persistence, regression)
- [ ] All 28 tests passing (24 existing + 4 new)
- [ ] Full test suite passing (no regressions in other components)
- [ ] TypeScript compiles with no new errors
- [ ] Manual browser testing completed

**Verification:**
- [ ] localStorage contains `gridColumns: 3` by default
- [ ] Changing value persists across page reload
- [ ] Existing fields (viewMode, thumbnailSize, visibleColumns) still work
- [ ] No console errors or warnings

**Documentation:**
- [ ] JSDoc comments comprehensive (type, interface, fields)
- [ ] Commit message descriptive with context
- [ ] Task #33 plan marked complete in status.md

**Ready for Next Task:**
- [ ] `GridColumnCount` type exported and usable in components
- [ ] `useTableSettingsStore` returns gridColumns and setGridColumns
- [ ] Task #34 (GridColumnControl component) can begin

---

## 🎓 Key Learnings (for Future Tasks)

### Pattern: Extending Zustand Persist Store

**What we learned:**
- Adding new fields to existing Zustand store with persist middleware is trivial
- No persist config changes needed (middleware automatically persists new fields)
- Existing persisted data merges with new fields (users don't lose settings)
- Type safety ensures all code using store updates automatically

**How to do it:**
1. Add type for new field (union type for fixed values)
2. Extend store interface with field and action
3. Add state field with default value
4. Add action (usually one-liner: `set({ field: value })`)
5. Done! persist middleware handles the rest

**Common Pitfalls:**
- Forgetting to add field to interface (TypeScript error)
- Using wrong localStorage key in tests (different key = test fails)
- Not testing regression (existing features break but tests don't catch it)

### Pattern: Regression Testing for Store Extensions

**Why Critical:**
- Store is global state (many components depend on it)
- Extension could accidentally break existing functionality
- localStorage merge could fail and lose user settings
- Type changes could break component imports

**How to Test:**
- One test that uses ALL fields together (gridColumns + viewMode + thumbnailSize + visibleColumns)
- Verify localStorage persists ALL fields (not just new one)
- Run full test suite (not just store tests)
- Type check to catch interface mismatches

### Pattern: Union Types for Fixed Value Sets

**When to use:**
- Small fixed set of values (2-7 options)
- Values are numeric or string literals
- Compile-time validation desired

**Why better than:**
- `number`: No type safety (allows 0, -1, 100, etc.)
- `enum`: More verbose for small sets
- Runtime validation: Slower, requires error handling

**Example:**
```typescript
// ✅ Good: Union type (compile-time safety)
type GridColumnCount = 2 | 3 | 4 | 5
const cols: GridColumnCount = 3 // ✓
const cols: GridColumnCount = 6 // ✗ TypeScript error

// ❌ Bad: Number (no safety)
type GridColumnCount = number
const cols: GridColumnCount = 99 // ✓ (but invalid!)
```

---

## 📋 REF MCP Improvements Applied

**Improvement #1: Store Extension (not Creation)** ✅
- Plan correctly identifies store already exists
- Extends interface instead of rewriting entire store
- Preserves existing fields (viewMode, thumbnailSize, visibleColumns)

**Improvement #2: Regression Testing** ✅
- Test #4 verifies existing features still work
- Tests ALL fields together (not gridColumns in isolation)
- Validates localStorage persists all fields correctly

**Improvement #3: Correct Storage Key** ✅
- Uses `'video-table-settings'` (existing key, not `'youtube-bookmarks-table-settings'`)
- Tests check actual localStorage with correct key
- Prevents "test fails because wrong key" mystery

**Improvement #4: Type Export Consistency** ✅
- Barrel export added for all store types
- Enables clean imports: `import { type GridColumnCount } from '@/stores'`
- All types exported in one place (consistent pattern)

**Improvement #5: Default Value Rationale** ✅
- Default 3 matches YouTube grid default (not arbitrary)
- JSDoc explains why 3 (balanced, readable, matches breakpoints)
- Documented research validates decision

**Improvement #6: Responsive Behavior Documented** ✅
- Type includes 5 even though CSS doesn't support it yet
- JSDoc explains responsive strategy (mobile/tablet override, desktop full control)
- Clear Task #33 is STATE, Task #35 is IMPLEMENTATION

**Improvement #7: Integration Path Documented** ✅
- Clear sequence: Task #33 (state) → Task #34 (control UI) → Task #35 (VideoGrid usage)
- Documents which files will use gridColumns
- Explains how VideoGrid will change (hardcoded → dynamic)

---

**Plan Complete:** Ready for implementation with TDD approach
**Estimated Time:** 35-45 minutes
**Next Task After #33:** Task #34 (Create GridColumnControl dropdown component)
