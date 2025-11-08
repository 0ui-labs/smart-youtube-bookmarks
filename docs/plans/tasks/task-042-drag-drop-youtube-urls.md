# Task #42: Implement Drag & Drop for YouTube URLs

**Plan Task:** #42
**Wave/Phase:** Advanced Features
**Dependencies:** Task #41 (SmartDropZone component)
**Created:** 2025-11-08
**Estimated Duration:** 4-5 hours

---

## 🎯 Ziel

Implement YouTube URL drag & drop functionality within the SmartDropZone component, allowing users to drag URLs from browser address bars, web page links, or text files directly into the video list. URLs are processed asynchronously via ARQ workers with real-time WebSocket progress updates.

**Expected Outcome:** Users can drag YouTube URLs from any source, system extracts video IDs, deduplicates, validates via Task #39 batch check, creates videos, and displays real-time processing progress.

---

## 📋 Acceptance Criteria

- [ ] Accept dragged URLs from browser address bars (text/plain)
- [ ] Accept dragged links from web pages (text/uri-list)
- [ ] Accept text files containing URLs (.txt files)
- [ ] Parse multiple URLs (newline-separated, comma-separated, space-separated)
- [ ] Extract YouTube video IDs from all common formats (watch, youtu.be, embed, shorts, live)
- [ ] Deduplicate URLs before processing (same video ID = one entry)
- [ ] Backend endpoint: POST /api/lists/{list_id}/videos/bulk-urls
- [ ] ARQ worker processes videos asynchronously
- [ ] Real-time progress via WebSocket (reuse existing progress system)
- [ ] Error handling for invalid URLs, duplicate videos, processing failures
- [ ] Tests passing (unit tests for URL parsing, integration test for bulk endpoint)
- [ ] Code reviewed

---

## 🛠️ Implementation Steps

### Step 1: Extend YouTube URL Extraction (Backend)

**Files:** `backend/app/api/videos.py`

**Action:** Add comprehensive regex patterns to support all YouTube URL formats

```python
def extract_youtube_id(url: str) -> str:
    """
    Extract YouTube video ID from URL.

    Supports formats:
    - youtube.com/watch?v=VIDEO_ID
    - youtu.be/VIDEO_ID
    - youtube.com/embed/VIDEO_ID
    - youtube.com/shorts/VIDEO_ID
    - youtube.com/live/VIDEO_ID
    - m.youtube.com/watch?v=VIDEO_ID
    - music.youtube.com/watch?v=VIDEO_ID

    Args:
        url: YouTube video URL

    Returns:
        str: 11-character YouTube video ID

    Raises:
        ValueError: If video ID cannot be extracted
    """
    patterns = [
        r'(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})',
        r'youtube\.com\/embed\/([a-zA-Z0-9_-]{11})',
        r'youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})',
        r'youtube\.com\/live\/([a-zA-Z0-9_-]{11})',
        r'm\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})',
        r'music\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})',
    ]

    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)

    raise ValueError("Could not extract YouTube video ID from URL")
```

---

### Step 2: Create Bulk URL Upload Pydantic Schema

**Files:** `backend/app/schemas/video.py`

**Action:** Add schema for bulk URL request

```python
class BulkUrlUploadRequest(BaseModel):
    """Schema for bulk YouTube URL upload."""
    urls: list[str] = Field(
        min_length=1,
        max_length=100,
        description="List of YouTube URLs (max 100)"
    )
```

---

### Step 3: Implement Bulk URL Upload Endpoint

**Files:** `backend/app/api/videos.py`

**Action:** Create POST /api/lists/{list_id}/videos/bulk-urls endpoint

```python
@router.post(
    "/lists/{list_id}/videos/bulk-urls",
    response_model=BulkUploadResponse,
    status_code=status.HTTP_201_CREATED
)
async def bulk_upload_urls(
    list_id: UUID,
    request: BulkUrlUploadRequest,
    db: AsyncSession = Depends(get_db)
) -> BulkUploadResponse:
    """
    Bulk upload videos from YouTube URLs.

    - Validates list exists (404 if not found)
    - Extracts YouTube IDs from URLs
    - Deduplicates URLs (same video ID = one entry)
    - Creates videos with pending status
    - Enqueues ARQ background processing
    - Returns created_count, failed_count, and failure details

    Args:
        list_id: UUID of the bookmark list
        request: BulkUrlUploadRequest with list of URLs
        db: Database session

    Returns:
        BulkUploadResponse: Statistics and failure details

    Raises:
        HTTPException 404: List not found
        HTTPException 422: Invalid URLs
    """
    # Validate list exists
    result = await db.execute(
        select(BookmarkList).where(BookmarkList.id == list_id)
    )
    bookmark_list = result.scalar_one_or_none()

    if not bookmark_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"List with id {list_id} not found"
        )

    videos_to_create = []
    failures = []
    seen_video_ids = set()  # For deduplication

    for idx, url in enumerate(request.urls):
        url = url.strip()

        if not url:
            failures.append(BulkUploadFailure(
                row=idx + 1,
                url=url,
                error="Empty URL"
            ))
            continue

        # Extract YouTube ID
        try:
            youtube_id = extract_youtube_id(url)

            # Deduplicate within batch
            if youtube_id in seen_video_ids:
                failures.append(BulkUploadFailure(
                    row=idx + 1,
                    url=url,
                    error="Duplicate video in request"
                ))
                continue

            seen_video_ids.add(youtube_id)

            # Create video with pending status
            video = Video(
                list_id=list_id,
                youtube_id=youtube_id,
                processing_status="pending"
            )
            videos_to_create.append(video)

        except ValueError as e:
            failures.append(BulkUploadFailure(
                row=idx + 1,
                url=url,
                error=str(e)
            ))

    # Bulk insert valid videos
    if videos_to_create:
        db.add_all(videos_to_create)
        try:
            await db.commit()
        except IntegrityError:
            # Handle duplicates with existing videos in DB
            await db.rollback()
            # Retry one by one to identify which failed
            created = 0
            for video in videos_to_create:
                try:
                    db.add(video)
                    await db.flush()
                    created += 1
                except IntegrityError:
                    await db.rollback()
                    failures.append(BulkUploadFailure(
                        row=0,
                        url=f"https://www.youtube.com/watch?v={video.youtube_id}",
                        error="Video already exists in this list"
                    ))
            await db.commit()

            # Create processing job if videos were created
            await _enqueue_video_processing(db, list_id, created)

            return BulkUploadResponse(
                created_count=created,
                failed_count=len(failures),
                failures=failures
            )

    # Create processing job if videos were created
    await _enqueue_video_processing(db, list_id, len(videos_to_create))

    return BulkUploadResponse(
        created_count=len(videos_to_create),
        failed_count=len(failures),
        failures=failures
    )
```

---

### Step 4: Create URL Parsing Utility (Frontend)

**Files:** `frontend/src/utils/urlParser.ts`

**Action:** Create utility to parse and validate YouTube URLs from text

```typescript
/**
 * Parse YouTube URLs from text input.
 *
 * Supports:
 * - Newline-separated URLs
 * - Comma-separated URLs
 * - Space-separated URLs
 * - Mixed separators
 *
 * @param text - Raw text containing URLs
 * @returns Array of valid YouTube URLs
 */
export function parseUrls(text: string): string[] {
  // Split by newlines, commas, or spaces
  const lines = text.split(/[\n,\s]+/)

  const urls: string[] = []
  const seenIds = new Set<string>()

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // Check if it's a YouTube URL
    if (isYouTubeUrl(trimmed)) {
      // Extract video ID for deduplication
      const videoId = extractVideoId(trimmed)
      if (videoId && !seenIds.has(videoId)) {
        seenIds.add(videoId)
        urls.push(trimmed)
      }
    }
  }

  return urls
}

/**
 * Check if URL is a valid YouTube URL.
 */
export function isYouTubeUrl(url: string): boolean {
  const youtubeRegex = /^(?:https?:\/\/)?(?:(?:www|m|music)\.)?(?:youtube\.com|youtu\.be)\/.+$/
  return youtubeRegex.test(url)
}

/**
 * Extract YouTube video ID from URL (client-side validation).
 */
export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }

  return null
}
```

---

### Step 5: Create useBulkUrlUpload Hook

**Files:** `frontend/src/hooks/useBulkUrlUpload.ts`

**Action:** Create TanStack Query hook for bulk URL upload

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

interface BulkUrlUploadRequest {
  urls: string[]
}

interface BulkUploadResponse {
  created_count: number
  failed_count: number
  failures: Array<{
    row: number
    url: string
    error: string
  }>
}

export function useBulkUrlUpload(listId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (request: BulkUrlUploadRequest) => {
      const response = await api.post<BulkUploadResponse>(
        `/api/lists/${listId}/videos/bulk-urls`,
        request
      )
      return response.data
    },
    onSuccess: () => {
      // Invalidate videos query to trigger refetch
      queryClient.invalidateQueries(['videos', listId])
    },
  })
}
```

---

### Step 6: Add URL Detection to SmartDropZone

**Files:** `frontend/src/components/SmartDropZone.tsx` (created in Task #41)

**Action:** Extend SmartDropZone to detect and parse URLs from drag events

```typescript
const handleDragOver = (e: React.DragEvent) => {
  e.preventDefault()
  e.stopPropagation()

  // Detect drag type
  const types = Array.from(e.dataTransfer.types)

  if (types.includes('Files')) {
    setDragType('csv')
  } else if (types.includes('text/uri-list') || types.includes('text/plain')) {
    setDragType('url')
  } else {
    setDragType('unknown')
  }
}

const handleDrop = async (e: React.DragEvent) => {
  e.preventDefault()
  e.stopPropagation()

  // Check for files first (CSV upload)
  if (e.dataTransfer.files.length > 0) {
    const file = e.dataTransfer.files[0]
    if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
      onCsvDrop(file)
      return
    }

    // Check for .txt files with URLs
    if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
      const text = await file.text()
      const urls = parseUrls(text)
      if (urls.length > 0) {
        onUrlDrop(urls)
        return
      }
    }
  }

  // Try to get URL data (dragged from browser)
  const urlData = e.dataTransfer.getData('text/uri-list') ||
                  e.dataTransfer.getData('text/plain')

  if (urlData) {
    const urls = parseUrls(urlData)
    if (urls.length > 0) {
      onUrlDrop(urls)
    }
  }
}
```

---

### Step 7: Integrate URL Drop into VideosPage

**Files:** `frontend/src/pages/VideosPage.tsx`

**Action:** Wire up URL drop handler to bulk upload hook

```typescript
import { useBulkUrlUpload } from '@/hooks/useBulkUrlUpload'
import { parseUrls } from '@/utils/urlParser'

export function VideosPage() {
  const listId = /* get current list ID */
  const bulkUrlUpload = useBulkUrlUpload(listId)

  const handleUrlDrop = async (urls: string[]) => {
    try {
      const result = await bulkUrlUpload.mutateAsync({ urls })

      if (result.failed_count > 0) {
        toast.warning(
          `${result.created_count} videos added, ${result.failed_count} failed`
        )
      } else {
        toast.success(`${result.created_count} videos added successfully`)
      }
    } catch (error) {
      toast.error('Failed to upload URLs')
    }
  }

  return (
    <SmartDropZone
      onCsvDrop={handleCsvDrop}
      onUrlDrop={handleUrlDrop}
      isProcessing={bulkUrlUpload.isPending}
    />
  )
}
```

---

## 🧪 Testing Strategy

**Backend Unit Tests (`backend/tests/api/test_videos.py`):**
- `extract_youtube_id()` with all URL formats (watch, youtu.be, embed, shorts, live)
- Bulk-urls endpoint with valid URLs → success
- Bulk-urls endpoint with invalid URLs → failures in response
- Bulk-urls endpoint with duplicate URLs → deduplication
- Bulk-urls endpoint with existing videos → IntegrityError handling
- Bulk-urls endpoint with non-existent list → 404

**Frontend Unit Tests (`frontend/src/utils/urlParser.test.ts`):**
- `parseUrls()` with newline/comma/space-separated URLs
- `parseUrls()` with duplicate URLs → deduplication
- `isYouTubeUrl()` with valid/invalid URLs
- `extractVideoId()` with all URL formats

**Integration Tests:**
- Full bulk URL upload flow (POST → ARQ worker → WebSocket → DB)
- Concurrent CSV and URL uploads
- WebSocket reconnection during processing

**Manual Testing:**
1. Drag URL from browser address bar → videos added
2. Drag link from web page → video added
3. Create .txt with multiple URLs → drag/drop → all added
4. Drag same URL twice → only one created
5. Drag invalid URL → error toast
6. Monitor WebSocket progress → real-time updates

---

## 📚 Reference

**Related Docs:**
- Task #41: SmartDropZone base implementation
- MDN DataTransfer API: https://developer.mozilla.org/en-US/docs/Web/API/DataTransfer

**Related Code:**
- `backend/app/api/videos.py` - CSV bulk upload pattern (lines 480-657)
- `backend/app/workers/video_processor.py` - ARQ worker pattern

**Design Decisions:**

### Decision 1: Extend extract_youtube_id() vs New Function
**Chosen:** Extend existing function
**Rationale:** DRY principle, single source of truth, consistent validation
**Trade-off:** None (pure benefit)

### Decision 2: Deduplicate Client AND Server
**Chosen:** Both layers
**Rationale:** Client = better UX (instant feedback), Server = security (never trust client)
**Trade-off:** Slight code duplication (acceptable)

### Decision 3: Parse URLs from Text
**Chosen:** Support any separator (newline, comma, space)
**Rationale:** User flexibility, common workflows (paste from spreadsheet)
**Trade-off:** More complex parsing (mitigated by tests)

### Decision 4: Reuse BulkUploadResponse Schema
**Chosen:** Same response format as CSV upload
**Rationale:** Consistent API, reuse frontend error handling
**Trade-off:** None (pure benefit)

### Decision 5: Max 100 URLs per Request
**Chosen:** Hard limit at 100
**Rationale:** Balance between convenience and server load, YouTube quota considerations
**Trade-off:** Large imports require multiple requests (acceptable)

### Decision 6: Support .txt File Drops
**Chosen:** Yes, in addition to raw URL text
**Rationale:** Common workflow (export from browser extensions)
**Trade-off:** Minimal extra code (reuse parseUrls())

### Decision 7: DataTransfer.types for Detection
**Chosen:** Use in dragover event
**Rationale:** Available before drop, cross-browser compatible, enables UI preview
**Trade-off:** None (standard API)

---

## ⏱️ Estimated Time

**Total:** 4-5 hours

- Backend endpoint + URL parsing: 1.5 hours
- Frontend URL detection + parsing: 1.5 hours
- SmartDropZone integration: 1 hour
- Testing (unit + integration): 1 hour

---

**Next Task:** Task #43 - Implement drag & drop for CSV files (extends SmartDropZone)
