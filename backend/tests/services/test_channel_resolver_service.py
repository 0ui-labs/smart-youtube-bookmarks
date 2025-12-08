"""
Tests for ChannelResolverService.

Tests the YouTube channel name/handle to ID resolution service
with mocked YouTube API and Redis cache.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest


@pytest.fixture
def mock_redis():
    """Create a mock Redis client."""
    redis = AsyncMock()
    redis.get = AsyncMock(return_value=None)  # Cache miss by default
    redis.setex = AsyncMock()
    return redis


@pytest.fixture
def mock_httpx_response():
    """Factory for creating mock httpx responses."""

    def _create_response(json_data: dict, status_code: int = 200):
        response = MagicMock()
        response.json.return_value = json_data
        response.status_code = status_code
        response.raise_for_status = MagicMock()
        if status_code >= 400:
            from httpx import HTTPStatusError

            response.raise_for_status.side_effect = HTTPStatusError(
                "Error", request=MagicMock(), response=response
            )
        return response

    return _create_response


@pytest.mark.asyncio
async def test_resolve_direct_channel_id(mock_redis):
    """Test that channel IDs are passed through unchanged."""
    from app.services.channel_resolver_service import ChannelResolverService

    service = ChannelResolverService(redis_client=mock_redis)

    result = await service.resolve_channel_names(["UCsBjURrPoezykLs9EqgamOA"])

    assert result["UCsBjURrPoezykLs9EqgamOA"] == "UCsBjURrPoezykLs9EqgamOA"
    # Should not hit YouTube API for direct channel IDs
    mock_redis.get.assert_not_called()


@pytest.mark.asyncio
async def test_resolve_handle_from_cache(mock_redis):
    """Test that cached channel IDs are returned from Redis."""
    from app.services.channel_resolver_service import ChannelResolverService

    # Set up cache hit
    mock_redis.get = AsyncMock(return_value=b"UCcached123456789012345")

    service = ChannelResolverService(redis_client=mock_redis)

    result = await service.resolve_channel_names(["@fireship"])

    assert result["@fireship"] == "UCcached123456789012345"
    mock_redis.get.assert_called_once()


@pytest.mark.asyncio
async def test_resolve_handle_from_youtube_api(mock_redis, mock_httpx_response):
    """Test resolving @handle via YouTube API."""
    from app.services.channel_resolver_service import ChannelResolverService

    mock_response = mock_httpx_response(
        {
            "items": [{"id": "UCsBjURrPoezykLs9EqgamOA"}],
        }
    )

    with patch("httpx.AsyncClient") as mock_client:
        mock_instance = AsyncMock()
        mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
        mock_instance.__aexit__ = AsyncMock(return_value=None)
        mock_instance.get = AsyncMock(return_value=mock_response)
        mock_client.return_value = mock_instance

        service = ChannelResolverService(redis_client=mock_redis)
        result = await service.resolve_channel_names(["@fireship"])

    assert result["@fireship"] == "UCsBjURrPoezykLs9EqgamOA"
    # Should cache the result
    mock_redis.setex.assert_called_once()


@pytest.mark.asyncio
async def test_resolve_channel_name_from_youtube_search(
    mock_redis, mock_httpx_response
):
    """Test resolving channel name via YouTube search API."""
    from app.services.channel_resolver_service import ChannelResolverService

    mock_response = mock_httpx_response(
        {
            "items": [
                {
                    "id": {"channelId": "UCx12345678901234567890"},
                    "snippet": {"title": "Fireship"},
                }
            ],
        }
    )

    with patch("httpx.AsyncClient") as mock_client:
        mock_instance = AsyncMock()
        mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
        mock_instance.__aexit__ = AsyncMock(return_value=None)
        mock_instance.get = AsyncMock(return_value=mock_response)
        mock_client.return_value = mock_instance

        service = ChannelResolverService(redis_client=mock_redis)
        result = await service.resolve_channel_names(["Fireship"])

    assert result["Fireship"] == "UCx12345678901234567890"


@pytest.mark.asyncio
async def test_resolve_handle_not_found(mock_redis, mock_httpx_response):
    """Test handling of unknown channel handles."""
    from app.services.channel_resolver_service import ChannelResolverService

    mock_response = mock_httpx_response({"items": []})

    with patch("httpx.AsyncClient") as mock_client:
        mock_instance = AsyncMock()
        mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
        mock_instance.__aexit__ = AsyncMock(return_value=None)
        mock_instance.get = AsyncMock(return_value=mock_response)
        mock_client.return_value = mock_instance

        service = ChannelResolverService(redis_client=mock_redis)
        result = await service.resolve_channel_names(["@nonexistent"])

    assert result["@nonexistent"] is None


@pytest.mark.asyncio
async def test_resolve_multiple_channels(mock_redis, mock_httpx_response):
    """Test resolving multiple channel names at once."""
    from app.services.channel_resolver_service import ChannelResolverService

    # Set up cache hit for one, miss for another
    mock_redis.get = AsyncMock(
        side_effect=[b"UCcached111111111111111", None]  # First cached  # Second not
    )

    mock_response = mock_httpx_response(
        {
            "items": [{"id": "UCapi22222222222222222"}],
        }
    )

    with patch("httpx.AsyncClient") as mock_client:
        mock_instance = AsyncMock()
        mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
        mock_instance.__aexit__ = AsyncMock(return_value=None)
        mock_instance.get = AsyncMock(return_value=mock_response)
        mock_client.return_value = mock_instance

        service = ChannelResolverService(redis_client=mock_redis)
        result = await service.resolve_channel_names(["@cachedchannel", "@apichannel"])

    assert result["@cachedchannel"] == "UCcached111111111111111"
    assert result["@apichannel"] == "UCapi22222222222222222"


@pytest.mark.asyncio
async def test_resolve_empty_names_skipped():
    """Test that empty names are skipped."""
    from app.services.channel_resolver_service import ChannelResolverService

    mock_redis = AsyncMock()
    service = ChannelResolverService(redis_client=mock_redis)

    result = await service.resolve_channel_names(["", "  ", None])  # type: ignore

    # Empty names should not appear in result
    assert len(result) == 0


@pytest.mark.asyncio
async def test_resolve_single_convenience_method(mock_redis, mock_httpx_response):
    """Test the resolve_single convenience method."""
    from app.services.channel_resolver_service import ChannelResolverService

    mock_redis.get = AsyncMock(return_value=b"UCsingle123456789012345")

    service = ChannelResolverService(redis_client=mock_redis)
    result = await service.resolve_single("@singlechannel")

    assert result == "UCsingle123456789012345"


@pytest.mark.asyncio
async def test_resolve_without_api_key():
    """Test that resolution fails gracefully without API key."""
    from app.services.channel_resolver_service import ChannelResolverService

    mock_redis = AsyncMock()
    mock_redis.get = AsyncMock(return_value=None)  # Cache miss

    with patch("app.services.channel_resolver_service.settings") as mock_settings:
        mock_settings.youtube_api_key = None

        service = ChannelResolverService(redis_client=mock_redis)
        result = await service.resolve_channel_names(["Fireship"])

    assert result["Fireship"] is None


@pytest.mark.asyncio
async def test_resolve_handles_api_error(mock_redis, mock_httpx_response):
    """Test graceful handling of YouTube API errors."""
    import httpx

    from app.services.channel_resolver_service import ChannelResolverService

    with patch("httpx.AsyncClient") as mock_client:
        mock_instance = AsyncMock()
        mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
        mock_instance.__aexit__ = AsyncMock(return_value=None)
        mock_instance.get = AsyncMock(side_effect=httpx.HTTPError("API Error"))
        mock_client.return_value = mock_instance

        service = ChannelResolverService(redis_client=mock_redis)
        result = await service.resolve_channel_names(["@errorcase"])

    assert result["@errorcase"] is None


@pytest.mark.asyncio
async def test_cache_key_is_lowercase(mock_redis):
    """Test that cache keys are case-insensitive."""
    from app.services.channel_resolver_service import ChannelResolverService

    mock_redis.get = AsyncMock(return_value=b"UCcasetest1234567890123")

    service = ChannelResolverService(redis_client=mock_redis)
    result = await service.resolve_channel_names(["@FIRESHIP"])

    # Should query cache with lowercase key
    mock_redis.get.assert_called_with("channel_resolver:@fireship")
    assert result["@FIRESHIP"] == "UCcasetest1234567890123"


@pytest.mark.asyncio
async def test_cache_ttl_is_7_days(mock_redis, mock_httpx_response):
    """Test that cache entries have 7-day TTL."""
    from app.services.channel_resolver_service import ChannelResolverService

    mock_response = mock_httpx_response({"items": [{"id": "UCttl12345678901234567"}]})

    with patch("httpx.AsyncClient") as mock_client:
        mock_instance = AsyncMock()
        mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
        mock_instance.__aexit__ = AsyncMock(return_value=None)
        mock_instance.get = AsyncMock(return_value=mock_response)
        mock_client.return_value = mock_instance

        service = ChannelResolverService(redis_client=mock_redis)
        await service.resolve_channel_names(["@ttltest"])

    # 7 days = 604800 seconds
    expected_ttl = 7 * 24 * 3600
    mock_redis.setex.assert_called_with(
        "channel_resolver:@ttltest", expected_ttl, "UCttl12345678901234567"
    )


@pytest.mark.asyncio
async def test_redis_connection_error_handled(mock_httpx_response):
    """Test that Redis connection errors don't break resolution."""
    from app.services.channel_resolver_service import ChannelResolverService

    mock_redis = AsyncMock()
    mock_redis.get = AsyncMock(side_effect=Exception("Redis connection error"))

    mock_response = mock_httpx_response({"items": [{"id": "UCfallback12345678901234"}]})

    with patch("httpx.AsyncClient") as mock_client:
        mock_instance = AsyncMock()
        mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
        mock_instance.__aexit__ = AsyncMock(return_value=None)
        mock_instance.get = AsyncMock(return_value=mock_response)
        mock_client.return_value = mock_instance

        service = ChannelResolverService(redis_client=mock_redis)
        result = await service.resolve_channel_names(["@fallback"])

    # Should still work via API even if cache fails
    assert result["@fallback"] == "UCfallback12345678901234"
