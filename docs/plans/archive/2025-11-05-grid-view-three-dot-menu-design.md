# Grid View Three-Dot Menu Design

**Date:** 2025-11-05
**Status:** Approved
**Type:** Feature Addition

## Overview

Add a three-dot actions menu to VideoCard components in Grid View, matching the functionality already present in List View. This enables users to delete videos (and later add features like Share) directly from Grid View cards.

## Requirements

### Functional Requirements
- Three-dot menu button visible on every VideoCard in Grid View
- Menu contains "Delete" action (with room for future actions like Share, Edit)
- Clicking "Delete" opens existing ConfirmDeleteModal from VideosPage
- Menu click does NOT trigger video navigation (stopPropagation)

### UX Requirements
- **Position:** Top-right in content area, next to video title
- **Visibility:** Always visible (not hover-only)
- **Click Behavior:** Opens menu only, prevents video link navigation
- **Consistency:** Visual style matches List View menu button

### Non-Functional Requirements
- Accessibility: ARIA labels, keyboard navigation support
- Mobile-friendly: Touch targets meet WCAG guidelines
- Extensibility: Easy to add future menu items (Share, Edit, etc.)

## Design Decisions

### Architectural Approach
**Chosen:** Inline DropdownMenu in VideoCard

**Rationale:**
- Fastest implementation path
- Follows existing pattern in List View (VideosPage.tsx lines 351-394)
- Minimal code changes required
- Good enough for current needs

**Alternatives Considered:**
1. Shared VideoActionsMenu component - Better for long-term maintainability but requires refactoring both views
2. Menu-Builder Pattern - More flexible but adds unnecessary abstraction for current scope

**Future Refactoring Note:** If we add 3+ actions beyond Delete, consider extracting to shared component.

## Component Architecture

### Props Flow

```
VideosPage
  ├── deleteModal state (existing)
  ├── handleDeleteConfirm() (existing)
  ├── handleGridDeleteClick() (NEW)
  └── VideoGrid
        ├── onVideoClick (existing)
        ├── onDeleteVideo (NEW prop)
        └── VideoCard
              ├── onClick (existing)
              ├── onDelete (NEW prop)
              └── DropdownMenu
                    └── "Löschen" MenuItem
```

### Data Flow

1. User clicks "Löschen" in VideoCard → `onDelete(video)` called
2. VideoCard calls `props.onDelete` → VideoGrid receives event
3. VideoGrid forwards to `props.onDeleteVideo` → VideosPage receives event
4. VideosPage opens `ConfirmDeleteModal` with video details
5. User confirms → `deleteVideo.mutate()` called (existing hook)
6. TanStack Query invalidates cache → UI updates

**Why this flow?**
- Reuses existing ConfirmDeleteModal infrastructure
- VideoCard remains presentational (no business logic)
- Consistent with List View delete pattern
- No state duplication

## UI/UX Design

### Visual Layout

```
┌─────────────────────────────┐
│  [Thumbnail with Duration]  │
├─────────────────────────────┤
│ Title (2 lines max)    [⋮]  │ ← Menu button here
│ Channel name                │
│ [Tag] [Tag]                 │
└─────────────────────────────┘
```

### Layout Implementation

```tsx
<div className="p-3 space-y-2">
  {/* Header: Title + Menu */}
  <div className="flex items-start gap-2">
    <h3 className="flex-1 text-sm font-semibold line-clamp-2 leading-tight">
      {video.title}
    </h3>
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.stopPropagation()
          }
        }}
        tabIndex={-1}
        className="inline-flex items-center justify-center w-8 h-8 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0"
        aria-label="Aktionen"
      >
        {/* 3-dot icon SVG */}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation()
            onDelete?.(video)
          }}
          className="text-red-600 focus:text-red-700 cursor-pointer"
        >
          {/* Trash icon + "Löschen" */}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>

  {/* Channel (existing) */}
  {video.channel && (
    <p className="text-xs text-muted-foreground truncate">
      {video.channel}
    </p>
  )}

  {/* Tags (existing) */}
  {video.tags && video.tags.length > 0 && (
    <div className="flex flex-wrap gap-1">
      {/* Tag chips */}
    </div>
  )}
</div>
```

### Styling Details

**Menu Button:**
- Size: `w-8 h-8` (32x32px touch target - WCAG compliant)
- Colors: `text-gray-400 hover:text-gray-600 hover:bg-gray-100`
- Shape: `rounded-full` with smooth `transition-colors`
- Visibility: Always visible (not conditional on hover)
- Flex: `flex-shrink-0` to prevent button compression

**Title Adjustment:**
- Change from fixed width to `flex-1` (fills available space)
- Maintains `line-clamp-2` for 2-line max display
- Works with menu button via flexbox gap

**Menu Item (Delete):**
- Text: Red color (`text-red-600 focus:text-red-700`)
- Icon: Trash icon (reuse from List View)
- Cursor: `cursor-pointer` for UX feedback

### Event Handling (Defense in Depth)

**Problem:** Clicking menu button should NOT navigate to video.

**Solution:** Multiple layers of prevention
1. `onClick={(e) => e.stopPropagation()}` on DropdownMenuTrigger
2. `onKeyDown` handler for Enter/Space keyboard events
3. `onClick={(e) => e.stopPropagation()}` on DropdownMenuItem
4. `tabIndex={-1}` on trigger (keeps card as primary keyboard target)

**Reference:** Same pattern as List View (VideosPage.tsx:352-358)

## Implementation Plan

### Files to Modify

1. **VideoCard.tsx** (frontend/src/components/VideoCard.tsx)
   - Add `onDelete?: (video: VideoResponse) => void` prop to interface
   - Import DropdownMenu components from `@/components/ui/dropdown-menu`
   - Restructure card content layout (title + menu in flex container)
   - Add DropdownMenu with 3-dot button and Delete menu item
   - Reuse existing SVG icons from List View

2. **VideoGrid.tsx** (frontend/src/components/VideoGrid.tsx)
   - Add `onDeleteVideo?: (video: VideoResponse) => void` to VideoGridProps interface
   - Pass prop to VideoCard: `onDelete={onDeleteVideo}`
   - No other changes needed

3. **VideosPage.tsx** (frontend/src/components/VideosPage.tsx)
   - Create handler function:
     ```tsx
     const handleGridDeleteClick = (video: VideoResponse) => {
       setDeleteModal({
         open: true,
         videoId: video.id,
         videoTitle: video.title || `Video ${video.youtube_id}` || 'Unbekanntes Video'
       })
     }
     ```
   - Pass to VideoGrid: `<VideoGrid ... onDeleteVideo={handleGridDeleteClick} />`
   - No changes to existing ConfirmDeleteModal or delete logic

### Code Reuse Strategy

**From List View (VideosPage.tsx:351-394):**
- DropdownMenu structure and props
- 3-dot SVG icon markup
- Trash icon SVG markup
- Event handling pattern (stopPropagation)
- Styling classes

**Benefit:** Consistency + reduced testing surface area

## Testing Strategy

### Unit Tests

**VideoCard.test.tsx** - Add new tests:
```tsx
describe('VideoCard three-dot menu', () => {
  it('renders three-dot menu button', () => {
    // Verify button exists with correct ARIA label
  })

  it('calls onDelete when delete menu item clicked', async () => {
    // Mock onDelete, click menu, click delete, verify called
  })

  it('prevents video click when menu button clicked', async () => {
    // Click menu button, verify onClick NOT called (stopPropagation)
  })

  it('menu button has correct accessibility attributes', () => {
    // Verify ARIA label, tabIndex, role
  })

  it('delete menu item has red styling', () => {
    // Open menu, verify delete item has text-red-600 class
  })
})
```

**VideoGrid.test.tsx** - Update existing:
```tsx
describe('VideoGrid with delete handler', () => {
  it('passes onDeleteVideo to VideoCard', () => {
    // Render with onDeleteVideo prop, verify passed to cards
  })
})
```

### Integration Tests

**VideosPage.integration.test.tsx** - Add:
```tsx
describe('Grid view delete flow', () => {
  it('deletes video from grid view via three-dot menu', async () => {
    // 1. Render VideosPage in grid mode
    // 2. Open three-dot menu on first card
    // 3. Click "Löschen"
    // 4. Verify ConfirmDeleteModal opens
    // 5. Click confirm
    // 6. Verify API called with correct video ID
    // 7. Verify video removed from grid
  })

  it('cancels delete from grid view', async () => {
    // Open menu, click delete, click cancel
    // Verify modal closes, video still in grid
  })
})
```

### Accessibility Testing Checklist
- [ ] ARIA label present on menu button
- [ ] Keyboard navigation works (Tab to card, Space/Enter to open video)
- [ ] Menu opens with mouse click
- [ ] Menu opens with keyboard (focus + activate)
- [ ] Delete item accessible via keyboard in dropdown
- [ ] Focus management correct after delete
- [ ] Screen reader announces button purpose

### Manual Testing Checklist
- [ ] Menu button visible in all grid column counts (2, 3, 4, 5)
- [ ] Menu button doesn't wrap or clip at narrow widths
- [ ] Click menu button does NOT open video
- [ ] Click delete opens ConfirmDeleteModal
- [ ] Modal shows correct video title
- [ ] Delete confirmation removes video from grid
- [ ] Cancel preserves video in grid
- [ ] Works on touch devices (mobile/tablet)

## Technical Considerations

### Responsive Behavior
- Menu button has fixed `w-8 h-8` size (doesn't scale)
- Title uses `flex-1` to fill remaining space
- Gap between title and button: `gap-2` (8px)
- Works in all grid column counts (2-5 columns)

### Keyboard Navigation
- Card remains primary keyboard target (`tabIndex={0}`)
- Menu button has `tabIndex={-1}` (excludes from tab order)
- User tabs to card → Space/Enter opens video (existing behavior)
- Menu accessed via mouse/touch only (acceptable trade-off)

**Future Enhancement:** If keyboard menu access needed, add `tabIndex={0}` and update keyboard handling.

### Mobile/Touch Support
- 32x32px touch target meets WCAG 2.1 AA (24x24px minimum)
- No hover states required for visibility (always visible)
- Radix UI DropdownMenu handles touch events automatically
- `modal={false}` prevents focus trapping issues on mobile

### Performance
- No new network requests
- No additional state management
- Reuses existing delete mutation and modal
- Minimal re-render impact (prop drilling only)

## Future Extensibility

### Adding New Menu Items

To add Share, Edit, or other actions:

```tsx
<DropdownMenuContent align="end">
  <DropdownMenuItem onClick={...}>
    {/* Icon */} Löschen
  </DropdownMenuItem>

  {/* NEW ITEMS HERE */}
  <DropdownMenuItem onClick={...}>
    {/* Icon */} Teilen
  </DropdownMenuItem>

  <DropdownMenuItem onClick={...}>
    {/* Icon */} Bearbeiten
  </DropdownMenuItem>
</DropdownMenuContent>
```

**When to Refactor:**
- If menu grows to 3+ items → Consider shared `VideoActionsMenu` component
- If List View and Grid View menus diverge → Keep separate implementations
- If complex menu logic needed → Extract to custom hook

### Migration Path to Shared Component

If we later extract to `VideoActionsMenu.tsx`:

1. Create new component with props: `video`, `onDelete`, `onShare`, etc.
2. Replace inline menu in VideoCard with `<VideoActionsMenu video={video} onDelete={onDelete} />`
3. Replace inline menu in List View (VideosPage table cell) with same component
4. Benefits: Single source of truth, easier to add actions globally

**Don't refactor prematurely** - inline approach is simpler until we actually need shared component.

## Risk Analysis

### Low Risk
- Reuses existing patterns (List View menu)
- No new dependencies
- Isolated to VideoCard component
- Backward compatible (optional props)

### Medium Risk
- Mobile touch targets could be tight in narrow columns
  - Mitigation: 32x32px button is WCAG compliant, tested in all column counts

### No Risk
- No breaking changes
- No API changes
- No state management changes
- Tests prevent regressions

## Success Criteria

**Functional:**
- [ ] Three-dot menu visible on all VideoCard instances in Grid View
- [ ] Clicking menu button does NOT navigate to video
- [ ] Clicking "Löschen" opens ConfirmDeleteModal with correct video
- [ ] Delete confirmation removes video from grid
- [ ] Cancel preserves video in grid

**Non-Functional:**
- [ ] All unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing checklist completed
- [ ] Accessibility checklist completed
- [ ] Works on mobile/tablet devices
- [ ] Performance: No noticeable slowdown with 100+ videos

**Code Quality:**
- [ ] Follows existing code style (Prettier, ESLint)
- [ ] TypeScript types correct (no `any`)
- [ ] Comments explain non-obvious behavior (stopPropagation rationale)
- [ ] Reuses existing components and patterns

## References

- List View implementation: `frontend/src/components/VideosPage.tsx:351-394`
- VideoCard component: `frontend/src/components/VideoCard.tsx`
- VideoGrid component: `frontend/src/components/VideoGrid.tsx`
- ConfirmDeleteModal: `frontend/src/components/ConfirmDeleteModal.tsx`
- Radix UI DropdownMenu docs: https://www.radix-ui.com/docs/primitives/components/dropdown-menu
- WCAG 2.1 Touch Target Size: https://www.w3.org/WAI/WCAG21/Understanding/target-size.html
