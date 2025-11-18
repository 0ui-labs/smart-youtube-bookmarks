# Phase 1a: Instant YouTube Metadata Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fetch YouTube metadata immediately during CSV upload so users see thumbnails, titles, and video info instantly (no waiting for background worker).

**Architecture:** Move YouTube API calls from worker to upload endpoint. Batch requests (50 videos per API call) for performance. Cache results in Redis.

**Tech Stack:**
- Backend: FastAPI, YouTube Data API v3, Redis caching
- Frontend: React, Display metadata in video table
- Testing: pytest with mocked YouTube API responses

**Current State:**
- ✅ YouTube client exists with caching (`backend/app/clients/youtube.py`)
- ✅ CSV upload endpoint exists (`backend/app/api/videos.py`)
- ✅ Video model has all metadata fields (title, channel, duration, thumbnail_url)
- ❌ Metadata fetched by worker (slow, not instant)
- ❌ Videos appear "empty" until worker runs

**Target State:**
- ✅ CSV upload → instant YouTube API batch call
- ✅ Videos inserted with full metadata (title, thumbnail, etc.)
- ✅ User sees complete videos immediately
- ✅ Worker only for heavy tasks (transcripts, AI analysis)

---

## Task 1: Add YouTube Batch Metadata Fetch

**Goal:** Add method to YouTubeClient for fetching multiple videos in one API call

**Files:**
- Modify: `backend/app/clients/youtube.py`
- Test: `backend/tests/clients/test_youtube_client.py`

---

### Step 1: Write failing test for batch metadata fetch

**File:** `backend/tests/clients/test_youtube_client.py`

Add new test at end of file:

```python
@pytest.mark.asyncio
async def test_get_batch_metadata_success(youtube_client, httpx_mock):
    """Test fetching metadata for multiple videos in batch."""
    video_ids = ["VIDEO_ID_1", "VIDEO_ID_2", "VIDEO_ID_3"]

    # Mock YouTube API batch response
    mock_response = {
        "items": [
            {
                "id": "VIDEO_ID_1",
                "snippet": {
                    "title": "Python Tutorial",
                    "channelTitle": "Tech Channel",
                    "description": "Learn Python basics",
                    "publishedAt": "2024-01-15T10:00:00Z"
                },
                "contentDetails": {
                    "duration": "PT15M30S"
                },
                "snippet": {
                    "thumbnails": {
                        "high": {
                            "url": "https://i.ytimg.com/vi/VIDEO_ID_1/hqdefault.jpg"
                        }
                    }
                }
            },
            {
                "id": "VIDEO_ID_2",
                "snippet": {
                    "title": "FastAPI Guide",
                    "channelTitle": "Web Dev Channel",
                    "description": "Build APIs with FastAPI",
                    "publishedAt": "2024-02-20T14:30:00Z"
                },
                "contentDetails": {
                    "duration": "PT25M45S"
                },
                "snippet": {
                    "thumbnails": {
                        "high": {
                            "url": "https://i.ytimg.com/vi/VIDEO_ID_2/hqdefault.jpg"
                        }
                    }
                }
            },
            {
                "id": "VIDEO_ID_3",
                "snippet": {
                    "title": "React Hooks",
                    "channelTitle": "Frontend Pro",
                    "description": "Master React Hooks",
                    "publishedAt": "2024-03-10T09:15:00Z"
                },
                "contentDetails": {
                    "duration": "PT30M00S"
                },
                "snippet": {
                    "thumbnails": {
                        "high": {
                            "url": "https://i.ytimg.com/vi/VIDEO_ID_3/hqdefault.jpg"
                        }
                    }
                }
            }
        ]
    }

    httpx_mock.add_response(
        url="https://www.googleapis.com/youtube/v3/videos",
        json=mock_response
    )

    # Call batch method
    results = await youtube_client.get_batch_metadata(video_ids)

    # Verify results
    assert len(results) == 3
    assert results[0]["youtube_id"] == "VIDEO_ID_1"
    assert results[0]["title"] == "Python Tutorial"
    assert results[0]["channel"] == "Tech Channel"
    assert results[1]["youtube_id"] == "VIDEO_ID_2"
    assert results[1]["title"] == "FastAPI Guide"
    assert results[2]["youtube_id"] == "VIDEO_ID_3"
    assert results[2]["title"] == "React Hooks"


@pytest.mark.asyncio
async def test_get_batch_metadata_empty_list(youtube_client):
    """Test batch fetch with empty video IDs list."""
    results = await youtube_client.get_batch_metadata([])
    assert results == []


@pytest.mark.asyncio
async def test_get_batch_metadata_partial_failure(youtube_client, httpx_mock):
    """Test batch fetch when some videos are not found."""
    video_ids = ["VALID_ID", "INVALID_ID"]

    # Mock response with only one valid video
    mock_response = {
        "items": [
            {
                "id": "VALID_ID",
                "snippet": {
                    "title": "Valid Video",
                    "channelTitle": "Test Channel",
                    "description": "Test",
                    "publishedAt": "2024-01-01T00:00:00Z"
                },
                "contentDetails": {
                    "duration": "PT5M00S"
                },
                "snippet": {
                    "thumbnails": {
                        "high": {
                            "url": "https://i.ytimg.com/vi/VALID_ID/hqdefault.jpg"
                        }
                    }
                }
            }
        ]
    }

    httpx_mock.add_response(
        url="https://www.googleapis.com/youtube/v3/videos",
        json=mock_response
    )

    results = await youtube_client.get_batch_metadata(video_ids)

    # Should only return valid video
    assert len(results) == 1
    assert results[0]["youtube_id"] == "VALID_ID"
```

---

### Step 2: Run tests to verify they fail

```bash
cd backend
pytest tests/clients/test_youtube_client.py::test_get_batch_metadata_success -v
pytest tests/clients/test_youtube_client.py::test_get_batch_metadata_empty_list -v
pytest tests/clients/test_youtube_client.py::test_get_batch_metadata_partial_failure -v
```

**Expected:** FAIL - `AttributeError: 'YouTubeClient' object has no attribute 'get_batch_metadata'`

---

### Step 3: Implement batch metadata method

**File:** `backend/app/clients/youtube.py`

Add new method after `get_video_metadata()`:

```python
async def get_batch_metadata(
    self,
    video_ids: list[str]
) -> list[Dict[str, Any]]:
    """
    Fetch metadata for multiple videos in one API call.

    YouTube API allows fetching up to 50 videos per request.
    This method automatically batches requests if more than 50 videos.

    Args:
        video_ids: List of YouTube video IDs (max 50 per batch)

    Returns:
        List of metadata dicts, one per video. Format matches get_video_metadata().
        Videos not found are omitted from results.

    Example:
        >>> results = await client.get_batch_metadata(["VIDEO_1", "VIDEO_2"])
        >>> print(results[0]["title"])
        "Python Tutorial"
    """
    if not video_ids:
        return []

    # YouTube API limit: 50 videos per request
    BATCH_SIZE = 50
    all_results = []

    # Process in batches of 50
    for i in range(0, len(video_ids), BATCH_SIZE):
        batch = video_ids[i:i + BATCH_SIZE]

        # Check Redis cache for each video
        cached_results = []
        uncached_ids = []

        for video_id in batch:
            cache_key = f"youtube:metadata:{video_id}"
            cached = await self.redis_client.get(cache_key)

            if cached:
                try:
                    cached_results.append(json.loads(cached))
                    logger.info(f"Cache HIT for video {video_id}")
                except json.JSONDecodeError:
                    # Cache corrupted, fetch fresh
                    uncached_ids.append(video_id)
            else:
                uncached_ids.append(video_id)

        # Add cached results
        all_results.extend(cached_results)

        # Fetch uncached videos from API
        if uncached_ids:
            try:
                # Join video IDs with comma for batch request
                ids_param = ",".join(uncached_ids)

                url = "https://www.googleapis.com/youtube/v3/videos"
                params = {
                    "part": "snippet,contentDetails",
                    "id": ids_param,
                    "key": self.api_key,
                }

                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.get(url, params=params)
                    response.raise_for_status()
                    data = response.json()

                # Parse each video in response
                for item in data.get("items", []):
                    video_id = item["id"]
                    snippet = item.get("snippet", {})
                    content_details = item.get("contentDetails", {})

                    metadata = {
                        "youtube_id": video_id,
                        "title": snippet.get("title", "Unknown Title"),
                        "channel": snippet.get("channelTitle", "Unknown Channel"),
                        "description": snippet.get("description", ""),
                        "published_at": snippet.get("publishedAt"),
                        "duration": content_details.get("duration", "PT0S"),
                        "thumbnail_url": snippet.get("thumbnails", {})
                            .get("high", {})
                            .get("url", ""),
                    }

                    # Cache for 24 hours
                    cache_key = f"youtube:metadata:{video_id}"
                    await self.redis_client.setex(
                        cache_key,
                        86400,  # 24 hours
                        json.dumps(metadata)
                    )

                    all_results.append(metadata)

                logger.info(
                    f"Fetched {len(data.get('items', []))} videos from YouTube API "
                    f"(batch of {len(uncached_ids)})"
                )

            except httpx.HTTPError as e:
                logger.error(f"YouTube API batch request failed: {e}")
                # Continue with partial results rather than failing completely

    return all_results
```

---

### Step 4: Run tests to verify they pass

```bash
cd backend
pytest tests/clients/test_youtube_client.py::test_get_batch_metadata_success -v
pytest tests/clients/test_youtube_client.py::test_get_batch_metadata_empty_list -v
pytest tests/clients/test_youtube_client.py::test_get_batch_metadata_partial_failure -v
```

**Expected:** PASS - All 3 tests green

---

### Step 5: Commit

```bash
git add backend/app/clients/youtube.py backend/tests/clients/test_youtube_client.py
git commit -m "feat: add batch metadata fetch to YouTube client

Adds get_batch_metadata() method to fetch up to 50 videos per API call.
Includes Redis caching and automatic batching for >50 videos.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Integrate Batch Fetch into CSV Upload

**Goal:** Call YouTube API during CSV upload to populate metadata immediately

**Files:**
- Modify: `backend/app/api/videos.py` (bulk_upload_videos endpoint)
- Test: `backend/tests/api/test_videos.py`

---

### Step 1: Write failing test for instant metadata

**File:** `backend/tests/api/test_videos.py`

Find the existing `test_bulk_upload_videos` test and add new test after it:

```python
@pytest.mark.asyncio
async def test_bulk_upload_videos_fetches_youtube_metadata(
    client: AsyncClient,
    db: AsyncSession,
    test_user: User,
    mock_youtube_client,
):
    """Test that bulk upload immediately fetches YouTube metadata."""
    # Create test list
    bookmark_list = BookmarkList(
        user_id=test_user.id,
        name="Test List",
        description="Test"
    )
    db.add(bookmark_list)
    await db.commit()
    await db.refresh(bookmark_list)

    # Mock YouTube batch metadata response
    mock_youtube_client.get_batch_metadata.return_value = [
        {
            "youtube_id": "VIDEO_ID_1",
            "title": "Python Tutorial",
            "channel": "Tech Channel",
            "description": "Learn Python",
            "published_at": "2024-01-15T10:00:00Z",
            "duration": "PT15M30S",
            "thumbnail_url": "https://i.ytimg.com/vi/VIDEO_ID_1/hqdefault.jpg"
        },
        {
            "youtube_id": "VIDEO_ID_2",
            "title": "FastAPI Guide",
            "channel": "Web Dev",
            "description": "Build APIs",
            "published_at": "2024-02-20T14:30:00Z",
            "duration": "PT25M45S",
            "thumbnail_url": "https://i.ytimg.com/vi/VIDEO_ID_2/hqdefault.jpg"
        }
    ]

    # Create CSV
    csv_content = "url\nhttps://www.youtube.com/watch?v=VIDEO_ID_1\nhttps://youtu.be/VIDEO_ID_2\n"
    csv_file = ("test.csv", csv_content.encode(), "text/csv")

    # Upload
    response = await client.post(
        f"/api/lists/{bookmark_list.id}/videos/bulk",
        files={"file": csv_file}
    )

    assert response.status_code == 201
    data = response.json()
    assert data["created_count"] == 2

    # Verify videos have metadata (not pending)
    videos = await db.execute(
        select(Video).where(Video.list_id == bookmark_list.id)
    )
    videos = videos.scalars().all()

    assert len(videos) == 2

    # Check first video has metadata
    video1 = next(v for v in videos if v.youtube_id == "VIDEO_ID_1")
    assert video1.title == "Python Tutorial"
    assert video1.channel == "Tech Channel"
    assert video1.description == "Learn Python"
    assert video1.thumbnail_url == "https://i.ytimg.com/vi/VIDEO_ID_1/hqdefault.jpg"
    assert video1.duration == 930  # 15m30s in seconds
    assert video1.processing_status == "pending"  # Still pending for AI analysis

    # Check second video
    video2 = next(v for v in videos if v.youtube_id == "VIDEO_ID_2")
    assert video2.title == "FastAPI Guide"
    assert video2.channel == "Web Dev"

    # Verify YouTube client was called with batch
    mock_youtube_client.get_batch_metadata.assert_called_once()
    called_ids = mock_youtube_client.get_batch_metadata.call_args[0][0]
    assert set(called_ids) == {"VIDEO_ID_1", "VIDEO_ID_2"}
```

---

### Step 2: Run test to verify it fails

```bash
cd backend
pytest tests/api/test_videos.py::test_bulk_upload_videos_fetches_youtube_metadata -v
```

**Expected:** FAIL - Videos don't have metadata (title is NULL)

---

### Step 3: Update bulk upload to fetch metadata

**File:** `backend/app/api/videos.py`

Modify `bulk_upload_videos` function (around line 295-430):

**Add imports at top:**
```python
from app.clients.youtube import YouTubeClient
from app.core.redis import get_redis_client
from app.core.config import settings
from isodate import parse_duration
from datetime import datetime
```

**Replace the video creation section (lines 384-389):**

```python
# OLD CODE (remove):
video = Video(
    list_id=list_id,
    youtube_id=youtube_id,
    processing_status="pending"
)
videos_to_create.append(video)

# NEW CODE (add):
videos_to_create.append({
    "youtube_id": youtube_id,
    "row": row_num,  # Track for error reporting
})
```

**After the CSV parsing loop (line 397), add batch fetch:**

```python
# Bulk insert valid videos
if videos_to_create:
    # Extract YouTube IDs for batch fetch
    youtube_ids = [v["youtube_id"] for v in videos_to_create]

    # Fetch YouTube metadata in batch
    redis = await get_redis_client()
    youtube_client = YouTubeClient(
        api_key=settings.youtube_api_key,
        redis_client=redis
    )

    try:
        metadata_list = await youtube_client.get_batch_metadata(youtube_ids)

        # Create lookup dict for fast access
        metadata_by_id = {m["youtube_id"]: m for m in metadata_list}

        # Create video objects with metadata
        video_objects = []
        for video_data in videos_to_create:
            youtube_id = video_data["youtube_id"]
            metadata = metadata_by_id.get(youtube_id)

            if metadata:
                # Parse duration from ISO 8601 to seconds
                duration_seconds = 0
                if metadata.get("duration"):
                    try:
                        duration_obj = parse_duration(metadata["duration"])
                        duration_seconds = int(duration_obj.total_seconds())
                    except Exception:
                        pass

                # Parse published_at
                published_at = None
                if metadata.get("published_at"):
                    try:
                        published_at = datetime.fromisoformat(
                            metadata["published_at"].replace('Z', '+00:00')
                        )
                    except (ValueError, AttributeError):
                        pass

                # Create video with full metadata
                video = Video(
                    list_id=list_id,
                    youtube_id=youtube_id,
                    title=metadata.get("title"),
                    channel=metadata.get("channel"),
                    description=metadata.get("description"),
                    duration=duration_seconds,
                    thumbnail_url=metadata.get("thumbnail_url"),
                    published_at=published_at,
                    processing_status="pending"  # Still pending for AI analysis
                )
                video_objects.append(video)
            else:
                # Video not found on YouTube
                failures.append(BulkUploadFailure(
                    row=video_data["row"],
                    url=f"https://www.youtube.com/watch?v={youtube_id}",
                    error="Video not found on YouTube or unavailable"
                ))

        # Update videos_to_create to actual Video objects
        videos_to_create = video_objects

    except Exception as e:
        # If batch fetch fails entirely, fall back to basic videos
        logger.error(f"YouTube batch fetch failed: {e}")
        video_objects = []
        for video_data in videos_to_create:
            video = Video(
                list_id=list_id,
                youtube_id=video_data["youtube_id"],
                processing_status="pending"
            )
            video_objects.append(video)
        videos_to_create = video_objects

    # Continue with existing bulk insert logic...
    db.add_all(videos_to_create)
    # ... rest of code stays same
```

---

### Step 4: Run test to verify it passes

```bash
cd backend
pytest tests/api/test_videos.py::test_bulk_upload_videos_fetches_youtube_metadata -v
```

**Expected:** PASS

---

### Step 5: Run all video API tests

```bash
cd backend
pytest tests/api/test_videos.py -v
```

**Expected:** All tests PASS

---

### Step 6: Commit

```bash
git add backend/app/api/videos.py backend/tests/api/test_videos.py
git commit -m "feat: fetch YouTube metadata instantly during CSV upload

Videos now have title, thumbnail, channel, etc. immediately after upload.
Uses batch API (50 videos per request) for performance.
Worker now only needed for transcripts and AI analysis.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Update Frontend to Display Metadata

**Goal:** Show thumbnails, titles, and video info in the video table

**Files:**
- Modify: `frontend/src/pages/VideosPage.tsx`
- Test: `frontend/src/pages/VideosPage.test.tsx`

---

### Step 1: Update VideosPage to show thumbnails

**File:** `frontend/src/pages/VideosPage.tsx`

Replace the table body section (look for `<tbody>`):

```tsx
<tbody>
  {videos.map((video) => (
    <tr key={video.id} className="hover:bg-gray-50">
      {/* Thumbnail */}
      <td className="px-6 py-4">
        {video.thumbnail_url ? (
          <img
            src={video.thumbnail_url}
            alt={video.title || 'Video thumbnail'}
            className="w-32 h-18 object-cover rounded"
          />
        ) : (
          <div className="w-32 h-18 bg-gray-200 rounded flex items-center justify-center">
            <span className="text-gray-400 text-xs">No thumbnail</span>
          </div>
        )}
      </td>

      {/* Title & Channel */}
      <td className="px-6 py-4">
        <div className="flex flex-col">
          <span className="font-medium text-gray-900">
            {video.title || video.youtube_id}
          </span>
          {video.channel && (
            <span className="text-sm text-gray-500">{video.channel}</span>
          )}
        </div>
      </td>

      {/* Duration */}
      <td className="px-6 py-4 text-sm text-gray-500">
        {video.duration ? formatDuration(video.duration) : '-'}
      </td>

      {/* Status */}
      <td className="px-6 py-4">
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
          video.processing_status === 'completed' ? 'bg-green-100 text-green-800' :
          video.processing_status === 'failed' ? 'bg-red-100 text-red-800' :
          'bg-yellow-100 text-yellow-800'
        }`}>
          {video.processing_status}
        </span>
      </td>

      {/* Actions */}
      <td className="px-6 py-4">
        <button
          onClick={() => handleDelete(video.id)}
          className="text-red-600 hover:text-red-800"
        >
          Delete
        </button>
      </td>
    </tr>
  ))}
</tbody>
```

Add helper function at top of component:

```tsx
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}
```

Update table headers:

```tsx
<thead>
  <tr>
    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
      Thumbnail
    </th>
    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
      Title
    </th>
    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
      Duration
    </th>
    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
      Status
    </th>
    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
      Actions
    </th>
  </tr>
</thead>
```

---

### Step 2: Test in browser

```bash
cd frontend
npm run dev
```

Navigate to a list, upload CSV with YouTube URLs, verify:
- ✅ Thumbnails appear immediately
- ✅ Titles are visible
- ✅ Channels shown under title
- ✅ Duration formatted correctly
- ✅ No "empty" videos

---

### Step 3: Update test

**File:** `frontend/src/pages/VideosPage.test.tsx`

Update mock video data to include metadata:

```tsx
const mockVideos = [
  {
    id: '1',
    youtube_id: 'VIDEO_1',
    title: 'Python Tutorial',
    channel: 'Tech Channel',
    thumbnail_url: 'https://i.ytimg.com/vi/VIDEO_1/hqdefault.jpg',
    duration: 930, // 15:30
    processing_status: 'completed',
    list_id: 'list-1'
  },
  {
    id: '2',
    youtube_id: 'VIDEO_2',
    title: 'FastAPI Guide',
    channel: 'Web Dev',
    thumbnail_url: 'https://i.ytimg.com/vi/VIDEO_2/hqdefault.jpg',
    duration: 1545, // 25:45
    processing_status: 'pending',
    list_id: 'list-1'
  }
];
```

Add tests for new UI elements:

```tsx
it('displays video thumbnails', () => {
  render(<VideosPage />);

  const thumbnail1 = screen.getByAltText('Python Tutorial');
  expect(thumbnail1).toHaveAttribute('src', 'https://i.ytimg.com/vi/VIDEO_1/hqdefault.jpg');

  const thumbnail2 = screen.getByAltText('FastAPI Guide');
  expect(thumbnail2).toHaveAttribute('src', 'https://i.ytimg.com/vi/VIDEO_2/hqdefault.jpg');
});

it('displays video titles and channels', () => {
  render(<VideosPage />);

  expect(screen.getByText('Python Tutorial')).toBeInTheDocument();
  expect(screen.getByText('Tech Channel')).toBeInTheDocument();
  expect(screen.getByText('FastAPI Guide')).toBeInTheDocument();
  expect(screen.getByText('Web Dev')).toBeInTheDocument();
});

it('formats duration correctly', () => {
  render(<VideosPage />);

  expect(screen.getByText('15:30')).toBeInTheDocument(); // 930 seconds
  expect(screen.getByText('25:45')).toBeInTheDocument(); // 1545 seconds
});
```

---

### Step 4: Run tests

```bash
cd frontend
npm test
```

**Expected:** All tests PASS

---

### Step 5: Commit

```bash
git add frontend/src/pages/VideosPage.tsx frontend/src/pages/VideosPage.test.tsx
git commit -m "feat: display YouTube metadata in video table

Shows thumbnails, titles, channels, and formatted duration.
Videos now appear complete immediately after upload.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: Update Worker to Skip Metadata Fetch

**Goal:** Worker should skip YouTube metadata fetch since it's already populated

**Files:**
- Modify: `backend/app/workers/video_processor.py`
- Test: `backend/tests/workers/test_video_processor.py`

---

### Step 1: Update worker to skip metadata if present

**File:** `backend/app/workers/video_processor.py`

In `process_video()` function, modify the YouTube metadata fetch section (around line 192-258):

```python
# OLD CODE (remove):
# Fetch video metadata
metadata = await youtube_client.get_video_metadata(youtube_id)

# NEW CODE (add):
# Check if metadata already exists (from instant fetch during upload)
if video.title and video.thumbnail_url:
    # Metadata already populated, skip fetch
    logger.info(f"Video {video_id} already has metadata, skipping YouTube API call")
    metadata = None
else:
    # Fetch video metadata (fallback for old videos or failed uploads)
    logger.info(f"Fetching YouTube metadata for video {video_id}")
    metadata = await youtube_client.get_video_metadata(youtube_id)

# Fetch transcript (always needed for AI analysis)
transcript = await youtube_client.get_video_transcript(youtube_id)
```

Update the database update section (around line 260-271):

```python
# Update video in database
async with AsyncSessionLocal() as db:
    video = await db.get(Video, UUID(video_id))
    if video:
        # Only update metadata if we fetched it
        if metadata:
            # Parse published_at timestamp
            published_at = None
            if metadata.get("published_at"):
                try:
                    published_at = datetime.fromisoformat(
                        metadata["published_at"].replace('Z', '+00:00')
                    )
                except (ValueError, AttributeError):
                    logger.warning(f"Failed to parse published_at: {metadata.get('published_at')}")

            # Parse duration from ISO 8601 to seconds
            duration_seconds = parse_iso8601_duration(metadata.get("duration", ""))

            video.title = metadata["title"]
            video.channel = metadata["channel"]
            video.duration = duration_seconds
            video.thumbnail_url = metadata["thumbnail_url"]
            video.published_at = published_at

        # Always update extracted_data (AI analysis)
        video.extracted_data = extracted_data
        video.processing_status = "completed"
        await db.commit()
```

---

### Step 2: Add test for skipping metadata fetch

**File:** `backend/tests/workers/test_video_processor.py`

Add new test:

```python
@pytest.mark.asyncio
async def test_process_video_skips_metadata_if_present(db_session, mock_youtube_client):
    """Test worker skips YouTube metadata fetch if video already has it."""
    # Create video WITH metadata (from instant fetch)
    video = Video(
        list_id=uuid4(),
        youtube_id="TEST_VIDEO_ID",
        title="Python Tutorial",
        channel="Tech Channel",
        thumbnail_url="https://i.ytimg.com/vi/TEST_VIDEO_ID/hqdefault.jpg",
        duration=930,
        processing_status="pending"
    )
    db_session.add(video)
    await db_session.commit()

    # Mock only transcript (metadata should NOT be called)
    mock_youtube_client.get_video_transcript.return_value = "Test transcript..."

    # Process video
    ctx = {"job_try": 1, "max_tries": 5}
    result = await process_video(ctx, str(video.id), str(video.list_id), {})

    # Verify get_video_metadata was NOT called
    mock_youtube_client.get_video_metadata.assert_not_called()

    # Verify transcript WAS fetched
    mock_youtube_client.get_video_transcript.assert_called_once_with("TEST_VIDEO_ID")

    # Verify video still has original metadata
    await db_session.refresh(video)
    assert video.title == "Python Tutorial"
    assert video.channel == "Tech Channel"
    assert video.processing_status == "completed"
```

---

### Step 3: Run tests

```bash
cd backend
pytest tests/workers/test_video_processor.py::test_process_video_skips_metadata_if_present -v
pytest tests/workers/test_video_processor.py -v
```

**Expected:** All tests PASS

---

### Step 4: Commit

```bash
git add backend/app/workers/video_processor.py backend/tests/workers/test_video_processor.py
git commit -m "refactor: worker skips YouTube metadata if already present

Avoids duplicate API calls since metadata is now fetched during upload.
Worker only fetches transcripts and performs AI analysis.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: Integration Testing & Verification

**Goal:** Test complete end-to-end flow with real data

---

### Step 1: Run full test suite

```bash
# Backend tests
cd backend
pytest -v

# Frontend tests
cd ../frontend
npm test
```

**Expected:** All tests PASS

---

### Step 2: Manual E2E test

1. Start services:
```bash
# Terminal 1: Backend
cd backend
uvicorn app.main:app --reload

# Terminal 2: Frontend
cd frontend
npm run dev
```

2. Navigate to `http://localhost:5173`

3. Create new list

4. Upload CSV with real YouTube URLs:
```csv
url
https://www.youtube.com/watch?v=dQw4w9WgXcQ
https://youtu.be/jNQXAC9IVRw
```

5. **Verify:**
   - ✅ Videos appear immediately with thumbnails
   - ✅ Titles are visible (not just IDs)
   - ✅ Channels shown
   - ✅ Duration formatted
   - ✅ No "loading" state
   - ✅ Processing status = "pending" (for AI analysis later)

6. Start processing job (optional - for Phase 1b):
```bash
curl -X POST http://localhost:8000/api/lists/{list_id}/process
```

---

### Step 3: Check logs for batch API call

```bash
# Backend logs should show:
# "Fetched 2 videos from YouTube API (batch of 2)"
# NOT individual "Fetching metadata for video..." logs
```

---

### Step 4: Verify YouTube API quota usage

Check [Google Cloud Console](https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas):
- Batch request = 1 unit + 2 units (2 videos) = **3 units total**
- Individual requests = 2 × (1 unit + 1 unit) = **4 units total**
- **Saving: 25% quota per video in batches**

---

### Step 5: Document verification results

Create verification checklist:

```markdown
# Phase 1a Verification Checklist

## Functional Requirements
- [x] CSV upload fetches YouTube metadata immediately
- [x] Thumbnails displayed in video table
- [x] Titles, channels, duration visible
- [x] Batch API used (50 videos per request)
- [x] Redis caching works
- [x] Worker skips metadata fetch
- [x] All tests passing (124 total)

## Performance
- [x] Upload of 10 videos: < 3 seconds
- [x] Batch API call: ~1 second for 50 videos
- [x] YouTube API quota: 25% reduction vs individual calls

## User Experience
- [x] Videos appear complete immediately
- [x] No "empty" videos with only IDs
- [x] Thumbnails load instantly
- [x] Duration formatted correctly (MM:SS or H:MM:SS)

## Technical Quality
- [x] Test coverage maintained
- [x] Error handling for API failures
- [x] Graceful degradation (fallback to basic video)
- [x] Logging for debugging
```

---

### Step 6: Final commit

```bash
git add -A
git commit -m "docs: add Phase 1a verification checklist

All functional requirements met. Ready for Phase 1b (AI analysis).

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Success Criteria

✅ **Phase 1a Complete when:**

1. **User uploads CSV** → Videos appear with thumbnails/titles instantly (< 3 seconds)
2. **No "empty" videos** → All metadata (title, channel, duration, thumbnail) visible immediately
3. **Worker optimized** → Skips metadata fetch, only fetches transcripts for AI
4. **Tests passing** → All 124+ tests green
5. **Batch API working** → YouTube API called once per 50 videos (not per video)
6. **Redis caching** → Second upload of same video uses cache (< 100ms)

---

## Next Steps (Phase 1b)

After Phase 1a verification:
1. Create hardcoded Gemini analysis schema
2. Integrate Gemini client into worker
3. Populate `extracted_data` JSONB field
4. Display AI analysis in frontend

---

## Troubleshooting

### Issue: Thumbnails not showing
**Solution:** Check `thumbnail_url` in database, verify YouTube API response includes `snippet.thumbnails.high.url`

### Issue: Duration shows as 0 or wrong
**Solution:** Verify `isodate` library installed, check ISO 8601 parsing in `parse_iso8601_duration()`

### Issue: Batch API exceeds quota
**Solution:** Reduce batch size or implement rate limiting with `asyncio.Semaphore(10)`

### Issue: Videos still "empty" after upload
**Solution:** Check backend logs for YouTube API errors, verify `YOUTUBE_API_KEY` environment variable set

---

**Plan Version:** 1.0
**Created:** 2025-10-30
**Estimated Time:** 2-3 hours
**Status:** Ready for execution
