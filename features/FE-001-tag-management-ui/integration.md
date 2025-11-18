# Integration Strategy: Tag Management UI & Settings Reorganization

**Feature ID:** FE-001-tag-management-ui
**Phase:** 4 - Integration Strategy
**Date:** 2025-11-18

---

## Overview

This document outlines HOW to integrate the tag management feature and UI reorganization into the existing codebase with minimal disruption and zero breaking changes.

**Key Principles:**
1. **Additive changes first** - New components before modifications
2. **Feature isolation** - Changes are self-contained and independent
3. **Graceful degradation** - Existing functionality continues to work during implementation
4. **Test-driven** - Write tests before refactoring existing code
5. **Incremental rollout** - Can deploy in stages if needed

---

## Integration Phases

### Phase A: Foundation (New Code Only)
**Duration:** ~3-4 hours
**Risk:** None - No modifications to existing code

**Changes:**
1. Create new mutation hooks (`useUpdateTag`, `useDeleteTag`)
2. Write hook tests
3. Verify hooks work with existing backend

**Why First:** Hooks are foundational - components depend on them

**Isolation:** These hooks don't affect anything until used by components

### Phase B: Tag Management Components (New Code Only)
**Duration:** ~4-5 hours
**Risk:** None - Components not yet integrated

**Changes:**
1. Create `TagsList.tsx` component
2. Create `EditTagDialog.tsx` component
3. Create `ConfirmDeleteTagDialog.tsx` component
4. Create `TagActionsMenu.tsx` component
5. Write component tests

**Why Second:** Build all new UI before integrating into existing pages

**Isolation:** Components exist but aren't rendered anywhere yet

### Phase C: Settings Page Integration (First Integration Point)
**Duration:** ~1-2 hours
**Risk:** Low - Additive change to tab structure

**Changes:**
1. Add "Tags" tab to SettingsPage
2. Wire up TagsList component
3. Test tab switching
4. Verify existing tabs (Schemas, Fields, Analytics) still work

**Why Third:** First integration point, but isolated to Settings page

**Safety:** If bugs occur, only Settings page affected, not Videos page

### Phase D: UI Reorganization (Second Integration Point)
**Duration:** ~2-3 hours
**Risk:** Medium - Modifies existing VideosPage

**Changes:**
1. Extract FilterPopover from FilterBar
2. Move Settings button to sidebar
3. Move Add Filter button to controls bar
4. Update tests

**Why Last:** Most risky change - wait until tag management proven stable

**Safety:** Can revert button changes quickly if issues arise

---

## Detailed Integration Strategy

### 1. Hook Integration (Phase A)

#### 1.1 useUpdateTag Hook

**File:** `frontend/src/hooks/useTags.ts`

**Integration Approach:**
- Add to end of file (after `useBulkApplySchema`)
- Follow exact pattern of `useCreateTag` (proven to work)
- Use same Zod validation, error handling, invalidation

**Integration Points:**
```tsx
// NO integration points yet - hook exists but unused
// Will be called by EditTagDialog in Phase B
```

**Testing Strategy:**
```tsx
// hooks/__tests__/useTags.test.tsx
describe('useUpdateTag', () => {
  it('should update tag name', async () => {
    // Mock API response
    // Call mutate with { tagId, data: { name: 'New Name' } }
    // Verify API called with PUT /api/tags/{id}
    // Verify query invalidated
  })
})
```

**Risk Mitigation:**
- Test with real backend (integration test)
- Verify doesn't affect existing useCreateTag

#### 1.2 useDeleteTag Hook

**File:** `frontend/src/hooks/useTags.ts`

**Integration Approach:**
- Add after `useUpdateTag`
- Invalidate both `['tags']` and `['videos']` queries
- No optimistic updates (deletion is permanent)

**Integration Points:**
```tsx
// NO integration points yet
// Will be called by ConfirmDeleteTagDialog in Phase B
```

**Testing Strategy:**
```tsx
describe('useDeleteTag', () => {
  it('should delete tag and invalidate queries', async () => {
    // Mock API response
    // Call mutate with tagId
    // Verify API called with DELETE /api/tags/{id}
    // Verify tags AND videos queries invalidated
  })
})
```

**Risk Mitigation:**
- Test cascade behavior (videos survive, video_tags deleted)
- Verify tag filtering updates correctly

---

### 2. Component Integration (Phase B)

#### 2.1 TagsList Component

**File:** `frontend/src/components/settings/TagsList.tsx`

**Integration Approach:**
- Copy structure from `FieldsList.tsx` (proven pattern)
- Use same table layout (Tailwind table classes)
- Implement actions menu (edit, delete)

**Component Structure:**
```tsx
export function TagsList({ tags, onEdit, onDelete }) {
  // Table with columns: Name, Color (badge), Schema, Videos, Actions
  // Actions dropdown with Edit, Delete options
  // Empty state if no tags
  // Loading state while fetching
}
```

**No External Integration Yet:**
- Component exists but not rendered
- Will be integrated in SettingsPage (Phase C)

**Testing Strategy:**
```tsx
describe('TagsList', () => {
  it('renders tags in table', () => {})
  it('shows empty state when no tags', () => {})
  it('calls onEdit when edit clicked', () => {})
  it('calls onDelete when delete clicked', () => {})
})
```

#### 2.2 EditTagDialog Component

**File:** `frontend/src/components/EditTagDialog.tsx`

**Integration Approach:**
- Copy structure from `CreateTagDialog.tsx` (95% identical)
- Use React Hook Form + Zod validation (same schema)
- Call `useUpdateTag` hook instead of `useCreateTag`

**Key Differences from CreateTagDialog:**
```tsx
// CREATE:
const createTag = useCreateTag()
createTag.mutate({ name, color, schema_id })

// EDIT (changes):
const updateTag = useUpdateTag()
updateTag.mutate({ tagId: tag.id, data: { name, color, schema_id } })
```

**Integration Point:**
```tsx
// Called from TagsList component
<EditTagDialog
  open={editDialogOpen}
  tag={selectedTag}  // Pre-fill form
  onClose={() => setEditDialogOpen(false)}
/>
```

**Testing Strategy:**
```tsx
describe('EditTagDialog', () => {
  it('pre-fills form with tag data', () => {})
  it('validates name required', () => {})
  it('prevents duplicate names', () => {})
  it('calls updateTag mutation on submit', () => {})
})
```

#### 2.3 ConfirmDeleteTagDialog Component

**File:** `frontend/src/components/ConfirmDeleteTagDialog.tsx`

**Integration Approach:**
- Use Radix `AlertDialog` (same as `ConfirmDeleteFieldModal.tsx`)
- Show warning message with tag name
- Show video count if available
- Call `useDeleteTag` hook on confirm

**Component Structure:**
```tsx
export function ConfirmDeleteTagDialog({ open, tag, onConfirm, onCancel }) {
  const deleteTag = useDeleteTag()

  const handleConfirm = async () => {
    await deleteTag.mutateAsync(tag.id)
    onConfirm()  // Close dialog
  }

  return (
    <AlertDialog open={open}>
      {/* Warning: "Delete tag '{tag.name}'?" */}
      {/* "This will remove the tag from all videos" */}
      {/* Cancel / Delete buttons */}
    </AlertDialog>
  )
}
```

**Integration Point:**
```tsx
// Called from TagsList component
<ConfirmDeleteTagDialog
  open={deleteDialogOpen}
  tag={selectedTag}
  onConfirm={() => {
    setDeleteDialogOpen(false)
    // Tag deletion handled by hook
  }}
  onCancel={() => setDeleteDialogOpen(false)}
/>
```

**Testing Strategy:**
```tsx
describe('ConfirmDeleteTagDialog', () => {
  it('shows tag name in warning', () => {})
  it('calls deleteTag on confirm', () => {})
  it('calls onCancel when cancelled', () => {})
})
```

---

### 3. SettingsPage Integration (Phase C)

**File:** `frontend/src/pages/SettingsPage.tsx`

**Integration Approach: Additive Tab Addition**

**Step 1: Import Components**
```tsx
import { TagsList } from '@/components/settings/TagsList'
import { EditTagDialog } from '@/components/EditTagDialog'
import { ConfirmDeleteTagDialog } from '@/components/ConfirmDeleteTagDialog'
import { useTags } from '@/hooks/useTags'
```

**Step 2: Add State Management**
```tsx
// In SettingsPage component
const { data: tags = [], isLoading: tagsLoading } = useTags()
const [editTagDialogOpen, setEditTagDialogOpen] = useState(false)
const [deleteTagDialogOpen, setDeleteTagDialogOpen] = useState(false)
const [selectedTag, setSelectedTag] = useState<Tag | null>(null)

const handleEditTag = (tag: Tag) => {
  setSelectedTag(tag)
  setEditTagDialogOpen(true)
}

const handleDeleteTag = (tag: Tag) => {
  setSelectedTag(tag)
  setDeleteTagDialogOpen(true)
}
```

**Step 3: Add Tab Trigger (BEFORE Analytics tab)**
```tsx
<TabsList>
  <TabsTrigger value="schemas">Schemas</TabsTrigger>
  <TabsTrigger value="fields">Fields</TabsTrigger>
  <TabsTrigger value="tags">Tags</TabsTrigger>  {/* NEW */}
  <TabsTrigger value="analytics">Analytics</TabsTrigger>
</TabsList>
```

**Step 4: Add Tab Content (BEFORE Analytics content)**
```tsx
<TabsContent value="tags">
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Tags</h2>
        <p className="text-muted-foreground">
          Manage your tags and their schemas
        </p>
      </div>
      {/* Optional: Create Tag button (already exists in sidebar) */}
    </div>

    {tagsLoading ? (
      <div>Loading tags...</div>
    ) : (
      <TagsList
        tags={tags}
        onEdit={handleEditTag}
        onDelete={handleDeleteTag}
      />
    )}
  </div>
</TabsContent>
```

**Step 5: Add Dialogs (outside Tabs)**
```tsx
{/* After </Tabs> closing tag */}
<EditTagDialog
  open={editTagDialogOpen}
  tag={selectedTag}
  onClose={() => {
    setEditTagDialogOpen(false)
    setSelectedTag(null)
  }}
/>

<ConfirmDeleteTagDialog
  open={deleteTagDialogOpen}
  tag={selectedTag}
  onConfirm={() => {
    setDeleteTagDialogOpen(false)
    setSelectedTag(null)
  }}
  onCancel={() => {
    setDeleteTagDialogOpen(false)
    setSelectedTag(null)
  }}
/>
```

**Testing Strategy:**
```tsx
// SettingsPage.integration.test.tsx
describe('SettingsPage - Tags Tab', () => {
  it('renders Tags tab', () => {})
  it('shows TagsList when tab clicked', () => {})
  it('opens EditTagDialog when edit clicked', () => {})
  it('opens ConfirmDeleteTagDialog when delete clicked', () => {})
  it('existing tabs still work (Schemas, Fields, Analytics)', () => {})
})
```

**Risk Mitigation:**
- Add Tags tab BEFORE Analytics tab (maintains tab order)
- Reuse existing error handling pattern from other tabs
- Verify tab switching works with new tab

**Rollback:**
- Remove `<TabsTrigger value="tags">` line
- Remove `<TabsContent value="tags">` block
- Remove dialog components
- 3 minutes to rollback

---

### 4. UI Reorganization (Phase D)

#### 4.1 Extract FilterPopover Component

**File:** `frontend/src/components/videos/FilterBar.tsx`

**Current Structure:**
```tsx
// FilterBar.tsx contains:
// 1. Active filter badges
// 2. "Add Filter" button with popover
// 3. "Clear all" button
```

**Integration Approach:**

**Step 1: Extract Reusable Component**
```tsx
// NEW FILE: frontend/src/components/videos/FilterPopover.tsx
export function FilterPopover({ listId, onFilterAdded }) {
  // Popover with field selector
  // Smart default operators
  // Duplicate prevention
  // Returns <Popover><PopoverTrigger><PopoverContent>...</Popover>
}
```

**Step 2: Update FilterBar to Use Extract**
```tsx
// FilterBar.tsx (modified)
import { FilterPopover } from './FilterPopover'

export function FilterBar({ listId }) {
  const filters = useFieldFilterStore(state => state.filters)

  return (
    <div className="flex items-center gap-2">
      {/* Active filter badges (unchanged) */}
      {filters.map(filter => (
        <FilterBadge key={filter.id} filter={filter} />
      ))}

      {/* NO LONGER HERE - moved to VideosPage */}
      {/* <FilterPopover listId={listId} /> */}

      {filters.length > 0 && (
        <Button onClick={clearFilters}>Clear all</Button>
      )}
    </div>
  )
}
```

**Testing Strategy:**
```tsx
describe('FilterPopover', () => {
  it('opens on button click', () => {})
  it('adds filter on selection', () => {})
  it('prevents duplicate filters', () => {})
})

describe('FilterBar', () => {
  it('NO LONGER includes Add Filter button', () => {})
  it('shows filter badges', () => {})
  it('shows clear button when filters exist', () => {})
})
```

#### 4.2 Move Settings Button to Sidebar

**File:** `frontend/src/components/VideosPage.tsx`

**Current Location:**
```tsx
// Lines ~779-787 (controls bar)
<div className="flex gap-1 items-center flex-shrink-0 ml-auto">
  <Button onClick={() => navigate('/settings/schemas')}>
    <Settings className="h-4 w-4 mr-2" />
    Settings
  </Button>
  <ViewModeToggle />
  <TableSettingsDropdown />
</div>
```

**Integration Approach:**

**Step 1: Remove from Controls Bar**
```tsx
// VideosPage.tsx (lines ~779-792)
<div className="flex gap-1 items-center flex-shrink-0 ml-auto">
  {/* REMOVED: Settings button */}

  {/* Add Filter button (NEW) */}
  <FilterPopover listId={listId} />

  <ViewModeToggle viewMode={viewMode} onToggle={setViewMode} />
  <TableSettingsDropdown />
</div>
```

**Step 2: Add to Sidebar**
```tsx
// Option A: Modify CollapsibleSidebar to accept footer slot
<CollapsibleSidebar
  footer={
    <Button
      variant="ghost"
      className="w-full justify-start"
      onClick={() => navigate('/settings/schemas')}
    >
      <Settings className="h-4 w-4 mr-2" />
      Settings
    </Button>
  }
>
  <TagNavigation {...props} />
</CollapsibleSidebar>

// Option B: Add directly in VideosPage after TagNavigation
<CollapsibleSidebar>
  <TagNavigation {...props} />

  {/* Settings link at bottom */}
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

**Decision:** Option B is simpler (no CollapsibleSidebar modification)

**Testing Strategy:**
```tsx
describe('VideosPage - UI Reorganization', () => {
  it('Settings button in sidebar, not controls bar', () => {
    render(<VideosPage />)
    const sidebar = screen.getByRole('complementary')
    const controlsBar = screen.getByRole('toolbar')

    expect(within(sidebar).getByText('Settings')).toBeInTheDocument()
    expect(within(controlsBar).queryByText('Settings')).not.toBeInTheDocument()
  })

  it('Add Filter button in controls bar, not FilterBar', () => {
    render(<VideosPage />)
    const controlsBar = screen.getByRole('toolbar')
    const filterBar = screen.getByTestId('filter-bar')

    expect(within(controlsBar).getByText('Add Filter')).toBeInTheDocument()
    expect(within(filterBar).queryByText('Add Filter')).not.toBeInTheDocument()
  })
})
```

**Risk Mitigation:**
- Test button click navigation works
- Verify Settings button accessible on mobile (sidebar drawer)
- Check keyboard navigation flow

**Rollback:**
- Move Settings button back to controls bar
- Move Add Filter button back to FilterBar
- 5 minutes to rollback

---

## Integration Sequence (Build Order)

```
Week 1:
├─ Day 1-2: Phase A - Foundation
│  ├─ useUpdateTag hook + tests
│  ├─ useDeleteTag hook + tests
│  └─ Integration tests with real backend
│
├─ Day 3-4: Phase B - Components (Part 1)
│  ├─ TagsList component + tests
│  ├─ TagActionsMenu component + tests
│  └─ Component integration tests
│
└─ Day 5: Phase B - Components (Part 2)
   ├─ EditTagDialog component + tests
   ├─ ConfirmDeleteTagDialog component + tests
   └─ Component integration tests

Week 2:
├─ Day 1: Phase C - Settings Integration
│  ├─ Add Tags tab to SettingsPage
│  ├─ Wire up TagsList
│  ├─ Test tab switching
│  └─ Integration tests
│
├─ Day 2: Phase D - UI Reorganization (Part 1)
│  ├─ Extract FilterPopover component
│  ├─ Update FilterBar
│  └─ Component tests
│
└─ Day 3: Phase D - UI Reorganization (Part 2)
   ├─ Move Settings button to sidebar
   ├─ Move Add Filter to controls bar
   ├─ Update tests
   └─ End-to-end testing
```

---

## Clean Integration Points

### 1. Hook Integration
- ✅ **Clean:** Hooks export new functions, no existing code modified
- ✅ **Isolated:** Not called until components use them
- ✅ **Testable:** Can test in isolation

### 2. Component Integration
- ✅ **Clean:** Components exist in separate files
- ✅ **Isolated:** Not rendered until SettingsPage imports them
- ✅ **Testable:** Can test each component independently

### 3. Settings Page Integration
- ✅ **Clean:** Additive tab addition, no modification to existing tabs
- ✅ **Isolated:** Tags tab independent of other tabs
- ✅ **Testable:** Can verify tab switching doesn't break

### 4. UI Reorganization
- ⚠️ **Moderate:** Requires modifying VideosPage and FilterBar
- ✅ **Isolated:** Button movements don't affect other functionality
- ✅ **Testable:** Can verify buttons still work in new locations

---

## Integration Testing Strategy

### Unit Testing (Per Component)
```tsx
// Test each component in isolation
TagsList.test.tsx
EditTagDialog.test.tsx
ConfirmDeleteTagDialog.test.tsx
TagActionsMenu.test.tsx
FilterPopover.test.tsx
```

### Integration Testing (Component + Hooks)
```tsx
// Test components calling hooks with mocked API
TagsList.integration.test.tsx
SettingsPage.integration.test.tsx
```

### End-to-End Testing (Full User Flow)
```tsx
// Test complete tag CRUD flow
describe('Tag Management E2E', () => {
  it('creates, edits, and deletes a tag', async () => {
    // 1. Navigate to Settings → Tags
    // 2. Create tag
    // 3. Verify appears in list
    // 4. Edit tag name
    // 5. Verify updated
    // 6. Delete tag
    // 7. Verify removed
  })
})
```

---

## Risk Mitigation Strategies

### 1. Incremental Deployment

**Option 1: Feature Flag (If Available)**
```tsx
// Feature flag for tag management
if (FEATURE_FLAGS.tagManagement) {
  return <TabsContent value="tags"><TagsList /></TabsContent>
}
```

**Option 2: Branch Deployment**
- Deploy to staging first
- User testing
- Deploy to production

### 2. Monitoring

**Metrics to Track:**
- API error rates on `/api/tags/{id}` (PUT, DELETE)
- Frontend error logs (EditTagDialog, DeleteDialog)
- User adoption (clicks on Tags tab)
- Performance (TagsList render time)

### 3. Rollback Plan

**If Critical Issues Arise:**

1. **Remove Tags Tab** (1 minute)
   ```tsx
   // Comment out TabsTrigger and TabsContent
   ```

2. **Revert Button Locations** (5 minutes)
   ```tsx
   // Move Settings back to controls bar
   // Move Add Filter back to FilterBar
   ```

3. **Revert Hook Changes** (2 minutes)
   ```tsx
   // Remove useUpdateTag, useDeleteTag exports
   ```

**Total Rollback Time:** ~10 minutes

---

## Extension Points (Future Features)

### 1. Tag Merge Functionality
**Integration Point:** TagsList actions menu
```tsx
<DropdownMenuItem onClick={() => onMerge(tag)}>
  Merge Tags
</DropdownMenuItem>
```

### 2. Bulk Operations
**Integration Point:** TagsList with checkboxes
```tsx
<TagsList
  selectable={true}
  onBulkDelete={handleBulkDelete}
  onBulkColorChange={handleBulkColorChange}
/>
```

### 3. Tag Statistics View
**Integration Point:** New tab in SettingsPage
```tsx
<TabsTrigger value="tag-analytics">Tag Analytics</TabsTrigger>
```

---

## Summary

**Integration Strategy:**
1. ✅ Build new code first (hooks, components)
2. ✅ Test in isolation
3. ✅ Integrate into Settings page (additive)
4. ✅ Reorganize UI (careful refactoring)
5. ✅ Test end-to-end
6. ✅ Deploy with monitoring

**Key Success Factors:**
- Follow existing patterns (FieldsList, FieldEditDialog)
- Reuse proven components (Radix UI, React Hook Form)
- Test each integration point
- Maintain rollback capability

**Risk Level:** Low-Medium
**Integration Complexity:** Medium
**Time to Integrate:** 8-12 hours

---

**Next Phase:** Backward Compatibility - Ensure no breaking changes
