"""Tests for configuration settings"""

from app.core.config import settings


def test_youtube_api_key_exists():
    """Test that YouTube API key is configured"""
    # Check that API key is set and not empty
    # Empty string means key is missing (should fail in production)
    assert settings.youtube_api_key, (
        "YouTube API key must be configured (not empty or None)"
    )
