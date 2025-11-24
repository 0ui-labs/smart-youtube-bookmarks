"""Tests for YouTube Data API v3 client"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.clients.youtube import YouTubeClient


def test_youtube_client_requires_api_key():
    """Test that YouTubeClient validates API key"""
    with pytest.raises(ValueError, match="API key is required"):
        YouTubeClient(api_key="")

    with pytest.raises(ValueError, match="API key is required"):
        YouTubeClient(api_key="   ")  # Whitespace only


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


@pytest.mark.asyncio
async def test_get_video_metadata_quota_exceeded():
    """Test handling of YouTube API quota exceeded (403)"""
    from aiogoogle.excs import HTTPError

    client = YouTubeClient(api_key="test-key")

    # Mock 403 response
    mock_response = MagicMock()
    mock_response.status_code = 403
    mock_response.json = {'error': {'errors': [{'reason': 'quotaExceeded'}]}}

    with patch('app.clients.youtube.Aiogoogle') as mock_aiogoogle:
        mock_instance = AsyncMock()
        mock_aiogoogle.return_value.__aenter__.return_value = mock_instance
        mock_instance.discover = AsyncMock(return_value=AsyncMock())
        mock_instance.as_api_key = AsyncMock(side_effect=HTTPError(
            msg="Quota exceeded",
            req=MagicMock(),
            res=mock_response
        ))

        with pytest.raises(ValueError, match="quota exceeded"):
            await client.get_video_metadata("test123")


@pytest.mark.asyncio
async def test_get_video_metadata_rate_limited():
    """Test handling of rate limit (429)"""
    from aiogoogle.excs import HTTPError

    client = YouTubeClient(api_key="test-key")

    mock_response = MagicMock()
    mock_response.status_code = 429

    with patch('app.clients.youtube.Aiogoogle') as mock_aiogoogle:
        mock_instance = AsyncMock()
        mock_aiogoogle.return_value.__aenter__.return_value = mock_instance
        mock_instance.discover = AsyncMock(return_value=AsyncMock())
        mock_instance.as_api_key = AsyncMock(side_effect=HTTPError(
            msg="Rate limited",
            req=MagicMock(),
            res=mock_response
        ))

        # Rate limit (429) should be re-raised for tenacity to handle
        with pytest.raises(HTTPError):
            await client.get_video_metadata("test123")


@pytest.mark.asyncio
async def test_get_batch_metadata_success():
    """Test fetching metadata for multiple videos in batch."""
    from unittest.mock import AsyncMock

    # Create mock Redis client
    redis_client = AsyncMock()
    redis_client.get.return_value = None  # Cache miss
    redis_client.setex = AsyncMock()

    client = YouTubeClient(api_key="test-key", redis_client=redis_client)

    video_ids = ["VIDEO_ID_1", "VIDEO_ID_2", "VIDEO_ID_3"]

    # Mock YouTube API batch response
    mock_response_data = {
        "items": [
            {
                "id": "VIDEO_ID_1",
                "snippet": {
                    "title": "Python Tutorial",
                    "channelTitle": "Tech Channel",
                    "description": "Learn Python basics",
                    "publishedAt": "2024-01-15T10:00:00Z",
                    "thumbnails": {
                        "high": {
                            "url": "https://i.ytimg.com/vi/VIDEO_ID_1/hqdefault.jpg"
                        }
                    }
                },
                "contentDetails": {
                    "duration": "PT15M30S"
                }
            },
            {
                "id": "VIDEO_ID_2",
                "snippet": {
                    "title": "FastAPI Guide",
                    "channelTitle": "Web Dev Channel",
                    "description": "Build APIs with FastAPI",
                    "publishedAt": "2024-02-20T14:30:00Z",
                    "thumbnails": {
                        "high": {
                            "url": "https://i.ytimg.com/vi/VIDEO_ID_2/hqdefault.jpg"
                        }
                    }
                },
                "contentDetails": {
                    "duration": "PT25M45S"
                }
            },
            {
                "id": "VIDEO_ID_3",
                "snippet": {
                    "title": "React Hooks",
                    "channelTitle": "Frontend Pro",
                    "description": "Master React Hooks",
                    "publishedAt": "2024-03-10T09:15:00Z",
                    "thumbnails": {
                        "high": {
                            "url": "https://i.ytimg.com/vi/VIDEO_ID_3/hqdefault.jpg"
                        }
                    }
                },
                "contentDetails": {
                    "duration": "PT30M00S"
                }
            }
        ]
    }

    # Mock httpx.AsyncClient
    with patch('httpx.AsyncClient') as mock_client_class:
        mock_client = AsyncMock()
        mock_response = MagicMock()  # Not AsyncMock - response.json() is sync
        mock_response.raise_for_status = MagicMock()
        mock_response.json = MagicMock(return_value=mock_response_data)

        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client_class.return_value.__aenter__.return_value = mock_client
        mock_client_class.return_value.__aexit__.return_value = AsyncMock()

        # Call batch method
        results = await client.get_batch_metadata(video_ids)

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
async def test_get_batch_metadata_empty_list():
    """Test batch fetch with empty video IDs list."""
    client = YouTubeClient(api_key="test-key")
    results = await client.get_batch_metadata([])
    assert results == []


@pytest.mark.asyncio
async def test_get_batch_metadata_partial_failure():
    """Test batch fetch when some videos are not found."""
    from unittest.mock import AsyncMock

    redis_client = AsyncMock()
    redis_client.get.return_value = None
    redis_client.setex = AsyncMock()

    client = YouTubeClient(api_key="test-key", redis_client=redis_client)

    video_ids = ["VALID_ID", "INVALID_ID"]

    # Mock response with only one valid video
    mock_response_data = {
        "items": [
            {
                "id": "VALID_ID",
                "snippet": {
                    "title": "Valid Video",
                    "channelTitle": "Test Channel",
                    "description": "Test",
                    "publishedAt": "2024-01-01T00:00:00Z",
                    "thumbnails": {
                        "high": {
                            "url": "https://i.ytimg.com/vi/VALID_ID/hqdefault.jpg"
                        }
                    }
                },
                "contentDetails": {
                    "duration": "PT5M00S"
                }
            }
        ]
    }

    with patch('httpx.AsyncClient') as mock_client_class:
        mock_client = AsyncMock()
        mock_response = MagicMock()  # Not AsyncMock - response.json() is sync
        mock_response.raise_for_status = MagicMock()
        mock_response.json = MagicMock(return_value=mock_response_data)

        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client_class.return_value.__aenter__.return_value = mock_client
        mock_client_class.return_value.__aexit__.return_value = AsyncMock()

        results = await client.get_batch_metadata(video_ids)

    # Should only return valid video
    assert len(results) == 1
    assert results[0]["youtube_id"] == "VALID_ID"


# ============================================================================
# Channel ID extraction tests (for YouTube Channels feature)
# ============================================================================

@pytest.mark.asyncio
async def test_get_video_metadata_includes_channel_id():
    """Test that get_video_metadata returns channel_id from YouTube API."""
    client = YouTubeClient(api_key="test-key")

    mock_response = {
        "items": [{
            "id": "dQw4w9WgXcQ",
            "snippet": {
                "title": "Test Video",
                "channelTitle": "Test Channel",
                "channelId": "UCuAXFkgsw1L7xaCfnd5JJOw",  # YouTube channel ID
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
        mock_instance = AsyncMock()
        mock_aiogoogle.return_value.__aenter__.return_value = mock_instance
        mock_instance.discover.return_value = AsyncMock()
        mock_instance.as_api_key.return_value = mock_response

        metadata = await client.get_video_metadata("dQw4w9WgXcQ")

    assert "channel_id" in metadata, "channel_id should be in metadata"
    assert metadata["channel_id"] == "UCuAXFkgsw1L7xaCfnd5JJOw"


@pytest.mark.asyncio
async def test_get_batch_metadata_includes_channel_id():
    """Test that get_batch_metadata returns channel_id for each video."""
    from unittest.mock import AsyncMock

    redis_client = AsyncMock()
    redis_client.get.return_value = None
    redis_client.setex = AsyncMock()

    client = YouTubeClient(api_key="test-key", redis_client=redis_client)

    mock_response_data = {
        "items": [
            {
                "id": "VIDEO_ID_1",
                "snippet": {
                    "title": "Python Tutorial",
                    "channelTitle": "Tech Channel",
                    "channelId": "UCtech123",  # Channel ID
                    "description": "Learn Python",
                    "publishedAt": "2024-01-15T10:00:00Z",
                    "thumbnails": {
                        "high": {"url": "https://i.ytimg.com/vi/VIDEO_ID_1/hqdefault.jpg"}
                    }
                },
                "contentDetails": {"duration": "PT15M30S"}
            },
            {
                "id": "VIDEO_ID_2",
                "snippet": {
                    "title": "FastAPI Guide",
                    "channelTitle": "Web Dev Channel",
                    "channelId": "UCwebdev456",  # Different channel
                    "description": "Build APIs",
                    "publishedAt": "2024-02-20T14:30:00Z",
                    "thumbnails": {
                        "high": {"url": "https://i.ytimg.com/vi/VIDEO_ID_2/hqdefault.jpg"}
                    }
                },
                "contentDetails": {"duration": "PT25M45S"}
            }
        ]
    }

    with patch('httpx.AsyncClient') as mock_client_class:
        mock_client = AsyncMock()
        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.json = MagicMock(return_value=mock_response_data)

        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client_class.return_value.__aenter__.return_value = mock_client
        mock_client_class.return_value.__aexit__.return_value = AsyncMock()

        results = await client.get_batch_metadata(["VIDEO_ID_1", "VIDEO_ID_2"])

    assert len(results) == 2
    assert "channel_id" in results[0], "channel_id should be in batch metadata"
    assert results[0]["channel_id"] == "UCtech123"
    assert results[1]["channel_id"] == "UCwebdev456"
