# Task #46: Create TagChips Component for Video Tags

**Plan Task:** #46
**Wave/Phase:** Phase 3: YouTube-Grid Interface (MODERNE UX)
**Dependencies:** Task #32 (VideoCard), Task #16 (tagStore), Task #1-8 (Tag System)

---

## 🎯 Ziel

Create a reusable `<TagChips>` component that displays video tags as clickable chips/badges on both Grid View cards and List View table rows. Chips should be clickable for tag filtering, support color visualization, show max 3-4 tags with overflow indicator, and be responsive (hidden on mobile).

---

## 📋 Acceptance Criteria

- [ ] Reusable `<TagChips>` component displays tags from `video.tags` array
- [ ] Clicking a tag chip adds it to `tagStore.selectedTagIds` for filtering
- [ ] Tag color (if present) displays as colored dot before tag name
- [ ] Max 3 visible tags, remaining shown as "+N more" indicator
- [ ] Hover on "+N more" shows Tooltip with all remaining tag names
- [ ] Component hidden on mobile (`< 768px`), visible on tablet+ (`>= 768px`)
- [ ] Integrated into VideoCard component (Grid View)
- [ ] Integrated into table rows in VideosPage (List View)
- [ ] 8+ unit tests passing (chip rendering, click behavior, overflow, tooltip, responsive)
- [ ] 2+ integration tests passing (filtering integration, color display)
- [ ] TypeScript strict mode with 0 new errors
- [ ] WCAG 2.1 Level AA compliant (keyboard navigation, ARIA labels)

---

## 🛠️ Implementation Steps

### Step 1: Install shadcn/ui Badge and Tooltip Components

**Files:** `frontend/src/components/ui/badge.tsx`, `frontend/src/components/ui/tooltip.tsx`
**Action:** Install missing shadcn/ui components for tag display and overflow tooltip

**Commands:**
```bash
cd frontend
npx shadcn@latest add badge
npx shadcn@latest add tooltip
```

**Verification:**
- Verify `frontend/src/components/ui/badge.tsx` exists
- Verify `frontend/src/components/ui/tooltip.tsx` exists
- Check Radix UI dependencies added to package.json: `@radix-ui/react-tooltip`

---

### Step 2: Create TagChips Component with TDD Approach

**Files:** `frontend/src/components/TagChips.test.tsx` (create)
**Action:** Write failing tests BEFORE implementation (TDD)

**Complete Test File:**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TagChips } from './TagChips'
import type { TagResponse } from '@/types/tag'

// Mock tagStore
const mockToggleTag = vi.fn()
vi.mock('@/stores/tagStore', () => ({
  useTagStore: vi.fn(() => ({
    toggleTag: mockToggleTag,
  })),
}))

describe('TagChips', () => {
  beforeEach(() => {
    mockToggleTag.mockClear()
  })

  const sampleTags: TagResponse[] = [
    {
      id: 'tag-1',
      name: 'Python',
      color: '#3776ab',
      user_id: 'user-1',
      schema_id: null,
      schema: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'tag-2',
      name: 'Tutorial',
      color: null,
      user_id: 'user-1',
      schema_id: null,
      schema: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'tag-3',
      name: 'Advanced',
      color: '#ff5722',
      user_id: 'user-1',
      schema_id: null,
      schema: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ]

  describe('Basic Rendering', () => {
    it('renders all tags when count <= 3', () => {
      render(<TagChips tags={sampleTags.slice(0, 3)} maxVisible={3} />)
      
      expect(screen.getByText('Python')).toBeInTheDocument()
      expect(screen.getByText('Tutorial')).toBeInTheDocument()
      expect(screen.getByText('Advanced')).toBeInTheDocument()
      expect(screen.queryByText(/\+\d+ more/)).not.toBeInTheDocument()
    })

    it('renders empty state when tags array is empty', () => {
      const { container } = render(<TagChips tags={[]} maxVisible={3} />)
      
      expect(container.firstChild).toBeNull()
    })

    it('renders color dot when tag has color', () => {
      render(<TagChips tags={[sampleTags[0]]} maxVisible={3} />)
      
      const colorDot = screen.getByTestId('tag-color-dot-tag-1')
      expect(colorDot).toHaveStyle({ backgroundColor: '#3776ab' })
    })

    it('does NOT render color dot when tag has no color', () => {
      render(<TagChips tags={[sampleTags[1]]} maxVisible={3} />)
      
      expect(screen.queryByTestId('tag-color-dot-tag-2')).not.toBeInTheDocument()
    })
  })

  describe('Click Behavior', () => {
    it('calls toggleTag when chip is clicked', async () => {
      const user = userEvent.setup()
      render(<TagChips tags={[sampleTags[0]]} maxVisible={3} />)
      
      const chip = screen.getByRole('button', { name: /Python/i })
      await user.click(chip)
      
      expect(mockToggleTag).toHaveBeenCalledWith('tag-1')
      expect(mockToggleTag).toHaveBeenCalledTimes(1)
    })

    it('supports keyboard navigation (Enter key)', async () => {
      const user = userEvent.setup()
      render(<TagChips tags={[sampleTags[0]]} maxVisible={3} />)
      
      const chip = screen.getByRole('button', { name: /Python/i })
      chip.focus()
      await user.keyboard('{Enter}')
      
      expect(mockToggleTag).toHaveBeenCalledWith('tag-1')
    })

    it('supports keyboard navigation (Space key)', async () => {
      const user = userEvent.setup()
      render(<TagChips tags={[sampleTags[0]]} maxVisible={3} />)
      
      const chip = screen.getByRole('button', { name: /Python/i })
      chip.focus()
      await user.keyboard(' ')
      
      expect(mockToggleTag).toHaveBeenCalledWith('tag-1')
    })
  })

  describe('Overflow Behavior', () => {
    const manyTags: TagResponse[] = [
      ...sampleTags,
      {
        id: 'tag-4',
        name: 'Web Development',
        color: null,
        user_id: 'user-1',
        schema_id: null,
        schema: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'tag-5',
        name: 'Backend',
        color: '#4caf50',
        user_id: 'user-1',
        schema_id: null,
        schema: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]

    it('shows "+N more" when tags exceed maxVisible', () => {
      render(<TagChips tags={manyTags} maxVisible={3} />)
      
      expect(screen.getByText('Python')).toBeInTheDocument()
      expect(screen.getByText('Tutorial')).toBeInTheDocument()
      expect(screen.getByText('Advanced')).toBeInTheDocument()
      expect(screen.getByText('+2 more')).toBeInTheDocument()
      expect(screen.queryByText('Web Development')).not.toBeInTheDocument()
      expect(screen.queryByText('Backend')).not.toBeInTheDocument()
    })

    it('shows tooltip with all tag names on "+N more" hover', async () => {
      const user = userEvent.setup()
      render(<TagChips tags={manyTags} maxVisible={3} />)
      
      const moreIndicator = screen.getByText('+2 more')
      await user.hover(moreIndicator)
      
      // Wait for tooltip to appear (Radix UI uses Portal)
      const tooltip = await screen.findByRole('tooltip')
      expect(tooltip).toHaveTextContent('Web Development, Backend')
    })
  })

  describe('Responsive Display', () => {
    it('hides on mobile with hidden md:flex classes', () => {
      const { container } = render(<TagChips tags={sampleTags} maxVisible={3} />)
      
      const wrapper = container.firstChild as HTMLElement
      expect(wrapper).toHaveClass('hidden')
      expect(wrapper).toHaveClass('md:flex')
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA labels on chips', () => {
      render(<TagChips tags={[sampleTags[0]]} maxVisible={3} />)
      
      const chip = screen.getByRole('button', { name: /Python/i })
      expect(chip).toHaveAttribute('aria-label', expect.stringContaining('Python'))
    })

    it('has focusable chips with keyboard navigation', () => {
      render(<TagChips tags={sampleTags} maxVisible={3} />)
      
      const chips = screen.getAllByRole('button')
      chips.forEach(chip => {
        expect(chip).toHaveAttribute('tabIndex', '0')
      })
    })
  })
})
```

---

### Step 3: Implement TagChips Component

**Files:** `frontend/src/components/TagChips.tsx` (create)
**Action:** Implement component following REF MCP best practices from shadcn/ui Badge and Radix UI Tooltip

**Complete Implementation:**
```typescript
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useTagStore } from '@/stores/tagStore'
import type { TagResponse } from '@/types/tag'

interface TagChipsProps {
  /**
   * Array of tags to display as chips
   */
  tags: TagResponse[]
  
  /**
   * Maximum number of visible tags before showing "+N more" indicator
   * @default 3
   */
  maxVisible?: number
}

/**
 * TagChips Component
 * 
 * Displays video tags as clickable chips/badges with:
 * - Color visualization (colored dot before name)
 * - Click-to-filter behavior (toggles tag selection)
 * - Overflow handling (max N visible, "+N more" tooltip)
 * - Responsive display (hidden on mobile, visible on tablet+)
 * - Full keyboard accessibility (Enter, Space, Tab navigation)
 * 
 * REF MCP Improvements Applied:
 * - shadcn/ui Badge component (variant="secondary" for tag styling)
 * - Radix UI Tooltip for overflow indicator hover
 * - Tailwind responsive classes (hidden md:flex for mobile)
 * - WCAG 2.1 compliant (role="button", aria-label, tabIndex)
 * 
 * @example
 * ```tsx
 * <TagChips tags={video.tags} maxVisible={3} />
 * ```
 */
export const TagChips = ({ tags, maxVisible = 3 }: TagChipsProps) => {
  const toggleTag = useTagStore((state) => state.toggleTag)

  // Early return for empty tags
  if (tags.length === 0) {
    return null
  }

  const visibleTags = tags.slice(0, maxVisible)
  const overflowTags = tags.slice(maxVisible)
  const hasOverflow = overflowTags.length > 0

  const handleChipClick = (tagId: string) => {
    toggleTag(tagId)
  }

  const handleKeyDown = (e: React.KeyboardEvent, tagId: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggleTag(tagId)
    }
  }

  return (
    // REF MCP: Responsive wrapper - hidden on mobile (< 768px), flex on tablet+ (>= 768px)
    <div className="hidden md:flex flex-wrap gap-1">
      {/* Visible Tags */}
      {visibleTags.map((tag) => (
        <Badge
          key={tag.id}
          variant="secondary"
          role="button"
          tabIndex={0}
          aria-label={`Filter by tag: ${tag.name}`}
          onClick={() => handleChipClick(tag.id)}
          onKeyDown={(e) => handleKeyDown(e, tag.id)}
          className="cursor-pointer hover:bg-secondary/80 transition-colors inline-flex items-center gap-1"
        >
          {/* Color Dot (if tag has color) */}
          {tag.color && (
            <div
              data-testid={`tag-color-dot-${tag.id}`}
              className="h-2 w-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: tag.color }}
              aria-hidden="true"
            />
          )}
          <span className="text-xs">{tag.name}</span>
        </Badge>
      ))}

      {/* Overflow Indicator with Tooltip */}
      {hasOverflow && (
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className="text-xs cursor-default"
                aria-label={`${overflowTags.length} more tags`}
              >
                +{overflowTags.length} more
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" align="start">
              <p className="text-sm">
                {overflowTags.map(tag => tag.name).join(', ')}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  )
}
```

---

### Step 4: Integrate into VideoCard Component

**Files:** `frontend/src/components/VideoCard.tsx`
**Action:** Replace existing tag display logic (lines 133-151) with `<TagChips>` component

**Changes:**
```typescript
// REMOVE lines 133-151 (old tag display logic):
// {video.tags && video.tags.length > 0 && (
//   <div className="flex flex-wrap gap-1">
//     {video.tags.map((tag) => (
//       <span ...>...</span>
//     ))}
//   </div>
// )}

// ADD import at top:
import { TagChips } from './TagChips'

// REPLACE with (after Channel Name section, around line 133):
{/* Tags */}
<TagChips tags={video.tags} maxVisible={3} />
```

**Complete Diff:**
```diff
+ import { TagChips } from './TagChips'

  export const VideoCard = ({ video, onClick, onDelete }: VideoCardProps) => {
    // ... existing code ...

    {/* Channel Name */}
    {((video as any).channel_name || video.channel) && (
      <p className="text-xs text-muted-foreground truncate">
        {(video as any).channel_name || video.channel}
      </p>
    )}

    {/* Tags */}
-   {video.tags && video.tags.length > 0 && (
-     <div className="flex flex-wrap gap-1">
-       {video.tags.map((tag) => (
-         <span
-           key={tag.id}
-           className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs"
-         >
-           {tag.color && (
-             <div
-               className="h-2 w-2 rounded-full"
-               style={{ backgroundColor: tag.color }}
-             />
-           )}
-           <span>{tag.name}</span>
-         </span>
-       ))}
-     </div>
-   )}
+   <TagChips tags={video.tags} maxVisible={3} />
  }
```

---

### Step 5: Integrate into VideosPage Table Rows

**Files:** `frontend/src/components/VideosPage.tsx`
**Action:** Add Tags column to table with `<TagChips>` component

**Changes:**
```typescript
// ADD import at top (around line 43):
import { TagChips } from './TagChips'

// ADD new column after Duration column (after line 344, before menu column):
// Column 4: Tags
columnHelper.accessor('tags', {
  id: 'tags',
  header: 'Tags',
  cell: (info) => {
    const tags = info.getValue()
    return <TagChips tags={tags} maxVisible={3} />
  },
}),

// Column 5: Three-dot menu (was Column 4)
columnHelper.accessor('id', {
  id: 'menu',
  header: '', // No header text - just icon column
  // ... existing menu code ...
}),
```

**Complete Implementation:**
```typescript
const columns = useMemo(
  () => {
    const allColumns = [
      // Column 1: Thumbnail
      columnHelper.accessor('thumbnail_url', {
        id: 'thumbnail',
        header: 'Vorschau',
        cell: (info) => {
          const thumbnailUrl = info.getValue()
          const row = info.row.original
          const title = row.title || `Video ${row.youtube_id}`
          return <VideoThumbnail url={thumbnailUrl} title={title} />
        },
      }),

      // Column 2: Title + Channel
      columnHelper.accessor('title', {
        id: 'title',
        header: 'Titel',
        cell: (info) => {
          const row = info.row.original
          const title = info.getValue() || `Video ${row.youtube_id}`
          const channel = row.channel
          return (
            <div className="flex flex-col gap-1 min-w-[200px] max-w-[400px]">
              <span className="font-medium text-gray-900 line-clamp-2 leading-tight" title={title}>
                {title}
              </span>
              {channel && (
                <span className="text-sm text-gray-600 truncate">
                  {channel}
                </span>
              )}
            </div>
          )
        },
      }),

      // Column 3: Duration
      columnHelper.accessor('duration', {
        id: 'duration',
        header: 'Dauer',
        cell: (info) => {
          const duration = info.getValue()
          return (
            <span className="text-sm text-gray-700 font-mono tabular-nums">
              {formatDuration(duration)}
            </span>
          )
        },
      }),

      // Column 4: Tags (NEW)
      columnHelper.accessor('tags', {
        id: 'tags',
        header: 'Tags',
        cell: (info) => {
          const tags = info.getValue()
          return <TagChips tags={tags} maxVisible={3} />
        },
      }),

      // Column 5: Three-dot menu (was Column 4)
      columnHelper.accessor('id', {
        id: 'menu',
        header: '', // No header text - just icon column
        // ... existing menu code unchanged ...
      }),
    ]

    // Filter columns based on visibility settings
    return allColumns.filter((col) => {
      const colId = col.id as keyof typeof visibleColumns
      return visibleColumns[colId] !== false
    })
  },
  [visibleColumns]
)
```

---

### Step 6: Update Table Settings Store

**Files:** `frontend/src/stores/tableSettingsStore.ts`
**Action:** Add `tags` column to `visibleColumns` state with default `true`

**Changes:**
```typescript
interface TableSettingsState {
  visibleColumns: {
    thumbnail: boolean
    title: boolean
    duration: boolean
    tags: boolean // ADD THIS
    menu: boolean
  }
  // ... rest unchanged
}

const initialState: TableSettingsState = {
  visibleColumns: {
    thumbnail: true,
    title: true,
    duration: true,
    tags: true, // ADD THIS - visible by default
    menu: true,
  },
  // ... rest unchanged
}
```

---

### Step 7: Update TableSettingsDropdown Component

**Files:** `frontend/src/components/TableSettingsDropdown.tsx`
**Action:** Add Tags checkbox to column visibility section

**Changes:**
```typescript
{/* Column Visibility Section */}
<DropdownMenuLabel>Spalten</DropdownMenuLabel>

<DropdownMenuItem
  onClick={(e) => {
    e.preventDefault()
    toggleColumn('thumbnail')
  }}
>
  <DropdownMenuCheckboxItem
    checked={visibleColumns.thumbnail}
    onCheckedChange={() => toggleColumn('thumbnail')}
  >
    Vorschau
  </DropdownMenuCheckboxItem>
</DropdownMenuItem>

<DropdownMenuItem
  onClick={(e) => {
    e.preventDefault()
    toggleColumn('title')
  }}
>
  <DropdownMenuCheckboxItem
    checked={visibleColumns.title}
    onCheckedChange={() => toggleColumn('title')}
  >
    Titel
  </DropdownMenuCheckboxItem>
</DropdownMenuItem>

<DropdownMenuItem
  onClick={(e) => {
    e.preventDefault()
    toggleColumn('duration')
  }}
>
  <DropdownMenuCheckboxItem
    checked={visibleColumns.duration}
    onCheckedChange={() => toggleColumn('duration')}
  >
    Dauer
  </DropdownMenuCheckboxItem>
</DropdownMenuItem>

{/* ADD THIS NEW ITEM: */}
<DropdownMenuItem
  onClick={(e) => {
    e.preventDefault()
    toggleColumn('tags')
  }}
>
  <DropdownMenuCheckboxItem
    checked={visibleColumns.tags}
    onCheckedChange={() => toggleColumn('tags')}
  >
    Tags
  </DropdownMenuCheckboxItem>
</DropdownMenuItem>
```

---

### Step 8: Run Tests and Verify

**Action:** Run all tests to verify component works correctly

**Commands:**
```bash
cd frontend

# Run TagChips unit tests
npm test -- TagChips

# Run VideoCard tests (verify integration)
npm test -- VideoCard

# Run all tests
npm test

# TypeScript check
npx tsc --noEmit
```

**Expected Results:**
- 15+ TagChips tests passing (basic rendering, click behavior, overflow, responsive, accessibility)
- 11 VideoCard tests passing (with TagChips integration)
- 0 new TypeScript errors

---

### Step 9: Manual Testing Checklist

**Action:** Perform comprehensive manual testing in browser

**Scenarios:**

1. **Grid View - Basic Display:**
   - [ ] Navigate to Videos page in Grid mode
   - [ ] Verify tags display below channel name on video cards
   - [ ] Verify tags hidden on mobile (< 768px width)
   - [ ] Verify tags visible on tablet+ (>= 768px width)

2. **Grid View - Color Visualization:**
   - [ ] Create a tag with color via TagNavigation "+"
   - [ ] Assign colored tag to a video
   - [ ] Verify colored dot displays before tag name
   - [ ] Verify dot color matches tag color exactly

3. **Grid View - Click Behavior:**
   - [ ] Click on a tag chip
   - [ ] Verify tag is added to TagNavigation selected state
   - [ ] Verify video list filters by clicked tag
   - [ ] Click same tag again
   - [ ] Verify tag is removed from selection (toggle behavior)

4. **Grid View - Keyboard Navigation:**
   - [ ] Tab to a tag chip
   - [ ] Verify focus ring visible
   - [ ] Press Enter key
   - [ ] Verify tag toggles selection
   - [ ] Press Space key
   - [ ] Verify tag toggles selection

5. **Grid View - Overflow Display:**
   - [ ] Assign 5+ tags to a video
   - [ ] Verify only first 3 tags display as chips
   - [ ] Verify "+N more" indicator displays (e.g., "+2 more")
   - [ ] Hover over "+N more"
   - [ ] Verify tooltip appears with remaining tag names
   - [ ] Verify tooltip uses comma-separated format

6. **List View - Basic Display:**
   - [ ] Switch to List View mode
   - [ ] Verify Tags column displays between Duration and Menu
   - [ ] Verify TagChips component renders in table cells
   - [ ] Verify responsive behavior (hidden on mobile)

7. **List View - Column Visibility:**
   - [ ] Open TableSettingsDropdown
   - [ ] Verify "Tags" checkbox is present
   - [ ] Uncheck "Tags" checkbox
   - [ ] Verify Tags column hides
   - [ ] Check "Tags" checkbox
   - [ ] Verify Tags column shows again

8. **List View - Click Behavior:**
   - [ ] Click on a tag chip in table row
   - [ ] Verify tag filtering works (same as Grid View)
   - [ ] Verify table row click does NOT trigger when clicking tag
   - [ ] Verify stopPropagation prevents row click

9. **Accessibility - Screen Reader:**
   - [ ] Enable VoiceOver (macOS) or NVDA (Windows)
   - [ ] Tab to tag chips
   - [ ] Verify aria-label announces "Filter by tag: [TagName]"
   - [ ] Verify overflow indicator announces "[N] more tags"

10. **Edge Cases:**
    - [ ] Video with 0 tags: Verify no chips or empty state message
    - [ ] Video with exactly 3 tags: Verify no "+N more" indicator
    - [ ] Video with 1 tag: Verify single chip displays correctly
    - [ ] Long tag name: Verify no layout breaking, text wraps or truncates

---

### Step 10: Update CLAUDE.md Documentation

**Files:** `CLAUDE.md`
**Action:** Document TagChips component under "Known Patterns & Conventions"

**Add Section:**
```markdown
### Tag Chip Display System

- Tags displayed as clickable chips/badges via `<TagChips>` component
- Click behavior: `toggleTag(tagId)` from `tagStore` (adds/removes from filter)
- Overflow handling: Max 3 visible tags, "+N more" with Tooltip for remaining
- Color visualization: Colored dot before tag name if `tag.color` present
- Responsive: Hidden on mobile (`< 768px`), visible on tablet+ (`>= 768px`)
- Integrated in Grid View: `VideoCard` component (below channel name)
- Integrated in List View: Tags column in `VideosPage` table (between Duration and Menu)
- Column visibility: Controlled by `tableSettingsStore.visibleColumns.tags`
- Accessibility: Full keyboard navigation (Enter, Space), ARIA labels, focus management
```

---

### Step 11: Create Handoff Log

**Files:** `docs/handoffs/2025-11-08-log-046-tag-chips-component.md` (create)
**Action:** Document implementation details for future reference

**Template:**
```markdown
# Handoff Log #046: TagChips Component

**Date:** 2025-11-08
**Task:** #46 - Create TagChips Component for Video Tags
**Duration:** [ACTUAL_TIME] minutes

## Implementation Summary

Created reusable `<TagChips>` component for displaying video tags as clickable chips/badges:
- shadcn/ui Badge component for tag styling
- Radix UI Tooltip for overflow indicator
- Click-to-filter behavior via `tagStore.toggleTag()`
- Max 3 visible tags, "+N more" with tooltip
- Color visualization with colored dots
- Responsive display (hidden mobile, visible tablet+)

## Files Modified

- `frontend/src/components/TagChips.tsx` (create, +147 lines)
- `frontend/src/components/TagChips.test.tsx` (create, +215 lines)
- `frontend/src/components/VideoCard.tsx` (+2/-19 lines)
- `frontend/src/components/VideosPage.tsx` (+12 lines)
- `frontend/src/stores/tableSettingsStore.ts` (+2 lines)
- `frontend/src/components/TableSettingsDropdown.tsx` (+15 lines)
- `frontend/src/components/ui/badge.tsx` (create, shadcn/ui)
- `frontend/src/components/ui/tooltip.tsx` (create, shadcn/ui)
- `CLAUDE.md` (+10 lines)

## Test Results

- 15/15 TagChips unit tests passing
- 11/11 VideoCard integration tests passing
- 0 new TypeScript errors
- WCAG 2.1 Level AA compliant

## REF MCP Improvements Applied

1. **shadcn/ui Badge API** - Variant="secondary" for tag styling (not custom CSS)
2. **Radix UI Tooltip** - Proper Provider/Trigger/Content structure with delayDuration
3. **Tailwind Responsive** - Mobile-first approach with `hidden md:flex`
4. **Clickable UX** - Role="button", tabIndex, keyboard support (Enter, Space)
5. **PurgeCSS Safety** - Explicit className strings (no template literals)

## Design Decisions

1. **Max 3 Visible Tags** - Prevents layout overflow, YouTube-style UX
2. **Tooltip on Overflow** - Better than expanding (preserves card size)
3. **Click-to-Filter** - Direct integration with existing tag filtering system
4. **Color Dot Pattern** - Reused from VideoCard (consistent visualization)
5. **Responsive Hidden** - Mobile users prioritize title/thumbnail over tags

## Manual Testing Completed

- [x] Grid View display and click behavior
- [x] List View table integration
- [x] Color visualization accuracy
- [x] Overflow tooltip functionality
- [x] Keyboard navigation (Enter, Space, Tab)
- [x] Responsive breakpoints (mobile/tablet/desktop)
- [x] Column visibility toggle
- [x] Screen reader accessibility (VoiceOver)
- [x] Edge cases (0 tags, 1 tag, 3 tags, 5+ tags)

## Known Limitations

- Tooltip requires hover (not accessible on touch devices) - Consider mobile long-press in future
- Max 3 tags is hardcoded - Could be configurable in future
- No tag editing from chips - Future enhancement: right-click context menu

## Next Steps

- Task #47: Add export filtered/all videos to settings
- Task #54: Create search bar with debouncing
- Task #106: Implement AI-powered duplicate detection
```

---

## 🧪 Testing Strategy

### Unit Tests (15 tests)

**File:** `frontend/src/components/TagChips.test.tsx`

1. **Basic Rendering (4 tests):**
   - Renders all tags when count <= maxVisible (3 tags)
   - Renders empty state when tags array is empty (null return)
   - Renders color dot when tag.color present (data-testid, style check)
   - Does NOT render color dot when tag.color is null

2. **Click Behavior (3 tests):**
   - Calls toggleTag(tagId) when chip is clicked
   - Supports keyboard navigation with Enter key
   - Supports keyboard navigation with Space key

3. **Overflow Behavior (2 tests):**
   - Shows "+N more" indicator when tags > maxVisible
   - Shows tooltip with comma-separated tag names on hover

4. **Responsive Display (1 test):**
   - Wrapper has `hidden md:flex` classes for mobile hiding

5. **Accessibility (2 tests):**
   - Chips have proper aria-label ("Filter by tag: [Name]")
   - Chips are focusable with tabIndex={0}

6. **Edge Cases (3 tests):**
   - Exactly 3 tags: No overflow indicator
   - Single tag: Renders correctly
   - Long tag name: No layout breaking (visual test)

### Integration Tests (2 tests)

**File:** `frontend/src/components/VideosPage.integration.test.tsx`

1. **Grid View Integration:**
   - Renders TagChips in VideoCard component
   - Clicking tag chip filters video list
   - Overflow tooltip shows remaining tags

2. **List View Integration:**
   - Renders Tags column in table
   - Clicking tag chip updates filter
   - Column visibility toggle works (TableSettingsDropdown)

### Manual Testing Checklist (10+ scenarios)

See Step 9 above for comprehensive manual testing scenarios covering:
- Grid View display, colors, click, keyboard, overflow
- List View display, column visibility, filtering
- Accessibility (screen reader, keyboard navigation)
- Edge cases (0 tags, 1 tag, 3 tags, 5+ tags)

---

## 📚 Reference

### REF MCP Findings (Evidence-Based)

**1. shadcn/ui Badge Component API** (Validated 2025-11-08)
- **Source:** https://ui.shadcn.com/docs/components/badge
- **Key Findings:**
  - Variant options: `default | secondary | destructive | outline`
  - Use `variant="secondary"` for tag-style chips (gray background)
  - Supports `asChild` pattern for custom click behavior
  - Can nest icons/elements inside Badge (e.g., color dots)
- **Applied:** Used `variant="secondary"` for tag styling, nested color dot div

**2. Radix UI Tooltip API** (Validated 2025-11-08)
- **Source:** https://github.com/radix-ui/website/blob/main/data/primitives/docs/components/tooltip.mdx
- **Key Findings:**
  - Structure: `TooltipProvider` → `Tooltip` → `TooltipTrigger` + `TooltipContent`
  - `delayDuration` prop on Provider (default 700ms, recommended 300ms for quick tooltips)
  - `side` prop on Content: `"top" | "right" | "bottom" | "left"` (default "top")
  - `asChild` pattern required on Trigger to avoid wrapper div
  - Portal rendering by default (tooltip in `document.body`)
- **Applied:** Used Provider with `delayDuration={300}`, `asChild` on Trigger, `side="top"`

**3. Tailwind CSS Responsive Design** (Validated 2025-11-08)
- **Source:** https://tailwindcss.com/docs/responsive-design
- **Key Findings:**
  - Mobile-first approach: `md:` prefix applies at `>= 768px`
  - Breakpoints: `sm: 640px`, `md: 768px`, `lg: 1024px`, `xl: 1280px`, `2xl: 1536px`
  - Recommended pattern: Base styles for mobile, add `md:` for tablet+
  - `hidden md:flex` pattern: Hidden by default, flex at 768px+
- **Applied:** Used `hidden md:flex` for mobile hiding (tags not critical on small screens)

**4. Clickable Tag Chip UX Patterns** (Research 2025-11-08)
- **Pattern:** YouTube-style tag chips with click-to-filter behavior
- **Key Findings:**
  - Use semantic `role="button"` for clickable non-button elements
  - Support both click AND keyboard (Enter, Space)
  - Visual feedback: `cursor-pointer`, `hover:bg-*` state
  - Accessibility: `aria-label` describing action ("Filter by tag: X")
  - Toggle pattern: Click again to remove filter
- **Applied:** Full keyboard support, toggle behavior via `tagStore.toggleTag()`

**5. Overflow Tag Display Patterns** (Research 2025-11-08)
- **Pattern:** Max N visible tags, "+N more" indicator with tooltip
- **Key Findings:**
  - Common UX: Show 3-4 tags max to prevent layout overflow
  - Overflow indicator: "+N more" badge (usually `variant="outline"`)
  - Tooltip shows all remaining tag names (comma-separated)
  - Alternative: Expandable "Show all" button (requires more space)
- **Applied:** Max 3 visible (matches YouTube), tooltip with comma-separated names

### Related Code Patterns

**Existing Tag Display (VideoCard.tsx lines 133-151):**
```typescript
{video.tags && video.tags.length > 0 && (
  <div className="flex flex-wrap gap-1">
    {video.tags.map((tag) => (
      <span
        key={tag.id}
        className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs"
      >
        {tag.color && (
          <div
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: tag.color }}
          />
        )}
        <span>{tag.name}</span>
      </span>
    ))}
  </div>
)}
```
- **Pattern:** Color dot + tag name in flex container
- **Improvement:** Add click behavior, overflow handling, responsive hiding

**Tag Store (tagStore.ts):**
```typescript
export const useTagStore = create<TagState>((set) => ({
  selectedTagIds: [],
  setSelectedTagIds: (ids: string[]) => set({ selectedTagIds: ids }),
  toggleTag: (tagId: string) =>
    set((state) => ({
      selectedTagIds: state.selectedTagIds.includes(tagId)
        ? state.selectedTagIds.filter((id) => id !== tagId)
        : [...state.selectedTagIds, tagId],
    })),
}))
```
- **Pattern:** Toggle behavior adds OR removes tag from selection
- **Integration:** Call `toggleTag(tag.id)` on chip click

### Design Decisions

**1. shadcn/ui Badge vs Custom Span**
- **Alternatives:**
  - A) Use existing `<span className="rounded-full bg-secondary">` pattern
  - B) Use shadcn/ui Badge component (standardized)
- **Chosen:** B (shadcn/ui Badge)
- **Rationale:**
  - Consistent with existing shadcn/ui components (Button, DropdownMenu)
  - Built-in variants (secondary, outline for overflow)
  - Better accessibility baseline (proper semantic HTML)
  - Easier to style with Tailwind utilities
- **Trade-offs:** +1 dependency (Badge component), but already using shadcn/ui ecosystem
- **Validation:** shadcn/ui docs recommend Badge for "chip-like" UI elements

**2. Max 3 Visible Tags**
- **Alternatives:**
  - A) Show all tags (no limit)
  - B) Show max 3 tags, "+N more" indicator
  - C) Show max 4 tags, "+N more" indicator
- **Chosen:** B (Max 3 tags)
- **Rationale:**
  - Prevents layout overflow on small cards (Grid View)
  - YouTube uses 2-3 tag limit for video cards
  - 3 tags fits comfortably in 280px card width
  - Tooltip provides access to all tags without cluttering UI
- **Trade-offs:** Users must hover to see all tags (desktop), but mobile hides tags entirely anyway
- **Validation:** Roadmap Phase 3 says "max 3-4 tags" - 3 is conservative choice

**3. Tooltip on Overflow vs Expandable**
- **Alternatives:**
  - A) Tooltip on "+N more" hover
  - B) Expandable "Show all" button (reveals hidden tags)
  - C) Modal with all tags on click
- **Chosen:** A (Tooltip)
- **Rationale:**
  - Preserves card size (no layout shift)
  - Faster UX (hover vs click)
  - Consistent with roadmap requirement: "Hover on '+2 more' shows tooltip"
  - Simpler implementation (no expanded state management)
- **Trade-offs:** Tooltip not accessible on touch devices (mobile hides tags anyway)
- **Validation:** Roadmap explicitly requires tooltip pattern

**4. Responsive: Hidden on Mobile**
- **Alternatives:**
  - A) Show tags on all screen sizes
  - B) Hide tags on mobile (`< 768px`), show on tablet+ (`>= 768px`)
  - C) Show 1 tag on mobile, 3 on tablet+
- **Chosen:** B (Hidden on mobile)
- **Rationale:**
  - Mobile space is limited (prioritize title, thumbnail, duration)
  - Tags accessible via TagNavigation sidebar (still usable)
  - Roadmap requirement: "Responsive: Hide tags on mobile, show on tablet+"
  - Matches YouTube mobile UX (no tags on video cards)
- **Trade-offs:** Mobile users can't click tags from cards (must use sidebar)
- **Validation:** Roadmap explicitly requires hiding on mobile

**5. Click Behavior: toggleTag vs addTag**
- **Alternatives:**
  - A) Click adds tag to filter (no removal)
  - B) Click toggles tag (add OR remove from filter)
  - C) Click opens tag edit dialog
- **Chosen:** B (Toggle behavior)
- **Rationale:**
  - Consistent with TagNavigation click behavior (already uses toggle)
  - User can click again to remove filter (more flexible)
  - Matches existing `tagStore.toggleTag()` API
  - Standard multi-select UX pattern
- **Trade-offs:** None (toggle is superior to add-only)
- **Validation:** TagNavigation already uses toggle pattern (Task #17)

**6. Color Visualization: Dot vs Background**
- **Alternatives:**
  - A) Color dot before tag name (existing pattern)
  - B) Colored background on entire chip
  - C) Colored border on chip
- **Chosen:** A (Color dot)
- **Rationale:**
  - Consistent with existing VideoCard tag display (lines 141-145)
  - Subtle visualization (doesn't overwhelm with color)
  - Works well with `variant="secondary"` gray background
  - Accessible (color is supplementary, not primary identifier)
- **Trade-offs:** Color dot is small (8px) - but sufficient for quick recognition
- **Validation:** Existing VideoCard pattern proven to work

**7. Keyboard Navigation: Enter + Space**
- **Alternatives:**
  - A) Enter key only
  - B) Enter + Space keys
  - C) All arrow keys + Enter + Space
- **Chosen:** B (Enter + Space)
- **Rationale:**
  - WCAG 2.1 requires both Enter and Space for `role="button"` elements
  - Consistent with native button behavior
  - Simple implementation (check `e.key` in onKeyDown)
  - No need for arrow keys (tags are not a menu)
- **Trade-offs:** None (this is accessibility requirement)
- **Validation:** WAI-ARIA Button pattern requires Enter + Space support

---

## ⏱️ Time Estimate

**Total Estimated Time:** 2.5 - 3.5 hours

**Breakdown:**
- Step 1: Install shadcn/ui components (10 min)
- Step 2: Write TagChips tests (TDD) (30 min)
- Step 3: Implement TagChips component (45 min)
- Step 4: Integrate into VideoCard (15 min)
- Step 5: Integrate into VideosPage table (20 min)
- Step 6: Update tableSettingsStore (5 min)
- Step 7: Update TableSettingsDropdown (10 min)
- Step 8: Run tests and verify (15 min)
- Step 9: Manual testing (30 min)
- Step 10: Update CLAUDE.md (5 min)
- Step 11: Create handoff log (15 min)

**Similar Task Reference:**
- Task #32 (VideoCard component): 5.5 hours actual (with REF validation + plan rewrite)
- Task #34 (GridColumnControl): 90 minutes actual (exactly on estimate)
- Task #26 (TableSettingsDropdown): 90 minutes actual (with Subagent-Driven Development)

**Confidence:** HIGH (component is well-scoped, no complex state management, follows proven patterns)

---

## 🔗 Dependencies

**Completed:**
- Task #1-8: Tag system backend (CRUD, filtering, assignment)
- Task #16: Tag store with Zustand (toggleTag function)
- Task #32: VideoCard component (Grid View)
- Task #25: Table settings store (column visibility)
- Task #26: TableSettingsDropdown component

**External:**
- shadcn/ui Badge component (to be installed)
- shadcn/ui Tooltip component (to be installed)
- Radix UI Tooltip primitives (auto-installed with shadcn/ui)

**Blocks:**
- None (Task #46 is independent)

---

## 📝 Notes

**Implementation Approach:**
- Use TDD (Test-Driven Development) - write tests BEFORE implementation
- Follow existing patterns from VideoCard tag display (color dot visualization)
- Reuse tagStore.toggleTag() for click behavior (no new state management)
- Apply REF MCP findings from shadcn/ui and Radix UI documentation
- Ensure WCAG 2.1 Level AA compliance (keyboard navigation, ARIA labels)

**Future Enhancements (Out of Scope):**
- Mobile long-press on "+N more" to show tooltip (currently hover-only)
- Configurable maxVisible prop per view mode (Grid: 3, List: 4)
- Right-click context menu on chips (edit tag, remove from video)
- Tag chip animations (fade in/out on filter changes)
- Drag-and-drop tags to reorder priority

**Related Tasks:**
- Task #54: Create search bar (will work with tag filtering)
- Task #106: AI-powered duplicate detection (may suggest tags)
- Task #107: Field-based filtering (custom fields + tags combined)
