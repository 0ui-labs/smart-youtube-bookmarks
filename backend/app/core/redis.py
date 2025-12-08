"""
Redis client management for the application.

Provides singleton Redis client for pub/sub and caching operations.
"""

import asyncio
from urllib.parse import parse_qs, urlparse

import redis.asyncio as redis
from arq import create_pool
from arq.connections import ArqRedis, RedisSettings

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
                settings.redis_url, encoding="utf-8", decode_responses=True
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
            # Parse Redis DSN manually (RedisSettings.from_dsn() doesn't exist)
            redis_dsn = urlparse(settings.redis_url)

            # Try to get db from query string first (e.g., ?db=5)
            query_params = parse_qs(redis_dsn.query)
            if query_params.get("db"):
                db_value = query_params["db"][0].strip()
                if not db_value.isdigit():
                    raise ValueError(
                        f"Invalid Redis database index in query string: {db_value}"
                    )
                try:
                    redis_db = int(db_value)
                except ValueError:
                    raise ValueError(
                        f"Invalid Redis database index in query string: {db_value}"
                    )
            else:
                # Fall back to path (e.g., /5)
                db_str = redis_dsn.path.lstrip("/") if redis_dsn.path else ""
                redis_db = int(db_str) if db_str.isdigit() else 0  # Safe int conversion

            redis_settings = RedisSettings(
                host=redis_dsn.hostname or "localhost",
                port=redis_dsn.port or 6379,
                database=redis_db,
                password=redis_dsn.password,
            )
            _arq_pool = await create_pool(redis_settings)
        return _arq_pool


async def close_arq_pool() -> None:
    """
    Close ARQ pool and cleanup.

    Should be called during application shutdown.
    """
    global _arq_pool
    if _arq_pool:
        await _arq_pool.close(close_connection_pool=True)
        _arq_pool = None
