from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://user:password@localhost/youtube_bookmarks"

    # Redis
    redis_url: str = "redis://localhost:6379"

    # External APIs
    youtube_api_key: str = ""
    gemini_api_key: str = ""

    # App
    env: str = "development"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
