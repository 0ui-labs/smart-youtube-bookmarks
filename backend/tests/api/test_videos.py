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
async def test_bulk_upload_csv_success(client, test_list):
    """Test bulk video upload from CSV file."""
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
async def test_bulk_upload_csv_with_failures(client, test_list):
    """Test bulk upload handles invalid URLs gracefully."""
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
