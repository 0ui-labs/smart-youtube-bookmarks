"""
Application configuration module.

This module defines the settings for the Smart YouTube Bookmarks application,
including database connection strings, API keys, and environment configuration.
Settings can be overridden via environment variables or a .env file.
"""

from pydantic import SecretStr, ValidationInfo, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # App environment (must be first for validators to access it)
    env: str = "development"

    # Database
    database_url: str = "postgresql+asyncpg://user:changeme@localhost/youtube_bookmarks"

    # Redis
    redis_url: str = "redis://localhost:6379"

    # External APIs
    youtube_api_key: str = ""
    gemini_api_key: str = ""
    groq_api_key: str = ""

    # PubSubHubbub (YouTube channel notifications)
    pubsub_signing_secret: SecretStr = SecretStr("")
    pubsub_callback_url: str = "http://localhost:8000"

    # Enrichment settings
    enrichment_enabled: bool = True
    enrichment_auto_trigger: bool = True  # Auto-enrich on video import
    enrichment_max_retries: int = 3
    enrichment_chunk_duration_minutes: int = 10  # Audio chunk duration

    clerk_issuer: str = ""
    clerk_authorized_parties: str = ""  # Comma-separated exact origins
    clerk_audience: str | None = None

    # Compatibility for existing .env files only; Clerk verification never uses these values.
    secret_key: str = "your-secret-key-here-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    # Database connection pool (for ARQ workers)
    db_pool_size: int = 10  # Match ARQ max_jobs
    db_max_overflow: int = 5
    db_pool_pre_ping: bool = True

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @field_validator("youtube_api_key")
    @classmethod
    def validate_youtube_api_key(cls, v: str, info: ValidationInfo) -> str:
        """
        Validate YouTube API key at startup.

        In production, require API key to be set (non-empty).
        In development, allow empty but warn if YouTube features are used.

        Args:
            v: YouTube API key value
            info: Validation context

        Returns:
            Validated API key

        Raises:
            ValueError: If production environment has empty API key
        """
        import logging

        # Validate provider configuration against the selected environment.
        env = info.data.get("env", "development")

        # Check if API key is empty
        is_empty = not v or not v.strip()

        # In production, reject empty API key
        if env == "production" and is_empty:
            raise ValueError(
                "YouTube API key is required in production. "
                "Set YOUTUBE_API_KEY environment variable."
            )

        # In development, warn if empty (features requiring YouTube API will fail)
        if is_empty and env == "development":
            logging.warning(
                "YouTube API key not set. "
                "Video metadata fetching will not work. "
                "Set YOUTUBE_API_KEY environment variable to enable."
            )

        return v

    @field_validator("gemini_api_key")
    @classmethod
    def validate_gemini_api_key(cls, v: str, info: ValidationInfo) -> str:
        """
        Validate Gemini API key at startup.

        In production, require API key to be set (non-empty).
        In development, allow empty but warn if Gemini features are used.

        Args:
            v: Gemini API key value
            info: Validation context

        Returns:
            Validated API key

        Raises:
            ValueError: If production environment has empty API key
        """
        import logging

        # Validate provider configuration against the selected environment.
        env = info.data.get("env", "development")

        # Check if API key is empty
        is_empty = not v or not v.strip()

        # In production, reject empty API key
        if env == "production" and is_empty:
            raise ValueError(
                "Gemini API key is required in production. "
                "Set GEMINI_API_KEY environment variable."
            )

        # In development, warn if empty (features requiring Gemini will fail)
        if is_empty and env == "development":
            logging.warning(
                "Gemini API key not set. "
                "Video extraction features will not work. "
                "Set GEMINI_API_KEY environment variable to enable."
            )

        return v


settings = Settings()
