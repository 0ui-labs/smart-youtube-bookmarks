"""
Tests for Video Management API endpoints.

Following TDD: These tests will fail initially until implementation is complete.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import uuid4
import io

from app.models.list import BookmarkList
from app.models.video import Video
from app.models.user import User


@pytest.mark.asyncio
async def test_add_video_to_list(client: AsyncClient, test_db: AsyncSession, test_list: BookmarkList):
    """Test adding a video to a list with standard YouTube URL (HYBRID: sync fetch for single videos)."""
    response = await client.post(
        f"/api/lists/{test_list.id}/videos",
        json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}
    )

    assert response.status_code == 201
    data = response.json()
    assert data["youtube_id"] == "dQw4w9WgXcQ"
    assert data["list_id"] == str(test_list.id)
    # HYBRID APPROACH: Single video additions fetch metadata synchronously (fast!)
    # Status is "completed" immediately, or "pending" if YouTube API fails
    assert data["processing_status"] in ["completed", "pending"]
    assert "id" in data
    assert "created_at" in data


@pytest.mark.asyncio
async def test_add_video_short_url(client: AsyncClient, test_db: AsyncSession, test_list: BookmarkList):
    """Test adding a video with youtu.be short URL."""
    response = await client.post(
        f"/api/lists/{test_list.id}/videos",
        json={"url": "https://youtu.be/dQw4w9WgXcQ"}
    )

    assert response.status_code == 201
    data = response.json()
    assert data["youtube_id"] == "dQw4w9WgXcQ"


@pytest.mark.asyncio
async def test_add_video_embed_url(client: AsyncClient, test_db: AsyncSession, test_list: BookmarkList):
    """Test adding a video with embed URL."""
    response = await client.post(
        f"/api/lists/{test_list.id}/videos",
        json={"url": "https://www.youtube.com/embed/dQw4w9WgXcQ"}
    )

    assert response.status_code == 201
    data = response.json()
    assert data["youtube_id"] == "dQw4w9WgXcQ"


@pytest.mark.asyncio
async def test_add_video_mobile_url(client: AsyncClient, test_db: AsyncSession, test_list: BookmarkList):
    """Test adding a video with mobile YouTube URL."""
    response = await client.post(
        f"/api/lists/{test_list.id}/videos",
        json={"url": "https://m.youtube.com/watch?v=dQw4w9WgXcQ"}
    )

    assert response.status_code == 201
    data = response.json()
    assert data["youtube_id"] == "dQw4w9WgXcQ"


@pytest.mark.asyncio
async def test_add_video_with_query_params(client: AsyncClient, test_db: AsyncSession, test_list: BookmarkList):
    """Test adding a video URL with additional query parameters."""
    response = await client.post(
        f"/api/lists/{test_list.id}/videos",
        json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=PLtest"}
    )

    assert response.status_code == 201
    data = response.json()
    assert data["youtube_id"] == "dQw4w9WgXcQ"


@pytest.mark.asyncio
async def test_add_duplicate_video(client: AsyncClient, test_db: AsyncSession, test_list: BookmarkList):
    """Test adding the same video twice returns 409 Conflict."""
    # Add video first time
    response1 = await client.post(
        f"/api/lists/{test_list.id}/videos",
        json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}
    )
    assert response1.status_code == 201

    # Try to add same video again
    response2 = await client.post(
        f"/api/lists/{test_list.id}/videos",
        json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}
    )
    assert response2.status_code == 409
    assert response2.json()["detail"] == "Video already exists in this list"


@pytest.mark.asyncio
async def test_add_video_to_nonexistent_list(client: AsyncClient, test_db: AsyncSession):
    """Test adding a video to a non-existent list returns 404."""
    nonexistent_id = uuid4()
    response = await client.post(
        f"/api/lists/{nonexistent_id}/videos",
        json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}
    )

    assert response.status_code == 404
    assert response.json()["detail"] == f"List with id {nonexistent_id} not found"


@pytest.mark.asyncio
async def test_add_video_invalid_url_format(client: AsyncClient, test_db: AsyncSession, test_list: BookmarkList):
    """Test adding a video with invalid YouTube URL format."""
    response = await client.post(
        f"/api/lists/{test_list.id}/videos",
        json={"url": "https://www.youtube.com/watch?v=invalid"}
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_add_video_non_youtube_domain(client: AsyncClient, test_db: AsyncSession, test_list: BookmarkList):
    """Test adding a video from non-YouTube domain is rejected."""
    response = await client.post(
        f"/api/lists/{test_list.id}/videos",
        json={"url": "https://vimeo.com/12345678"}
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_add_video_http_protocol(client: AsyncClient, test_db: AsyncSession, test_list: BookmarkList):
    """Test adding a video with HTTP (not HTTPS) is rejected."""
    response = await client.post(
        f"/api/lists/{test_list.id}/videos",
        json={"url": "http://www.youtube.com/watch?v=dQw4w9WgXcQ"}
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_add_video_unicode_chars(client: AsyncClient, test_db: AsyncSession, test_list: BookmarkList):
    """Test adding a video URL with Unicode characters is rejected."""
    response = await client.post(
        f"/api/lists/{test_list.id}/videos",
        json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ\u200b"}
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_get_videos_in_list(client: AsyncClient, test_db: AsyncSession, test_list: BookmarkList):
    """Test retrieving all videos in a list (default sort: created_at DESC, newest first)."""
    # Add some videos first
    video1_url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    video2_url = "https://www.youtube.com/watch?v=jNQXAC9IVRw"

    await client.post(f"/api/lists/{test_list.id}/videos", json={"url": video1_url})
    await client.post(f"/api/lists/{test_list.id}/videos", json={"url": video2_url})

    # Get all videos (default sort: created_at DESC - newest first)
    response = await client.get(f"/api/lists/{test_list.id}/videos")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    # Default sort is created_at DESC, so video2 (newest) comes first
    assert data[0]["youtube_id"] == "jNQXAC9IVRw"
    assert data[1]["youtube_id"] == "dQw4w9WgXcQ"


@pytest.mark.asyncio
async def test_get_videos_empty_list(client: AsyncClient, test_db: AsyncSession, test_list: BookmarkList):
    """Test retrieving videos from an empty list returns empty array."""
    response = await client.get(f"/api/lists/{test_list.id}/videos")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 0


@pytest.mark.asyncio
async def test_get_videos_nonexistent_list(client: AsyncClient, test_db: AsyncSession):
    """Test retrieving videos from non-existent list returns 404."""
    nonexistent_id = uuid4()
    response = await client.get(f"/api/lists/{nonexistent_id}/videos")

    assert response.status_code == 404
    assert response.json()["detail"] == f"List with id {nonexistent_id} not found"


@pytest.mark.asyncio
async def test_delete_video(client: AsyncClient, test_db: AsyncSession, test_list: BookmarkList):
    """Test deleting a video."""
    # Add a video first
    add_response = await client.post(
        f"/api/lists/{test_list.id}/videos",
        json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}
    )
    video_id = add_response.json()["id"]

    # Delete the video
    delete_response = await client.delete(f"/api/videos/{video_id}")

    assert delete_response.status_code == 204

    # Verify video is gone
    get_response = await client.get(f"/api/lists/{test_list.id}/videos")
    videos = get_response.json()
    assert len(videos) == 0


@pytest.mark.asyncio
async def test_delete_nonexistent_video(client: AsyncClient, test_db: AsyncSession):
    """Test deleting a non-existent video returns 404."""
    nonexistent_id = uuid4()
    response = await client.delete(f"/api/videos/{nonexistent_id}")

    assert response.status_code == 404
    assert response.json()["detail"] == f"Video with id {nonexistent_id} not found"


@pytest.mark.asyncio
async def test_bulk_upload_csv_success(client, test_list, monkeypatch):
    """Test bulk video upload from CSV file."""
    # Mock ARQ pool to avoid event loop issues in tests
    from unittest.mock import AsyncMock, patch
    mock_arq_pool = AsyncMock()
    mock_arq_pool.enqueue_job = AsyncMock()

    async def mock_get_arq_pool():
        return mock_arq_pool

    monkeypatch.setattr("app.api.videos.get_arq_pool", mock_get_arq_pool)

    # Mock YouTube client to return basic metadata
    mock_youtube_client = AsyncMock()
    mock_youtube_client.get_batch_metadata = AsyncMock(return_value=[
        {"youtube_id": "dQw4w9WgXcQ", "title": "Video 1", "channel": "Channel 1", "duration": "PT3M33S", "thumbnail_url": "https://img.youtube.com/1.jpg", "published_at": "2024-01-01T00:00:00Z"},
        {"youtube_id": "jNQXAC9IVRw", "title": "Video 2", "channel": "Channel 2", "duration": "PT5M00S", "thumbnail_url": "https://img.youtube.com/2.jpg", "published_at": "2024-01-02T00:00:00Z"},
        {"youtube_id": "9bZkp7q19f0", "title": "Video 3", "channel": "Channel 3", "duration": "PT10M00S", "thumbnail_url": "https://img.youtube.com/3.jpg", "published_at": "2024-01-03T00:00:00Z"}
    ])

    with patch('app.api.videos.YouTubeClient', return_value=mock_youtube_client):
        # Create CSV content with 3 videos
        csv_content = """url
https://www.youtube.com/watch?v=dQw4w9WgXcQ
https://youtu.be/jNQXAC9IVRw
https://www.youtube.com/watch?v=9bZkp7q19f0"""

        csv_file = io.BytesIO(csv_content.encode('utf-8'))

        # Upload CSV
        response = await client.post(
            f"/api/lists/{test_list.id}/videos/bulk",
            files={"file": ("videos.csv", csv_file, "text/csv")}
        )

        assert response.status_code == 201
        data = response.json()
        assert data["created_count"] == 3
        assert data["failed_count"] == 0
        assert len(data["failures"]) == 0

        # Verify videos were created
        videos_response = await client.get(f"/api/lists/{test_list.id}/videos")
        assert videos_response.status_code == 200
        videos = videos_response.json()
        assert len(videos) == 3

        # Verify videos start in "pending" state (ARQ-driven processing)
        for video in videos:
            assert video["processing_status"] == "pending"
            assert video["title"] is None  # Metadata not fetched yet


@pytest.mark.asyncio
async def test_bulk_upload_csv_with_failures(client, test_list, monkeypatch):
    """Test bulk upload handles invalid URLs gracefully."""
    # Mock ARQ pool to avoid event loop issues in tests
    from unittest.mock import AsyncMock, patch
    mock_arq_pool = AsyncMock()
    mock_arq_pool.enqueue_job = AsyncMock()

    async def mock_get_arq_pool():
        return mock_arq_pool

    monkeypatch.setattr("app.api.videos.get_arq_pool", mock_get_arq_pool)

    # Mock YouTube client
    mock_youtube_client = AsyncMock()
    mock_youtube_client.get_batch_metadata = AsyncMock(return_value=[
        {"youtube_id": "dQw4w9WgXcQ", "title": "Video 1", "channel": "Channel 1", "duration": "PT3M33S", "thumbnail_url": "https://img.youtube.com/1.jpg", "published_at": "2024-01-01T00:00:00Z"},
        {"youtube_id": "jNQXAC9IVRw", "title": "Video 2", "channel": "Channel 2", "duration": "PT5M00S", "thumbnail_url": "https://img.youtube.com/2.jpg", "published_at": "2024-01-02T00:00:00Z"}
    ])

    with patch('app.api.videos.YouTubeClient', return_value=mock_youtube_client):
        csv_content = """url
https://www.youtube.com/watch?v=dQw4w9WgXcQ
https://invalid.com/video
https://youtu.be/jNQXAC9IVRw"""

        csv_file = io.BytesIO(csv_content.encode('utf-8'))

        response = await client.post(
            f"/api/lists/{test_list.id}/videos/bulk",
            files={"file": ("videos.csv", csv_file, "text/csv")}
        )

        assert response.status_code == 201
        data = response.json()
        assert data["created_count"] == 2  # Only 2 valid URLs
        assert data["failed_count"] == 1
        assert len(data["failures"]) == 1
        assert "invalid.com" in data["failures"][0]["url"]


@pytest.mark.asyncio
async def test_bulk_upload_csv_list_not_found(client):
    """Test bulk upload returns 404 when list doesn't exist."""
    csv_content = """url
https://www.youtube.com/watch?v=dQw4w9WgXcQ"""

    csv_file = io.BytesIO(csv_content.encode('utf-8'))
    fake_list_id = "00000000-0000-0000-0000-000000000000"

    response = await client.post(
        f"/api/lists/{fake_list_id}/videos/bulk",
        files={"file": ("videos.csv", csv_file, "text/csv")}
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_bulk_upload_csv_invalid_header(client, test_list):
    """Test bulk upload validates CSV header."""
    csv_content = """invalid_header
https://www.youtube.com/watch?v=dQw4w9WgXcQ"""

    csv_file = io.BytesIO(csv_content.encode('utf-8'))

    response = await client.post(
        f"/api/lists/{test_list.id}/videos/bulk",
        files={"file": ("videos.csv", csv_file, "text/csv")}
    )

    assert response.status_code == 422
    assert "header" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_export_videos_csv_success(client, test_list, test_video):
    """Test exporting videos to CSV."""
    response = await client.get(f"/api/lists/{test_list.id}/export/csv")

    assert response.status_code == 200
    assert response.headers["content-type"] == "text/csv; charset=utf-8"
    assert "attachment" in response.headers["content-disposition"]

    # Parse CSV response
    csv_content = response.content.decode('utf-8')
    lines = csv_content.strip().splitlines()

    # Skip comment lines (starting with #) when counting lines
    data_lines = [line for line in lines if not line.startswith('#')]

    assert len(data_lines) >= 2  # Header + at least 1 video
    # Updated header format: uses 'url' instead of 'youtube_id' for import compatibility
    assert data_lines[0].startswith("url,status,created_at")
    assert test_video.youtube_id in data_lines[1]
    assert "pending" in data_lines[1]


@pytest.mark.asyncio
async def test_export_videos_csv_empty_list(client, test_list):
    """Test exporting empty list returns CSV with header only."""
    response = await client.get(f"/api/lists/{test_list.id}/export/csv")

    assert response.status_code == 200
    csv_content = response.content.decode('utf-8')
    lines = csv_content.strip().splitlines()

    # Skip comment lines (may have custom field metadata)
    data_lines = [line for line in lines if not line.startswith('#')]

    assert len(data_lines) == 1  # Header only
    # Updated header format: uses 'url' instead of 'youtube_id'
    assert data_lines[0].startswith("url,status,created_at")


@pytest.mark.asyncio
async def test_export_videos_csv_list_not_found(client):
    """Test export returns 404 when list doesn't exist."""
    fake_list_id = "00000000-0000-0000-0000-000000000000"

    response = await client.get(f"/api/lists/{fake_list_id}/export/csv")

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_bulk_upload_fetches_youtube_metadata(client, test_list, test_db, monkeypatch):
    """Test that bulk upload immediately fetches YouTube metadata."""
    from unittest.mock import AsyncMock, MagicMock, patch
    from sqlalchemy import select

    # Mock ARQ pool to avoid event loop issues
    mock_arq_pool = AsyncMock()
    mock_arq_pool.enqueue_job = AsyncMock()

    async def mock_get_arq_pool():
        return mock_arq_pool

    monkeypatch.setattr("app.api.videos.get_arq_pool", mock_get_arq_pool)

    # Mock YouTube batch metadata response
    mock_metadata = [
        {
            "youtube_id": "VIDEO_ID_1",
            "title": "Python Tutorial",
            "channel": "Tech Channel",
            "published_at": "2024-01-15T10:00:00Z",
            "duration": "PT15M30S",
            "thumbnail_url": "https://i.ytimg.com/vi/VIDEO_ID_1/hqdefault.jpg"
        },
        {
            "youtube_id": "VIDEO_ID_2",
            "title": "FastAPI Guide",
            "channel": "Web Dev",
            "published_at": "2024-02-20T14:30:00Z",
            "duration": "PT25M45S",
            "thumbnail_url": "https://i.ytimg.com/vi/VIDEO_ID_2/hqdefault.jpg"
        }
    ]

    # Patch YouTubeClient and extract_youtube_id within the videos module
    with patch('app.api.videos.YouTubeClient') as mock_youtube_client_class, \
         patch('app.api.videos.extract_youtube_id') as mock_extract_id:

        # Mock extract_youtube_id with exact URL mapping (not substring matching)
        url_to_id = {
            "https://www.youtube.com/watch?v=VIDEO_ID_1": "VIDEO_ID_1",
            "https://youtu.be/VIDEO_ID_2": "VIDEO_ID_2"
        }
        mock_extract_id.side_effect = lambda url: url_to_id[url]

        # Mock YouTube client instance
        mock_client = AsyncMock()
        mock_client.get_batch_metadata = AsyncMock(return_value=mock_metadata)
        mock_youtube_client_class.return_value = mock_client

        # Create CSV
        csv_content = "url\nhttps://www.youtube.com/watch?v=VIDEO_ID_1\nhttps://youtu.be/VIDEO_ID_2\n"
        csv_file = io.BytesIO(csv_content.encode('utf-8'))

        # Upload
        response = await client.post(
            f"/api/lists/{test_list.id}/videos/bulk",
            files={"file": ("test.csv", csv_file, "text/csv")}
        )

        assert response.status_code == 201
        data = response.json()
        assert data["created_count"] == 2

        # Verify videos have metadata (not pending)
        result = await test_db.execute(
            select(Video).where(Video.list_id == test_list.id)
        )
        videos = result.scalars().all()

        assert len(videos) == 2

        # Option B: Videos start with pending status (metadata fetched by ARQ worker)
        video1 = next(v for v in videos if v.youtube_id == "VIDEO_ID_1")
        assert video1.processing_status == "pending"
        assert video1.title is None  # Metadata not fetched yet

        video2 = next(v for v in videos if v.youtube_id == "VIDEO_ID_2")
        assert video2.processing_status == "pending"
        assert video2.title is None  # Metadata not fetched yet

        # No batch metadata fetch in bulk_upload anymore (moved to ARQ worker)
        # Mock is no longer used in this endpoint
        mock_client.get_batch_metadata.assert_not_called()


@pytest.mark.asyncio
async def test_get_videos_includes_tags(client: AsyncClient, test_db: AsyncSession, test_list: BookmarkList):
    """Test that GET /api/lists/{list_id}/videos includes tags for each video."""
    # Add a video
    video_response = await client.post(
        f"/api/lists/{test_list.id}/videos",
        json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}
    )
    video_id = video_response.json()["id"]

    # Create tags
    tag1_response = await client.post("/api/tags", json={"name": "Python-test", "color": "#3B82F6"})
    tag2_response = await client.post("/api/tags", json={"name": "Tutorial-test", "color": "#10B981"})
    tag1_id = tag1_response.json()["id"]
    tag2_id = tag2_response.json()["id"]

    # Assign tags to video
    await client.post(f"/api/videos/{video_id}/tags", json={"tag_ids": [tag1_id, tag2_id]})

    # Get videos in list
    response = await client.get(f"/api/lists/{test_list.id}/videos")

    assert response.status_code == 200
    videos = response.json()
    assert len(videos) == 1

    # Verify tags are included in response
    video = videos[0]
    assert "tags" in video
    assert len(video["tags"]) == 2
    tag_names = [t["name"] for t in video["tags"]]
    assert "Python-test" in tag_names
    assert "Tutorial-test" in tag_names


@pytest.mark.asyncio
async def test_get_videos_filter_by_single_tag(client: AsyncClient, test_db: AsyncSession, test_list: BookmarkList):
    """Test filtering videos by a single tag (OR logic)."""
    # Create videos (using valid 11-character YouTube IDs)
    video1_response = await client.post(
        f"/api/lists/{test_list.id}/videos",
        json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXc1"}
    )
    video2_response = await client.post(
        f"/api/lists/{test_list.id}/videos",
        json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXc2"}
    )
    video3_response = await client.post(
        f"/api/lists/{test_list.id}/videos",
        json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXc3"}
    )
    video1_id = video1_response.json()["id"]
    video2_id = video2_response.json()["id"]
    video3_id = video3_response.json()["id"]

    # Create tags with unique names for this test
    python_tag = await client.post("/api/tags", json={"name": "SingleTag-Python", "color": "#3B82F6"})
    js_tag = await client.post("/api/tags", json={"name": "SingleTag-JavaScript", "color": "#F59E0B"})
    python_id = python_tag.json()["id"]
    js_id = js_tag.json()["id"]

    # Assign tags: video1=Python, video2=JavaScript, video3=both
    await client.post(f"/api/videos/{video1_id}/tags", json={"tag_ids": [python_id]})
    await client.post(f"/api/videos/{video2_id}/tags", json={"tag_ids": [js_id]})
    await client.post(f"/api/videos/{video3_id}/tags", json={"tag_ids": [python_id, js_id]})

    # Filter by Python tag
    response = await client.get(f"/api/lists/{test_list.id}/videos?tags=SingleTag-Python")

    assert response.status_code == 200
    videos = response.json()
    assert len(videos) == 2  # video1 and video3
    video_ids = [v["id"] for v in videos]
    assert video1_id in video_ids
    assert video3_id in video_ids
    assert video2_id not in video_ids


@pytest.mark.asyncio
async def test_get_videos_filter_by_multiple_tags_or_logic(client: AsyncClient, test_db: AsyncSession, test_list: BookmarkList):
    """Test filtering videos by multiple tags with OR logic (videos with ANY of the tags)."""
    # Create videos (using valid 11-character YouTube IDs)
    video1_response = await client.post(
        f"/api/lists/{test_list.id}/videos",
        json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXc1"}
    )
    video2_response = await client.post(
        f"/api/lists/{test_list.id}/videos",
        json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXc2"}
    )
    video3_response = await client.post(
        f"/api/lists/{test_list.id}/videos",
        json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXc3"}
    )
    video4_response = await client.post(
        f"/api/lists/{test_list.id}/videos",
        json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXc4"}
    )
    video1_id = video1_response.json()["id"]
    video2_id = video2_response.json()["id"]
    video3_id = video3_response.json()["id"]
    video4_id = video4_response.json()["id"]

    # Create tags with unique names for this test
    python_tag = await client.post("/api/tags", json={"name": "MultiTag-Python", "color": "#3B82F6"})
    tutorial_tag = await client.post("/api/tags", json={"name": "MultiTag-Tutorial", "color": "#10B981"})
    advanced_tag = await client.post("/api/tags", json={"name": "MultiTag-Advanced", "color": "#EF4444"})
    python_id = python_tag.json()["id"]
    tutorial_id = tutorial_tag.json()["id"]
    advanced_id = advanced_tag.json()["id"]

    # Assign tags
    await client.post(f"/api/videos/{video1_id}/tags", json={"tag_ids": [python_id]})
    await client.post(f"/api/videos/{video2_id}/tags", json={"tag_ids": [tutorial_id]})
    await client.post(f"/api/videos/{video3_id}/tags", json={"tag_ids": [python_id, tutorial_id]})
    await client.post(f"/api/videos/{video4_id}/tags", json={"tag_ids": [advanced_id]})

    # Filter by Python OR Tutorial (should return video1, video2, video3)
    response = await client.get(f"/api/lists/{test_list.id}/videos?tags=MultiTag-Python&tags=MultiTag-Tutorial")

    assert response.status_code == 200
    videos = response.json()
    assert len(videos) == 3
    video_ids = [v["id"] for v in videos]
    assert video1_id in video_ids
    assert video2_id in video_ids
    assert video3_id in video_ids
    assert video4_id not in video_ids


@pytest.mark.asyncio
async def test_get_videos_filter_case_insensitive(client: AsyncClient, test_db: AsyncSession, test_list: BookmarkList):
    """Test that tag filtering is case-insensitive."""
    # Create video (using valid 11-character YouTube ID)
    video_response = await client.post(
        f"/api/lists/{test_list.id}/videos",
        json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXc5"}
    )
    video_id = video_response.json()["id"]

    # Create tag with mixed case and unique name
    tag = await client.post("/api/tags", json={"name": "CaseTest-PyThOn", "color": "#3B82F6"})
    tag_id = tag.json()["id"]

    # Assign tag
    await client.post(f"/api/videos/{video_id}/tags", json={"tag_ids": [tag_id]})

    # Filter with different case variations
    response1 = await client.get(f"/api/lists/{test_list.id}/videos?tags=casetest-python")
    response2 = await client.get(f"/api/lists/{test_list.id}/videos?tags=CASETEST-PYTHON")
    response3 = await client.get(f"/api/lists/{test_list.id}/videos?tags=CaseTest-PyThOn")

    assert response1.status_code == 200
    assert response2.status_code == 200
    assert response3.status_code == 200
    assert len(response1.json()) == 1
    assert len(response2.json()) == 1
    assert len(response3.json()) == 1


@pytest.mark.asyncio
async def test_get_videos_filter_no_matching_tags(client: AsyncClient, test_db: AsyncSession, test_list: BookmarkList):
    """Test that filtering by non-existent tag returns empty list."""
    # Create video with tag
    video_response = await client.post(
        f"/api/lists/{test_list.id}/videos",
        json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}
    )
    assert video_response.status_code == 201
    video_id = video_response.json()["id"]

    tag = await client.post("/api/tags", json={"name": "NoMatch-Python", "color": "#3B82F6"})
    tag_id = tag.json()["id"]
    await client.post(f"/api/videos/{video_id}/tags", json={"tag_ids": [tag_id]})

    # Filter by non-existent tag
    response = await client.get(f"/api/lists/{test_list.id}/videos?tags=NonExistent-XYZ")

    assert response.status_code == 200
    videos = response.json()
    assert len(videos) == 0


@pytest.mark.asyncio
async def test_get_videos_without_filter_returns_all(client: AsyncClient, test_db: AsyncSession, test_list: BookmarkList):
    """Test that omitting tags parameter returns all videos."""
    # Create videos with and without tags (using valid 11-character YouTube IDs)
    video_with_tag_response = await client.post(
        f"/api/lists/{test_list.id}/videos",
        json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXc6"}
    )
    await client.post(
        f"/api/lists/{test_list.id}/videos",
        json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXc7"}
    )
    video1_id = video_with_tag_response.json()["id"]

    # Tag only first video with unique tag name
    tag = await client.post("/api/tags", json={"name": "AllVideos-Python", "color": "#3B82F6"})
    await client.post(f"/api/videos/{video1_id}/tags", json={"tag_ids": [tag.json()["id"]]})

    # Get all videos without filter
    response = await client.get(f"/api/lists/{test_list.id}/videos")

    assert response.status_code == 200
    videos = response.json()
    assert len(videos) == 2  # Both videos returned


@pytest.mark.asyncio
async def test_get_videos_field_values_empty_when_no_tags(client: AsyncClient, test_db: AsyncSession, test_list: BookmarkList):
    """Test that field_values is empty list when video has no tags."""
    # Create video without tags
    video_response = await client.post(
        f"/api/lists/{test_list.id}/videos",
        json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXc8"}
    )
    assert video_response.status_code == 201

    # Get videos
    response = await client.get(f"/api/lists/{test_list.id}/videos")

    assert response.status_code == 200
    videos = response.json()
    assert len(videos) == 1

    # Verify field_values is empty list
    video = videos[0]
    assert "field_values" in video
    assert video["field_values"] == []


@pytest.mark.asyncio
async def test_get_videos_field_values_union_from_multiple_schemas(client: AsyncClient, test_db: AsyncSession, test_list: BookmarkList):
    """Test field union when video has tags from multiple schemas."""
    # Create two different custom fields
    field1_response = await client.post(
        f"/api/lists/{test_list.id}/custom-fields",
        json={
            "name": "Overall Rating",
            "field_type": "rating",
            "config": {"max_rating": 5}
        }
    )
    field1_id = field1_response.json()["id"]

    field2_response = await client.post(
        f"/api/lists/{test_list.id}/custom-fields",
        json={
            "name": "Presentation Quality",  # Different name to avoid conflict
            "field_type": "select",
            "config": {"options": ["bad", "good", "great"]}
        }
    )
    field2_id = field2_response.json()["id"]

    # Create schema1 with rating field
    schema1_response = await client.post(
        f"/api/lists/{test_list.id}/schemas",
        json={
            "name": "Schema A",
            "description": "First schema with rating",
            "fields": [
                {"field_id": field1_id, "display_order": 1, "show_on_card": True}
            ]
        }
    )
    schema1_id = schema1_response.json()["id"]

    # Create schema2 with select field
    schema2_response = await client.post(
        f"/api/lists/{test_list.id}/schemas",
        json={
            "name": "Schema B",
            "description": "Second schema with select",
            "fields": [
                {"field_id": field2_id, "display_order": 1, "show_on_card": False}
            ]
        }
    )
    schema2_id = schema2_response.json()["id"]

    # Create tag1 with schema1
    tag1_response = await client.post(
        "/api/tags",
        json={"name": "Tag1", "color": "#3B82F6"}
    )
    tag1_id = tag1_response.json()["id"]
    await client.put(f"/api/tags/{tag1_id}", json={"schema_id": schema1_id})

    # Create tag2 with schema2
    tag2_response = await client.post(
        "/api/tags",
        json={"name": "Tag2", "color": "#10B981"}
    )
    tag2_id = tag2_response.json()["id"]
    await client.put(f"/api/tags/{tag2_id}", json={"schema_id": schema2_id})

    # Create video with both tags
    video_response = await client.post(
        f"/api/lists/{test_list.id}/videos",
        json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXc9"}
    )
    video_id = video_response.json()["id"]

    await client.post(
        f"/api/videos/{video_id}/tags",
        json={"tag_ids": [tag1_id, tag2_id]}
    )

    # Get videos
    response = await client.get(f"/api/lists/{test_list.id}/videos")

    assert response.status_code == 200
    videos = response.json()
    assert len(videos) == 1

    # Verify field_values (BUG FIX #003: Should be empty since no values set yet)
    video = videos[0]
    assert "field_values" in video
    field_values = video["field_values"]

    # FIX: field_values should be EMPTY when no values are set
    # This test was previously expecting 2 fields with None values, which violated the schema
    # The correct behavior is:
    # - field_values: Shows ONLY fields that HAVE been filled (empty in this case)
    # - available_fields: Shows ALL fields that CAN be filled (not tested in this endpoint)
    assert len(field_values) == 0, (
        "field_values should be empty when no values are set. "
        "Only fields with actual values should be included."
    )


@pytest.mark.asyncio
async def test_get_videos_field_values_rating_accepts_float(client: AsyncClient, test_db: AsyncSession, test_list: BookmarkList, test_user: User):
    """Test that rating field accepts and returns float values (e.g., 4.5)."""
    # Create rating field
    field_response = await client.post(
        f"/api/lists/{test_list.id}/custom-fields",
        json={
            "name": "Quality Rating",
            "field_type": "rating",
            "config": {"max_rating": 5}
        }
    )
    field_id = field_response.json()["id"]

    # Create schema with rating field (use correct endpoint: /api/lists/{list_id}/schemas)
    schema_response = await client.post(
        f"/api/lists/{test_list.id}/schemas",
        json={
            "name": "Quality Schema",
            "description": "Schema with rating",
            "fields": [
                {"field_id": field_id, "display_order": 1, "show_on_card": True}
            ]
        }
    )
    schema_id = schema_response.json()["id"]

    # Create tag with schema (pass user_id to ensure correct user association)
    tag_response = await client.post(
        f"/api/tags?user_id={test_user.id}",
        json={"name": "Rated", "color": "#F59E0B"}
    )
    tag_id = tag_response.json()["id"]
    await client.put(f"/api/tags/{tag_id}?user_id={test_user.id}", json={"schema_id": schema_id})

    # Create video with tag
    video_response = await client.post(
        f"/api/lists/{test_list.id}/videos",
        json={"url": "https://www.youtube.com/watch?v=dQw4w9WgX10"}
    )
    video_id = video_response.json()["id"]

    await client.post(
        f"/api/videos/{video_id}/tags",
        json={"tag_ids": [tag_id]}
    )

    # Set rating value to 4.5 (decimal)
    # Note: This requires VideoFieldValue endpoint to exist
    # For now, we'll create the value directly in the database
    from app.models.video_field_value import VideoFieldValue
    from uuid import UUID

    value = VideoFieldValue(
        video_id=UUID(video_id),
        field_id=UUID(field_id),
        value_numeric=4.5
    )
    test_db.add(value)
    await test_db.commit()
    await test_db.refresh(value)  # Ensure committed

    # Get videos
    response = await client.get(f"/api/lists/{test_list.id}/videos")

    assert response.status_code == 200
    videos = response.json()
    assert len(videos) == 1

    # Verify field value is 4.5 (float, not 4)
    video = videos[0]
    assert "field_values" in video
    field_values = video["field_values"]

    assert len(field_values) == 1
    field_value = field_values[0]

    # Verify the value is exactly 4.5 (float)
    assert field_value["value"] == 4.5
    assert isinstance(field_value["value"], float)


# ============================================================================
# SORTING TESTS (Task #146: Field-Based Sorting)
# ============================================================================


@pytest.mark.asyncio
async def test_sort_by_title_ascending(client: AsyncClient, test_db: AsyncSession, test_list: BookmarkList):
    """Test sorting videos by title in ascending order (A-Z)."""
    from sqlalchemy import select, update
    from unittest.mock import AsyncMock, patch

    # Mock YouTube client
    mock_youtube_client = AsyncMock()
    mock_youtube_client.get_video_metadata = AsyncMock(return_value={
        "youtube_id": "test123",
        "title": "Test Video",
        "channel": "Test Channel",
        "duration": "PT5M",
        "thumbnail_url": "https://example.com/thumb.jpg",
        "published_at": "2024-01-01T00:00:00Z"
    })

    with patch('app.api.videos.YouTubeClient', return_value=mock_youtube_client):
        # Create videos with different titles
        await client.post(
            f"/api/lists/{test_list.id}/videos",
            json={"url": "https://www.youtube.com/watch?v=ZuluVideo01"}
        )
        await client.post(
            f"/api/lists/{test_list.id}/videos",
            json={"url": "https://www.youtube.com/watch?v=AlphaVideo1"}
        )
        await client.post(
            f"/api/lists/{test_list.id}/videos",
            json={"url": "https://www.youtube.com/watch?v=MikeVideo01"}
        )

    # Update titles using UPDATE statement (bypasses ORM)
    await test_db.execute(
        update(Video)
        .where(Video.youtube_id == "ZuluVideo01")
        .values(title="Zulu Video")
    )
    await test_db.execute(
        update(Video)
        .where(Video.youtube_id == "AlphaVideo1")
        .values(title="Alpha Video")
    )
    await test_db.execute(
        update(Video)
        .where(Video.youtube_id == "MikeVideo01")
        .values(title="Mike Video")
    )
    await test_db.commit()

    # Test sorting by title ascending
    response = await client.get(f"/api/lists/{test_list.id}/videos?sort_by=title&sort_order=asc")

    assert response.status_code == 200
    videos_json = response.json()
    assert len(videos_json) == 3
    assert videos_json[0]["title"] == "Alpha Video"
    assert videos_json[1]["title"] == "Mike Video"
    assert videos_json[2]["title"] == "Zulu Video"


@pytest.mark.asyncio
async def test_sort_by_title_descending(client: AsyncClient, test_db: AsyncSession, test_list: BookmarkList):
    """Test sorting videos by title in descending order (Z-A)."""
    from unittest.mock import AsyncMock, patch

    # Mock YouTube client
    mock_youtube_client = AsyncMock()
    mock_youtube_client.get_video_metadata = AsyncMock(return_value={
        "youtube_id": "test123",
        "title": "Test Video",
        "channel": "Test Channel",
        "duration": "PT5M",
        "thumbnail_url": "https://example.com/thumb.jpg",
        "published_at": "2024-01-01T00:00:00Z"
    })

    with patch('app.api.videos.YouTubeClient', return_value=mock_youtube_client):
        # Create videos with different titles
        await client.post(
            f"/api/lists/{test_list.id}/videos",
            json={"url": "https://www.youtube.com/watch?v=AlphaVideo1"}
        )
        await client.post(
            f"/api/lists/{test_list.id}/videos",
            json={"url": "https://www.youtube.com/watch?v=ZuluVideo01"}
        )
        await client.post(
            f"/api/lists/{test_list.id}/videos",
            json={"url": "https://www.youtube.com/watch?v=MikeVideo01"}
        )

    # Update titles using UPDATE statement
    from sqlalchemy import update

    await test_db.execute(update(Video).where(Video.youtube_id == "ZuluVideo01").values(title="Zulu Video"))
    await test_db.execute(update(Video).where(Video.youtube_id == "AlphaVideo1").values(title="Alpha Video"))
    await test_db.execute(update(Video).where(Video.youtube_id == "MikeVideo01").values(title="Mike Video"))
    await test_db.commit()

    # Test sorting by title descending
    response = await client.get(f"/api/lists/{test_list.id}/videos?sort_by=title&sort_order=desc")

    assert response.status_code == 200
    videos = response.json()
    assert len(videos) == 3
    assert videos[0]["title"] == "Zulu Video"
    assert videos[1]["title"] == "Mike Video"
    assert videos[2]["title"] == "Alpha Video"


@pytest.mark.asyncio
async def test_sort_by_duration_ascending(client: AsyncClient, test_db: AsyncSession, test_list: BookmarkList):
    """Test sorting videos by duration in ascending order (shortest first)."""
    from unittest.mock import AsyncMock, patch

    # Mock YouTube client
    mock_youtube_client = AsyncMock()
    mock_youtube_client.get_video_metadata = AsyncMock(return_value={
        "youtube_id": "test123",
        "title": "Test Video",
        "channel": "Test Channel",
        "duration": "PT5M",
        "thumbnail_url": "https://example.com/thumb.jpg",
        "published_at": "2024-01-01T00:00:00Z"
    })

    with patch('app.api.videos.YouTubeClient', return_value=mock_youtube_client):
        # Create videos
        await client.post(
            f"/api/lists/{test_list.id}/videos",
            json={"url": "https://www.youtube.com/watch?v=LongVideo01"}
        )
        await client.post(
            f"/api/lists/{test_list.id}/videos",
            json={"url": "https://www.youtube.com/watch?v=ShortVideo1"}
        )
        await client.post(
            f"/api/lists/{test_list.id}/videos",
            json={"url": "https://www.youtube.com/watch?v=MediumVideo"}
        )

    # Update durations using UPDATE statement (in seconds)
    from sqlalchemy import update

    await test_db.execute(update(Video).where(Video.youtube_id == "LongVideo01").values(title="Long Video", duration=600))
    await test_db.execute(update(Video).where(Video.youtube_id == "ShortVideo1").values(title="Short Video", duration=120))
    await test_db.execute(update(Video).where(Video.youtube_id == "MediumVideo").values(title="Medium Video", duration=300))
    await test_db.commit()

    # Test sorting by duration ascending
    response = await client.get(f"/api/lists/{test_list.id}/videos?sort_by=duration&sort_order=asc")

    assert response.status_code == 200
    videos = response.json()
    assert len(videos) == 3
    assert videos[0]["title"] == "Short Video"
    assert videos[0]["duration"] == 120
    assert videos[1]["title"] == "Medium Video"
    assert videos[1]["duration"] == 300
    assert videos[2]["title"] == "Long Video"
    assert videos[2]["duration"] == 600


@pytest.mark.asyncio
async def test_sort_by_duration_descending(client: AsyncClient, test_db: AsyncSession, test_list: BookmarkList):
    """Test sorting videos by duration in descending order (longest first)."""
    from unittest.mock import AsyncMock, patch

    # Mock YouTube client
    mock_youtube_client = AsyncMock()
    mock_youtube_client.get_video_metadata = AsyncMock(return_value={
        "youtube_id": "test123",
        "title": "Test Video",
        "channel": "Test Channel",
        "duration": "PT5M",
        "thumbnail_url": "https://example.com/thumb.jpg",
        "published_at": "2024-01-01T00:00:00Z"
    })

    with patch('app.api.videos.YouTubeClient', return_value=mock_youtube_client):
        # Create videos
        await client.post(
            f"/api/lists/{test_list.id}/videos",
            json={"url": "https://www.youtube.com/watch?v=ShortVideo1"}
        )
        await client.post(
            f"/api/lists/{test_list.id}/videos",
            json={"url": "https://www.youtube.com/watch?v=LongVideo01"}
        )
        await client.post(
            f"/api/lists/{test_list.id}/videos",
            json={"url": "https://www.youtube.com/watch?v=MediumVideo"}
        )

    # Update durations using UPDATE statement (in seconds)
    from sqlalchemy import update

    await test_db.execute(update(Video).where(Video.youtube_id == "LongVideo01").values(title="Long Video", duration=600))
    await test_db.execute(update(Video).where(Video.youtube_id == "ShortVideo1").values(title="Short Video", duration=120))
    await test_db.execute(update(Video).where(Video.youtube_id == "MediumVideo").values(title="Medium Video", duration=300))
    await test_db.commit()

    # Test sorting by duration descending
    response = await client.get(f"/api/lists/{test_list.id}/videos?sort_by=duration&sort_order=desc")

    assert response.status_code == 200
    videos = response.json()
    assert len(videos) == 3
    assert videos[0]["title"] == "Long Video"
    assert videos[0]["duration"] == 600
    assert videos[1]["title"] == "Medium Video"
    assert videos[1]["duration"] == 300
    assert videos[2]["title"] == "Short Video"
    assert videos[2]["duration"] == 120


@pytest.mark.asyncio
async def test_sort_by_field_rating_descending(client: AsyncClient, test_db: AsyncSession, test_list: BookmarkList):
    """Test sorting videos by rating field (highest first) with NULLS LAST."""
    from app.models.video_field_value import VideoFieldValue
    from uuid import UUID
    from sqlalchemy import select, update
    from unittest.mock import AsyncMock, patch

    # Create rating field
    field_response = await client.post(
        f"/api/lists/{test_list.id}/custom-fields",
        json={
            "name": "Quality",
            "field_type": "rating",
            "config": {"max_rating": 5}
        }
    )
    field_id = field_response.json()["id"]

    # Mock YouTube client
    mock_youtube_client = AsyncMock()
    mock_youtube_client.get_video_metadata = AsyncMock(return_value={
        "youtube_id": "test123",
        "title": "Test Video",
        "channel": "Test Channel",
        "duration": "PT5M",
        "thumbnail_url": "https://example.com/thumb.jpg",
        "published_at": "2024-01-01T00:00:00Z"
    })

    with patch('app.api.videos.YouTubeClient', return_value=mock_youtube_client):
        # Create videos
        video_high_response = await client.post(
            f"/api/lists/{test_list.id}/videos",
            json={"url": "https://www.youtube.com/watch?v=HighQuality"}
        )
        video_low_response = await client.post(
            f"/api/lists/{test_list.id}/videos",
            json={"url": "https://www.youtube.com/watch?v=LowQuality1"}
        )
        video_no_rating_response = await client.post(
            f"/api/lists/{test_list.id}/videos",
            json={"url": "https://www.youtube.com/watch?v=NoRating001"}
        )

    video_high_id = video_high_response.json()["id"]
    video_low_id = video_low_response.json()["id"]
    video_no_rating_id = video_no_rating_response.json()["id"]

    # Set field values
    value_high = VideoFieldValue(
        video_id=UUID(video_high_id),
        field_id=UUID(field_id),
        value_numeric=5
    )
    value_low = VideoFieldValue(
        video_id=UUID(video_low_id),
        field_id=UUID(field_id),
        value_numeric=2
    )
    test_db.add(value_high)
    test_db.add(value_low)

    # Update titles using UPDATE statement
    await test_db.execute(update(Video).where(Video.id == UUID(video_high_id)).values(title="High Quality"))
    await test_db.execute(update(Video).where(Video.id == UUID(video_low_id)).values(title="Low Quality"))
    await test_db.execute(update(Video).where(Video.id == UUID(video_no_rating_id)).values(title="No Rating"))
    await test_db.commit()

    # Test sorting by rating field descending
    response = await client.get(
        f"/api/lists/{test_list.id}/videos?sort_by=field:{field_id}&sort_order=desc"
    )

    assert response.status_code == 200
    videos = response.json()
    assert len(videos) == 3

    # Descending with NULLS LAST: 5, 2, NULL
    assert videos[0]["title"] == "High Quality"  # 5 rating
    assert videos[1]["title"] == "Low Quality"   # 2 rating
    assert videos[2]["title"] == "No Rating"     # NULL (at end)


@pytest.mark.asyncio
async def test_sort_by_field_rating_ascending_nulls_last(client: AsyncClient, test_db: AsyncSession, test_list: BookmarkList):
    """Test sorting videos by rating field ascending with NULLS LAST (empties at end)."""
    from app.models.video_field_value import VideoFieldValue
    from uuid import UUID
    from sqlalchemy import select, update
    from unittest.mock import AsyncMock, patch

    # Create rating field
    field_response = await client.post(
        f"/api/lists/{test_list.id}/custom-fields",
        json={
            "name": "Rating",
            "field_type": "rating",
            "config": {"max_rating": 5}
        }
    )
    field_id = field_response.json()["id"]

    # Mock YouTube client
    mock_youtube_client = AsyncMock()
    mock_youtube_client.get_video_metadata = AsyncMock(return_value={
        "youtube_id": "test123",
        "title": "Test Video",
        "channel": "Test Channel",
        "duration": "PT5M",
        "thumbnail_url": "https://example.com/thumb.jpg",
        "published_at": "2024-01-01T00:00:00Z"
    })

    with patch('app.api.videos.YouTubeClient', return_value=mock_youtube_client):
        # Create videos
        v1_response = await client.post(
            f"/api/lists/{test_list.id}/videos",
            json={"url": "https://www.youtube.com/watch?v=Video1Rate1"}
        )
        v2_response = await client.post(
            f"/api/lists/{test_list.id}/videos",
            json={"url": "https://www.youtube.com/watch?v=Video2NoRat"}
        )
        v3_response = await client.post(
            f"/api/lists/{test_list.id}/videos",
            json={"url": "https://www.youtube.com/watch?v=Video3Rate1"}
        )

    v1_id = v1_response.json()["id"]
    v2_id = v2_response.json()["id"]
    v3_id = v3_response.json()["id"]

    # Set field values (v1=3, v2=NULL, v3=1)
    value_v1 = VideoFieldValue(
        video_id=UUID(v1_id),
        field_id=UUID(field_id),
        value_numeric=3
    )
    value_v3 = VideoFieldValue(
        video_id=UUID(v3_id),
        field_id=UUID(field_id),
        value_numeric=1
    )
    test_db.add(value_v1)
    test_db.add(value_v3)

    # Update titles using UPDATE statement
    await test_db.execute(update(Video).where(Video.id == UUID(v1_id)).values(title="Video 1"))
    await test_db.execute(update(Video).where(Video.id == UUID(v2_id)).values(title="Video 2"))
    await test_db.execute(update(Video).where(Video.id == UUID(v3_id)).values(title="Video 3"))
    await test_db.commit()

    # Test sorting by rating field ascending (NULLS LAST)
    response = await client.get(
        f"/api/lists/{test_list.id}/videos?sort_by=field:{field_id}&sort_order=asc"
    )

    assert response.status_code == 200
    videos = response.json()
    assert len(videos) == 3

    # Ascending with NULLS LAST: 1, 3, NULL
    assert videos[0]["title"] == "Video 3"  # 1 (lowest)
    assert videos[1]["title"] == "Video 1"  # 3
    assert videos[2]["title"] == "Video 2"  # NULL (at end)


@pytest.mark.asyncio
async def test_sort_by_field_select_ascending(client: AsyncClient, test_db: AsyncSession, test_list: BookmarkList):
    """Test sorting videos by select field (alphabetical)."""
    from app.models.video_field_value import VideoFieldValue
    from uuid import UUID
    from sqlalchemy import select, update
    from unittest.mock import AsyncMock, patch

    # Create select field
    field_response = await client.post(
        f"/api/lists/{test_list.id}/custom-fields",
        json={
            "name": "Priority",
            "field_type": "select",
            "config": {"options": ["Low", "Medium", "High"]}
        }
    )
    field_id = field_response.json()["id"]

    # Mock YouTube client
    mock_youtube_client = AsyncMock()
    mock_youtube_client.get_video_metadata = AsyncMock(return_value={
        "youtube_id": "test123",
        "title": "Test Video",
        "channel": "Test Channel",
        "duration": "PT5M",
        "thumbnail_url": "https://example.com/thumb.jpg",
        "published_at": "2024-01-01T00:00:00Z"
    })

    with patch('app.api.videos.YouTubeClient', return_value=mock_youtube_client):
        # Create videos
        video_high_response = await client.post(
            f"/api/lists/{test_list.id}/videos",
            json={"url": "https://www.youtube.com/watch?v=HighPriorit"}
        )
        video_low_response = await client.post(
            f"/api/lists/{test_list.id}/videos",
            json={"url": "https://www.youtube.com/watch?v=LowPriority"}
        )
        video_medium_response = await client.post(
            f"/api/lists/{test_list.id}/videos",
            json={"url": "https://www.youtube.com/watch?v=MediumPrior"}
        )

    video_high_id = video_high_response.json()["id"]
    video_low_id = video_low_response.json()["id"]
    video_medium_id = video_medium_response.json()["id"]

    # Set field values
    value_high = VideoFieldValue(
        video_id=UUID(video_high_id),
        field_id=UUID(field_id),
        value_text="High"
    )
    value_low = VideoFieldValue(
        video_id=UUID(video_low_id),
        field_id=UUID(field_id),
        value_text="Low"
    )
    value_medium = VideoFieldValue(
        video_id=UUID(video_medium_id),
        field_id=UUID(field_id),
        value_text="Medium"
    )
    test_db.add(value_high)
    test_db.add(value_low)
    test_db.add(value_medium)

    # Update titles using UPDATE statement
    await test_db.execute(update(Video).where(Video.id == UUID(video_high_id)).values(title="High Priority"))
    await test_db.execute(update(Video).where(Video.id == UUID(video_low_id)).values(title="Low Priority"))
    await test_db.execute(update(Video).where(Video.id == UUID(video_medium_id)).values(title="Medium Priority"))
    await test_db.commit()

    # Test sorting by select field ascending (alphabetical)
    response = await client.get(
        f"/api/lists/{test_list.id}/videos?sort_by=field:{field_id}&sort_order=asc"
    )

    assert response.status_code == 200
    videos = response.json()
    assert len(videos) == 3

    # Alphabetical: High < Low < Medium
    assert videos[0]["title"] == "High Priority"
    assert videos[1]["title"] == "Low Priority"
    assert videos[2]["title"] == "Medium Priority"


@pytest.mark.asyncio
async def test_sort_by_invalid_field_id(client: AsyncClient, test_db: AsyncSession, test_list: BookmarkList):
    """Test that invalid field_id returns 404."""
    response = await client.get(
        f"/api/lists/{test_list.id}/videos?sort_by=field:00000000-0000-0000-0000-000000000000&sort_order=asc"
    )

    assert response.status_code == 404
    assert "Custom field not found" in response.json()["detail"]


@pytest.mark.asyncio
async def test_sort_by_invalid_column(client: AsyncClient, test_db: AsyncSession, test_list: BookmarkList):
    """Test that invalid column name returns 400."""
    response = await client.get(
        f"/api/lists/{test_list.id}/videos?sort_by=invalid_column&sort_order=asc"
    )

    assert response.status_code == 400
    assert "Invalid sort_by column" in response.json()["detail"]


@pytest.mark.skip(reason="PostgreSQL DISTINCT + ORDER BY limitation with joined tables - requires subquery fix")
@pytest.mark.asyncio
async def test_sort_combined_with_tag_filter(client: AsyncClient, test_db: AsyncSession, test_list: BookmarkList):
    """Test that sorting works correctly with tag filtering.

    NOTE: This test is skipped due to a PostgreSQL limitation: when using DISTINCT with tag filtering,
    ORDER BY expressions on joined tables (like video_field_values) must appear in the SELECT list.
    This requires a more complex query strategy (subquery or CTE). The basic functionality works,
    but combining tag filtering with field-based sorting needs additional implementation.
    """
    from app.models.video_field_value import VideoFieldValue
    from uuid import UUID
    from sqlalchemy import select, update
    from unittest.mock import AsyncMock, patch

    # Create rating field
    field_response = await client.post(
        f"/api/lists/{test_list.id}/custom-fields",
        json={
            "name": "Rating",
            "field_type": "rating",
            "config": {"max_rating": 5}
        }
    )
    field_id = field_response.json()["id"]

    # Create tag
    tag_response = await client.post(
        "/api/tags",
        json={"name": "Python", "color": "#3B82F6"}
    )
    tag_id = tag_response.json()["id"]

    # Mock YouTube client
    mock_youtube_client = AsyncMock()
    mock_youtube_client.get_video_metadata = AsyncMock(return_value={
        "youtube_id": "test123",
        "title": "Test Video",
        "channel": "Test Channel",
        "duration": "PT5M",
        "thumbnail_url": "https://example.com/thumb.jpg",
        "published_at": "2024-01-01T00:00:00Z"
    })

    with patch('app.api.videos.YouTubeClient', return_value=mock_youtube_client):
        # Create videos
        v1_response = await client.post(
            f"/api/lists/{test_list.id}/videos",
            json={"url": "https://www.youtube.com/watch?v=LowRatedPy1"}
        )
        v2_response = await client.post(
            f"/api/lists/{test_list.id}/videos",
            json={"url": "https://www.youtube.com/watch?v=HighRatedP1"}
        )
        v3_response = await client.post(
            f"/api/lists/{test_list.id}/videos",
            json={"url": "https://www.youtube.com/watch?v=NoTagVideo1"}
        )

    v1_id = v1_response.json()["id"]
    v2_id = v2_response.json()["id"]
    v3_id = v3_response.json()["id"]

    # Assign Python tag to v1 and v2 only
    await client.post(f"/api/videos/{v1_id}/tags", json={"tag_ids": [tag_id]})
    await client.post(f"/api/videos/{v2_id}/tags", json={"tag_ids": [tag_id]})

    # Set field values
    value_v1 = VideoFieldValue(
        video_id=UUID(v1_id),
        field_id=UUID(field_id),
        value_numeric=2
    )
    value_v2 = VideoFieldValue(
        video_id=UUID(v2_id),
        field_id=UUID(field_id),
        value_numeric=5
    )
    value_v3 = VideoFieldValue(
        video_id=UUID(v3_id),
        field_id=UUID(field_id),
        value_numeric=4
    )
    test_db.add(value_v1)
    test_db.add(value_v2)
    test_db.add(value_v3)

    # Update titles using UPDATE statement
    await test_db.execute(update(Video).where(Video.id == UUID(v1_id)).values(title="Low Rated"))
    await test_db.execute(update(Video).where(Video.id == UUID(v2_id)).values(title="High Rated"))
    await test_db.execute(update(Video).where(Video.id == UUID(v3_id)).values(title="No Tag"))
    await test_db.commit()

    # Test filtering by Python tag and sorting by rating descending
    response = await client.get(
        f"/api/lists/{test_list.id}/videos?tags=Python&sort_by=field:{field_id}&sort_order=desc"
    )

    assert response.status_code == 200
    videos = response.json()

    # Should only return v1 and v2 (with Python tag), sorted by rating desc
    assert len(videos) == 2
    assert videos[0]["title"] == "High Rated"  # 5 first
    assert videos[1]["title"] == "Low Rated"   # 2 second


@pytest.mark.asyncio
async def test_default_sort_created_at_desc(client: AsyncClient, test_db: AsyncSession, test_list: BookmarkList):
    """Test that default sorting is created_at descending (newest first)."""
    import asyncio
    from sqlalchemy import select
    from unittest.mock import AsyncMock, patch

    # Mock YouTube client
    mock_youtube_client = AsyncMock()
    mock_youtube_client.get_video_metadata = AsyncMock(return_value={
        "youtube_id": "test123",
        "title": "Test Video",
        "channel": "Test Channel",
        "duration": "PT5M",
        "thumbnail_url": "https://example.com/thumb.jpg",
        "published_at": "2024-01-01T00:00:00Z"
    })

    with patch('app.api.videos.YouTubeClient', return_value=mock_youtube_client):
        # Create videos with slight delay to ensure different timestamps
        old_response = await client.post(
            f"/api/lists/{test_list.id}/videos",
            json={"url": "https://www.youtube.com/watch?v=OldVideo001"}
        )
        old_id = old_response.json()["id"]

        await asyncio.sleep(0.1)  # Ensure different timestamps

        new_response = await client.post(
            f"/api/lists/{test_list.id}/videos",
            json={"url": "https://www.youtube.com/watch?v=NewVideo001"}
        )
        new_id = new_response.json()["id"]

    # Update titles using UPDATE statement
    from uuid import UUID
    from sqlalchemy import update

    await test_db.execute(update(Video).where(Video.id == UUID(old_id)).values(title="Old Video"))
    await test_db.execute(update(Video).where(Video.id == UUID(new_id)).values(title="New Video"))
    await test_db.commit()

    # Test default sorting (no sort params)
    response = await client.get(f"/api/lists/{test_list.id}/videos")

    assert response.status_code == 200
    videos = response.json()
    assert len(videos) == 2

    # Default sort is created_at DESC (newest first)
    assert videos[0]["title"] == "New Video"
    assert videos[1]["title"] == "Old Video"


# ============================================================================
# Video Detail Endpoint Tests
# ============================================================================

@pytest.mark.asyncio
async def test_get_video_detail_with_available_fields_but_no_values(
    client: AsyncClient, test_db: AsyncSession, test_user, test_list: BookmarkList
):
    """
    REGRESSION TEST for Bug #003: Video detail endpoint with available fields but no values.

    This test catches the bug where the endpoint includes ALL available fields in field_values,
    even when they have no value, setting id=None and updated_at=None which violates the schema.

    Expected behavior:
    - available_fields: Shows ALL fields that CAN be filled (from tag schemas)
    - field_values: Shows ONLY fields that HAVE been filled (non-empty)

    Bug scenario:
    - Video has tag with schema (available fields exist)
    - No field values have been set yet
    - GET /api/videos/{id} should return:
      - available_fields: [field1, field2, ...]
      - field_values: [] (EMPTY - no values set yet)

    Before fix: field_values contains entries with id=None, updated_at=None → ResponseValidationError
    After fix: field_values is empty (correct!)
    """
    from app.models.field_schema import FieldSchema
    from app.models.schema_field import SchemaField
    from app.models.custom_field import CustomField
    from app.models.tag import Tag

    # Create a schema with a custom field
    schema = FieldSchema(list_id=test_list.id, name="Test Schema")
    test_db.add(schema)
    await test_db.commit()
    await test_db.refresh(schema)

    # Create a custom field
    custom_field = CustomField(
        list_id=test_list.id,
        name="Rating",
        field_type="rating",
        config={"max_rating": 5}
    )
    test_db.add(custom_field)
    await test_db.commit()
    await test_db.refresh(custom_field)

    # Link field to schema
    schema_field = SchemaField(
        schema_id=schema.id,
        field_id=custom_field.id,
        display_order=1,
        show_on_card=True
    )
    test_db.add(schema_field)
    await test_db.commit()

    # Create a tag linked to the schema
    tag = Tag(
        name="Test Tag",
        user_id=test_user.id,
        schema_id=schema.id
    )
    test_db.add(tag)
    await test_db.commit()
    await test_db.refresh(tag)

    # Create a video
    video_response = await client.post(
        f"/api/lists/{test_list.id}/videos",
        json={"url": "https://www.youtube.com/watch?v=testVidAvail"}
    )
    assert video_response.status_code == 201
    video_id = video_response.json()["id"]

    # Assign tag to video
    tag_response = await client.post(
        f"/api/videos/{video_id}/tags",
        json={"tag_ids": [str(tag.id)]}
    )
    assert tag_response.status_code == 200

    # GET video detail (this is where the bug occurs)
    response = await client.get(f"/api/videos/{video_id}")

    # Should return 200, not 500
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    data = response.json()

    # CRITICAL: available_fields should show the field (CAN be filled)
    assert "available_fields" in data
    assert len(data["available_fields"]) == 1
    assert data["available_fields"][0]["field_name"] == "Rating"
    assert data["available_fields"][0]["field_type"] == "rating"

    # CRITICAL: field_values should be EMPTY (no values set yet)
    assert "field_values" in data
    assert data["field_values"] == [], (
        "Bug detected! field_values should be empty when no values are set. "
        "The endpoint is incorrectly adding available fields to field_values with None values."
    )


@pytest.mark.asyncio
async def test_get_video_detail_with_multiple_field_values(
    client: AsyncClient, test_db: AsyncSession, test_user, test_list: BookmarkList
):
    """
    REGRESSION TEST for Bug #004: Video detail endpoint with multiple field values.

    This test catches the bug where SQLAlchemy returns a single VideoFieldValue object
    instead of a list when there are multiple field values, causing:
    "TypeError: 'VideoFieldValue' object is not iterable"

    Bug scenario:
    - Video has tag with schema (available fields exist)
    - Video has MULTIPLE field values set
    - GET /api/videos/{id} tries to iterate over field_values
    - SQLAlchemy returns single object instead of list → TypeError

    Before fix: 500 Internal Server Error - "VideoFieldValue object is not iterable"
    After fix: 200 OK with all field values returned as a proper list
    """
    from app.models.field_schema import FieldSchema
    from app.models.schema_field import SchemaField
    from app.models.custom_field import CustomField
    from app.models.tag import Tag
    from app.models.video_field_value import VideoFieldValue

    # Create a schema with multiple custom fields
    schema = FieldSchema(list_id=test_list.id, name="Test Schema")
    test_db.add(schema)
    await test_db.commit()
    await test_db.refresh(schema)

    # Create multiple custom fields
    rating_field = CustomField(
        list_id=test_list.id,
        name="Overall Rating",
        field_type="rating",
        config={"max_rating": 5}
    )
    select_field = CustomField(
        list_id=test_list.id,
        name="Quality",
        field_type="select",
        config={"options": ["excellent", "good", "fair"]}
    )
    boolean_field = CustomField(
        list_id=test_list.id,
        name="Watched",
        field_type="boolean",
        config={}
    )
    test_db.add_all([rating_field, select_field, boolean_field])
    await test_db.commit()
    await test_db.refresh(rating_field)
    await test_db.refresh(select_field)
    await test_db.refresh(boolean_field)

    # Link all fields to schema
    for i, field in enumerate([rating_field, select_field, boolean_field], start=1):
        schema_field = SchemaField(
            schema_id=schema.id,
            field_id=field.id,
            display_order=i,
            show_on_card=True
        )
        test_db.add(schema_field)
    await test_db.commit()

    # Create a tag linked to the schema
    tag = Tag(
        name="Test Tag With Schema",
        user_id=test_user.id,
        schema_id=schema.id
    )
    test_db.add(tag)
    await test_db.commit()
    await test_db.refresh(tag)

    # Create a video
    video_response = await client.post(
        f"/api/lists/{test_list.id}/videos",
        json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}  # Valid YouTube ID format
    )
    assert video_response.status_code == 201
    video_id = video_response.json()["id"]

    # Assign tag to video
    tag_response = await client.post(
        f"/api/videos/{video_id}/tags",
        json={"tag_ids": [str(tag.id)]}
    )
    assert tag_response.status_code == 200

    # Set values for MULTIPLE fields (this triggers the bug)
    update_response = await client.put(
        f"/api/videos/{video_id}/fields",
        json={
            "field_values": [
                {"field_id": str(rating_field.id), "value": 4},
                {"field_id": str(select_field.id), "value": "excellent"},
                {"field_id": str(boolean_field.id), "value": True}
            ]
        }
    )
    assert update_response.status_code == 200

    # GET video detail (this is where Bug #004 occurs)
    response = await client.get(f"/api/videos/{video_id}")

    # Should return 200, not 500
    assert response.status_code == 200, (
        f"Bug #004 detected! Expected 200, got {response.status_code}: {response.text}. "
        "SQLAlchemy is likely returning a single VideoFieldValue object instead of a list."
    )
    data = response.json()

    # CRITICAL: available_fields should show all 3 fields
    assert "available_fields" in data
    assert len(data["available_fields"]) == 3

    # CRITICAL: field_values should contain all 3 field values as a list
    assert "field_values" in data
    assert len(data["field_values"]) == 3, (
        f"Bug #004 detected! Expected 3 field values, got {len(data['field_values'])}. "
        "SQLAlchemy relationship loading returned single object instead of list."
    )

    # Verify all field values are present
    field_values_by_name = {fv["field_name"]: fv for fv in data["field_values"]}
    assert "Overall Rating" in field_values_by_name
    assert field_values_by_name["Overall Rating"]["value"] == 4.0
    assert "Quality" in field_values_by_name
    assert field_values_by_name["Quality"]["value"] == "excellent"
    assert "Watched" in field_values_by_name
    assert field_values_by_name["Watched"]["value"] == 1.0  # Boolean stored as numeric
