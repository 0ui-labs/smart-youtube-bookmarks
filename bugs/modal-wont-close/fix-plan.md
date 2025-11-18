# Fix Implementation Plan: Video Details Modal Won't Close

## Date
2025-11-17

## Implementation Strategy

**Solution**: Lift modal state from VideoCard to VideosPage (Solution 1 from fix-strategy.md)

**Principle**: Follow existing pattern of ConfirmDeleteModal and CreateTagDialog

## Files to Modify

1. `frontend/src/components/VideosPage.tsx` - Add modal state and render modal
2. `frontend/src/components/VideoGrid.tsx` - Pass callback to cards
3. `frontend/src/components/VideoCard.tsx` - Remove modal, call callback

## Step-by-Step Implementation

### Step 1: Add Modal State to VideosPage ✅

**File**: `frontend/src/components/VideosPage.tsx`

**Location**: After line 186 (after `isCreateTagDialogOpen` state)

**Add**:
```tsx
// Video Details Modal state (follows pattern of ConfirmDeleteModal)
const [videoDetailsModal, setVideoDetailsModal] = useState<{
  open: boolean
  video: VideoResponse | null
}>({
  open: false,
  video: null,
})
```

**Reasoning**: Same pattern as deleteModal state (lines 177-185)

### Step 2: Add Modal Open Handler to VideosPage ✅

**File**: `frontend/src/components/VideosPage.tsx`

**Location**: After line 590 (after `handleGridDeleteClick` function)

**Add**:
```tsx
// Handle video card click from Grid View
// Opens modal if videoDetailsView is 'modal', otherwise navigates to page
const handleGridVideoClick = (video: VideoResponse) => {
  const videoDetailsView = useTableSettingsStore.getState().videoDetailsView

  if (videoDetailsView === 'modal') {
    setVideoDetailsModal({
      open: true,
      video: video,
    })
  } else {
    // Page mode - navigate to video details page
    navigate(`/videos/${video.id}`)
  }
}
```

**Reasoning**: Centralizes navigation logic at page level

### Step 3: Add Modal Close Handler to VideosPage ✅

**File**: `frontend/src/components/VideosPage.tsx`

**Location**: After `handleGridVideoClick` function

**Add**:
```tsx
const handleVideoDetailsModalClose = () => {
  setVideoDetailsModal({
    open: false,
    video: null,
  })
}
```

**Reasoning**: Simple close handler, resets state

### Step 4: Pass Callback to VideoGrid ✅

**File**: `frontend/src/components/VideosPage.tsx`

**Location**: Line 855-860 (VideoGrid component)

**Change From**:
```tsx
<VideoGrid
  videos={videos}
  gridColumns={gridColumns}
  onDeleteVideo={handleGridDeleteClick}
/>
```

**Change To**:
```tsx
<VideoGrid
  videos={videos}
  gridColumns={gridColumns}
  onDeleteVideo={handleGridDeleteClick}
  onVideoClick={handleGridVideoClick}  // NEW: Pass click handler
/>
```

### Step 5: Render VideoDetailsModal at VideosPage Level ✅

**File**: `frontend/src/components/VideosPage.tsx`

**Location**: After line 942 (after CreateTagDialog, before closing divs)

**Add**:
```tsx
{/* Video Details Modal (follows pattern of ConfirmDeleteModal) */}
{videoDetailsModal.video && (
  <VideoDetailsModal
    video={videoDetailsModal.video}
    open={videoDetailsModal.open}
    onOpenChange={handleVideoDetailsModalClose}
    listId={listId}
    onFieldChange={(fieldId, value) => {
      // Field mutation using video from modal state
      const updateField = useUpdateVideoFieldValues(videoDetailsModal.video.id)
      updateField.mutate([{ field_id: fieldId, value }])
    }}
  />
)}
```

**Note**: Need to handle field mutation - see Step 5b below

### Step 5b: Add Field Mutation Hook Import ✅

**File**: `frontend/src/components/VideosPage.tsx`

**Location**: Line 10 (in imports from hooks)

**Change From**:
```tsx
import { useVideos, useCreateVideo, useDeleteVideo, exportVideosCSV, useAssignTags } from '@/hooks/useVideos'
```

**Change To**:
```tsx
import { useVideos, useCreateVideo, useDeleteVideo, exportVideosCSV, useAssignTags } from '@/hooks/useVideos'
import { useUpdateVideoFieldValues } from '@/hooks/useVideoFieldValues'
```

**Alternative**: Move field mutation to separate handler function to avoid hook in JSX

**Better Approach** (recommended):
```tsx
// Add handler after handleVideoDetailsModalClose
const handleVideoFieldChange = (fieldId: string, value: string | number | boolean) => {
  if (!videoDetailsModal.video) return

  // Use mutation hook at component level
  const updateField = useUpdateVideoFieldValues(videoDetailsModal.video.id)
  updateField.mutate([{ field_id: fieldId, value }])
}

// Then in modal:
<VideoDetailsModal
  ...
  onFieldChange={handleVideoFieldChange}
/>
```

**ISSUE**: Can't call hook conditionally. Need to restructure.

**SOLUTION**: Create wrapper component or use queryClient directly.

**Final Approach** (simplest):
```tsx
{/* Video Details Modal */}
<VideoDetailsModal
  video={videoDetailsModal.video}
  open={videoDetailsModal.open}
  onOpenChange={(open) => {
    if (!open) {
      handleVideoDetailsModalClose()
    }
  }}
  listId={listId}
  onFieldChange={(fieldId, value) => {
    // Field changes are handled by CustomFieldsSection internally
    // via useUpdateVideoFieldValues hook - no action needed here
    console.log('Field changed:', fieldId, value)
  }}
/>
```

**NOTE**: CustomFieldsSection already handles mutations internally, so we just need a no-op callback.

### Step 6: Update VideoGrid Props ✅

**File**: `frontend/src/components/VideoGrid.tsx`

**Location**: Lines 6-10 (VideoGridProps interface)

**Change From**:
```tsx
interface VideoGridProps {
  videos: VideoResponse[]
  gridColumns: GridColumnCount
  onDeleteVideo?: (video: VideoResponse) => void
}
```

**Change To**:
```tsx
interface VideoGridProps {
  videos: VideoResponse[]
  gridColumns: GridColumnCount
  onDeleteVideo?: (video: VideoResponse) => void
  onVideoClick?: (video: VideoResponse) => void  // NEW: Video click handler
}
```

### Step 7: Pass Callback to VideoCard ✅

**File**: `frontend/src/components/VideoGrid.tsx`

**Location**: Lines 62-67 (VideoCard rendering)

**Change From**:
```tsx
{videos.map((video) => (
  <VideoCard
    key={video.id}
    video={video}
    onDelete={onDeleteVideo ? () => onDeleteVideo(video) : undefined}
  />
))}
```

**Change To**:
```tsx
{videos.map((video) => (
  <VideoCard
    key={video.id}
    video={video}
    onDelete={onDeleteVideo ? () => onDeleteVideo(video) : undefined}
    onCardClick={onVideoClick ? () => onVideoClick(video) : undefined}  // NEW
  />
))}
```

### Step 8: Update VideoCard Props ✅

**File**: `frontend/src/components/VideoCard.tsx`

**Location**: Lines 26-29 (VideoCardProps interface)

**Change From**:
```tsx
interface VideoCardProps {
  video: VideoResponse
  onDelete?: (videoId: string) => void
}
```

**Change To**:
```tsx
interface VideoCardProps {
  video: VideoResponse
  onDelete?: (videoId: string) => void
  onCardClick?: () => void  // NEW: Optional click handler from parent
}
```

### Step 9: Remove Modal State from VideoCard ✅

**File**: `frontend/src/components/VideoCard.tsx`

**Location**: Lines 59-69

**Remove**:
```tsx
export const VideoCard = ({ video, onDelete }: VideoCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { tags, toggleTag } = useTagStore()

  // Task #131 Step 4: Modal state for conditional navigation
  const [showModal, setShowModal] = useState(false)
  const videoDetailsView = useTableSettingsStore(state => state.videoDetailsView)

  // Task #131 Step 4: Field mutation for modal updates
  const updateField = useUpdateVideoFieldValues(video.id)
```

**Replace With**:
```tsx
export const VideoCard = ({ video, onDelete, onCardClick }: VideoCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { tags, toggleTag } = useTagStore()

  // Modal state removed - now handled at VideosPage level
```

**Remove**:
- `useState(false)` for showModal
- `useTableSettingsStore` for videoDetailsView
- `useUpdateVideoFieldValues` hook

### Step 10: Update handleCardClick in VideoCard ✅

**File**: `frontend/src/components/VideoCard.tsx`

**Location**: Lines 72-82 (handleCardClick function)

**Change From**:
```tsx
const handleCardClick = () => {
  // Early return pattern for clean conditional logic (REF MCP #6)
  if (videoDetailsView === 'modal') {
    setShowModal(true)
    return
  }

  // Default: navigate to page (preserves existing behavior)
  navigate(`/videos/${video.id}`)
}
```

**Change To**:
```tsx
const handleCardClick = () => {
  // Use parent callback if provided (Grid view with modal/page logic)
  if (onCardClick) {
    onCardClick()
    return
  }

  // Fallback: navigate to page (for standalone usage)
  navigate(`/videos/${video.id}`)
}
```

**Reasoning**:
- Delegates decision to parent (VideosPage)
- Maintains fallback for standalone usage
- Simpler logic (no store access needed)

### Step 11: Remove VideoDetailsModal from VideoCard JSX ✅

**File**: `frontend/src/components/VideoCard.tsx`

**Location**: Lines 227-237

**Remove**:
```tsx
{/* Task #131 Step 4: VideoDetailsModal for modal view */}
<VideoDetailsModal
  video={video}
  open={showModal}
  onOpenChange={setShowModal}
  listId={video.list_id}
  onFieldChange={(fieldId, value) => {
    // Use existing updateField mutation from VideoCard
    updateField.mutate([{ field_id: fieldId, value }])
  }}
/>
```

**Reasoning**: Modal is now rendered at VideosPage level

### Step 12: Remove VideoDetailsModal Import from VideoCard ✅

**File**: `frontend/src/components/VideoCard.tsx`

**Location**: Lines 23-24

**Remove**:
```tsx
// Import VideoDetailsModal for modal view (Task #131 Step 4)
import { VideoDetailsModal } from './VideoDetailsModal'
```

**Also Remove** (Line 14):
```tsx
import { useUpdateVideoFieldValues } from '@/hooks/useVideoFieldValues'
```

## Testing Checklist

After implementation:

1. ☐ Run regression tests (`npm test VideoCard.modal.test.tsx`)
2. ☐ Manual test: Open modal → Close with X → Verify doesn't reopen
3. ☐ Manual test: Open modal → Click backdrop → Verify doesn't reopen
4. ☐ Manual test: Open modal → Press Escape → Verify doesn't reopen
5. ☐ Manual test: Switch to Page mode → Verify navigation works
6. ☐ Manual test: Test field editing in modal → Verify saves correctly
7. ☐ Run full test suite (`npm test`)
8. ☐ Check for TypeScript errors (`npm run type-check`)

## Rollback Plan

If fix causes issues:

1. Revert commits (3 files modified atomically)
2. Fallback to Solution 2 (simple state check) as temporary fix
3. Investigate issues and retry

## Estimated Effort

- Implementation: 30 minutes
- Testing: 15 minutes
- Code review: 10 minutes
- **Total**: ~1 hour

## Dependencies

None - all changes are within frontend components.

## Breaking Changes

None - external API remains the same (VideoCard still renders and works).

## Migration Notes

- VideoCard now accepts optional `onCardClick` prop
- If not provided, falls back to default navigation behavior
- Existing usages (outside VideoGrid) continue to work unchanged
