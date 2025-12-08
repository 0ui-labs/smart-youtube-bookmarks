"""Tests for YouTube API Quota Tracking Service.

The QuotaService tracks daily YouTube API quota usage in Redis.
YouTube's daily quota limit is 10,000 units.

Search API: 100 units per request
Videos list: 1 unit per request
"""

from datetime import datetime
from unittest.mock import AsyncMock, patch

import pytest

from app.services.quota_service import DAILY_QUOTA, QuotaService


class TestQuotaService:
    """Tests for QuotaService."""

    @pytest.fixture
    def mock_redis(self):
        """Create a mock Redis client."""
        redis = AsyncMock()
        redis.get = AsyncMock(return_value=None)
        redis.incrby = AsyncMock()
        redis.expire = AsyncMock()
        return redis

    @pytest.fixture
    def quota_service(self, mock_redis):
        """Create QuotaService with mocked Redis."""
        return QuotaService(redis_client=mock_redis)

    def test_daily_quota_constant(self):
        """DAILY_QUOTA is set to YouTube's default limit."""
        assert DAILY_QUOTA == 10000

    @pytest.mark.asyncio
    async def test_track_usage(self, quota_service, mock_redis):
        """track_usage increments Redis counter."""
        await quota_service.track_usage(100)

        mock_redis.incrby.assert_called_once()
        # Key should contain today's date
        call_args = mock_redis.incrby.call_args[0]
        today = datetime.utcnow().strftime("%Y-%m-%d")
        assert today in call_args[0]
        assert call_args[1] == 100

    @pytest.mark.asyncio
    async def test_track_usage_sets_expiry(self, quota_service, mock_redis):
        """track_usage sets TTL on Redis key."""
        await quota_service.track_usage(100)

        mock_redis.expire.assert_called_once()
        # TTL should be ~2 days (172800 seconds)
        call_args = mock_redis.expire.call_args[0]
        assert call_args[1] >= 172800

    @pytest.mark.asyncio
    async def test_get_used_returns_zero_when_empty(self, quota_service, mock_redis):
        """get_used returns 0 when no quota used today."""
        mock_redis.get.return_value = None

        used = await quota_service.get_used()

        assert used == 0

    @pytest.mark.asyncio
    async def test_get_used_returns_tracked_value(self, quota_service, mock_redis):
        """get_used returns tracked quota usage."""
        mock_redis.get.return_value = b"5000"

        used = await quota_service.get_used()

        assert used == 5000

    @pytest.mark.asyncio
    async def test_get_remaining_full_quota(self, quota_service, mock_redis):
        """get_remaining returns full quota when nothing used."""
        mock_redis.get.return_value = None

        remaining = await quota_service.get_remaining()

        assert remaining == DAILY_QUOTA

    @pytest.mark.asyncio
    async def test_get_remaining_partial_usage(self, quota_service, mock_redis):
        """get_remaining returns correct remaining after usage."""
        mock_redis.get.return_value = b"3000"

        remaining = await quota_service.get_remaining()

        assert remaining == 7000  # 10000 - 3000

    @pytest.mark.asyncio
    async def test_get_remaining_never_negative(self, quota_service, mock_redis):
        """get_remaining never returns negative value."""
        mock_redis.get.return_value = b"15000"  # Over quota

        remaining = await quota_service.get_remaining()

        assert remaining == 0

    @pytest.mark.asyncio
    async def test_is_quota_available_with_enough_quota(
        self, quota_service, mock_redis
    ):
        """is_quota_available returns True when enough quota."""
        mock_redis.get.return_value = b"5000"  # 5000 remaining

        available = await quota_service.is_quota_available(100)

        assert available is True

    @pytest.mark.asyncio
    async def test_is_quota_available_not_enough_quota(self, quota_service, mock_redis):
        """is_quota_available returns False when not enough quota."""
        mock_redis.get.return_value = b"9950"  # Only 50 remaining

        available = await quota_service.is_quota_available(100)

        assert available is False

    @pytest.mark.asyncio
    async def test_is_quota_available_default_check(self, quota_service, mock_redis):
        """is_quota_available defaults to checking 100 units (search cost)."""
        mock_redis.get.return_value = b"9901"  # 99 remaining

        available = await quota_service.is_quota_available()

        assert available is False

    @pytest.mark.asyncio
    async def test_get_quota_status(self, quota_service, mock_redis):
        """get_quota_status returns complete status dict."""
        mock_redis.get.return_value = b"2500"

        status = await quota_service.get_quota_status()

        assert status["used"] == 2500
        assert status["remaining"] == 7500
        assert status["limit"] == DAILY_QUOTA
        assert status["percentage"] == 25.0

    @pytest.mark.asyncio
    async def test_quota_key_uses_utc_date(self, quota_service, mock_redis):
        """Quota key uses UTC date for consistency."""
        await quota_service.get_used()

        call_args = mock_redis.get.call_args[0][0]
        today_utc = datetime.utcnow().strftime("%Y-%m-%d")
        assert f"youtube_quota:{today_utc}" == call_args


class TestQuotaServiceDailyReset:
    """Tests for daily quota reset behavior."""

    @pytest.mark.asyncio
    async def test_different_day_different_key(self):
        """Different days use different Redis keys (automatic reset)."""
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(return_value=None)

        service = QuotaService(redis_client=mock_redis)

        # Simulate two different days
        with patch("app.services.quota_service.datetime") as mock_dt:
            # Day 1
            mock_dt.utcnow.return_value = datetime(2024, 1, 15, 10, 0, 0)
            await service.get_used()
            key1 = mock_redis.get.call_args[0][0]

            # Day 2
            mock_dt.utcnow.return_value = datetime(2024, 1, 16, 10, 0, 0)
            await service.get_used()
            key2 = mock_redis.get.call_args[0][0]

        assert key1 != key2
        assert "2024-01-15" in key1
        assert "2024-01-16" in key2
