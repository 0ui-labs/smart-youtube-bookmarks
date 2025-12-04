"""
PubSubHubbub service for real-time YouTube channel notifications.

YouTube uses PubSubHubbub (WebSub) to push notifications when channels
upload new videos. This service handles subscribing/unsubscribing to
channel feeds and managing lease renewals.

Flow:
1. We send subscribe request to Google's hub
2. Hub verifies our callback endpoint (GET with challenge)
3. Hub sends POST notifications when channel uploads
4. We renew leases before they expire (default 10 days)
"""

import logging
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# Google's PubSubHubbub hub URL
HUB_URL = "https://pubsubhubbub.appspot.com/subscribe"

# Default lease duration in seconds (10 days)
DEFAULT_LEASE_SECONDS = 864000


class PubSubHubbubService:
    """
    Service for managing PubSubHubbub subscriptions to YouTube channels.

    YouTube exposes Atom feeds for channels at:
    https://www.youtube.com/xml/feeds/videos.xml?channel_id=CHANNEL_ID

    We subscribe to these feeds via Google's hub to receive real-time
    notifications when new videos are uploaded.
    """

    def __init__(self, timeout: float = 30.0):
        """
        Initialize the service.

        Args:
            timeout: HTTP request timeout in seconds
        """
        self.client = httpx.AsyncClient(timeout=timeout)
        self._callback_url: str | None = None

    @property
    def callback_url(self) -> str:
        """Get the configured callback URL for webhooks."""
        if self._callback_url:
            return self._callback_url
        return f"{settings.pubsub_callback_url}/api/webhooks/pubsubhubbub"

    @callback_url.setter
    def callback_url(self, value: str) -> None:
        """Override the callback URL (useful for testing)."""
        self._callback_url = value

    def _get_topic_url(self, channel_id: str) -> str:
        """
        Get the Atom feed URL for a YouTube channel.

        Args:
            channel_id: YouTube channel ID (e.g., UCxxxxxx)

        Returns:
            Feed URL that can be subscribed to
        """
        return f"https://www.youtube.com/xml/feeds/videos.xml?channel_id={channel_id}"

    async def subscribe(
        self,
        channel_id: str,
        callback_url: str | None = None,
        lease_seconds: int = DEFAULT_LEASE_SECONDS,
    ) -> bool:
        """
        Subscribe to a YouTube channel's feed.

        The hub will send a verification request to our callback URL,
        then start pushing notifications for new videos.

        Args:
            channel_id: YouTube channel ID to subscribe to
            callback_url: Override callback URL (uses default if None)
            lease_seconds: How long the subscription lasts (default 10 days)

        Returns:
            True if subscription request was accepted (202 status)
        """
        callback = callback_url or self.callback_url
        topic = self._get_topic_url(channel_id)

        data = {
            "hub.mode": "subscribe",
            "hub.topic": topic,
            "hub.callback": callback,
            "hub.verify": "async",
            "hub.lease_seconds": str(lease_seconds),
        }

        try:
            response = await self.client.post(
                HUB_URL,
                data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )

            if response.status_code == 202:
                logger.info(
                    f"PubSubHubbub subscribe request accepted for channel {channel_id}"
                )
                return True

            logger.warning(
                f"PubSubHubbub subscribe failed for channel {channel_id}: "
                f"status={response.status_code}, body={response.text}"
            )
            return False

        except httpx.HTTPError as e:
            logger.error(f"PubSubHubbub subscribe error for channel {channel_id}: {e}")
            return False

    async def unsubscribe(
        self,
        channel_id: str,
        callback_url: str | None = None,
    ) -> bool:
        """
        Unsubscribe from a YouTube channel's feed.

        Args:
            channel_id: YouTube channel ID to unsubscribe from
            callback_url: Override callback URL (uses default if None)

        Returns:
            True if unsubscribe request was accepted
        """
        callback = callback_url or self.callback_url
        topic = self._get_topic_url(channel_id)

        data = {
            "hub.mode": "unsubscribe",
            "hub.topic": topic,
            "hub.callback": callback,
        }

        try:
            response = await self.client.post(
                HUB_URL,
                data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )

            if response.status_code == 202:
                logger.info(
                    f"PubSubHubbub unsubscribe request accepted for channel {channel_id}"
                )
                return True

            logger.warning(
                f"PubSubHubbub unsubscribe failed for channel {channel_id}: "
                f"status={response.status_code}"
            )
            return False

        except httpx.HTTPError as e:
            logger.error(
                f"PubSubHubbub unsubscribe error for channel {channel_id}: {e}"
            )
            return False

    async def subscribe_channels(
        self,
        channel_ids: list[str],
        callback_url: str | None = None,
    ) -> dict[str, bool]:
        """
        Subscribe to multiple channels at once.

        Args:
            channel_ids: List of YouTube channel IDs
            callback_url: Override callback URL

        Returns:
            Dict mapping channel_id to success status
        """
        results: dict[str, bool] = {}
        for channel_id in channel_ids:
            results[channel_id] = await self.subscribe(channel_id, callback_url)
        return results

    async def unsubscribe_channels(
        self,
        channel_ids: list[str],
        callback_url: str | None = None,
    ) -> dict[str, bool]:
        """
        Unsubscribe from multiple channels at once.

        Args:
            channel_ids: List of YouTube channel IDs
            callback_url: Override callback URL

        Returns:
            Dict mapping channel_id to success status
        """
        results: dict[str, bool] = {}
        for channel_id in channel_ids:
            results[channel_id] = await self.unsubscribe(channel_id, callback_url)
        return results

    async def close(self) -> None:
        """Close the HTTP client."""
        await self.client.aclose()

    async def __aenter__(self) -> "PubSubHubbubService":
        """Context manager entry."""
        return self

    async def __aexit__(self, *args: Any) -> None:
        """Context manager exit."""
        await self.close()


# Convenience function for one-off operations
async def subscribe_to_channel(channel_id: str) -> bool:
    """
    Subscribe to a single channel (convenience function).

    Args:
        channel_id: YouTube channel ID

    Returns:
        True if subscription request was accepted
    """
    async with PubSubHubbubService() as service:
        return await service.subscribe(channel_id)


async def unsubscribe_from_channel(channel_id: str) -> bool:
    """
    Unsubscribe from a single channel (convenience function).

    Args:
        channel_id: YouTube channel ID

    Returns:
        True if unsubscribe request was accepted
    """
    async with PubSubHubbubService() as service:
        return await service.unsubscribe(channel_id)
