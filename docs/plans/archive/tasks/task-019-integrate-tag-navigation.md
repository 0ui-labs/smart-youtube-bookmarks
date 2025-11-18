# Task #19: Integrate TagNavigation into VideosPage with Layout

**Plan Task:** #19
**Wave/Phase:** Wave 1 Frontend
**Dependencies:** Task #16 (Tag Store), Task #17 (TagNavigation Component), Task #18 (useTags Hook)

---

## 🎯 Ziel

Integrate the TagNavigation component into VideosPage using the existing CollapsibleSidebar component. Transform the current standalone page into a two-column layout with tag filtering sidebar on the left and video table on the right.

**Expected Result:**
- VideosPage shows collapsible sidebar with TagNavigation
- Desktop: Sidebar always visible (250px fixed width)
- Mobile: Sidebar as drawer with backdrop
- Selected tags displayed in page header
- Layout matches existing CollapsibleSidebar behavior

---

## 📋 Acceptance Criteria

- [ ] VideosPage uses CollapsibleSidebar component
- [ ] TagNavigation rendered in sidebar
- [ ] Desktop: Sidebar always visible (≥768px)
- [ ] Mobile: Sidebar as drawer (<768px)
- [ ] Tag selection updates Zustand store
- [ ] Page header shows selected tag names
- [ ] No TwoColumnLayout component created (use existing CollapsibleSidebar)
- [ ] Tests passing
- [ ] Code reviewed

---

## 🛠️ Implementation Steps

### 1. Refactor VideosPage to use CollapsibleSidebar Layout
**Files:** `frontend/src/components/VideosPage.tsx`
**Action:** Wrap existing content with CollapsibleSidebar, move TagNavigation into sidebar

**Implementation:**
```tsx
// frontend/src/components/VideosPage.tsx
import { CollapsibleSidebar } from '@/components/CollapsibleSidebar'
import { TagNavigation } from '@/components/TagNavigation'
import { useTags } from '@/hooks/useTags'
import { useTagStore } from '@/stores/tagStore'

export const VideosPage = ({ listId, onBack }: VideosPageProps) => {
  // Existing state...
  const { data: videos = [], isLoading, error } = useVideos(listId)

  // NEW: Tag integration
  const { data: tags = [] } = useTags()
  const { selectedTagIds, toggleTag } = useTagStore()

  // NEW: Compute selected tag names for header
  const selectedTagNames = useMemo(() => {
    return tags
      .filter(tag => selectedTagIds.includes(tag.id))
      .map(tag => tag.name)
      .join(', ')
  }, [tags, selectedTagIds])

  // Placeholder for create tag (will be implemented in later task)
  const handleCreateTag = () => {
    console.log('Create tag - will be implemented in Task #20+')
  }

  return (
    <div className="flex h-screen">
      {/* Sidebar with TagNavigation */}
      <CollapsibleSidebar>
        <TagNavigation
          tags={tags}
          selectedTagIds={selectedTagIds}
          onTagSelect={toggleTag}
          onTagCreate={handleCreateTag}
        />
      </CollapsibleSidebar>

      {/* Main content area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-8">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <button onClick={onBack} className="text-blue-600 hover:text-blue-800 mb-2 text-sm">
                ← Zurück zu Listen
              </button>
              <h1 className="text-3xl font-bold text-gray-900">
                {selectedTagNames || 'Videos'}
              </h1>
              {selectedTagNames && (
                <p className="text-sm text-gray-600 mt-1">
                  Gefiltert nach: {selectedTagNames}
                </p>
              )}
            </div>

            {/* Existing buttons (CSV Export, CSV Upload, Video hinzufügen) */}
            <div className="flex gap-2">
              {/* ... existing button code ... */}
            </div>
          </div>

          {/* Existing table code */}
          {/* ... rest of existing component ... */}
        </div>
      </div>
    </div>
  )
}
```

**Why this approach:**
- ✅ Reuses existing CollapsibleSidebar (already has mobile/desktop logic)
- ✅ No need to create TwoColumnLayout (would be duplicate)
- ✅ Matches design: Fixed sidebar on desktop, drawer on mobile
- ✅ Minimal changes to existing VideosPage structure

---

### 2. Update Page Title to Show Selected Tags
**Files:** `frontend/src/components/VideosPage.tsx`
**Action:** Compute selected tag names from store and display in header

**Code changes:**
```tsx
// Compute selected tag names
const selectedTagNames = useMemo(() => {
  return tags
    .filter(tag => selectedTagIds.includes(tag.id))
    .map(tag => tag.name)
    .join(', ')
}, [tags, selectedTagIds])

// In header:
<h1 className="text-3xl font-bold text-gray-900">
  {selectedTagNames || 'Videos'}
</h1>
{selectedTagNames && (
  <p className="text-sm text-gray-600 mt-1">
    Gefiltert nach: {selectedTagNames}
  </p>
)}
```

**Why:**
- User sees which tags are selected
- Empty state shows "Videos"
- Multiple tags: "Python, Tutorial, Advanced"

---

### 3. Add Placeholder for Create Tag Handler
**Files:** `frontend/src/components/VideosPage.tsx`
**Action:** Add console.log placeholder for onTagCreate callback

**Code:**
```tsx
const handleCreateTag = () => {
  console.log('Create tag clicked - will be implemented in later task')
  // TODO: Implement in separate task (Tag Dialog component)
}
```

**Why:**
- TagNavigation requires onTagCreate prop
- Actual dialog will be separate task (cleaner separation)
- Plus icon is clickable but shows console message

---

### 4. Test Layout Responsiveness
**Files:** N/A
**Action:** Manual testing in browser

**Test cases:**
1. **Desktop (≥768px):**
   - Sidebar always visible on left
   - Fixed 250px width
   - No menu button visible

2. **Mobile (<768px):**
   - Sidebar hidden by default
   - Menu (hamburger) button visible
   - Click menu → sidebar slides in from left
   - Backdrop darkens background
   - Click outside → sidebar closes
   - ESC key → sidebar closes

3. **Tag selection:**
   - Click tag → background changes to accent color
   - Click again → deselects
   - Multiple tags selectable
   - Page title updates immediately

4. **Empty states:**
   - No tags selected → "Videos"
   - 1 tag selected → "Python"
   - 2 tags selected → "Python, Tutorial"

---

## 🧪 Testing Strategy

**Unit Tests:**
- Test selectedTagNames computation with 0, 1, 3 tags selected
- Test handleCreateTag logs to console
- Test CollapsibleSidebar renders TagNavigation

**Integration Tests:**
- Test tag selection updates Zustand store
- Test page title changes on tag selection
- Test sidebar visibility on mobile/desktop

**Manual Testing:**
1. Open [http://localhost:5173/videos](http://localhost:5173/videos)
2. Desktop view (≥768px):
   - Verify sidebar visible
   - Click tag → title updates
   - Click multiple tags → "Tag1, Tag2, Tag3"
3. Mobile view (<768px):
   - Verify menu button visible
   - Click menu → sidebar opens
   - Click tag → sidebar closes (mobile behavior)
   - Title updates correctly
4. Resize window → sidebar adapts correctly

---

## 📚 Reference

**Related Docs:**
- `docs/plans/2025-10-31-ID-05-ux-optimization-implementation-plan.md` - Task 1.10
- `docs/handoffs/2025-11-02-log-018-tag-navigation-complete.md` - Previous task context

**Related Code:**
- Similar integration: N/A (first sidebar integration)
- Pattern to follow: `frontend/src/components/CollapsibleSidebar.tsx` (Lines 32-159)
- Store usage: `frontend/src/stores/tagStore.ts` (toggleTag, selectedTagIds)

**Design Decisions:**

**1. Why CollapsibleSidebar instead of TwoColumnLayout?**
- CollapsibleSidebar already exists with full mobile/desktop logic
- TwoColumnLayout would duplicate 90% of CollapsibleSidebar code
- Plan Task 1.7 mentions "TwoColumnLayout" but CollapsibleSidebar is the implemented solution
- Avoids maintaining two similar components

**2. Why placeholder for Create Tag?**
- Separation of concerns: Layout integration ≠ Dialog implementation
- Keeps Task #19 focused and testable
- Dialog component will be separate task (likely Task #20 or later)
- User can still interact with plus icon (console feedback)

**3. Why useMemo for selectedTagNames?**
- Prevents re-computation on every render
- Only updates when tags or selectedTagIds change
- Performance optimization for large tag lists

**4. Why show "Gefiltert nach" subtitle?**
- Clear visual feedback that filter is active
- Distinguishes between "Videos" (all) and "Python" (filtered)
- Improves UX transparency

---

## ⚠️ Important Notes

**Mobile Behavior:**
- CollapsibleSidebar auto-closes on mobile when clicking outside
- This means clicking a tag will close the drawer (expected behavior)
- Desktop: Sidebar stays open (expected behavior)

**State Management:**
- Tag selection state lives in Zustand store (persistent)
- Sidebar open/closed state lives in CollapsibleSidebar (ephemeral)
- No conflicts between the two states

**Not Included in This Task:**
- Video filtering by tags (Task #20)
- Create Tag dialog (later task)
- Tag editing/deletion (later task)
- Tag color picker (later task)

**Current Limitations:**
- Clicking tags updates UI but doesn't filter videos yet (Task #20)
- Plus icon logs to console (dialog in later task)
- No "Clear All Tags" button yet (future enhancement)

---

## 🎯 Success Criteria

**Definition of Done:**
- [ ] VideosPage renders CollapsibleSidebar + TagNavigation
- [ ] Desktop: Sidebar visible, 250px width
- [ ] Mobile: Sidebar as drawer, menu button works
- [ ] Tag selection updates store and page title
- [ ] No console errors or warnings
- [ ] Manual testing on desktop + mobile confirmed
- [ ] Code follows existing patterns (CollapsibleSidebar usage)
- [ ] Git commit with clear message

**Visual Validation:**
```text
Desktop (≥768px):
┌─────────────┬──────────────────────────────┐
│ Tags        │ Videos (or "Python, Tutorial")│
│ ────────    │ ───────────────────────────── │
│ [ ] Python  │ Header: CSV Export | Upload   │
│ [x] Tutorial│ ─────────────────────────────│
│ [ ] Advanced│ | Thumb | Title | Duration |  │
│             │ |──────|───────|──────────|  │
│ [+ Create]  │ | ...  | ...   | ...      |  │
│             │                               │
└─────────────┴──────────────────────────────┘

Mobile (<768px):
┌──────────────────────────────────────┐
│ [☰] Videos                           │
│ ────────────────────────────────────│
│ | Thumb | Title        | Actions |   │
│ |──────|──────────────|─────────|   │
│ | ...  | ...          | ...     |   │
└──────────────────────────────────────┘

(Sidebar opens as drawer overlay on menu click)
```

---

## 📝 Commit Message Template

```text
feat: integrate TagNavigation into VideosPage with sidebar

- Use CollapsibleSidebar for desktop/mobile layout
- Render TagNavigation in sidebar
- Connect useTags hook and tag store
- Display selected tag names in page header
- Add "Gefiltert nach: X, Y" subtitle when tags selected
- Placeholder for create tag (console.log)
- Manual testing confirmed on desktop + mobile

Task #19 from Wave 1 Frontend

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```
