"""Tests for YouTube Data API v3 client"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.clients.youtube import YouTubeClient


@pytest.mark.asyncio
async def test_get_video_metadata_success():
    """Test successful video metadata retrieval"""
    client = YouTubeClient(api_key="test-key")

    # Mock aiogoogle response
    mock_response = {
        "items": [{
            "id": "dQw4w9WgXcQ",
            "snippet": {
                "title": "Test Video",
                "channelTitle": "Test Channel",
                "publishedAt": "2009-10-25T06:57:33Z",
                "thumbnails": {
                    "default": {"url": "https://example.com/thumb.jpg"}
                }
            },
            "contentDetails": {
                "duration": "PT3M33S"
            }
        }]
    }

    with patch('app.clients.youtube.Aiogoogle') as mock_aiogoogle:
        # Setup mock
        mock_instance = AsyncMock()
        mock_aiogoogle.return_value.__aenter__.return_value = mock_instance
        mock_instance.discover.return_value = AsyncMock()
        mock_instance.as_api_key.return_value = mock_response

        metadata = await client.get_video_metadata("dQw4w9WgXcQ")

    assert metadata["video_id"] == "dQw4w9WgXcQ"
    assert metadata["title"] == "Test Video"
    assert metadata["channel"] == "Test Channel"
    assert metadata["duration"] == "PT3M33S"
    assert "thumbnail_url" in metadata


@pytest.mark.asyncio
async def test_get_video_metadata_not_found():
    """Test video not found (404) handling"""
    client = YouTubeClient(api_key="test-key")

    with patch('app.clients.youtube.Aiogoogle') as mock_aiogoogle:
        mock_instance = AsyncMock()
        mock_aiogoogle.return_value.__aenter__.return_value = mock_instance
        mock_instance.discover.return_value = AsyncMock()
        # Empty items = video not found
        mock_instance.as_api_key.return_value = {"items": []}

        with pytest.raises(ValueError, match="Video not found"):
            await client.get_video_metadata("invalid_id")


@pytest.mark.asyncio
async def test_get_video_transcript_success():
    """Test successful transcript retrieval"""
    client = YouTubeClient(api_key="test-key")

    mock_transcript = [
        {"text": "Hello", "start": 0.0, "duration": 1.5},
        {"text": "World", "start": 1.5, "duration": 1.5}
    ]

    with patch('app.clients.youtube.YouTubeTranscriptApi') as mock_api:
        mock_api.get_transcript.return_value = mock_transcript

        transcript = await client.get_video_transcript("dQw4w9WgXcQ")

    assert transcript == "Hello World"


@pytest.mark.asyncio
async def test_get_video_transcript_not_found():
    """Test transcript not available"""
    from youtube_transcript_api._errors import NoTranscriptFound

    client = YouTubeClient(api_key="test-key")

    with patch('app.clients.youtube.YouTubeTranscriptApi') as mock_api:
        mock_api.get_transcript.side_effect = NoTranscriptFound("id", [], "msg")

        transcript = await client.get_video_transcript("dQw4w9WgXcQ")

    # Should return None gracefully (not raise)
    assert transcript is None


@pytest.mark.asyncio
async def test_get_video_metadata_uses_cache():
    """Test that metadata uses Redis cache"""
    from unittest.mock import AsyncMock

    # Create mock Redis client
    redis_client = AsyncMock()
    redis_client.get.return_value = None  # Cache miss first time
    redis_client.setex = AsyncMock()

    client = YouTubeClient(api_key="test-key", redis_client=redis_client)

    # Mock API response
    mock_response = {
        "items": [{
            "id": "test123",
            "snippet": {
                "title": "Cached Video",
                "channelTitle": "Cache Channel",
                "publishedAt": "2025-01-01T00:00:00Z",
                "thumbnails": {"default": {"url": "https://example.com/thumb.jpg"}}
            },
            "contentDetails": {"duration": "PT5M00S"}
        }]
    }

    with patch('app.clients.youtube.Aiogoogle') as mock_aiogoogle:
        mock_instance = AsyncMock()
        mock_aiogoogle.return_value.__aenter__.return_value = mock_instance
        mock_instance.discover.return_value = AsyncMock()
        mock_instance.as_api_key.return_value = mock_response

        # First call - should hit API
        metadata1 = await client.get_video_metadata("test123")

        # Verify cache was checked and set
        redis_client.get.assert_called_once()
        redis_client.setex.assert_called_once()

        # Second call - mock cache hit
        import json
        redis_client.get.return_value = json.dumps(metadata1)
        metadata2 = await client.get_video_metadata("test123")

    assert metadata1 == metadata2
    # API should only be called once (second call cached)
    assert mock_instance.as_api_key.call_count == 1


@pytest.mark.asyncio
async def test_get_video_transcript_uses_cache():
    """Test that transcript uses Redis cache"""
    from unittest.mock import AsyncMock

    # Create mock Redis client
    redis_client = AsyncMock()
    redis_client.get.return_value = None  # Cache miss first time
    redis_client.setex = AsyncMock()

    client = YouTubeClient(api_key="test-key", redis_client=redis_client)

    mock_transcript = [
        {"text": "Cached", "start": 0.0, "duration": 1.5},
        {"text": "Transcript", "start": 1.5, "duration": 1.5}
    ]

    with patch('app.clients.youtube.YouTubeTranscriptApi') as mock_api:
        mock_api.get_transcript.return_value = mock_transcript

        # First call - should hit API
        transcript1 = await client.get_video_transcript("test123")

        # Verify cache was checked and set
        redis_client.get.assert_called_once()
        redis_client.setex.assert_called_once()

    assert transcript1 == "Cached Transcript"
