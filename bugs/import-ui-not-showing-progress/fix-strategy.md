# Fix Strategy: Import UI Not Showing Progress

## Overview

Three independent fixes required, in order of priority:

## Fix 1: Backend - Add `thumbnail_url` to ASYNC Path (CRITICAL)

### Location
`backend/app/api/videos.py` lines 1760-1767

### Change
Add `thumbnail_url`, `import_stage`, `import_progress` to ASYNC video creation:

```python
# BEFORE (broken)
video = Video(
    list_id=list_id,
    youtube_id=youtube_id,
    processing_status="pending"
)

# AFTER (fixed)
video = Video(
    list_id=list_id,
    youtube_id=youtube_id,
    # Two-phase import: Thumbnail URL derived from YouTube ID (instant)
    thumbnail_url=f"https://img.youtube.com/vi/{youtube_id}/mqdefault.jpg",
    import_stage="created",
    import_progress=0,
    processing_status="pending"
)
```

### Risk
- Low - follows existing pattern from error fallback
- Backward compatible - adds missing fields

---

## Fix 2: Frontend - Enable WebSocket Hook (CRITICAL)

### Location
`frontend/src/components/VideosPage.tsx` lines 509-514

### Change
Uncomment WebSocket hook:

```typescript
// BEFORE (disabled)
// const { jobProgress, reconnecting, historyError } = useWebSocket()
const jobProgress = new Map()
const reconnecting = false
const historyError = null

// AFTER (enabled)
const { jobProgress, reconnecting, historyError } = useWebSocket()
```

### Risk
- Medium - may cause re-renders (was disabled for this reason)
- Need to monitor performance

---

## Fix 3: Frontend - Use DB Fields as Fallback (RECOMMENDED)

### Location
`frontend/src/components/VideoCard.tsx` lines 63-67

### Change
Check both WebSocket store AND DB fields:

```typescript
// BEFORE (only WebSocket store)
const importing = isImporting(video.id)
const importProgress = getProgress(video.id)

// AFTER (WebSocket store OR DB fields)
const storeProgress = getProgress(video.id)

// Use WebSocket store if available, otherwise fall back to DB fields
const importing = storeProgress
    ? storeProgress.stage !== 'complete' && storeProgress.stage !== 'error'
    : video.import_stage !== 'complete' && video.import_stage !== 'error' && video.import_stage !== undefined

const importProgress = storeProgress || (video.import_stage && {
    progress: video.import_progress || 0,
    stage: video.import_stage
})
```

### Risk
- Low - provides redundancy
- More robust even if WebSocket disconnects

---

## Implementation Order

1. **Fix 1 (Backend)** - Ensures instant thumbnail (solves "white card")
2. **Fix 2 (Frontend WebSocket)** - Enables live progress updates
3. **Fix 3 (Frontend DB fallback)** - Resilience if WebSocket fails

## Minimal Viable Fix

If time-constrained, **Fix 1 alone** solves the visible "white card" problem.
Fixes 2+3 are needed for the full "progress overlay" experience.

## Verification

After all fixes:
1. Import 9 videos via drag & drop
2. Cards should appear IMMEDIATELY with thumbnails (greyed out)
3. Progress overlay should show 0% → 25% → 60% → 90% → 100%
4. Cards should NOT be clickable until 100%
5. After 100%, cards become full color and clickable
