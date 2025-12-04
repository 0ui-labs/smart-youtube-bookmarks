"""
YouTube API Quota Tracking Service.

Tracks daily YouTube API quota usage in Redis.
YouTube's daily quota limit is 10,000 units (default).

API Costs:
- Search API: 100 units per request
- Videos list: 1 unit per request

Usage:
    quota = QuotaService(redis_client=redis)
    if await quota.is_quota_available(100):
        # Perform search
        await quota.track_usage(100)
"""

import logging
from datetime import datetime

from redis.asyncio import Redis

logger = logging.getLogger(__name__)

# YouTube API default daily quota limit
DAILY_QUOTA = 10000


class QuotaService:
    """
    Service for tracking YouTube API quota usage.

    Uses Redis to track daily usage with automatic reset at midnight UTC.
    Keys are formatted as 'youtube_quota:YYYY-MM-DD' and expire after 2 days.
    """

    def __init__(self, redis_client: Redis):
        """
        Initialize QuotaService.

        Args:
            redis_client: Async Redis client for storage
        """
        self.redis = redis_client

    def _get_key(self) -> str:
        """
        Get Redis key for today's quota.

        Returns:
            Key in format 'youtube_quota:YYYY-MM-DD'
        """
        today = datetime.utcnow().strftime("%Y-%m-%d")
        return f"youtube_quota:{today}"

    async def track_usage(self, units: int) -> None:
        """
        Track consumed quota units.

        Args:
            units: Number of API units consumed
        """
        key = self._get_key()
        await self.redis.incrby(key, units)
        # Set TTL to 2 days to ensure cleanup after daily reset
        await self.redis.expire(key, 86400 * 2)

        logger.debug(f"Tracked {units} quota units (key: {key})")

    async def get_used(self) -> int:
        """
        Get quota units used today.

        Returns:
            Number of units used today (0 if none)
        """
        key = self._get_key()
        value = await self.redis.get(key)
        if value is None:
            return 0
        # Handle both string and bytes returns
        if isinstance(value, bytes):
            return int(value.decode())
        return int(value)

    async def get_remaining(self) -> int:
        """
        Get remaining quota units for today.

        Returns:
            Number of units remaining (never negative)
        """
        used = await self.get_used()
        return max(0, DAILY_QUOTA - used)

    async def is_quota_available(self, units: int = 100) -> bool:
        """
        Check if enough quota is available for an operation.

        Args:
            units: Number of units needed (default 100 for search)

        Returns:
            True if enough quota available, False otherwise
        """
        remaining = await self.get_remaining()
        return remaining >= units

    async def get_quota_status(self) -> dict[str, int | float]:
        """
        Get complete quota status for monitoring.

        Returns:
            Dict with used, remaining, limit, and percentage fields
        """
        used = await self.get_used()
        remaining = max(0, DAILY_QUOTA - used)
        percentage = round(used / DAILY_QUOTA * 100, 1)

        return {
            "used": used,
            "remaining": remaining,
            "limit": DAILY_QUOTA,
            "percentage": percentage,
        }
