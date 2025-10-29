"""
Redis client management for the application.

Provides singleton Redis client for pub/sub and caching operations.
"""

import asyncio
import redis.asyncio as redis
from arq import create_pool
from arq.connections import RedisSettings, ArqRedis
from app.core.config import settings


# Global Redis client instance (singleton)
_redis_client: redis.Redis | None = None
_redis_lock = asyncio.Lock()

# Global ARQ pool instance (singleton)
_arq_pool: ArqRedis | None = None
_arq_lock = asyncio.Lock()


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


async def get_arq_pool() -> ArqRedis:
    """
    Get or create ARQ Redis pool (singleton pattern with thread-safe initialization).

    Returns:
        ARQ Redis pool instance for enqueuing jobs
    """
    global _arq_pool

    # Fast path: pool already exists
    if _arq_pool is not None:
        return _arq_pool

    # Slow path: acquire lock and initialize
    async with _arq_lock:
        # Double-check: another coroutine might have initialized it
        if _arq_pool is None:
            redis_settings = RedisSettings.from_dsn(settings.redis_url)
            _arq_pool = await create_pool(redis_settings)
        return _arq_pool


async def close_arq_pool() -> None:
    """
    Close ARQ pool and cleanup.

    Should be called during application shutdown.
    """
    global _arq_pool
    if _arq_pool:
        await _arq_pool.close()
        _arq_pool = None
