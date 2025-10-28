"""
Redis client management for the application.

Provides singleton Redis client for pub/sub and caching operations.
"""

import redis.asyncio as redis
from app.core.config import settings


# Global Redis client instance (singleton)
_redis_client: redis.Redis | None = None


async def get_redis_client() -> redis.Redis:
    """
    Get or create Redis client (singleton pattern).

    Returns:
        Redis client instance with UTF-8 encoding and response decoding enabled
    """
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True
        )
    return _redis_client


async def close_redis_client() -> None:
    """
    Close Redis connection and cleanup.

    Should be called during application shutdown.
    """
    global _redis_client
    if _redis_client:
        await _redis_client.close()
        _redis_client = None
