"""Configuration behavior without requiring real provider credentials."""

import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_development_allows_missing_youtube_key():
    assert Settings(env="development", youtube_api_key="").youtube_api_key == ""


def test_production_rejects_missing_youtube_key():
    with pytest.raises(ValidationError, match="YouTube API key is required"):
        Settings(
            env="production",
            secret_key="x" * 32,
            youtube_api_key="",
            gemini_api_key="synthetic",
        )
