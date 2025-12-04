"""Tests for PubSubHubbub service."""

from unittest.mock import AsyncMock, patch

import pytest

from app.services.pubsub_service import (
    DEFAULT_LEASE_SECONDS,
    HUB_URL,
    PubSubHubbubService,
    subscribe_to_channel,
    unsubscribe_from_channel,
)


class TestPubSubHubbubService:
    """Tests for PubSubHubbubService class."""

    def test_get_topic_url(self):
        """Topic URL is correctly formatted for YouTube channel feeds."""
        service = PubSubHubbubService()
        channel_id = "UCxxxxxxxxxxxxxx"

        topic = service._get_topic_url(channel_id)

        assert topic == f"https://www.youtube.com/xml/feeds/videos.xml?channel_id={channel_id}"

    def test_callback_url_default(self):
        """Default callback URL uses settings."""
        with patch("app.services.pubsub_service.settings") as mock_settings:
            mock_settings.pubsub_callback_url = "https://example.com"
            service = PubSubHubbubService()

            assert service.callback_url == "https://example.com/api/webhooks/pubsubhubbub"

    def test_callback_url_override(self):
        """Callback URL can be overridden."""
        service = PubSubHubbubService()
        service.callback_url = "https://custom.example.com/webhook"

        assert service.callback_url == "https://custom.example.com/webhook"

    @pytest.mark.asyncio
    async def test_subscribe_success(self):
        """Subscribe returns True on 202 response."""
        service = PubSubHubbubService()

        mock_response = AsyncMock()
        mock_response.status_code = 202

        with patch.object(service.client, "post", return_value=mock_response) as mock_post:
            result = await service.subscribe("UCxxxxxx", "https://callback.example.com")

            assert result is True
            mock_post.assert_called_once()

            # Verify request data
            call_args = mock_post.call_args
            assert call_args.kwargs["data"]["hub.mode"] == "subscribe"
            assert "UCxxxxxx" in call_args.kwargs["data"]["hub.topic"]
            assert call_args.kwargs["data"]["hub.callback"] == "https://callback.example.com"

        await service.close()

    @pytest.mark.asyncio
    async def test_subscribe_failure(self):
        """Subscribe returns False on non-202 response."""
        service = PubSubHubbubService()

        mock_response = AsyncMock()
        mock_response.status_code = 400
        mock_response.text = "Bad request"

        with patch.object(service.client, "post", return_value=mock_response):
            result = await service.subscribe("UCxxxxxx")

            assert result is False

        await service.close()

    @pytest.mark.asyncio
    async def test_subscribe_http_error(self):
        """Subscribe returns False on HTTP error."""
        import httpx

        service = PubSubHubbubService()

        with patch.object(
            service.client, "post", side_effect=httpx.ConnectError("Connection refused")
        ):
            result = await service.subscribe("UCxxxxxx")

            assert result is False

        await service.close()

    @pytest.mark.asyncio
    async def test_unsubscribe_success(self):
        """Unsubscribe returns True on 202 response."""
        service = PubSubHubbubService()

        mock_response = AsyncMock()
        mock_response.status_code = 202

        with patch.object(service.client, "post", return_value=mock_response) as mock_post:
            result = await service.unsubscribe("UCxxxxxx", "https://callback.example.com")

            assert result is True

            # Verify request data
            call_args = mock_post.call_args
            assert call_args.kwargs["data"]["hub.mode"] == "unsubscribe"

        await service.close()

    @pytest.mark.asyncio
    async def test_subscribe_channels_multiple(self):
        """Subscribe to multiple channels returns results dict."""
        service = PubSubHubbubService()

        mock_response = AsyncMock()
        mock_response.status_code = 202

        with patch.object(service.client, "post", return_value=mock_response):
            results = await service.subscribe_channels(
                ["UCxxxxxx", "UCyyyyyy", "UCzzzzzz"]
            )

            assert len(results) == 3
            assert all(success for success in results.values())

        await service.close()

    @pytest.mark.asyncio
    async def test_context_manager(self):
        """Service works as async context manager."""
        async with PubSubHubbubService() as service:
            assert service.client is not None

        # Client should be closed after context exit
        assert service.client.is_closed


class TestConvenienceFunctions:
    """Tests for module-level convenience functions."""

    @pytest.mark.asyncio
    async def test_subscribe_to_channel(self):
        """Convenience function subscribes to single channel."""
        with patch(
            "app.services.pubsub_service.PubSubHubbubService"
        ) as MockService:
            mock_instance = AsyncMock()
            mock_instance.subscribe = AsyncMock(return_value=True)
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=None)
            MockService.return_value = mock_instance

            result = await subscribe_to_channel("UCxxxxxx")

            assert result is True
            mock_instance.subscribe.assert_called_once_with("UCxxxxxx")

    @pytest.mark.asyncio
    async def test_unsubscribe_from_channel(self):
        """Convenience function unsubscribes from single channel."""
        with patch(
            "app.services.pubsub_service.PubSubHubbubService"
        ) as MockService:
            mock_instance = AsyncMock()
            mock_instance.unsubscribe = AsyncMock(return_value=True)
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=None)
            MockService.return_value = mock_instance

            result = await unsubscribe_from_channel("UCxxxxxx")

            assert result is True
            mock_instance.unsubscribe.assert_called_once_with("UCxxxxxx")
