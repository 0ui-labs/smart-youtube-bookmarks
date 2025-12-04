"""Tests for YouTube Search API functionality.

These tests cover the search_videos method for keyword-based subscriptions
and the VideoSearchResult dataclass (Etappe 3).
"""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.clients.youtube import VideoSearchResult, YouTubeClient


class TestVideoSearchResult:
    """Tests for VideoSearchResult dataclass."""

    def test_create_video_search_result(self):
        """VideoSearchResult can be created with all fields."""
        result = VideoSearchResult(
            youtube_id="dQw4w9WgXcQ",
            title="Test Video",
            description="A test video description",
            channel_id="UCtest123",
            channel_name="Test Channel",
            thumbnail_url="https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
            published_at=datetime(2024, 1, 15, 10, 0, 0, tzinfo=UTC),
        )

        assert result.youtube_id == "dQw4w9WgXcQ"
        assert result.title == "Test Video"
        assert result.channel_id == "UCtest123"
        assert result.duration_seconds is None  # Optional field
        assert result.view_count is None  # Optional field

    def test_video_search_result_with_optional_fields(self):
        """VideoSearchResult includes optional duration and view count."""
        result = VideoSearchResult(
            youtube_id="test123",
            title="Test",
            description="Desc",
            channel_id="UC123",
            channel_name="Channel",
            thumbnail_url="https://example.com/thumb.jpg",
            published_at=datetime.now(tz=UTC),
            duration_seconds=930,  # 15:30
            view_count=50000,
        )

        assert result.duration_seconds == 930
        assert result.view_count == 50000


class TestSearchVideos:
    """Tests for YouTubeClient.search_videos method."""

    @pytest.mark.asyncio
    async def test_search_videos_returns_results(self):
        """search_videos returns VideoSearchResult objects."""
        client = YouTubeClient(api_key="test-key")

        mock_response = {
            "items": [
                {
                    "id": {"videoId": "VIDEO_1"},
                    "snippet": {
                        "title": "Python Tutorial",
                        "description": "Learn Python basics",
                        "channelId": "UCpython",
                        "channelTitle": "Python Channel",
                        "publishedAt": "2024-01-15T10:00:00Z",
                        "thumbnails": {
                            "high": {
                                "url": "https://i.ytimg.com/vi/VIDEO_1/hqdefault.jpg"
                            }
                        },
                    },
                },
                {
                    "id": {"videoId": "VIDEO_2"},
                    "snippet": {
                        "title": "Advanced Python",
                        "description": "Advanced Python topics",
                        "channelId": "UCpython",
                        "channelTitle": "Python Channel",
                        "publishedAt": "2024-02-20T14:30:00Z",
                        "thumbnails": {
                            "high": {
                                "url": "https://i.ytimg.com/vi/VIDEO_2/hqdefault.jpg"
                            }
                        },
                    },
                },
            ]
        }

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_response_obj = MagicMock()
            mock_response_obj.raise_for_status = MagicMock()
            mock_response_obj.json = MagicMock(return_value=mock_response)

            mock_client.get = AsyncMock(return_value=mock_response_obj)
            mock_client_class.return_value.__aenter__.return_value = mock_client
            mock_client_class.return_value.__aexit__.return_value = AsyncMock()

            results = await client.search_videos(keywords=["Python", "Tutorial"])

        assert len(results) == 2
        assert isinstance(results[0], VideoSearchResult)
        assert results[0].youtube_id == "VIDEO_1"
        assert results[0].title == "Python Tutorial"
        assert results[0].channel_id == "UCpython"
        assert results[0].channel_name == "Python Channel"
        assert results[1].youtube_id == "VIDEO_2"

    @pytest.mark.asyncio
    async def test_search_videos_with_published_after(self):
        """search_videos respects publishedAfter parameter."""
        client = YouTubeClient(api_key="test-key")

        published_after = datetime(2024, 1, 1, 0, 0, 0, tzinfo=UTC)

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_response_obj = MagicMock()
            mock_response_obj.raise_for_status = MagicMock()
            mock_response_obj.json = MagicMock(return_value={"items": []})

            mock_client.get = AsyncMock(return_value=mock_response_obj)
            mock_client_class.return_value.__aenter__.return_value = mock_client
            mock_client_class.return_value.__aexit__.return_value = AsyncMock()

            await client.search_videos(
                keywords=["Python"],
                published_after=published_after,
            )

            # Verify the API was called with correct params
            call_args = mock_client.get.call_args
            params = call_args.kwargs.get(
                "params", call_args.args[1] if len(call_args.args) > 1 else {}
            )

            assert "publishedAfter" in params
            assert params["publishedAfter"] == "2024-01-01T00:00:00Z"

    @pytest.mark.asyncio
    async def test_search_videos_respects_max_results(self):
        """search_videos uses maxResults parameter."""
        client = YouTubeClient(api_key="test-key")

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_response_obj = MagicMock()
            mock_response_obj.raise_for_status = MagicMock()
            mock_response_obj.json = MagicMock(return_value={"items": []})

            mock_client.get = AsyncMock(return_value=mock_response_obj)
            mock_client_class.return_value.__aenter__.return_value = mock_client
            mock_client_class.return_value.__aexit__.return_value = AsyncMock()

            await client.search_videos(keywords=["test"], max_results=10)

            call_args = mock_client.get.call_args
            params = call_args.kwargs.get(
                "params", call_args.args[1] if len(call_args.args) > 1 else {}
            )

            assert params["maxResults"] == 10

    @pytest.mark.asyncio
    async def test_search_videos_empty_results(self):
        """search_videos returns empty list when no results found."""
        client = YouTubeClient(api_key="test-key")

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_response_obj = MagicMock()
            mock_response_obj.raise_for_status = MagicMock()
            mock_response_obj.json = MagicMock(return_value={"items": []})

            mock_client.get = AsyncMock(return_value=mock_response_obj)
            mock_client_class.return_value.__aenter__.return_value = mock_client
            mock_client_class.return_value.__aexit__.return_value = AsyncMock()

            results = await client.search_videos(keywords=["nonexistent12345"])

        assert results == []

    @pytest.mark.asyncio
    async def test_search_videos_orders_by_date(self):
        """search_videos requests results ordered by date."""
        client = YouTubeClient(api_key="test-key")

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_response_obj = MagicMock()
            mock_response_obj.raise_for_status = MagicMock()
            mock_response_obj.json = MagicMock(return_value={"items": []})

            mock_client.get = AsyncMock(return_value=mock_response_obj)
            mock_client_class.return_value.__aenter__.return_value = mock_client
            mock_client_class.return_value.__aexit__.return_value = AsyncMock()

            await client.search_videos(keywords=["test"])

            call_args = mock_client.get.call_args
            params = call_args.kwargs.get(
                "params", call_args.args[1] if len(call_args.args) > 1 else {}
            )

            assert params["order"] == "date"

    @pytest.mark.asyncio
    async def test_search_videos_only_videos_type(self):
        """search_videos only searches for videos (not playlists/channels)."""
        client = YouTubeClient(api_key="test-key")

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_response_obj = MagicMock()
            mock_response_obj.raise_for_status = MagicMock()
            mock_response_obj.json = MagicMock(return_value={"items": []})

            mock_client.get = AsyncMock(return_value=mock_response_obj)
            mock_client_class.return_value.__aenter__.return_value = mock_client
            mock_client_class.return_value.__aexit__.return_value = AsyncMock()

            await client.search_videos(keywords=["test"])

            call_args = mock_client.get.call_args
            params = call_args.kwargs.get(
                "params", call_args.args[1] if len(call_args.args) > 1 else {}
            )

            assert params["type"] == "video"


class TestGetVideoDetailsBatch:
    """Tests for getting video details (duration, views) in batch.

    Note: get_batch_metadata already exists, but we need to ensure
    it returns duration_seconds and view_count for filtering.
    """

    @pytest.mark.asyncio
    async def test_get_batch_metadata_includes_duration_and_views(self):
        """get_batch_metadata returns duration_seconds and view_count."""
        redis_client = AsyncMock()
        redis_client.get.return_value = None
        redis_client.setex = AsyncMock()

        client = YouTubeClient(api_key="test-key", redis_client=redis_client)

        mock_response = {
            "items": [
                {
                    "id": "VIDEO_1",
                    "snippet": {
                        "title": "Test Video",
                        "channelTitle": "Test Channel",
                        "channelId": "UCtest",
                        "description": "Description",
                        "publishedAt": "2024-01-15T10:00:00Z",
                        "thumbnails": {
                            "high": {"url": "https://example.com/thumb.jpg"}
                        },
                    },
                    "contentDetails": {"duration": "PT15M30S"},
                    "statistics": {"viewCount": "50000", "likeCount": "1000"},
                },
            ]
        }

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_response_obj = MagicMock()
            mock_response_obj.raise_for_status = MagicMock()
            mock_response_obj.json = MagicMock(return_value=mock_response)

            mock_client.get = AsyncMock(return_value=mock_response_obj)
            mock_client_class.return_value.__aenter__.return_value = mock_client
            mock_client_class.return_value.__aexit__.return_value = AsyncMock()

            results = await client.get_batch_metadata(["VIDEO_1"])

        assert len(results) == 1
        # These fields should already exist from the existing implementation
        assert "view_count" in results[0]
        assert results[0]["view_count"] == 50000
        # Duration is returned as ISO string, we verify it's present
        assert "duration" in results[0]
