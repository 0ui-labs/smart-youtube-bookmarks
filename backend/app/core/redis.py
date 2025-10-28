"""
Redis client management for the application.

Provides singleton Redis client for pub/sub and caching operations.
"""

import asyncio
import redis.asyncio as redis
from app.core.config import settings


# Global Redis client instance (singleton)
_redis_client: redis.Redis | None = None
_redis_lock = asyncio.Lock()


async def get_redis_client() -> redis.Redis:
    """
    Get or create Redis client (singleton pattern with thread-safe initialization).

    Uses double-check locking pattern to prevent race conditions during
    concurrent initialization.

    Returns:
        Redis client instance with UTF-8 encoding and response decoding enabled
    """
    global _redis_client

    # Fast path: client already exists
    if _redis_client is not None:
        return _redis_client

    # Slow path: acquire lock and initialize
    async with _redis_lock:
        # Double-check: another coroutine might have initialized it
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
