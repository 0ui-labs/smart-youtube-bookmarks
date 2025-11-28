# Root Cause Analysis: Import UI Not Showing Progress

## Executive Summary

**Three independent root causes** combine to break the import UX:

1. **Backend: ASYNC path creates videos WITHOUT `thumbnail_url`**
2. **Frontend: WebSocket is DISABLED**
3. **Frontend: `import_stage`/`import_progress` from DB not used for UI state**

---

## Root Cause #1: Missing `thumbnail_url` in ASYNC Path

### Location
`backend/app/api/videos.py` lines 1760-1767

### Code (Problematic)
```python
# ASYNC PATH: Create with pending status, ARQ worker fetches metadata
logger.info(f"Large batch ({len(videos_to_create)} videos) - queueing for background processing")
for video_data in videos_to_create:
    youtube_id = video_data["youtube_id"]
    video = Video(
        list_id=list_id,
        youtube_id=youtube_id,
        processing_status="pending"
    )
```

### Problem
- NO `thumbnail_url` set
- NO `import_stage` set
- NO `import_progress` set

### Expected (from spec)
```python
video = Video(
    list_id=list_id,
    youtube_id=youtube_id,
    thumbnail_url=f"https://img.youtube.com/vi/{youtube_id}/mqdefault.jpg",  # INSTANT!
    import_stage="created",
    import_progress=0,
    processing_status="pending"
)
```

### Evidence
The **error fallback** (line 485-494) correctly sets thumbnail:
```python
# Two-phase import: Set thumbnail immediately from YouTube ID pattern
thumbnail_url=f"https://img.youtube.com/vi/{youtube_id}/mqdefault.jpg",
import_stage="created",
import_progress=0
```

---

## Root Cause #2: WebSocket DISABLED in Frontend

### Location
`frontend/src/components/VideosPage.tsx` lines 509-514

### Code (Disabled)
```typescript
// WebSocket for bulk upload progress (optional - bulk uploads now work without it too)
// Disabled for now to prevent unnecessary re-renders
// const { jobProgress, reconnecting, historyError } = useWebSocket()
const jobProgress = new Map()
const reconnecting = false
const historyError = null
```

### Problem
- WebSocket hook is **commented out**
- `import_progress` messages from backend never reach frontend
- `useImportProgressStore` is never populated
- Progress overlay never shown (relies on store data)

### Evidence
`useWebSocket.ts` line 177-180 handles progress:
```typescript
// Handle video-level import progress updates
if (data.type === 'import_progress') {
    const { video_id, progress, stage } = data;
    useImportProgressStore.getState().setProgress(video_id, progress, stage);
}
```

But this code never runs because WebSocket is disabled!

---

## Root Cause #3: DB Fields Not Used for UI State

### Location
`frontend/src/components/VideoCard.tsx` lines 63-67

### Code
```typescript
const { isImporting, getProgress } = useImportProgressStore()

// Check if video is currently importing
const importing = isImporting(video.id)
const importProgress = getProgress(video.id)
```

### Problem
- `VideoCard` checks `importProgressStore` (populated by WebSocket)
- But NEVER checks `video.import_stage` or `video.import_progress` from DB
- Even if backend sets these fields, frontend ignores them!

### Expected
```typescript
// Use BOTH sources: WebSocket store OR DB fields
const storeProgress = getProgress(video.id)
const dbStage = video.import_stage

const importing = storeProgress
    ? storeProgress.stage !== 'complete' && storeProgress.stage !== 'error'
    : dbStage !== 'complete' && dbStage !== 'error'
```

---

## Data Flow Diagram (Current - BROKEN)

```
[Backend: bulk_upload]
      │
      ├── SYNC path (≤5 videos) ──► Metadata fetched ──► thumbnail_url set ──► Works!
      │
      └── ASYNC path (>5 videos) ──► Video created WITHOUT thumbnail_url
                                          │
                                          ▼
                             [Frontend receives video list]
                                          │
                                          ▼
                             [VideoCard renders]
                                          │
                                          ├── thumbnail_url = null ──► White card
                                          │
                                          └── importProgressStore.get(id) = undefined
                                                      │
                                                      ▼
                                              No progress overlay
```

## Data Flow Diagram (Expected - FIXED)

```
[Backend: bulk_upload]
      │
      └── ASYNC path (>5 videos)
              │
              ├── thumbnail_url = YouTube CDN pattern ──► Instant thumbnail
              ├── import_stage = "created"
              └── import_progress = 0
                       │
                       ▼
          [ARQ Worker: enrich_video_staged]
                       │
                       ├── Publishes to Redis: progress:user:{id}
                       │
                       ▼
          [WebSocket forwards to client]
                       │
                       ▼
          [useImportProgressStore.setProgress()]
                       │
                       ▼
          [VideoCard re-renders with progress overlay]
                       │
                       ▼
          [Stage "complete" → overlay removed, card clickable]
```

---

## Verification Steps Taken

1. Read `backend/app/api/videos.py` - confirmed ASYNC path missing fields
2. Read `frontend/src/components/VideosPage.tsx` - confirmed WebSocket disabled
3. Read `frontend/src/components/VideoCard.tsx` - confirmed only uses store, not DB
4. Read `frontend/src/stores/importProgressStore.ts` - confirmed store structure
5. Read `frontend/src/hooks/useWebSocket.ts` - confirmed handler exists but not used
