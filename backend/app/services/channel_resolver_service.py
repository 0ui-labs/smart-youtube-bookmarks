"""
Channel Resolver Service.

Resolves YouTube channel names and @handles to channel IDs
with Redis caching for efficiency.
"""

import logging

import httpx
from redis.asyncio import Redis

from app.core.config import settings
from app.core.redis import get_redis_client

logger = logging.getLogger(__name__)


class ChannelResolverService:
    """
    Service for resolving YouTube channel names to channel IDs.

    Supports:
    - @handle format (e.g., @fireship)
    - Channel names (e.g., "Fireship")
    - Direct channel IDs (passed through unchanged)

    Results are cached in Redis for 7 days to minimize API calls.
    """

    # Cache TTL: 7 days
    CACHE_TTL = 7 * 24 * 3600

    def __init__(self, redis_client: Redis | None = None) -> None:
        """
        Initialize the channel resolver service.

        Args:
            redis_client: Optional Redis client. If not provided, will get from pool.
        """
        self._redis = redis_client
        self.api_key = settings.youtube_api_key

    async def _get_redis(self) -> Redis | None:
        """Get Redis client lazily."""
        if self._redis is None:
            try:
                self._redis = await get_redis_client()
            except Exception as e:
                logger.warning(f"Redis unavailable for channel resolver: {e}")
        return self._redis

    async def resolve_channel_names(self, names: list[str]) -> dict[str, str | None]:
        """
        Resolve multiple channel names to channel IDs.

        Args:
            names: List of channel names, @handles, or channel IDs

        Returns:
            Dict mapping input names to channel IDs (None if not found)

        Example:
            >>> resolver = ChannelResolverService()
            >>> result = await resolver.resolve_channel_names(
            ...     ["Fireship", "@lexfridman", "UCsBjURrPoezykLs9EqgamOA"]
            ... )
            >>> print(result)
            {
                "Fireship": "UCsBjURrPoezykLs9EqgamOA",
                "@lexfridman": "UCSHZKyawb77ixDdsGog4iWA",
                "UCsBjURrPoezykLs9EqgamOA": "UCsBjURrPoezykLs9EqgamOA"
            }
        """
        result: dict[str, str | None] = {}
        redis = await self._get_redis()

        for name in names:
            # Skip empty names
            if not name or not name.strip():
                continue

            name = name.strip()

            # Check if it's already a channel ID (starts with UC and is 24 chars)
            if name.startswith("UC") and len(name) == 24:
                result[name] = name
                continue

            # Try cache first
            cache_key = f"channel_resolver:{name.lower()}"
            if redis:
                try:
                    cached = await redis.get(cache_key)
                    if cached:
                        result[name] = (
                            cached.decode() if isinstance(cached, bytes) else cached
                        )
                        logger.debug(f"Cache HIT for channel: {name}")
                        continue
                except Exception as e:
                    logger.warning(f"Redis cache read error: {e}")

            logger.debug(f"Cache MISS for channel: {name}")

            # Search YouTube for channel
            channel_id = await self._search_channel(name)
            result[name] = channel_id

            # Cache result (including None for not found)
            if redis and channel_id:
                try:
                    await redis.setex(cache_key, self.CACHE_TTL, channel_id)
                except Exception as e:
                    logger.warning(f"Redis cache write error: {e}")

        return result

    async def _search_channel(self, name: str) -> str | None:
        """
        Search for a channel on YouTube.

        Args:
            name: Channel name or @handle

        Returns:
            Channel ID if found, None otherwise
        """
        if not self.api_key:
            logger.warning("YouTube API key not configured, cannot resolve channel")
            return None

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                # Handle @username format using forHandle parameter
                if name.startswith("@"):
                    handle = name[1:]  # Remove @ prefix
                    response = await client.get(
                        "https://www.googleapis.com/youtube/v3/channels",
                        params={
                            "part": "id",
                            "forHandle": handle,
                            "key": self.api_key,
                        },
                    )
                    response.raise_for_status()
                    data = response.json()

                    items = data.get("items", [])
                    if items:
                        channel_id = items[0]["id"]
                        logger.info(
                            f"Resolved handle {name} to channel ID: {channel_id}"
                        )
                        return channel_id

                    logger.warning(f"Channel handle not found: {name}")
                    return None

                else:
                    # Search by channel name
                    response = await client.get(
                        "https://www.googleapis.com/youtube/v3/search",
                        params={
                            "part": "snippet",
                            "q": name,
                            "type": "channel",
                            "maxResults": 1,
                            "key": self.api_key,
                        },
                    )
                    response.raise_for_status()
                    data = response.json()

                    items = data.get("items", [])
                    if items:
                        channel_id = items[0]["id"]["channelId"]
                        logger.info(
                            f"Resolved channel name '{name}' to ID: {channel_id}"
                        )
                        return channel_id

                    logger.warning(f"Channel not found: {name}")
                    return None

        except httpx.HTTPError as e:
            logger.error(f"YouTube API error resolving channel '{name}': {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error resolving channel '{name}': {e}")
            return None

    async def resolve_single(self, name: str) -> str | None:
        """
        Convenience method to resolve a single channel name.

        Args:
            name: Channel name, @handle, or channel ID

        Returns:
            Channel ID if found, None otherwise
        """
        result = await self.resolve_channel_names([name])
        return result.get(name)
