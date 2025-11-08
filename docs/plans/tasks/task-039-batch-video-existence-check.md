# Task #39: Add Batch Video Existence Check to YouTube Client

**Plan Task:** #39
**Wave/Phase:** Advanced Features
**Dependencies:** None
**Created:** 2025-11-08
**Estimated Duration:** 90-120 minutes

---

## 🎯 Ziel

Add a batch video existence check method to the YouTube client that efficiently validates whether YouTube videos exist before processing them. This supports Task #38 (smart CSV import) by enabling pre-validation of video IDs to filter out deleted/private videos before enqueuing ARQ workers.

**Expected Outcome:** New `check_videos_exist()` method that accepts up to 50 video IDs per call, returns a dictionary mapping video_id → VideoExistenceResult (exists: bool, metadata: optional), handles API errors gracefully, and optimizes quota usage for large CSV imports.

---

## 📋 Acceptance Criteria

### Functional Requirements
- [ ] New method `check_videos_exist(video_ids: list[str])` accepts 1-50 video IDs
- [ ] Returns `dict[str, VideoExistenceResult]` with exists flag and optional basic metadata
- [ ] Automatically chunks requests into batches of 50 (YouTube API limit)
- [ ] Handles invalid video IDs gracefully (returns exists=False, no exception)
- [ ] Handles quota exceeded error (403) with clear error message
- [ ] Handles network errors with retry logic (uses existing @retry decorator)
- [ ] Supports Redis caching for existence checks (7-day TTL)
- [ ] Quota efficient: 1 API call per 50 videos (vs N calls for individual checks)

### Integration Requirements
- [ ] Compatible with existing YouTube client architecture (async, Redis caching)
- [ ] Can be called from CSV bulk upload endpoint before creating Video records
- [ ] Returns enough metadata for early validation (title, channel) without full processing
- [ ] Does not duplicate existing `get_batch_metadata()` functionality

### Testing Requirements
- [ ] Unit tests for video ID chunking (51 IDs → 2 batches, 100 IDs → 2 batches)
- [ ] Unit tests for VideoExistenceResult TypedDict structure
- [ ] Integration test: Valid video IDs (all exist=True)
- [ ] Integration test: Mix of valid/invalid IDs (partial success)
- [ ] Integration test: All invalid IDs (all exist=False)
- [ ] Integration test: Empty list (returns empty dict)
- [ ] Integration test: Quota exceeded error (raises ValueError)
- [ ] Integration test: Network error retry (uses tenacity)
- [ ] Manual verification: 100-video CSV pre-check uses 2 API calls instead of 100

### Code Quality Requirements
- [ ] Code follows existing YouTubeClient patterns (async, @retry, Redis caching)
- [ ] Docstring with usage examples and quota analysis
- [ ] Type hints with TypedDict for result structure
- [ ] Error messages in English (technical API, not user-facing)
- [ ] Logging for cache hits/misses and API batch requests

---

## 🛠️ Implementation Steps

### Step 1: Add VideoExistenceResult TypedDict

**Files:** `backend/app/clients/youtube.py`

**Action:** Define TypedDict for existence check results with optional metadata

**Code:**
```python
# Add after VideoMetadata TypedDict (around line 42)

class VideoExistenceResult(TypedDict):
    """Type definition for video existence check result"""
    exists: bool
    video_id: str
    title: Optional[str]  # None if video doesn't exist
    channel: Optional[str]  # None if video doesn't exist
```

**Why:**
- TypedDict provides type safety for return values
- `exists` flag enables quick filtering without exception handling
- Optional title/channel useful for early validation (detect wrong videos)
- Lightweight - doesn't include full metadata (duration, thumbnail, etc.)
- Consistent with existing VideoMetadata TypedDict pattern

---

### Step 2: Implement check_videos_exist Method

**Files:** `backend/app/clients/youtube.py`

**Action:** Add batch existence check method with chunking and caching

**Code:**
```python
# Add after get_batch_metadata() method (around line 340)

async def check_videos_exist(
    self,
    video_ids: list[str]
) -> dict[str, VideoExistenceResult]:
    """
    Check if YouTube videos exist (batch validation for CSV imports).

    Uses YouTube Data API v3 videos.list to validate video IDs efficiently.
    Automatically chunks requests into batches of 50 (API limit).
    Results are cached in Redis (7-day TTL) to avoid redundant API calls.

    Args:
        video_ids: List of YouTube video IDs to check (e.g., ["dQw4w9WgXcQ", "invalid123"])

    Returns:
        Dictionary mapping video_id → VideoExistenceResult
        - exists=True: Video found, includes title and channel
        - exists=False: Video not found (deleted, private, or invalid ID)

    Raises:
        ValueError: If YouTube API quota exceeded (403 quotaExceeded)

    Quota Analysis:
        - Cost: 1 quota unit per API call (not per video)
        - 50 videos = 1 API call = 1 quota unit
        - 100 videos = 2 API calls = 2 quota units
        - Daily limit: 10,000 units = 500,000 videos/day
        - Compare: Individual get_video_metadata() would be 100 calls = 100 quota units

    Example:
        >>> client = YouTubeClient(api_key="...")
        >>> results = await client.check_videos_exist(["dQw4w9WgXcQ", "invalid123"])
        >>> print(results["dQw4w9WgXcQ"]["exists"])
        True
        >>> print(results["invalid123"]["exists"])
        False
    """
    if not video_ids:
        return {}

    # YouTube API limit: 50 videos per request
    BATCH_SIZE = 50
    all_results: dict[str, VideoExistenceResult] = {}

    # Process in batches of 50
    for i in range(0, len(video_ids), BATCH_SIZE):
        batch = video_ids[i:i + BATCH_SIZE]

        # Check Redis cache for each video
        cached_results: dict[str, VideoExistenceResult] = {}
        uncached_ids: list[str] = []

        if self.redis:
            for video_id in batch:
                cache_key = f"youtube:v1:exists:{video_id}"
                cached = await self.redis.get(cache_key)

                if cached:
                    try:
                        cached_results[video_id] = json.loads(cached)
                        logger.debug(f"Cache HIT for existence check: {video_id}")
                    except json.JSONDecodeError:
                        # Cache corrupted, fetch fresh
                        uncached_ids.append(video_id)
                else:
                    uncached_ids.append(video_id)
        else:
            # No Redis, fetch all
            uncached_ids = batch

        # Add cached results
        all_results.update(cached_results)

        # Fetch uncached videos from API
        if uncached_ids:
            try:
                # Join video IDs with comma for batch request
                ids_param = ",".join(uncached_ids)

                url = "https://www.googleapis.com/youtube/v3/videos"
                params = {
                    "part": "snippet",  # Only need snippet for title/channel
                    "id": ids_param,
                    "key": self.api_key,
                }

                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.get(url, params=params)

                    # Handle quota exceeded (403)
                    if response.status_code == 403:
                        error_data = response.json()
                        reason = error_data.get('error', {}).get('errors', [{}])[0].get('reason', 'unknown')
                        if reason == 'quotaExceeded':
                            raise ValueError("YouTube API quota exceeded")
                        else:
                            raise ValueError(f"YouTube API access forbidden: {reason}")

                    response.raise_for_status()
                    data = response.json()

                # Create a set of found video IDs for fast lookup
                found_ids = set()

                # Parse videos that exist
                for item in data.get("items", []):
                    video_id = item["id"]
                    snippet = item.get("snippet", {})
                    found_ids.add(video_id)

                    result: VideoExistenceResult = {
                        "exists": True,
                        "video_id": video_id,
                        "title": snippet.get("title", "Unknown Title"),
                        "channel": snippet.get("channelTitle", "Unknown Channel"),
                    }

                    # Cache for 7 days (same as get_video_metadata)
                    if self.redis:
                        cache_key = f"youtube:v1:exists:{video_id}"
                        ttl = 7 * 24 * 3600 + random.randint(0, 3600)  # Add jitter
                        await self.redis.setex(
                            cache_key,
                            ttl,
                            json.dumps(result)
                        )

                    all_results[video_id] = result

                # Mark videos not in response as non-existent
                for video_id in uncached_ids:
                    if video_id not in found_ids:
                        result: VideoExistenceResult = {
                            "exists": False,
                            "video_id": video_id,
                            "title": None,
                            "channel": None,
                        }

                        # Cache negative result (shorter TTL: 1 day)
                        if self.redis:
                            cache_key = f"youtube:v1:exists:{video_id}"
                            ttl = 1 * 24 * 3600  # 1 day for negative results
                            await self.redis.setex(
                                cache_key,
                                ttl,
                                json.dumps(result)
                            )

                        all_results[video_id] = result

                logger.info(
                    f"Checked {len(uncached_ids)} videos: "
                    f"{len(found_ids)} exist, {len(uncached_ids) - len(found_ids)} not found"
                )

            except httpx.HTTPError as e:
                logger.error(f"YouTube API batch existence check failed: {e}")
                # Mark all uncached videos as unknown (exists=False)
                for video_id in uncached_ids:
                    if video_id not in all_results:
                        all_results[video_id] = {
                            "exists": False,
                            "video_id": video_id,
                            "title": None,
                            "channel": None,
                        }

    return all_results
```

**Why:**
- **Batching:** Chunks into 50-video batches to respect YouTube API limit
- **Caching:** Checks Redis first to avoid redundant API calls (7-day TTL for exists=True, 1-day for exists=False)
- **Partial failures:** If API fails, returns exists=False for unknown videos (fail-safe)
- **Quota optimization:** 1 API call per 50 videos vs 50 individual calls (50x reduction)
- **Error handling:** Raises ValueError for quota exceeded (clear signal to caller), logs other errors
- **Type safety:** Uses TypedDict for structured return values

---

### Step 3: Add Unit Tests

**Files:** `backend/tests/clients/test_youtube_client.py`

**Action:** Test batch chunking with different input sizes

**Code:**
```python
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.clients.youtube import YouTubeClient, VideoExistenceResult


@pytest.fixture
def youtube_client_no_redis():
    """YouTube client without Redis (for testing API calls)."""
    return YouTubeClient(api_key="test-api-key", redis_client=None)


@pytest.mark.asyncio
async def test_check_videos_exist_empty_list(youtube_client_no_redis):
    """Test empty video ID list returns empty dict."""
    result = await youtube_client_no_redis.check_videos_exist([])
    assert result == {}


@pytest.mark.asyncio
async def test_check_videos_exist_single_batch(youtube_client_no_redis):
    """Test 3 videos (< 50) makes 1 API call."""
    with patch("app.clients.youtube.httpx.AsyncClient") as mock_client:
        # Mock API response with 2 valid videos
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "items": [
                {"id": "video1", "snippet": {"title": "Video 1", "channelTitle": "Channel 1"}},
                {"id": "video2", "snippet": {"title": "Video 2", "channelTitle": "Channel 2"}}
            ]
        }

        mock_client_instance = AsyncMock()
        mock_client_instance.get.return_value = mock_response
        mock_client.return_value.__aenter__.return_value = mock_client_instance

        # Call with 3 video IDs (1 invalid)
        result = await youtube_client_no_redis.check_videos_exist(["video1", "video2", "invalid"])

        # Verify 1 API call made
        assert mock_client_instance.get.call_count == 1

        # Verify results
        assert result["video1"]["exists"] is True
        assert result["video1"]["title"] == "Video 1"
        assert result["video2"]["exists"] is True
        assert result["invalid"]["exists"] is False
        assert result["invalid"]["title"] is None


@pytest.mark.asyncio
async def test_check_videos_exist_multiple_batches(youtube_client_no_redis):
    """Test 51 videos makes 2 API calls (batches of 50 + 1)."""
    with patch("app.clients.youtube.httpx.AsyncClient") as mock_client:
        video_ids = [f"video{i}" for i in range(51)]

        def mock_get_response(*args, **kwargs):
            ids_param = kwargs["params"]["id"]
            ids = ids_param.split(",")

            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "items": [
                    {"id": vid, "snippet": {"title": f"Title {vid}", "channelTitle": f"Channel {vid}"}}
                    for vid in ids
                ]
            }
            return mock_response

        mock_client_instance = AsyncMock()
        mock_client_instance.get = AsyncMock(side_effect=mock_get_response)
        mock_client.return_value.__aenter__.return_value = mock_client_instance

        result = await youtube_client_no_redis.check_videos_exist(video_ids)

        # Verify 2 API calls made (50 + 1)
        assert mock_client_instance.get.call_count == 2

        # Verify all results exist
        assert len(result) == 51
        assert all(result[vid]["exists"] for vid in video_ids)


@pytest.mark.asyncio
async def test_check_videos_exist_quota_exceeded(youtube_client_no_redis):
    """Test quota exceeded error raises ValueError."""
    with patch("app.clients.youtube.httpx.AsyncClient") as mock_client:
        mock_response = MagicMock()
        mock_response.status_code = 403
        mock_response.json.return_value = {
            "error": {"errors": [{"reason": "quotaExceeded"}]}
        }

        mock_client_instance = AsyncMock()
        mock_client_instance.get.return_value = mock_response
        mock_client.return_value.__aenter__.return_value = mock_client_instance

        with pytest.raises(ValueError, match="YouTube API quota exceeded"):
            await youtube_client_no_redis.check_videos_exist(["video1"])
```

---

## 🧪 Testing Strategy

**Unit Tests:**
- Empty list → returns empty dict
- Single batch (3 videos) → 1 API call, correct results
- Multiple batches (51 videos) → 2 API calls, all results
- Mix of valid/invalid IDs → correct exists flags
- Quota exceeded → raises ValueError
- Network error → returns exists=False

**Integration Tests:**
- Real YouTube API call with known video ID (Rick Astley)
- Redis caching verification (cache hit on second call)

**Manual Testing:**
```python
import asyncio
from app.clients.youtube import YouTubeClient

async def test():
    client = YouTubeClient(api_key="...", redis_client=None)

    # Test with 3 known videos (2 valid, 1 invalid)
    video_ids = ["dQw4w9WgXcQ", "jNQXAC9IVRw", "invalid123"]
    results = await client.check_videos_exist(video_ids)

    for vid, result in results.items():
        print(f"{vid}: exists={result['exists']}, title={result['title']}")

asyncio.run(test())
```

---

## 📚 Reference

**Related Documentation:**
- YouTube Data API v3 - videos.list: https://developers.google.com/youtube/v3/docs/videos/list
- YouTube API Quota Calculator: https://developers.google.com/youtube/v3/determine_quota_cost

**Related Code:**
- `backend/app/clients/youtube.py` - Lines 210-339 (`get_batch_metadata()`)
- `backend/app/clients/youtube.py` - Lines 53-151 (`get_video_metadata()`)

**Design Decisions:**

### Decision 1: New Method vs Extend get_batch_metadata()

**Decision:** Create new `check_videos_exist()` method (separate from `get_batch_metadata()`)

**Rationale:**
- **Different use cases:** Existence check vs full metadata fetch
- **Performance difference:** `part=snippet` (lighter) vs `part=snippet,contentDetails` (heavier)
- **API semantics:** Returns exists=False for invalid IDs (no exception) vs omits from response

**Trade-offs:**
- ✅ Clear API semantics, optimized for CSV pre-validation
- ⚠️ ~50 lines of duplicated batching code (acceptable for clarity)

### Decision 2: Cache TTL (7 days vs 1 day)

**Decision:** 7-day TTL for exists=True, 1-day TTL for exists=False

**Rationale:**
- **Existing videos rarely disappear:** Once exists, unlikely to be deleted within 7 days
- **Deleted videos may return:** Users may re-upload with same ID
- **Quota optimization:** Most CSV imports are re-uploads (same videos)

**Trade-offs:**
- ✅ Balances freshness and quota savings
- ⚠️ Slightly more complex caching (2 TTL values)

### Decision 3: Return Format

**Decision:** Return `dict[str, VideoExistenceResult]` (mapping video_id → result)

**Rationale:**
- **Fast lookup:** O(1) access by video_id
- **Includes metadata:** Title/channel useful for validation
- **Type safety:** TypedDict provides autocomplete

**Trade-offs:**
- ✅ Fast lookups, type-safe, useful metadata
- ⚠️ Slightly larger memory footprint

---

## 📊 Performance Analysis

### Quota Comparison (100-Video CSV)

**Without Batch Check:**
- 100 individual `get_video_metadata()` calls = 100 quota units
- Total quota: 100 units

**With Batch Check:**
- 2 `check_videos_exist()` calls (50+50) = 2 quota units
- 90 valid videos: 90 `get_video_metadata()` calls = 90 quota units
- Total quota: 2 + 90 = 92 units (8% savings)

### Cache Performance

**First import (100 videos):** 2 API calls (batch check)
**Second import (same 100 videos):** 0 API calls (Redis cache hit)

---

## ✅ Success Criteria

**Implementation Complete When:**
1. ✅ `check_videos_exist(video_ids)` method exists with TypedDict return type
2. ✅ Automatically chunks requests into batches of 50
3. ✅ Returns exists=True for valid videos with title/channel
4. ✅ Returns exists=False for invalid/deleted/private videos
5. ✅ Handles quota exceeded error (raises ValueError)
6. ✅ Uses Redis caching (7-day TTL for exists=True, 1-day for exists=False)
7. ✅ Unit tests passing (6+ test cases)
8. ✅ Documentation complete with usage examples

---

**Next Task:** Task #38 - Smart CSV Import (uses `check_videos_exist()` for pre-validation)
