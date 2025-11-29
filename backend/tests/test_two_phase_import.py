"""
Tests for two-phase video import.

Phase 1: Video appears immediately with thumbnail
Phase 2: Background enrichment adds metadata, captions, chapters
"""

from unittest.mock import AsyncMock, patch

import pytest
from httpx import TimeoutException


@pytest.mark.asyncio
async def test_video_created_with_initial_import_state(client, test_list):
    """Test that new video has import_stage='created' and import_progress=0."""
    # Arrange: Mock YouTube client to simulate metadata fetch failure
    with (
        patch("app.api.videos.get_redis_client", new_callable=AsyncMock) as mock_redis,
        patch("app.api.videos.YouTubeClient") as mock_yt_class,
    ):
        mock_redis.return_value = AsyncMock()
        mock_yt = AsyncMock()
        # Simulate metadata fetch failure with caught exception type
        mock_yt.get_video_metadata.side_effect = TimeoutException("API timeout")
        mock_yt_class.return_value = mock_yt

        # Act: Add video
        response = await client.post(
            f"/api/lists/{test_list.id}/videos",
            json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
        )

    # Assert: Video created with initial import state
    assert response.status_code == 201
    data = response.json()
    assert data["import_stage"] == "created"
    assert data["import_progress"] == 0


@pytest.mark.asyncio
async def test_video_has_thumbnail_immediately(client, test_list):
    """Test that video has thumbnail URL even before metadata fetch."""
    with (
        patch("app.api.videos.get_redis_client", new_callable=AsyncMock) as mock_redis,
        patch("app.api.videos.YouTubeClient") as mock_yt_class,
    ):
        mock_redis.return_value = AsyncMock()
        mock_yt = AsyncMock()
        mock_yt.get_video_metadata.side_effect = TimeoutException("API timeout")
        mock_yt_class.return_value = mock_yt

        response = await client.post(
            f"/api/lists/{test_list.id}/videos",
            json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
        )

    assert response.status_code == 201
    data = response.json()
    # Thumbnail should be set from YouTube ID pattern
    assert data["thumbnail_url"] is not None
    assert "dQw4w9WgXcQ" in data["thumbnail_url"]


@pytest.mark.asyncio
async def test_successful_metadata_fetch_sets_metadata_stage(client, test_list):
    """Test that successful sync metadata fetch sets import_stage='metadata'."""
    with (
        patch("app.api.videos.get_redis_client", new_callable=AsyncMock) as mock_redis,
        patch("app.api.videos.YouTubeClient") as mock_yt_class,
    ):
        mock_redis.return_value = AsyncMock()
        mock_yt = AsyncMock()
        mock_yt.get_video_metadata.return_value = {
            "title": "Test Video",
            "channel": "Test Channel",
            "channel_id": "UC123",
            "thumbnail_url": "https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
            "duration": "PT3M32S",
            "published_at": "2023-01-01T00:00:00Z",
        }
        mock_yt.get_channel_info.return_value = {
            "thumbnail_url": "https://example.com/channel.jpg",
            "description": "Test channel",
        }
        mock_yt_class.return_value = mock_yt

        response = await client.post(
            f"/api/lists/{test_list.id}/videos",
            json={"url": "https://www.youtube.com/watch?v=abc123xyz99"},
        )

    assert response.status_code == 201
    data = response.json()
    # After successful metadata fetch, stage should be 'metadata' (ready for enrichment)
    assert data["import_stage"] == "metadata"
    assert data["import_progress"] == 25  # Metadata = 25%
    assert data["title"] == "Test Video"
