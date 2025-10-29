"""Integration test fixtures"""
import pytest
from unittest.mock import patch, AsyncMock


@pytest.fixture(autouse=True)
def mock_youtube_client_for_integration():
    """Auto-mock YouTube client for all integration tests"""
    with patch('app.workers.video_processor.YouTubeClient') as mock_client_class:
        mock_client = AsyncMock()
        mock_client.get_video_metadata.return_value = {
            "video_id": "test123",
            "title": "Test Video",
            "channel": "Test Channel",
            "published_at": "2025-01-01T00:00:00Z",
            "thumbnail_url": "https://example.com/thumb.jpg",
            "duration": "PT3M33S"
        }
        mock_client.get_video_transcript.return_value = "Test transcript"
        mock_client_class.return_value = mock_client
        yield mock_client_class
