# Grid Column Control Design

**Date:** 2025-11-04
**Status:** Approved
**Feature:** Independent grid view column configuration

## Problem Statement

Currently, the `thumbnailSize` setting in `tableSettingsStore` is shared between list view and grid view. When a user configures thumbnail size for the list view (small/medium/large/xlarge), this setting also affects the grid view, which is not ideal. Each view should have independent layout controls.

**User Impact:**
- Configuring list view thumbnail size unintentionally changes grid layout
- No way to control grid density independently
- Confusing UX where settings bleed across view modes

## Solution Overview

Separate list and grid view settings by:
1. **List view**: Keep existing `thumbnailSize` control (small/medium/large/xlarge)
2. **Grid view**: Add new `gridColumns` control (2, 3, 4, 5 columns)
3. Store both settings in `tableSettingsStore` but each view reads only its relevant setting

## Design Decisions

### State Management Architecture

**Approach Selected:** Single store with view-scoped settings (Approach 3)

**Rationale:**
- Minimal migration impact (extends existing `tableSettingsStore`)
- Single source of truth for all view-related settings
- Clean separation: list view ignores `gridColumns`, grid view ignores `thumbnailSize`
- Simpler localStorage management (one persisted object)
- Future-proof for adding more view-specific settings

**Alternatives Considered:**
- **Approach 1 (Single store, conditional logic)**: Rejected - creates coupling between views
- **Approach 2 (Separate stores)**: Rejected - over-engineering, adds complexity

### UI Component Location

**Location Selected:** Separate control near ViewModeToggle in toolbar

**Rationale:**
- Context proximity: Grid column control only matters in grid view
- Discoverability: Users see it immediately after switching to grid view
- Visual consistency: Matches YouTube's UI pattern (view controls in toolbar)
- Less cognitive load: No conditional dropdown content
- Simpler implementation: Button group in toolbar

### Responsive Behavior

**Desktop (lg+):** Shows user's full choice (2, 3, 4, or 5 columns)
**Tablet (md):** Scales down intelligently (max 2-3 columns)
**Mobile (sm):** Always 1 column for usability

**Example:**
- User selects "5 columns" → Desktop: 5, Tablet: 3, Mobile: 1
- User selects "2 columns" → Desktop: 2, Tablet: 2, Mobile: 1

### Thumbnail Scaling

**Approach Selected:** Auto-adapt to column width

**Rationale:**
- Simpler UX: One control affects both columns and thumbnail size
- CSS-based responsive scaling (no JavaScript calculations)
- Matches YouTube grid behavior
- More predictable than fixed sizes

## Technical Specification

### 1. State Management

**File:** `frontend/src/stores/tableSettingsStore.ts`

**New Type:**
```typescript
export type GridColumnCount = 2 | 3 | 4 | 5;
```

**Store Interface Update:**
```typescript
interface TableSettingsStore {
  thumbnailSize: ThumbnailSize;    // List view only
  gridColumns: GridColumnCount;     // Grid view only (NEW)
  viewMode: ViewMode;
  visibleColumns: VisibleColumns;

  setThumbnailSize: (size: ThumbnailSize) => void;
  setGridColumns: (count: GridColumnCount) => void;  // NEW
  setViewMode: (mode: ViewMode) => void;
  toggleColumn: (column: keyof VisibleColumns) => void;
}
```

**Default Value:**
```typescript
gridColumns: 3  // Matches current hardcoded behavior
```

### 2. UI Component

**New Component:** `frontend/src/components/GridColumnControl.tsx`

**Interface:**
```typescript
interface GridColumnControlProps {
  columnCount: GridColumnCount;
  onColumnCountChange: (count: GridColumnCount) => void;
}
```

**Visual Design:**
- Horizontal button group (4 buttons: "2", "3", "4", "5")
- Selected button: filled blue background
- Unselected buttons: light gray background
- Consistent with `ViewModeToggle` styling

**Integration in VideosPage:**
```tsx
<div className="flex gap-2">
  {/* ...existing buttons... */}
  <ViewModeToggle viewMode={viewMode} onToggle={setViewMode} />

  {viewMode === 'grid' && (
    <GridColumnControl
      columnCount={gridColumns}
      onColumnCountChange={setGridColumns}
    />
  )}
</div>
```

### 3. Grid Layout Implementation

**File:** `frontend/src/components/VideoGrid.tsx`

**Props Update:**
```typescript
interface VideoGridProps {
  videos: VideoResponse[];
  gridColumns: GridColumnCount;  // NEW
  onVideoClick: (video: VideoResponse) => void;
  onDelete: (videoId: string) => void;
}
```

**Tailwind Classes Mapping:**
```typescript
const gridColumnClasses = {
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  5: 'grid-cols-1 md:grid-cols-3 lg:grid-cols-5',
} as const;
```

**Container Implementation:**
```tsx
<div
  className={`video-grid grid ${gridColumnClasses[gridColumns]} gap-4 md:gap-6`}
  role="list"
  aria-label="Video Grid"
>
  {videos.map((video) => (
    <VideoCard key={video.id} video={video} {...} />
  ))}
</div>
```

**Key Points:**
- PurgeCSS-safe (no template literals in class names)
- No changes needed to `VideoCard` component
- Thumbnails scale via CSS (`w-full` on image)

## Testing Strategy

### Unit Tests

**1. tableSettingsStore.test.ts** (extend existing):
- Test `gridColumns` default value is 3
- Test `setGridColumns` updates state correctly
- Test localStorage persistence includes gridColumns
- Verify `thumbnailSize` and `gridColumns` are independent

**2. GridColumnControl.test.tsx** (new):
- Renders 4 buttons with correct labels
- Active state matches `columnCount` prop
- Calls `onColumnCountChange` when button clicked
- Keyboard navigation works (Tab, Enter, Space)
- Proper aria-labels for accessibility

**3. VideoGrid.test.tsx** (update existing):
- Add `gridColumns` prop to all test cases
- Test each column count (2, 3, 4, 5) applies correct CSS class
- Verify responsive breakpoints in class strings

### Integration Tests

**4. VideosPage.integration.test.tsx** (update):
- GridColumnControl only visible when `viewMode === 'grid'`
- Changing column count updates VideoGrid correctly
- Switching between list/grid preserves separate settings
- Thumbnail size change in list view doesn't affect grid

**Test Approach:** TDD (RED → GREEN → REFACTOR)

## Migration & Backwards Compatibility

### localStorage Migration

**Current State:**
```json
{
  "thumbnailSize": "small",
  "viewMode": "list",
  "visibleColumns": { ... }
}
```

**After Update:**
```json
{
  "thumbnailSize": "small",
  "gridColumns": 3,           // NEW (auto-populated)
  "viewMode": "list",
  "visibleColumns": { ... }
}
```

**Migration Strategy:**
- No migration script needed
- Zustand persist middleware handles new fields gracefully
- Default value `3` auto-populates on first load
- Non-breaking change for existing users

### Component Impact

**No Changes Needed:**
- `VideoCard.tsx`
- `ViewModeToggle.tsx`
- `TableSettingsDropdown.tsx`

**Minor Changes:**
- `VideoGrid.tsx` - Add `gridColumns` prop
- `VideosPage.tsx` - Add `GridColumnControl` component

**New Component:**
- `GridColumnControl.tsx`

### Edge Cases

1. **Invalid localStorage value** → Falls back to default (3)
2. **Grid control hidden in list view** → No user confusion
3. **View switching** → Each view reads only its relevant setting
4. **Mobile devices** → Responsive classes ensure usable layouts

## Rollout Plan

**Phase 1: Implementation**
1. Extend `tableSettingsStore` with `gridColumns`
2. Create `GridColumnControl` component
3. Update `VideoGrid` to accept and use `gridColumns` prop
4. Integrate into `VideosPage`

**Phase 2: Testing**
1. Write unit tests (TDD approach)
2. Write integration tests
3. Manual testing across devices (desktop, tablet, mobile)

**Phase 3: Deployment**
- Feature is additive and safe to deploy
- Default value preserves current behavior
- No user action required

## Success Criteria

- ✅ List view thumbnail size doesn't affect grid view
- ✅ Grid view column count is independently configurable
- ✅ Settings persist across page reloads
- ✅ GridColumnControl only visible in grid view
- ✅ Responsive behavior works on mobile, tablet, desktop
- ✅ All tests pass (unit + integration)
- ✅ No breaking changes for existing users

## Future Enhancements

Potential future additions to view settings:
- Grid card style variants (compact, comfortable, spacious)
- List view row height control
- Custom thumbnail aspect ratios
- Per-view sort preferences

## References

- Task tracking: Task #32 (Grid View Implementation)
- Related components: `ViewModeToggle.tsx`, `VideoGrid.tsx`, `VideoCard.tsx`
- Store: `tableSettingsStore.ts`
