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


def test_retired_hs256_secret_is_not_a_production_auth_requirement():
    config = Settings(
        env="production",
        secret_key="",
        youtube_api_key="synthetic",
        gemini_api_key="synthetic",
    )
    assert config.secret_key == ""
    assert (
        config.clerk_issuer == ""
    )  # Missing Clerk remains fail-closed in the verifier.
