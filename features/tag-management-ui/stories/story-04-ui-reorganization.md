# User Story 04: UI Reorganization - Settings & Filter Buttons

**Feature ID:** FE-001-tag-management-ui
**Story ID:** US-04
**Priority:** Must Have
**Status:** Planned

---

## Story

**As a** user navigating the application
**I want** Settings accessible from the sidebar and Add Filter more prominent in the controls
**So that** I can access settings more easily and add filters more quickly

---

## Acceptance Criteria

### Part A: Settings Button to Sidebar

#### ✅ AC1: Settings Button Removed from Controls Bar
- **Given** I'm on the Videos page
- **When** I view the controls bar (above video grid)
- **Then** I do NOT see the Settings button
- **And** I see: [Add Filter] [View Mode Toggle] [Table Settings]

#### ✅ AC2: Settings Button Added to Sidebar
- **Given** I'm on the Videos page
- **When** I view the sidebar (left side)
- **Then** I see the Settings button at the bottom
- **And** It's below the TagNavigation component
- **And** It has a Settings icon and "Settings" label

#### ✅ AC3: Settings Button Navigation Works
- **Given** Settings button is in sidebar
- **When** I click it
- **Then** I navigate to `/settings/schemas`
- **And** The SettingsPage opens

#### ✅ AC4: Settings Button Accessible on Mobile
- **Given** I'm on mobile (viewport <768px)
- **When** I open the sidebar drawer
- **Then** I see the Settings button at the bottom
- **And** Clicking it navigates to Settings

---

### Part B: Add Filter Button to Controls Bar

#### ✅ AC5: Add Filter Button Removed from FilterBar
- **Given** I'm on the Videos page
- **When** I view the FilterBar (below controls)
- **Then** I do NOT see the "Add Filter" button
- **And** I only see: [Active Filter Badges] [Clear All]

#### ✅ AC6: Add Filter Button Added to Controls Bar
- **Given** I'm on the Videos page
- **When** I view the controls bar
- **Then** I see the "Add Filter" button
- **And** It's in the EXACT position where Settings button was (right side, before View Mode Toggle)

#### ✅ AC7: Add Filter Popover Works
- **Given** Add Filter button is in controls bar
- **When** I click it
- **Then** The filter popover opens
- **And** I can select a field and add a filter
- **And** The filter appears in FilterBar as a badge

#### ✅ AC8: Filter Workflow Unchanged
- **Given** I want to add a filter
- **When** I use the new Add Filter button location
- **Then** The filtering functionality works exactly as before
- **And** No regressions in filter behavior

---

## UX Flow

### Flow A: Accessing Settings (New)

```text
BEFORE:
1. User on Videos page
2. User looks at controls bar (top right)
3. User clicks Settings button
4. Navigate to /settings/schemas

AFTER:
1. User on Videos page
2. User looks at sidebar (left side)
3. User scrolls to bottom of sidebar
4. User clicks Settings button
5. Navigate to /settings/schemas
```

### Flow B: Adding Filter (New)

```text
BEFORE:
1. User on Videos page
2. User looks at FilterBar (below controls)
3. User clicks "Add Filter" button
4. Popover opens
5. User selects field, sets value
6. Filter applied

AFTER:
1. User on Videos page
2. User looks at controls bar (top right)
3. User clicks "Add Filter" button (prominent position)
4. Popover opens
5. User selects field, sets value
6. Filter applied
```

---

## UI Mockup (Before vs After)

### BEFORE:
```text
VideosPage Layout:
┌─────────────────────────────────────────────────┐
│ Sidebar         │  Main Content                 │
│ ┌─────────────┐ │  Header                       │
│ │TagNavigation│ │  ┌──────────────────────────┐ │
│ │- Python     │ │  │ Controls Bar             │ │
│ │- Tutorial   │ │  │ [Settings][View][Table]  │ │ ← Settings HERE
│ │+ Create     │ │  └──────────────────────────┘ │
│ └─────────────┘ │  ┌──────────────────────────┐ │
│                 │  │ FilterBar                │ │
│                 │  │ [Add Filter][Clear All]  │ │ ← Add Filter HERE
│                 │  └──────────────────────────┘ │
│                 │  Video Grid                   │
└─────────────────────────────────────────────────┘
```

### AFTER:
```text
VideosPage Layout:
┌─────────────────────────────────────────────────┐
│ Sidebar         │  Main Content                 │
│ ┌─────────────┐ │  Header                       │
│ │TagNavigation│ │  ┌──────────────────────────┐ │
│ │- Python     │ │  │ Controls Bar             │ │
│ │- Tutorial   │ │  │ [Add Filter][View][Table]│ │ ← Add Filter MOVED
│ │+ Create     │ │  └──────────────────────────┘ │
│ │─────────────│ │  ┌──────────────────────────┐ │
│ │ [Settings]  │ │  │ FilterBar                │ │ ← Settings MOVED
│ └─────────────┘ │  │ [Badge][Badge][Clear All]│ │ ← No button
│                 │  └──────────────────────────┘ │
│                 │  Video Grid                   │
└─────────────────────────────────────────────────┘
```

---

## Edge Cases

### Edge Case 1: Settings Button Click on Mobile
- **Scenario:** Mobile user clicks Settings in sidebar drawer
- **Expected:** Drawer closes, navigate to Settings page

### Edge Case 2: FilterBar with No Filters
- **Scenario:** No active filters, FilterBar is empty
- **Expected:** FilterBar shows nothing (or hidden), Add Filter button in controls bar is primary way to add filters

### Edge Case 3: Add Filter Popover Positioning
- **Scenario:** Add Filter button near edge of screen
- **Expected:** Popover positions itself to stay within viewport (Radix Popover auto-positioning)

### Edge Case 4: Keyboard Navigation
- **Scenario:** User tabs through UI
- **Expected:** Settings button in sidebar is reachable via Tab, Add Filter button in controls is reachable via Tab

---

## Technical Notes

### Settings Button Migration

**From:** `VideosPage.tsx` lines ~779-787
```tsx
// REMOVE:
<Button onClick={() => navigate('/settings/schemas')}>
  <Settings className="h-4 w-4 mr-2" />
  Settings
</Button>
```

**To:** `VideosPage.tsx` (in CollapsibleSidebar section)
```tsx
<CollapsibleSidebar>
  <TagNavigation {...props} />

  {/* NEW: Settings at bottom of sidebar */}
  <div className="mt-auto pt-4 border-t">
    <Button
      variant="ghost"
      className="w-full justify-start"
      onClick={() => navigate('/settings/schemas')}
    >
      <Settings className="h-4 w-4 mr-2" />
      Settings
    </Button>
  </div>
</CollapsibleSidebar>
```

### Add Filter Button Migration

**From:** `FilterBar.tsx`
```tsx
// EXTRACT and move:
<Popover>
  <PopoverTrigger asChild>
    <Button size="sm" variant="outline">
      <Plus className="h-4 w-4 mr-2" />
      Add Filter
    </Button>
  </PopoverTrigger>
  <PopoverContent>{/* Filter selection UI */}</PopoverContent>
</Popover>
```

**To:** `VideosPage.tsx` controls bar (replacing Settings)
```tsx
<div className="flex gap-1 items-center flex-shrink-0 ml-auto">
  {/* NEW: Add Filter button */}
  <FilterPopover listId={listId} />

  <ViewModeToggle viewMode={viewMode} onToggle={setViewMode} />
  <TableSettingsDropdown />
</div>
```

**Extract Reusable Component:**
```tsx
// NEW FILE: frontend/src/components/videos/FilterPopover.tsx
export function FilterPopover({ listId }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="h-4 w-4 mr-2" />
          Add Filter
        </Button>
      </PopoverTrigger>
      <PopoverContent>{/* Filter selection UI */}</PopoverContent>
    </Popover>
  )
}
```

---

## Dependencies

- ✅ VideosPage component (existing, needs modification)
- ✅ CollapsibleSidebar component (existing, needs slot for Settings button)
- ✅ FilterBar component (existing, needs button extraction)
- ⚠️ FilterPopover component (needs to be created by extraction)

---

## Testing Scenarios

### Test 1: Settings Button in Sidebar
```tsx
it('renders Settings button in sidebar, not controls bar', () => {
  render(<VideosPage listId="list-1" />)

  const sidebar = screen.getByRole('complementary')
  const controlsBar = screen.getByRole('toolbar')

  expect(within(sidebar).getByText('Settings')).toBeInTheDocument()
  expect(within(controlsBar).queryByText('Settings')).not.toBeInTheDocument()
})
```

### Test 2: Add Filter Button in Controls Bar
```tsx
it('renders Add Filter button in controls bar, not FilterBar', () => {
  render(<VideosPage listId="list-1" />)

  const controlsBar = screen.getByRole('toolbar')
  const filterBar = screen.getByTestId('filter-bar')

  expect(within(controlsBar).getByText('Add Filter')).toBeInTheDocument()
  expect(within(filterBar).queryByText('Add Filter')).not.toBeInTheDocument()
})
```

### Test 3: Settings Navigation
```tsx
it('navigates to settings on click', async () => {
  const navigate = jest.fn()
  render(<VideosPage listId="list-1" />)

  fireEvent.click(screen.getByText('Settings'))

  await waitFor(() => {
    expect(navigate).toHaveBeenCalledWith('/settings/schemas')
  })
})
```

### Test 4: Add Filter Popover Opens
```tsx
it('opens filter popover on Add Filter click', async () => {
  render(<VideosPage listId="list-1" />)

  fireEvent.click(screen.getByText('Add Filter'))

  expect(await screen.findByRole('dialog')).toBeInTheDocument()
  expect(screen.getByText('Select field')).toBeInTheDocument()
})
```

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Users can't find Settings | Low | Medium | Settings at bottom of sidebar is common pattern |
| Add Filter less discoverable | Low | Low | More prominent in controls bar (better visibility) |
| Breaking filter functionality | Low | High | Thorough testing, extract component carefully |
| Mobile sidebar too tall | Low | Low | Settings at bottom, scrollable sidebar |

---

## Definition of Done

- [ ] Settings button removed from VideosPage controls bar
- [ ] Settings button added to sidebar (bottom)
- [ ] Settings button navigates to /settings/schemas
- [ ] Settings button accessible on mobile (sidebar drawer)
- [ ] Add Filter button removed from FilterBar
- [ ] Add Filter button added to controls bar (Settings' old position)
- [ ] FilterPopover component extracted and reusable
- [ ] Add Filter popover opens and works
- [ ] Filter functionality unchanged (no regressions)
- [ ] Component tests pass for VideosPage
- [ ] Component tests pass for FilterBar
- [ ] Integration test: Settings button → navigation
- [ ] Integration test: Add Filter button → popover → filter added
- [ ] Accessibility: keyboard navigation works
- [ ] Accessibility: focus order makes sense (sidebar Settings, then controls Add Filter)

---

## User Research Notes

**Rationale for Changes:**

1. **Settings to Sidebar:**
   - Standard UI pattern (VS Code, Figma, etc.)
   - Persistent across all pages (future: add to all pages' sidebars)
   - Reduces clutter in main controls bar

2. **Add Filter to Controls:**
   - Filters are primary video page action
   - More prominent placement = faster access
   - Aligns with other controls (View, Table Settings)

**User Testing Questions:**
- Can you find the Settings page?
- How would you add a filter to the video list?
- Is the new layout more intuitive than before?

---

**Related Stories:**
- US-01: View All Tags (accessed via Settings)
- US-02: Edit Tag (accessed via Settings)
- US-03: Delete Tag (accessed via Settings)
