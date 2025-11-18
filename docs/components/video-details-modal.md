# VideoDetailsModal Component

**Location:** `frontend/src/components/VideoDetailsModal.tsx`
**Task:** #131 (Dual-Pattern Architecture)
**Status:** Active

## Purpose

Modal dialog alternative to VideoDetailsPage. Users can choose between page or modal view via settings. Uses CustomFieldsSection component (DRY).

## User Configuration

Users can toggle between two patterns in TableSettingsDropdown:
- **Page** (default) - Navigate to `/videos/:videoId`
- **Modal** - Open overlay dialog

Setting persisted in `tableSettingsStore.videoDetailsView` ('page' | 'modal')

## Props

```typescript
interface VideoDetailsModalProps {
  video: Video                                           // Video data
  open: boolean                                          // Controlled state
  onOpenChange: (open: boolean) => void                  // State setter
  listId: string                                         // List ID for mutations
  onFieldChange: (fieldId: string, value: string | number | boolean) => void  // Change handler
}
```

## Pattern - Controlled Component

```typescript
// VideoCard.tsx - Modal integration
const [showModal, setShowModal] = useState(false)
const videoDetailsView = useTableSettingsStore(state => state.videoDetailsView)

const handleCardClick = () => {
  if (videoDetailsView === 'modal') {
    setShowModal(true)
    return  // Early return pattern
  }
  navigate(`/videos/${video.id}`)  // Default: page navigation
}

return (
  <>
    <Card onClick={handleCardClick}>...</Card>
    <VideoDetailsModal
      video={video}
      open={showModal}
      onOpenChange={setShowModal}
      listId={video.list_id}
      onFieldChange={(fieldId, value) => {
        updateField.mutate([{ field_id: fieldId, value }])
      }}
    />
  </>
)
```

## Features

- Large 16:9 thumbnail with metadata
- Clickable channel name, tags, duration
- Reuses CustomFieldsSection for field display
- Max height 90vh with scroll overflow
- shadcn/ui Dialog component (Radix UI)

## DRY Principle

VideoDetailsModal reuses CustomFieldsSection component:
- **Eliminates:** 200+ lines of potential code duplication
- **Shares:** Schema grouping, Collapsible logic, FieldDisplay integration

## Settings UI - RadioGroup

```typescript
// TableSettingsDropdown.tsx
<RadioGroup
  value={videoDetailsView}
  onValueChange={(value) => setVideoDetailsView(value as 'page' | 'modal')}
>
  <div className="flex items-center gap-2">
    <RadioGroupItem value="page" id="view-page" />
    <Label htmlFor="view-page">Eigene Seite (Standard)</Label>
  </div>
  <div className="flex items-center gap-2">
    <RadioGroupItem value="modal" id="view-modal" />
    <Label htmlFor="view-modal">Modal Dialog</Label>
  </div>
</RadioGroup>
```

## Store Extension

```typescript
// tableSettingsStore.ts
export type VideoDetailsView = 'page' | 'modal'

interface TableSettingsStore {
  videoDetailsView: VideoDetailsView
  setVideoDetailsView: (view: VideoDetailsView) => void
}

// Default 'page' preserves existing behavior (non-breaking)
videoDetailsView: 'page',
setVideoDetailsView: (view) => set({ videoDetailsView: view }),
```

## Testing

- 14/14 tests passing
- Tests cover: controlled pattern, field changes, metadata display, scroll behavior

## REF MCP Improvements Applied

1. Extended existing store (not new component)
2. DRY extraction for reuse (CustomFieldsSection)
3. Controlled modal pattern (open/onOpenChange)
4. RadioGroup for mutually exclusive options (not checkbox)
5. Default 'page' preserves existing behavior (non-breaking)
6. Early return pattern for clean conditional logic

## Related Documentation

- Shared Component: `docs/components/custom-fields-section.md` (Task #131)
- Page Alternative: `docs/components/video-details-page.md` (Task #130)
- Report: `docs/reports/2025-11-13-task-131-report.md`
