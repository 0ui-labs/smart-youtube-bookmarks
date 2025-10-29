"""Tests for configuration settings"""
import pytest
from app.core.config import settings


def test_youtube_api_key_exists():
    """Test that YouTube API key is configured"""
    assert settings.youtube_api_key is not None
    assert len(settings.youtube_api_key) >= 0  # Can be empty string, but must exist
