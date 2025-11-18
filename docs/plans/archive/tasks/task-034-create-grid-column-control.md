# Task #34: Create GridColumnControl Component

**Plan Task:** #34
**Wave/Phase:** Wave 2 UI Cleanup - Grid View Enhancement
**Dependencies:** Task #33 (tableSettingsStore with gridColumns state)

---

## 🎯 Ziel

Create a dropdown component within TableSettingsDropdown to control the number of grid columns (2, 3, 4, 5). The control should only be visible when in grid view mode and should integrate seamlessly with the existing settings dropdown following established patterns from Task #26.

**Expected Result:** User can open settings dropdown in grid view, see "Spaltenanzahl" section with 4 radio options, select a column count, and see the grid immediately update to the chosen layout.

## 📋 Acceptance Criteria

- [ ] GridColumnControl section appears in TableSettingsDropdown only when viewMode === 'grid'
- [ ] 4 radio options (2, 3, 4, 5 Spalten) with descriptive labels
- [ ] Current gridColumns value is highlighted (radio checked state)
- [ ] Clicking an option updates tableSettingsStore.gridColumns immediately
- [ ] VideoGrid component receives updated gridColumns prop and re-renders
- [ ] Settings persist to localStorage (automatic via Zustand persist middleware)
- [ ] Keyboard navigation works (Arrow keys, Enter/Space, Tab)
- [ ] ARIA labels present for screen readers
- [ ] All tests passing (unit + integration)
- [ ] TypeScript strict mode (no any types)

---

## 🔍 REF MCP Validation Results

### ✅ Pattern 1: Radix UI RadioGroup API (2024)
**Source:** Radix UI DropdownMenu documentation
**Finding:** RadioGroup accepts `value` (string) and `onValueChange` (string => void)
**Implication:** Must convert GridColumnCount (number) to string for Radix API, then parse back to number
**Implementation:**
```tsx
// Convert number to string for Radix API
<DropdownMenuRadioGroup
  value={String(gridColumns)}
  onValueChange={(value) => {
    const parsed = parseInt(value, 10)
    if (parsed === 2 || parsed === 3 || parsed === 4 || parsed === 5) {
      setGridColumns(parsed)
    }
  }}
>
```

### ✅ Pattern 2: Reuse TableSettingsDropdown (Task #26)
**Source:** Existing implementation `frontend/src/components/TableSettingsDropdown.tsx`
**Finding:** Component already has Thumbnail Size section with RadioGroup pattern
**Implication:** Add new section AFTER Thumbnail Size, BEFORE Column Visibility
**Layout Order:**
1. Thumbnail-Größe (existing)
2. **Spaltenanzahl (NEW - only visible in grid view)**
3. Separator
4. Sichtbare Spalten (existing)

### ✅ Pattern 3: Conditional Rendering with viewMode
**Source:** Task #32 implementation (ViewModeToggle pattern)
**Finding:** Components can access viewMode from tableSettingsStore
**Implication:** Use conditional rendering `{viewMode === 'grid' && <GridColumnSection />}`
**Rationale:** Grid columns are meaningless in list view, avoid user confusion

### ⚠️ Pattern 4: Runtime Validation (Task #26 REF MCP Improvement #1)
**Source:** TableSettingsDropdown handleThumbnailSizeChange pattern
**Finding:** Type guards prevent invalid string values from Radix API
**Implication:** MUST validate parsed number before calling setGridColumns
**Anti-Pattern:** `setGridColumns(parseInt(value, 10) as GridColumnCount)` (type casting = bad!)
**Correct Pattern:**
```tsx
const parsed = parseInt(value, 10)
if (parsed === 2 || parsed === 3 || parsed === 4 || parsed === 5) {
  setGridColumns(parsed) // TypeScript knows parsed is GridColumnCount
}
```

### ✅ Pattern 5: Descriptive Labels (German Localization)
**Source:** Existing component German labels ("Klein", "Mittel", "Groß")
**Labels:**
- `2` → "2 Spalten (Breit)"
- `3` → "3 Spalten (Standard)"
- `4` → "4 Spalten (Kompakt)"
- `5` → "5 Spalten (Dicht)"
**Rationale:** "Standard" clarifies default value, adjectives explain visual effect

### ✅ Pattern 6: useShallow Optimization (Task #20 REF MCP)
**Source:** React Query + Zustand best practices 2024
**Finding:** Prevent unnecessary re-renders when only one field needed
**Implementation:**
```tsx
import { useShallow } from 'zustand/react/shallow'

const { viewMode, gridColumns, setGridColumns } = useTableSettingsStore(
  useShallow((state) => ({
    viewMode: state.viewMode,
    gridColumns: state.gridColumns,
    setGridColumns: state.setGridColumns,
  }))
)
```

---

## 🛠️ Implementation Steps

### Step 1: Update TableSettingsDropdown imports
**Files:** `frontend/src/components/TableSettingsDropdown.tsx`
**Action:** Add GridColumnCount type and useShallow hook imports

**Code:**
```tsx
// Add to existing imports (line 27-28)
import { useShallow } from 'zustand/react/shallow'
import type { ThumbnailSize, GridColumnCount, ViewMode } from '@/stores'
```

**Why:** Need GridColumnCount type for type-safe validation, ViewMode for conditional rendering, useShallow for performance optimization

---

### Step 2: Update useTableSettingsStore hook to include viewMode + gridColumns
**Files:** `frontend/src/components/TableSettingsDropdown.tsx`
**Action:** Replace single-line hook with useShallow selector pattern

**Code (line 31):**
```tsx
// BEFORE (single-line):
const { thumbnailSize, setThumbnailSize, visibleColumns, toggleColumn } = useTableSettingsStore();

// AFTER (useShallow selector):
const { thumbnailSize, setThumbnailSize, visibleColumns, toggleColumn, viewMode, gridColumns, setGridColumns } = useTableSettingsStore(
  useShallow((state) => ({
    thumbnailSize: state.thumbnailSize,
    setThumbnailSize: state.setThumbnailSize,
    visibleColumns: state.visibleColumns,
    toggleColumn: state.toggleColumn,
    viewMode: state.viewMode,
    gridColumns: state.gridColumns,
    setGridColumns: state.setGridColumns,
  }))
)
```

**Why:**
- useShallow prevents re-renders when other store fields change
- viewMode needed for conditional rendering
- gridColumns + setGridColumns for RadioGroup binding

---

### Step 3: Add handleGridColumnsChange type-safe handler
**Files:** `frontend/src/components/TableSettingsDropdown.tsx`
**Action:** Add validation handler after handleThumbnailSizeChange (line 42)

**Code:**
```tsx
// Add after handleThumbnailSizeChange function (line 42)

// REF MCP Improvement #4: Runtime validation for GridColumnCount
const handleGridColumnsChange = (value: string) => {
  const parsed = parseInt(value, 10)
  // Type guard - TypeScript narrows type automatically
  if (parsed === 2 || parsed === 3 || parsed === 4 || parsed === 5) {
    setGridColumns(parsed) // TypeScript knows parsed is GridColumnCount here
  } else {
    console.warn(`Invalid grid column count: ${value}`)
  }
}
```

**Why:**
- Radix RadioGroup onValueChange passes string, not number
- Runtime validation prevents invalid values (0, 1, 6, 99, "abc")
- Type guard narrows type from number to GridColumnCount (no type casting!)

---

### Step 4: Add Grid Column Count section to dropdown
**Files:** `frontend/src/components/TableSettingsDropdown.tsx`
**Action:** Insert new section AFTER Thumbnail Size, BEFORE Column Visibility separator

**Code (insert after line 62, BEFORE separator at line 65):**
```tsx
{/* Grid Column Count Section - Only visible in grid view (REF MCP Pattern #3) */}
{viewMode === 'grid' && (
  <>
    <DropdownMenuSeparator />
    <DropdownMenuLabel>Spaltenanzahl</DropdownMenuLabel>
    <DropdownMenuRadioGroup
      value={String(gridColumns)} // Convert number to string for Radix API
      onValueChange={handleGridColumnsChange}
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
  </>
)}
```

**Why:**
- Conditional rendering: Grid columns only relevant in grid view
- Separator: Visual distinction from Thumbnail Size section (REF MCP Pattern #2)
- String conversion: Radix RadioGroup API requires string values
- Descriptive labels: "(Breit)", "(Standard)", etc. explain visual effect
- "(Standard)": Clarifies default value (3) for new users

**Layout Order (REF MCP Pattern #2):**
1. Thumbnail-Größe (existing)
2. Spaltenanzahl (NEW - grid view only)
3. Separator
4. Sichtbare Spalten (existing)

---

### Step 5: Write failing test for conditional rendering
**Files:** `frontend/src/components/TableSettingsDropdown.test.tsx`
**Action:** Create test file with conditional visibility test

**Code:**
```tsx
// frontend/src/components/TableSettingsDropdown.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TableSettingsDropdown } from './TableSettingsDropdown'
import { useTableSettingsStore } from '@/stores'

// Mock store with viewMode control
vi.mock('@/stores', () => ({
  useTableSettingsStore: vi.fn(),
}))

describe('TableSettingsDropdown - Grid Column Control', () => {
  const mockSetGridColumns = vi.fn()
  const mockSetThumbnailSize = vi.fn()
  const mockToggleColumn = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not show grid column control when viewMode is list', () => {
    vi.mocked(useTableSettingsStore).mockReturnValue({
      viewMode: 'list',
      thumbnailSize: 'small',
      gridColumns: 3,
      visibleColumns: { thumbnail: true, title: true, duration: true, actions: true },
      setThumbnailSize: mockSetThumbnailSize,
      setGridColumns: mockSetGridColumns,
      toggleColumn: mockToggleColumn,
    } as any)

    render(<TableSettingsDropdown />)

    // Open dropdown
    const trigger = screen.getByRole('button', { name: 'Einstellungen' })
    userEvent.click(trigger)

    // Should NOT show Spaltenanzahl section
    expect(screen.queryByText('Spaltenanzahl')).not.toBeInTheDocument()
    expect(screen.queryByText('2 Spalten (Breit)')).not.toBeInTheDocument()
  })

  it('shows grid column control when viewMode is grid', async () => {
    const user = userEvent.setup()
    vi.mocked(useTableSettingsStore).mockReturnValue({
      viewMode: 'grid',
      thumbnailSize: 'small',
      gridColumns: 3,
      visibleColumns: { thumbnail: true, title: true, duration: true, actions: true },
      setThumbnailSize: mockSetThumbnailSize,
      setGridColumns: mockSetGridColumns,
      toggleColumn: mockToggleColumn,
    } as any)

    render(<TableSettingsDropdown />)

    // Open dropdown
    const trigger = screen.getByRole('button', { name: 'Einstellungen' })
    await user.click(trigger)

    // Should show Spaltenanzahl section
    expect(screen.getByText('Spaltenanzahl')).toBeInTheDocument()
    expect(screen.getByText('2 Spalten (Breit)')).toBeInTheDocument()
    expect(screen.getByText('3 Spalten (Standard)')).toBeInTheDocument()
    expect(screen.getByText('4 Spalten (Kompakt)')).toBeInTheDocument()
    expect(screen.getByText('5 Spalten (Dicht)')).toBeInTheDocument()
  })
})
```

**Expected:** FAIL - "Spaltenanzahl" not found (not implemented yet)

---

### Step 6: Run test to verify it fails
**Files:** N/A (command line)
**Action:** Run test suite to confirm RED state

**Command:**
```bash
cd frontend && npm test -- TableSettingsDropdown.test.tsx
```

**Expected Output:**
```
FAIL  src/components/TableSettingsDropdown.test.tsx
  TableSettingsDropdown - Grid Column Control
    ✓ does not show grid column control when viewMode is list
    ✕ shows grid column control when viewMode is grid

  ● shows grid column control when viewMode is grid
    Unable to find an element with the text: Spaltenanzahl
```

**Why:** TDD RED phase - test fails because feature not implemented yet

---

### Step 7: Implement Steps 1-4 to make test pass
**Files:** `frontend/src/components/TableSettingsDropdown.tsx`
**Action:** Execute Step 1-4 changes

**Verification:**
```bash
cd frontend && npm test -- TableSettingsDropdown.test.tsx
```

**Expected:** PASS - Both tests passing (conditional rendering works)

---

### Step 8: Write test for radio selection + store update
**Files:** `frontend/src/components/TableSettingsDropdown.test.tsx`
**Action:** Add interaction test

**Code:**
```tsx
it('updates store when grid column option is selected', async () => {
  const user = userEvent.setup()
  vi.mocked(useTableSettingsStore).mockReturnValue({
    viewMode: 'grid',
    thumbnailSize: 'small',
    gridColumns: 3, // Currently 3
    visibleColumns: { thumbnail: true, title: true, duration: true, actions: true },
    setThumbnailSize: mockSetThumbnailSize,
    setGridColumns: mockSetGridColumns,
    toggleColumn: mockToggleColumn,
  } as any)

  render(<TableSettingsDropdown />)

  // Open dropdown
  const trigger = screen.getByRole('button', { name: 'Einstellungen' })
  await user.click(trigger)

  // Select 5 columns
  const option5 = screen.getByText('5 Spalten (Dicht)')
  await user.click(option5)

  // Verify store was updated with number 5 (not string "5")
  expect(mockSetGridColumns).toHaveBeenCalledWith(5)
  expect(mockSetGridColumns).toHaveBeenCalledTimes(1)
})
```

**Expected:** PASS (implementation from Step 3 handles this)

---

### Step 9: Write test for checked state (current value highlighted)
**Files:** `frontend/src/components/TableSettingsDropdown.test.tsx`
**Action:** Add visual state test

**Code:**
```tsx
it('highlights current grid column count', async () => {
  const user = userEvent.setup()
  vi.mocked(useTableSettingsStore).mockReturnValue({
    viewMode: 'grid',
    thumbnailSize: 'small',
    gridColumns: 4, // Current value is 4
    visibleColumns: { thumbnail: true, title: true, duration: true, actions: true },
    setThumbnailSize: mockSetThumbnailSize,
    setGridColumns: mockSetGridColumns,
    toggleColumn: mockToggleColumn,
  } as any)

  render(<TableSettingsDropdown />)

  // Open dropdown
  const trigger = screen.getByRole('button', { name: 'Einstellungen' })
  await user.click(trigger)

  // Find radio item for 4 columns
  const option4 = screen.getByText('4 Spalten (Kompakt)').closest('[role="menuitemradio"]')

  // Should have checked state
  expect(option4).toHaveAttribute('data-state', 'checked')
})
```

**Expected:** PASS (Radix RadioGroup handles checked state automatically)

---

### Step 10: Write test for invalid value handling
**Files:** `frontend/src/components/TableSettingsDropdown.test.tsx`
**Action:** Add edge case test

**Code:**
```tsx
it('does not update store with invalid column count', async () => {
  const user = userEvent.setup()
  const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

  vi.mocked(useTableSettingsStore).mockReturnValue({
    viewMode: 'grid',
    thumbnailSize: 'small',
    gridColumns: 3,
    visibleColumns: { thumbnail: true, title: true, duration: true, actions: true },
    setThumbnailSize: mockSetThumbnailSize,
    setGridColumns: mockSetGridColumns,
    toggleColumn: mockToggleColumn,
  } as any)

  render(<TableSettingsDropdown />)

  // Simulate invalid value from corrupted localStorage or API
  const { handleGridColumnsChange } = require('./TableSettingsDropdown')
  handleGridColumnsChange('99') // Invalid value

  // Should NOT call setGridColumns
  expect(mockSetGridColumns).not.toHaveBeenCalled()

  // Should log warning
  expect(consoleWarnSpy).toHaveBeenCalledWith('Invalid grid column count: 99')

  consoleWarnSpy.mockRestore()
})
```

**Expected:** PASS (validation in Step 3 handles this)

---

### Step 11: Write integration test in VideosPage
**Files:** `frontend/src/components/VideosPage.integration.test.tsx`
**Action:** Add end-to-end test

**Code:**
```tsx
describe('Grid Column Control Integration', () => {
  it('updates VideoGrid when column count changes via settings dropdown', async () => {
    const user = userEvent.setup()

    // Mock API responses
    server.use(
      http.get('/api/lists/:listId/videos', () => {
        return HttpResponse.json([
          mockVideo({ id: '1', title: 'Video 1' }),
          mockVideo({ id: '2', title: 'Video 2' }),
          mockVideo({ id: '3', title: 'Video 3' }),
        ])
      })
    )

    render(<VideosPage listId="test-list-id" />)

    // Switch to grid view
    const gridButton = screen.getByRole('button', { name: /grid/i })
    await user.click(gridButton)

    // Wait for grid to render
    await waitFor(() => {
      expect(screen.getByRole('list', { name: 'Video Grid' })).toBeInTheDocument()
    })

    // Initial grid should have default 3 columns (grid-cols-3)
    const grid = screen.getByRole('list', { name: 'Video Grid' })
    expect(grid).toHaveClass('lg:grid-cols-3')

    // Open settings dropdown
    const settingsButton = screen.getByRole('button', { name: 'Einstellungen' })
    await user.click(settingsButton)

    // Change to 5 columns
    const option5 = screen.getByText('5 Spalten (Dicht)')
    await user.click(option5)

    // Grid should update to 5 columns
    await waitFor(() => {
      expect(grid).toHaveClass('lg:grid-cols-5')
    })
  })

  it('hides grid column control when switching to list view', async () => {
    const user = userEvent.setup()
    render(<VideosPage listId="test-list-id" />)

    // Switch to grid view
    const gridButton = screen.getByRole('button', { name: /grid/i })
    await user.click(gridButton)

    // Open settings - should show grid column control
    const settingsButton = screen.getByRole('button', { name: 'Einstellungen' })
    await user.click(settingsButton)
    expect(screen.getByText('Spaltenanzahl')).toBeInTheDocument()

    // Close dropdown
    await user.keyboard('{Escape}')

    // Switch to list view
    const listButton = screen.getByRole('button', { name: /list/i })
    await user.click(listButton)

    // Open settings again - should NOT show grid column control
    await user.click(settingsButton)
    expect(screen.queryByText('Spaltenanzahl')).not.toBeInTheDocument()
  })
})
```

**Expected:** PASS (validates end-to-end flow)

---

### Step 12: Run all tests to verify nothing broke
**Files:** N/A (command line)
**Action:** Run full test suite

**Command:**
```bash
cd frontend && npm test
```

**Expected:**
```
Test Files  X passed (X total)
Tests  Y passed (Y total)
```

**Check for regressions:**
- TableSettingsDropdown tests: All passing
- VideosPage integration tests: All passing
- tableSettingsStore tests: All passing (Task #33)
- No new failures in other components

---

### Step 13: Manual testing in browser
**Files:** N/A (browser testing)
**Action:** Verify feature works in real browser

**Test Checklist:**
- [ ] Start dev server: `cd frontend && npm run dev`
- [ ] Navigate to http://localhost:5173/videos
- [ ] Default view is list → Open settings → No "Spaltenanzahl" section visible
- [ ] Switch to grid view → Open settings → "Spaltenanzahl" section appears
- [ ] Default selection is "3 Spalten (Standard)" (checked radio)
- [ ] Click "2 Spalten (Breit)" → Grid updates to 2 columns
- [ ] Click "5 Spalten (Dicht)" → Grid updates to 5 columns
- [ ] Switch to list view → Open settings → "Spaltenanzahl" hidden again
- [ ] Switch back to grid → Grid still shows 5 columns (localStorage persisted)
- [ ] Reload page → Grid still shows 5 columns (localStorage works)
- [ ] Test keyboard navigation: Tab to settings → Enter → Arrow keys to navigate options → Enter to select
- [ ] Test responsive: Resize to tablet width → Grid respects responsive breakpoints

**Why:** Automated tests can't catch visual bugs, layout issues, or UX friction

---

### Step 14: TypeScript strict mode verification
**Files:** N/A (command line)
**Action:** Run type check

**Command:**
```bash
cd frontend && npx tsc --noEmit
```

**Expected:**
```
No errors found.
```

**Common issues to check:**
- No `any` types in new code
- GridColumnCount type narrowing works correctly (no type casting!)
- Radix RadioGroup value prop accepts string (not number)

**If errors:** Fix type issues before committing

---

### Step 15: Commit implementation
**Files:** Multiple
**Action:** Create atomic commit with all changes

**Command:**
```bash
git add frontend/src/components/TableSettingsDropdown.tsx
git add frontend/src/components/TableSettingsDropdown.test.tsx
git add frontend/src/components/VideosPage.integration.test.tsx
git commit -m "feat(ui): add grid column control to settings dropdown (Task #34)

Add Spaltenanzahl section to TableSettingsDropdown for controlling
grid column count (2, 3, 4, 5). Only visible when viewMode === 'grid'.

Implementation:
- Conditional rendering with viewMode check (REF MCP Pattern #3)
- Radix RadioGroup with 4 options (2/3/4/5 Spalten)
- Type-safe value handler with runtime validation (REF MCP Pattern #4)
- useShallow optimization for performance (REF MCP Pattern #6)
- Descriptive German labels with adjectives (Breit/Standard/Kompakt/Dicht)

Testing:
- Unit tests: Conditional visibility, radio selection, checked state, invalid values (4/4 passing)
- Integration tests: End-to-end VideoGrid update, view switching (2/2 passing)
- Manual testing: Verified in Chrome/Safari, keyboard navigation, localStorage persistence

Changes:
- Modified: frontend/src/components/TableSettingsDropdown.tsx (+47 lines)
- Created: frontend/src/components/TableSettingsDropdown.test.tsx (163 lines)
- Modified: frontend/src/components/VideosPage.integration.test.tsx (+54 lines)

Dependencies: Task #33 (gridColumns state in tableSettingsStore)
Next: Task #35 (Update VideoGrid with dynamic gridColumns prop)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

**Why:** Atomic commit with comprehensive message for future reference

---

## 🧪 Testing Strategy

### Unit Tests (TableSettingsDropdown.test.tsx)

**Test 1: Conditional Visibility (List View)**
- **What:** Render dropdown in list view, verify "Spaltenanzahl" NOT visible
- **How:** Mock store with `viewMode: 'list'`, open dropdown, assert queryByText returns null
- **Why:** Grid columns are meaningless in list view, avoid user confusion

**Test 2: Conditional Visibility (Grid View)**
- **What:** Render dropdown in grid view, verify "Spaltenanzahl" visible with 4 options
- **How:** Mock store with `viewMode: 'grid'`, open dropdown, assert all 4 labels exist
- **Why:** Feature should be discoverable when relevant

**Test 3: Radio Selection Updates Store**
- **What:** Click "5 Spalten (Dicht)", verify setGridColumns(5) called
- **How:** userEvent.click(), assert mockSetGridColumns called with number 5 (not string)
- **Why:** Validates Radix → handler → store flow, ensures type conversion works

**Test 4: Checked State Reflects Current Value**
- **What:** Mock gridColumns: 4, verify "4 Spalten (Kompakt)" has checked state
- **How:** Find radio item, assert data-state="checked" attribute
- **Why:** User needs visual feedback of current selection

**Test 5: Invalid Value Handling**
- **What:** Simulate invalid value "99", verify store NOT updated, warning logged
- **How:** Call handler directly, assert setGridColumns not called, console.warn called
- **Why:** Prevents corrupted localStorage or API bugs from crashing app

### Integration Tests (VideosPage.integration.test.tsx)

**Test 6: End-to-End Grid Update**
- **What:** Switch to grid, change columns via dropdown, verify VideoGrid className updates
- **How:** userEvent interactions, waitFor grid className change (lg:grid-cols-3 → lg:grid-cols-5)
- **Why:** Validates full React component tree re-renders correctly

**Test 7: View Switching Hides/Shows Control**
- **What:** Grid view → settings → see control, list view → settings → no control
- **How:** Toggle viewMode multiple times, verify conditional rendering works both ways
- **Why:** Ensures viewMode reactivity, prevents stale UI bugs

### Manual Testing Checklist

**Visual Tests:**
- [ ] Grid columns update smoothly (no layout shift flicker)
- [ ] Radio options align properly in dropdown (not cut off on mobile)
- [ ] Checked radio has visual distinction (blue dot/checkmark)
- [ ] Dropdown closes after selection (Radix default behavior)

**Interaction Tests:**
- [ ] Keyboard navigation: Tab → Arrow keys → Enter works
- [ ] Screen reader: ARIA labels read correctly (VoiceOver/NVDA)
- [ ] Touch targets: Radio options have adequate size on mobile (44×44px minimum)

**Edge Cases:**
- [ ] Corrupted localStorage: Set invalid value, reload, verify fallback to default (3)
- [ ] Rapid clicking: Click multiple options quickly, verify no race conditions
- [ ] Concurrent users: Open in 2 tabs, change in tab 1, verify tab 2 updates (localStorage sync)

---

## 📚 Reference

### Related Docs

**Master Plan:**
- `docs/plans/2025-10-31-ID-05-ux-optimization-implementation-plan.md` - Section: Task 2 (Grid Column Control)

**Implementation Plan:**
- `docs/plans/2025-11-04-grid-column-control-implementation.md` - Task 2 (Create GridColumnControl component)

**Design Document:**
- `docs/plans/2025-11-04-grid-column-control-design.md` - Section: Technical Specification

**External Docs:**
- [Radix UI DropdownMenu RadioGroup API](https://www.radix-ui.com/primitives/docs/components/dropdown-menu#radiogroup) - value prop, onValueChange
- [WAI-ARIA Radio Group Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/radio/) - Keyboard interaction (Arrow keys)
- [Zustand useShallow](https://docs.pmnd.rs/zustand/guides/prevent-rerenders-with-use-shallow) - Performance optimization

### Related Code

**Similar Pattern (Thumbnail Size RadioGroup):**
- File: `frontend/src/components/TableSettingsDropdown.tsx` (lines 54-62)
- Pattern: DropdownMenuRadioGroup with onValueChange handler
- Reuse: Same structure, replace values + labels

**Conditional Rendering Pattern:**
- File: `frontend/src/components/ViewModeToggle.tsx` (lines 20-40)
- Pattern: Display opposite icon based on viewMode state
- Reuse: Same viewMode check for conditional section visibility

**Type Guard Pattern (REF MCP Improvement #1):**
- File: `frontend/src/components/TableSettingsDropdown.tsx` (lines 34-41)
- Pattern: Runtime validation with type narrowing (no type casting)
- Reuse: Adapt for GridColumnCount validation (2/3/4/5)

**useShallow Pattern (REF MCP Improvement #6):**
- File: `frontend/src/components/VideosPage.tsx` (lines 212-220)
- Pattern: Zustand selector with useShallow to prevent re-renders
- Reuse: Same pattern for accessing multiple store fields

### Design Decisions

**Decision 1: Extend TableSettingsDropdown vs. Separate Component**
- **Alternatives:**
  1. Extend TableSettingsDropdown (CHOSEN)
  2. Create separate GridColumnControl component next to ViewModeToggle
  3. Inline in VideosPage toolbar
- **Chosen:** Alternative 1 (Extend TableSettingsDropdown)
- **Rationale:**
  - Groups related settings in one dropdown (UX consistency)
  - Follows Task #26 pattern (Thumbnail Size already in dropdown)
  - Reduces header clutter (only 2 buttons: ViewMode + Settings)
- **Trade-offs:**
  - Pro: Cleaner UI, settings grouped logically
  - Con: Dropdown has more items (risk of scroll on mobile)
  - Mitigation: Conditional rendering (grid columns only in grid view)

**Decision 2: RadioGroup vs. Slider**
- **Alternatives:**
  1. RadioGroup with 4 options (CHOSEN)
  2. Slider with range 2-5
  3. Dropdown select (combobox)
- **Chosen:** Alternative 1 (RadioGroup)
- **Rationale:**
  - Discrete values (2, 3, 4, 5) fit radio pattern better than continuous slider
  - Descriptive labels possible ("Breit", "Standard", etc.) - slider only shows number
  - Accessibility: Radio groups have better screen reader support than sliders
  - Consistency: Thumbnail Size uses RadioGroup, maintain pattern
- **Trade-offs:**
  - Pro: Clearer affordance, better a11y
  - Con: More vertical space (4 items vs. 1 slider)
  - Mitigation: Acceptable in dropdown with scroll

**Decision 3: Conditional Rendering vs. Disabled State**
- **Alternatives:**
  1. Conditional rendering (hide in list view) (CHOSEN)
  2. Show but disable in list view
  3. Always show, warning message in list view
- **Chosen:** Alternative 1 (Conditional rendering)
- **Rationale:**
  - Grid columns are **meaningless** in list view (not temporarily unavailable)
  - Disabled state implies "feature exists but currently locked" - false affordance
  - Reduces cognitive load (fewer options to parse in list view)
- **Trade-offs:**
  - Pro: Cleaner UX, no user confusion
  - Con: Feature less discoverable (user must switch to grid to see option)
  - Mitigation: ViewModeToggle is prominent, grid view is primary use case

**Decision 4: Labels with Adjectives vs. Numbers Only**
- **Alternatives:**
  1. "2 Spalten (Breit)", "3 Spalten (Standard)", etc. (CHOSEN)
  2. "2", "3", "4", "5" only
  3. Icons (1×2 grid, 1×3 grid, etc.)
- **Chosen:** Alternative 1 (Descriptive labels)
- **Rationale:**
  - Adjectives explain visual effect ("Breit" = fewer, wider cards)
  - "(Standard)" clarifies default value (helps new users)
  - German localization consistency (Thumbnail Size uses "Klein", "Mittel", "Groß")
- **Trade-offs:**
  - Pro: Self-explanatory, reduces trial-and-error
  - Con: Longer labels (risk of truncation on mobile)
  - Mitigation: Dropdown has max-width constraint (w-64 max-w-[calc(100vw-2rem)])

**Decision 5: Number → String Conversion for Radix API**
- **Alternatives:**
  1. Convert at component boundary (CHOSEN)
  2. Store gridColumns as string in Zustand
  3. Fork Radix RadioGroup to accept numbers
- **Chosen:** Alternative 1 (Convert at component boundary)
- **Rationale:**
  - gridColumns is semantically a number (used for grid-cols-${N} classes)
  - Radix RadioGroup API requires string (value: string, onValueChange: (value: string) => void)
  - Component boundary conversion keeps store type-safe
- **Trade-offs:**
  - Pro: Store stays type-safe, component adapts to library API
  - Con: Requires parseInt + validation (extra code)
  - Mitigation: Validation prevents corrupted values (REF MCP Pattern #4)

**Decision 6: Runtime Validation with Type Guard (No Type Casting)**
- **Alternatives:**
  1. Type guard with explicit checks (CHOSEN)
  2. Type casting: `setGridColumns(parseInt(value, 10) as GridColumnCount)`
  3. Trust Radix, no validation
- **Chosen:** Alternative 1 (Type guard)
- **Rationale:**
  - REF MCP Pattern #4: Runtime validation + type narrowing (Task #26)
  - Type casting bypasses TypeScript safety (allows invalid values at runtime)
  - Corrupted localStorage or API bugs could inject invalid values
- **Trade-offs:**
  - Pro: Type-safe, prevents runtime crashes
  - Con: More verbose code (4-line if statement)
  - Mitigation: console.warn for debugging

---

## 🚀 Implementation Estimates

**Estimated Time:** 1.5-2 hours

**Breakdown:**
- Step 1-4 (Implementation): 30 minutes
- Step 5-10 (Unit Tests): 30 minutes
- Step 11 (Integration Tests): 20 minutes
- Step 12-13 (Testing): 20 minutes
- Step 14-15 (TypeScript + Commit): 10 minutes

**Complexity:** Medium
- **Why:** Extends existing component (not new from scratch), follows established patterns, conditional rendering adds complexity

**Risks:**
- **Risk 1:** Radix RadioGroup value prop type mismatch (expects string, we have number)
  - **Mitigation:** String conversion + parseInt + validation (Step 3)
- **Risk 2:** Conditional rendering causes dropdown height jump (UX jarring)
  - **Mitigation:** Dropdown already scrollable, user expects content change when switching views
- **Risk 3:** Test failures due to Radix portal rendering (dropdown outside DOM tree)
  - **Mitigation:** Use userEvent.click (handles portal interactions), findByText for async assertions

---

## 🔗 Next Steps

**Task #35: Update VideoGrid with Dynamic gridColumns Prop**

**Prerequisites (completed):**
- ✅ Task #33: gridColumns state in tableSettingsStore
- ✅ Task #34: GridColumnControl in TableSettingsDropdown (this task)

**What's needed:**
- Modify `frontend/src/components/VideoGrid.tsx` to accept gridColumns prop
- Replace hardcoded `grid-cols-4` with dynamic value from store
- **CRITICAL:** Use object mapping for PurgeCSS safety (no template literals!)
- Update VideosPage to pass gridColumns prop to VideoGrid
- Add responsive tests for all 4 column counts

**PurgeCSS Safety Pattern (MUST FOLLOW):**
```tsx
// ❌ WRONG (breaks Production build):
const colsClass = `grid-cols-${gridColumns}`

// ✅ CORRECT (PurgeCSS-safe):
const gridColClasses = {
  2: 'grid grid-cols-2 gap-4 md:gap-6',
  3: 'grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6',
  4: 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6',
  5: 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6',
} as const

<div className={gridColClasses[gridColumns]}>
```

**Reference:** Task #32 Handoff (LOG-032) lines 98-113, 219-238

---

## 📝 Completion Checklist

- [ ] Step 1-4: TableSettingsDropdown extended with GridColumnControl section
- [ ] Step 5-10: Unit tests passing (5/5)
- [ ] Step 11: Integration tests passing (2/2)
- [ ] Step 12: All tests passing (no regressions)
- [ ] Step 13: Manual testing completed (12/12 checks)
- [ ] Step 14: TypeScript strict mode verified (0 errors)
- [ ] Step 15: Commit created with comprehensive message
- [ ] Update status.md: Mark Task #34 complete, add LOG entry
- [ ] Create handoff document: `docs/handoffs/2025-11-04-log-034-grid-column-control.md`

---

**Plan Created:** 2025-11-04
**Estimated Duration:** 1.5-2 hours
**Complexity:** Medium
**Dependencies:** Task #33 (gridColumns state)
**Next Task:** Task #35 (VideoGrid dynamic columns)
