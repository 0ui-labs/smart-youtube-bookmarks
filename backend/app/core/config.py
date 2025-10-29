"""
Application configuration module.

This module defines the settings for the Smart YouTube Bookmarks application,
including database connection strings, API keys, and environment configuration.
Settings can be overridden via environment variables or a .env file.
"""

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://user:changeme@localhost/youtube_bookmarks"

    # Redis
    redis_url: str = "redis://localhost:6379"

    # External APIs
    youtube_api_key: str = ""
    gemini_api_key: str = ""

    # Authentication (JWT)
    secret_key: str = "your-secret-key-here-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    # App
    env: str = "development"

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


settings = Settings()
