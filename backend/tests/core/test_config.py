"""Tests for configuration settings"""
import pytest
from app.core.config import settings


def test_youtube_api_key_exists():
    """Test that YouTube API key is configured"""
    assert settings.youtube_api_key is not None
    # Note: In test environment, API key may be empty string
    # In production, it must be set via environment variable
