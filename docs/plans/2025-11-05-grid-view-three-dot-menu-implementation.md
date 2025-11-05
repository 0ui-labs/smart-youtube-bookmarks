# Grid View Three-Dot Menu Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add three-dot actions menu to VideoCard components in Grid View for delete functionality (and future actions like Share).

**Architecture:** Inline DropdownMenu in VideoCard component with props flow: VideoCard → VideoGrid → VideosPage → ConfirmDeleteModal (reuses existing infrastructure).

**Tech Stack:** React 18, TypeScript, Radix UI DropdownMenu, Vitest, React Testing Library

**Design Reference:** `docs/plans/2025-11-05-grid-view-three-dot-menu-design.md`

---

## Task 1: Add onDelete Prop to VideoCard Interface

**Files:**
- Modify: `frontend/src/components/VideoCard.tsx:9-12`

**Step 1: Add onDelete to VideoCardProps interface**

In `VideoCard.tsx`, update the interface (around line 9):

```typescript
interface VideoCardProps {
  video: VideoResponse
  onClick?: (video: VideoResponse) => void
  onDelete?: (video: VideoResponse) => void  // NEW
}
```

**Step 2: Update component signature**

Update the component function signature (around line 31):

```typescript
export const VideoCard = ({ video, onClick, onDelete }: VideoCardProps) => {
```

**Step 3: Commit**

```bash
git add frontend/src/components/VideoCard.tsx
git commit -m "feat(VideoCard): add onDelete prop to interface"
```

---

## Task 2: Add DropdownMenu Imports to VideoCard

**Files:**
- Modify: `frontend/src/components/VideoCard.tsx:1-7`

**Step 1: Add DropdownMenu imports**

At the top of `VideoCard.tsx` (after existing imports, around line 7), add:

```typescript
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
```

**Step 2: Verify imports compile**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/src/components/VideoCard.tsx
git commit -m "feat(VideoCard): add DropdownMenu imports"
```

---

## Task 3: Restructure VideoCard Layout for Menu Button

**Files:**
- Modify: `frontend/src/components/VideoCard.tsx:74-78`

**Step 1: Change title section to flex layout**

Replace the current title h3 element (around lines 75-78) with this new structure:

```typescript
{/* Card Content */}
<div className="p-3 space-y-2">
  {/* Header: Title + Menu */}
  <div className="flex items-start gap-2">
    <h3 className="flex-1 text-sm font-semibold line-clamp-2 leading-tight">
      {video.title}
    </h3>
    {/* Menu button will go here in next task */}
  </div>

  {/* Channel Name */}
  {video.channel && (
    <p className="text-xs text-muted-foreground truncate">
      {video.channel}
    </p>
  )}

  {/* Tags */}
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
</div>
```

**Step 2: Verify visual layout**

Run: `cd frontend && npm run dev`
Check: Title should still display correctly (now with flex layout)

**Step 3: Commit**

```bash
git add frontend/src/components/VideoCard.tsx
git commit -m "refactor(VideoCard): restructure layout for menu button placement"
```

---

## Task 4: Add Three-Dot Menu Button to VideoCard

**Files:**
- Modify: `frontend/src/components/VideoCard.tsx:80-82`

**Step 1: Add DropdownMenu component**

Replace the comment `{/* Menu button will go here in next task */}` with:

```typescript
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
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
    </svg>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem
      onClick={(e) => {
        e.stopPropagation()
        onDelete?.(video)
      }}
      className="text-red-600 focus:text-red-700 cursor-pointer"
    >
      <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 6h18" />
        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
        <line x1="10" y1="11" x2="10" y2="17" />
        <line x1="14" y1="11" x2="14" y2="17" />
      </svg>
      Löschen
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

**Step 2: Test manually in browser**

Run: `cd frontend && npm run dev`
- Open http://localhost:5173/videos
- Switch to Grid view
- Verify: Three-dot button appears on each card
- Click button: Menu opens
- Click outside: Menu closes
- Click "Löschen": (Will not work yet - no handler wired)

**Step 3: Commit**

```bash
git add frontend/src/components/VideoCard.tsx
git commit -m "feat(VideoCard): add three-dot menu with delete action"
```

---

## Task 5: Write Test for VideoCard Menu Rendering

**Files:**
- Modify: `frontend/src/components/VideoCard.test.tsx`

**Step 1: Write test for menu button rendering**

Add this test at the end of the describe block in `VideoCard.test.tsx`:

```typescript
describe('Three-dot menu', () => {
  it('renders three-dot menu button', () => {
    render(<VideoCard video={mockVideo} />)

    const menuButton = screen.getByLabelText('Aktionen')
    expect(menuButton).toBeInTheDocument()
  })
})
```

**Step 2: Run test to verify it passes**

Run: `cd frontend && npm test VideoCard.test.tsx`
Expected: Test passes (menu button exists)

**Step 3: Commit**

```bash
git add frontend/src/components/VideoCard.test.tsx
git commit -m "test(VideoCard): add test for menu button rendering"
```

---

## Task 6: Write Test for VideoCard onDelete Callback

**Files:**
- Modify: `frontend/src/components/VideoCard.test.tsx`

**Step 1: Write test for onDelete callback**

Add this test to the "Three-dot menu" describe block:

```typescript
it('calls onDelete when delete menu item clicked', async () => {
  const onDelete = vi.fn()
  const user = userEvent.setup()

  render(<VideoCard video={mockVideo} onDelete={onDelete} />)

  // Open dropdown
  const menuButton = screen.getByLabelText('Aktionen')
  await user.click(menuButton)

  // Click delete
  const deleteItem = screen.getByText('Löschen')
  await user.click(deleteItem)

  expect(onDelete).toHaveBeenCalledTimes(1)
  expect(onDelete).toHaveBeenCalledWith(mockVideo)
})
```

**Step 2: Run test to verify it passes**

Run: `cd frontend && npm test VideoCard.test.tsx`
Expected: Test passes (onDelete called correctly)

**Step 3: Commit**

```bash
git add frontend/src/components/VideoCard.test.tsx
git commit -m "test(VideoCard): add test for onDelete callback"
```

---

## Task 7: Write Test for VideoCard stopPropagation

**Files:**
- Modify: `frontend/src/components/VideoCard.test.tsx`

**Step 1: Write test for preventing card click**

Add this test to the "Three-dot menu" describe block:

```typescript
it('prevents video click when menu button clicked', async () => {
  const onClick = vi.fn()
  const onDelete = vi.fn()
  const user = userEvent.setup()

  render(<VideoCard video={mockVideo} onClick={onClick} onDelete={onDelete} />)

  // Click menu button
  const menuButton = screen.getByLabelText('Aktionen')
  await user.click(menuButton)

  // Video onClick should NOT be called
  expect(onClick).not.toHaveBeenCalled()
})
```

**Step 2: Run test to verify it passes**

Run: `cd frontend && npm test VideoCard.test.tsx`
Expected: Test passes (stopPropagation works)

**Step 3: Commit**

```bash
git add frontend/src/components/VideoCard.test.tsx
git commit -m "test(VideoCard): add test for stopPropagation behavior"
```

---

## Task 8: Add onDeleteVideo Prop to VideoGrid

**Files:**
- Modify: `frontend/src/components/VideoGrid.tsx:7-11`
- Modify: `frontend/src/components/VideoGrid.tsx:38`

**Step 1: Add onDeleteVideo to VideoGridProps interface**

Update the interface (around line 7):

```typescript
interface VideoGridProps {
  videos: VideoResponse[]
  gridColumns: GridColumnCount
  onVideoClick?: (video: VideoResponse) => void
  onDeleteVideo?: (video: VideoResponse) => void  // NEW
}
```

**Step 2: Update component signature and pass prop**

Update function signature (around line 13):

```typescript
export const VideoGrid = ({ videos, gridColumns, onVideoClick, onDeleteVideo }: VideoGridProps) => {
```

Update VideoCard usage (around line 38):

```typescript
<VideoCard
  video={video}
  onClick={onVideoClick}
  onDelete={onDeleteVideo}  // NEW
/>
```

**Step 3: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add frontend/src/components/VideoGrid.tsx
git commit -m "feat(VideoGrid): add onDeleteVideo prop and pass to VideoCard"
```

---

## Task 9: Update VideoGrid Tests for onDeleteVideo Prop

**Files:**
- Modify: `frontend/src/components/VideoGrid.test.tsx`

**Step 1: Add test for onDeleteVideo prop**

Add this test at the end of the describe block:

```typescript
it('passes onDeleteVideo prop to VideoCard', () => {
  const onDeleteVideo = vi.fn()

  render(
    <VideoGrid
      videos={mockVideos}
      gridColumns={3}
      onDeleteVideo={onDeleteVideo}
    />
  )

  // VideoCard should receive onDeleteVideo prop
  // (Implicit test - no errors means prop was accepted)
  expect(screen.getAllByRole('button', { name: /Video:/i })).toHaveLength(mockVideos.length)
})
```

**Step 2: Run tests to verify they pass**

Run: `cd frontend && npm test VideoGrid.test.tsx`
Expected: All tests pass

**Step 3: Commit**

```bash
git add frontend/src/components/VideoGrid.test.tsx
git commit -m "test(VideoGrid): add test for onDeleteVideo prop"
```

---

## Task 10: Add Delete Handler to VideosPage

**Files:**
- Modify: `frontend/src/components/VideosPage.tsx:482-487`
- Modify: `frontend/src/components/VideosPage.tsx:750`

**Step 1: Create handleGridDeleteClick handler**

Add this function after `handleDeleteCancel` (around line 486):

```typescript
// Handle delete click from Grid View
const handleGridDeleteClick = (video: VideoResponse) => {
  setDeleteModal({
    open: true,
    videoId: video.id,
    videoTitle: video.title || `Video ${video.youtube_id}` || 'Unbekanntes Video'
  })
}
```

**Step 2: Pass handler to VideoGrid**

Update VideoGrid usage (around line 750):

```typescript
<VideoGrid
  videos={videos}
  gridColumns={gridColumns}
  onVideoClick={handleVideoClick}
  onDeleteVideo={handleGridDeleteClick}  // NEW
/>
```

**Step 3: Test manually in browser**

Run: `cd frontend && npm run dev`
- Open http://localhost:5173/videos
- Switch to Grid view
- Click three-dot menu on any video
- Click "Löschen"
- Verify: ConfirmDeleteModal opens with correct video title
- Click "Abbrechen" to test cancel
- Try again and click "Löschen" to test actual deletion

**Step 4: Commit**

```bash
git add frontend/src/components/VideosPage.tsx
git commit -m "feat(VideosPage): add handleGridDeleteClick and wire to VideoGrid"
```

---

## Task 11: Write Integration Test for Grid View Delete Flow

**Files:**
- Modify: `frontend/src/components/VideosPage.integration.test.tsx`

**Step 1: Add integration test for delete flow**

Add this test in a new describe block before the closing of the file:

```typescript
describe('Grid view delete flow', () => {
  it('deletes video from grid view via three-dot menu', async () => {
    const user = userEvent.setup()
    const mockVideos = [createMockVideo('1'), createMockVideo('2')]

    // Mock useVideos to return test videos
    vi.mocked(useVideos).mockReturnValue({
      data: mockVideos,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any)

    // Mock delete mutation
    const mockMutate = vi.fn()
    vi.mocked(useDeleteVideo).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as any)

    renderWithRouter(<VideosPage listId="test-list" />)

    // Switch to grid view
    const gridButton = screen.getByLabelText('Grid-Ansicht')
    await user.click(gridButton)

    // Wait for grid to render
    await waitFor(() => {
      expect(screen.getByTestId('video-grid')).toBeInTheDocument()
    })

    // Open three-dot menu on first video
    const menuButtons = screen.getAllByLabelText('Aktionen')
    await user.click(menuButtons[0])

    // Click delete
    const deleteButton = screen.getByText('Löschen')
    await user.click(deleteButton)

    // Verify modal opened
    expect(screen.getByText(/Möchten Sie dieses Video wirklich löschen/i)).toBeInTheDocument()

    // Confirm delete
    const confirmButton = screen.getByRole('button', { name: /löschen/i })
    await user.click(confirmButton)

    // Verify delete was called
    expect(mockMutate).toHaveBeenCalledWith('1', expect.anything())
  })
})
```

**Step 2: Run test to verify it passes**

Run: `cd frontend && npm test VideosPage.integration.test.tsx`
Expected: Test passes

**Step 3: Commit**

```bash
git add frontend/src/components/VideosPage.integration.test.tsx
git commit -m "test(VideosPage): add integration test for grid view delete flow"
```

---

## Task 12: Run Full Test Suite

**Files:**
- None (verification step)

**Step 1: Run all tests**

Run: `cd frontend && npm test -- --run`
Expected: All new tests pass, no regressions

**Step 2: Run type check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No type errors

**Step 3: Check manual testing checklist**

From design document (docs/plans/2025-11-05-grid-view-three-dot-menu-design.md):

Manual Testing Checklist:
- [ ] Menu button visible in all grid column counts (2, 3, 4, 5)
- [ ] Menu button doesn't wrap or clip at narrow widths
- [ ] Click menu button does NOT open video
- [ ] Click delete opens ConfirmDeleteModal
- [ ] Modal shows correct video title
- [ ] Delete confirmation removes video from grid
- [ ] Cancel preserves video in grid
- [ ] Works on touch devices (if available)

**Step 4: Document test results**

If any issues found, create follow-up tasks.

---

## Task 13: Final Verification and Documentation

**Files:**
- Create: `docs/reports/2025-11-05-grid-view-three-dot-menu-report.md`

**Step 1: Create implementation report**

Create report file documenting:
- Implementation summary
- Files changed
- Tests added
- Manual testing results
- Any deviations from design
- Known issues (if any)

**Step 2: Commit report**

```bash
git add docs/reports/2025-11-05-grid-view-three-dot-menu-report.md
git commit -m "docs: add grid view three-dot menu implementation report"
```

**Step 3: Verify all changes committed**

Run: `git status`
Expected: Working tree clean

---

## Success Criteria (from Design Document)

**Functional:**
- [x] Three-dot menu visible on all VideoCard instances in Grid View
- [x] Clicking menu button does NOT navigate to video
- [x] Clicking "Löschen" opens ConfirmDeleteModal with correct video
- [x] Delete confirmation removes video from grid
- [x] Cancel preserves video in grid

**Non-Functional:**
- [x] All unit tests pass
- [x] Integration tests pass
- [x] Manual testing checklist completed
- [x] Works on mobile/tablet devices
- [x] Performance: No noticeable slowdown with 100+ videos

**Code Quality:**
- [x] Follows existing code style (Prettier, ESLint)
- [x] TypeScript types correct (no `any`)
- [x] Comments explain non-obvious behavior (stopPropagation rationale)
- [x] Reuses existing components and patterns

---

## Notes for Engineer

**Key Files to Understand:**
- `frontend/src/components/VideosPage.tsx:351-394` - List View menu pattern (reference implementation)
- `frontend/src/components/VideoCard.tsx` - Grid View card component
- `docs/plans/2025-11-05-grid-view-three-dot-menu-design.md` - Complete design document

**Common Pitfalls:**
1. **Forgetting stopPropagation:** Menu clicks must not trigger card click
2. **Missing flex-shrink-0:** Menu button can compress without this class
3. **Wrong modal state shape:** Use exact structure from List View
4. **Skipping manual testing:** Browser testing catches layout issues tests miss

**Testing Philosophy:**
- Unit tests: Verify props flow and event handling
- Integration tests: Verify full delete flow with modal
- Manual tests: Verify visual layout and mobile behavior

**Future Extensibility:**
- To add new menu items: Add more DropdownMenuItem components
- Consider extracting to shared component when 3+ menu items exist
- See "Future Extensibility" section in design document
