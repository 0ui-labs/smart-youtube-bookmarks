"""
Application configuration module.

This module defines the settings for the Smart YouTube Bookmarks application,
including database connection strings, API keys, and environment configuration.
Settings can be overridden via environment variables or a .env file.
"""

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


settings = Settings()
