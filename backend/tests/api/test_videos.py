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


@pytest.mark.asyncio
async def test_add_video_to_list(client: AsyncClient, test_db: AsyncSession, test_list: BookmarkList):
    """Test adding a video to a list with standard YouTube URL."""
    response = await client.post(
        f"/api/lists/{test_list.id}/videos",
        json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}
    )

    assert response.status_code == 201
    data = response.json()
    assert data["youtube_id"] == "dQw4w9WgXcQ"
    assert data["list_id"] == str(test_list.id)
    assert data["processing_status"] == "pending"
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
    """Test retrieving all videos in a list."""
    # Add some videos first
    video1_url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    video2_url = "https://www.youtube.com/watch?v=jNQXAC9IVRw"

    await client.post(f"/api/lists/{test_list.id}/videos", json={"url": video1_url})
    await client.post(f"/api/lists/{test_list.id}/videos", json={"url": video2_url})

    # Get all videos
    response = await client.get(f"/api/lists/{test_list.id}/videos")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["youtube_id"] == "dQw4w9WgXcQ"
    assert data[1]["youtube_id"] == "jNQXAC9IVRw"


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

    assert len(lines) == 2  # Header + 1 video
    assert lines[0] == "youtube_id,status,created_at"
    assert test_video.youtube_id in lines[1]
    assert "pending" in lines[1]


@pytest.mark.asyncio
async def test_export_videos_csv_empty_list(client, test_list):
    """Test exporting empty list returns CSV with header only."""
    response = await client.get(f"/api/lists/{test_list.id}/export/csv")

    assert response.status_code == 200
    csv_content = response.content.decode('utf-8')
    lines = csv_content.strip().splitlines()

    assert len(lines) == 1  # Header only
    assert lines[0] == "youtube_id,status,created_at"


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

        # Mock extract_youtube_id to return our test IDs
        mock_extract_id.side_effect = lambda url: "VIDEO_ID_1" if "VIDEO_ID_1" in url else "VIDEO_ID_2"

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

        # Check first video has metadata
        video1 = next(v for v in videos if v.youtube_id == "VIDEO_ID_1")
        assert video1.title == "Python Tutorial"
        assert video1.channel == "Tech Channel"
        assert video1.thumbnail_url == "https://i.ytimg.com/vi/VIDEO_ID_1/hqdefault.jpg"
        assert video1.duration == 930  # 15m30s in seconds
        assert video1.processing_status == "pending"  # Still pending for AI analysis

        # Check second video
        video2 = next(v for v in videos if v.youtube_id == "VIDEO_ID_2")
        assert video2.title == "FastAPI Guide"
        assert video2.channel == "Web Dev"

        # Verify YouTube client was called with batch
        mock_client.get_batch_metadata.assert_called_once()
        called_ids = mock_client.get_batch_metadata.call_args[0][0]
        assert set(called_ids) == {"VIDEO_ID_1", "VIDEO_ID_2"}
