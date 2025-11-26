"""
Application configuration module.

This module defines the settings for the Smart YouTube Bookmarks application,
including database connection strings, API keys, and environment configuration.
Settings can be overridden via environment variables or a .env file.
"""

from pydantic import field_validator
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

    # Enrichment settings
    enrichment_enabled: bool = True
    enrichment_auto_trigger: bool = True  # Auto-enrich on video import
    enrichment_max_retries: int = 3
    enrichment_chunk_duration_minutes: int = 10  # Audio chunk duration

    # Authentication (JWT)
    secret_key: str = "your-secret-key-here-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    # Database connection pool (for ARQ workers)
    db_pool_size: int = 10  # Match ARQ max_jobs
    db_max_overflow: int = 5
    db_pool_pre_ping: bool = True

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8"
    )

    @field_validator("secret_key")
    @classmethod
    def validate_secret_key(cls, v: str, info) -> str:
        """
        Validate JWT secret key.

        In production, reject default value and require minimum 32 characters.
        In development, allow default but log warning.

        Args:
            v: Secret key value
            info: Validation context

        Returns:
            Validated secret key

        Raises:
            ValueError: If production uses default or short secret
        """
        # Get env from values being validated (might not be set yet)
        env = info.data.get("env", "development")

        # Check for default value
        is_default = v == "your-secret-key-here-change-in-production"

        # In production, reject default and enforce minimum length
        if env == "production":
            if is_default:
                raise ValueError(
                    "Cannot use default secret_key in production. "
                    "Set SECRET_KEY environment variable to a secure random value."
                )
            if len(v) < 32:
                raise ValueError(
                    "secret_key must be at least 32 characters in production. "
                    f"Current length: {len(v)}"
                )

        # In development, just warn if using default
        if is_default and env == "development":
            import logging
            logging.warning(
                "Using default secret_key in development. "
                "This is insecure for production use."
            )

        return v

    @field_validator("youtube_api_key")
    @classmethod
    def validate_youtube_api_key(cls, v: str, info) -> str:
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

        # Get env from values being validated (same pattern as secret_key validator)
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
    def validate_gemini_api_key(cls, v: str, info) -> str:
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

        # Get env from values being validated (same pattern as secret_key validator)
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
