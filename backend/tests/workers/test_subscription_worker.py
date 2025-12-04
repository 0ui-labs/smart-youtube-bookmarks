"""Tests for subscription worker functions."""

from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.models.subscription import Subscription, SubscriptionMatch
from app.models.video import Video
from app.workers.subscription_worker import (
    _apply_filters,
    _parse_duration_to_seconds,
    process_pubsub_notification,
    renew_pubsub_leases,
)


class TestParseDuration:
    """Tests for duration parsing helper."""

    def test_parse_valid_duration(self):
        """Parses ISO 8601 durations correctly."""
        assert _parse_duration_to_seconds("PT1H30M15S") == 5415
        assert _parse_duration_to_seconds("PT10M") == 600
        assert _parse_duration_to_seconds("PT45S") == 45
        assert _parse_duration_to_seconds("PT2H") == 7200

    def test_parse_none(self):
        """Returns None for None input."""
        assert _parse_duration_to_seconds(None) is None

    def test_parse_invalid(self):
        """Returns None for invalid duration string."""
        assert _parse_duration_to_seconds("invalid") is None
        assert _parse_duration_to_seconds("") is None


class TestApplyFilters:
    """Tests for subscription filter application."""

    @pytest.fixture
    def video_data(self):
        """Sample video data for filter testing."""
        return {
            "title": "Python Tutorial for Beginners",
            "description": "Learn Python programming from scratch",
            "duration": "PT15M30S",  # 15:30
            "view_count": 50000,
            "youtube_category_id": "27",  # Education
        }

    @pytest.fixture
    def subscription(self):
        """Create mock subscription for filter testing (no DB needed)."""
        from unittest.mock import Mock

        sub = Mock(spec=Subscription)
        sub.id = uuid4()
        sub.user_id = uuid4()
        sub.list_id = uuid4()
        sub.name = "Test Subscription"
        sub.channel_ids = ["UCxxxxxx"]
        sub.keywords = None
        sub.filters = {}
        sub.poll_interval = "daily"
        return sub

    def test_no_filters(self, video_data, subscription):
        """Video passes when no filters defined."""
        subscription.filters = {}
        assert _apply_filters(video_data, subscription) is True

    def test_duration_filter_min(self, video_data, subscription):
        """Duration min filter works."""
        # Video is 15:30 (930 seconds)
        subscription.filters = {"duration": {"min_seconds": 600}}  # 10 min
        assert _apply_filters(video_data, subscription) is True

        subscription.filters = {"duration": {"min_seconds": 1200}}  # 20 min
        assert _apply_filters(video_data, subscription) is False

    def test_duration_filter_max(self, video_data, subscription):
        """Duration max filter works."""
        subscription.filters = {"duration": {"max_seconds": 1200}}  # 20 min
        assert _apply_filters(video_data, subscription) is True

        subscription.filters = {"duration": {"max_seconds": 600}}  # 10 min
        assert _apply_filters(video_data, subscription) is False

    def test_duration_filter_range(self, video_data, subscription):
        """Duration range filter works."""
        subscription.filters = {
            "duration": {"min_seconds": 600, "max_seconds": 1200}  # 10-20 min
        }
        assert _apply_filters(video_data, subscription) is True

    def test_views_filter(self, video_data, subscription):
        """View count filter works."""
        subscription.filters = {"views": {"min_views": 10000}}
        assert _apply_filters(video_data, subscription) is True

        subscription.filters = {"views": {"min_views": 100000}}
        assert _apply_filters(video_data, subscription) is False

    def test_category_filter(self, video_data, subscription):
        """YouTube category filter works."""
        subscription.filters = {"youtube_category": {"category_ids": ["27", "28"]}}
        assert _apply_filters(video_data, subscription) is True

        subscription.filters = {"youtube_category": {"category_ids": ["10", "22"]}}
        assert _apply_filters(video_data, subscription) is False

    def test_keyword_filter_title(self, video_data, subscription):
        """Keyword filter matches title."""
        subscription.keywords = ["Python"]
        assert _apply_filters(video_data, subscription) is True

        subscription.keywords = ["JavaScript"]
        assert _apply_filters(video_data, subscription) is False

    def test_keyword_filter_description(self, video_data, subscription):
        """Keyword filter matches description."""
        subscription.keywords = ["programming"]
        assert _apply_filters(video_data, subscription) is True

    def test_keyword_filter_case_insensitive(self, video_data, subscription):
        """Keyword filter is case insensitive."""
        subscription.keywords = ["PYTHON", "TUTORIAL"]
        assert _apply_filters(video_data, subscription) is True

    def test_combined_filters(self, video_data, subscription):
        """Multiple filters are ANDed together."""
        subscription.filters = {
            "duration": {"min_seconds": 600},
            "views": {"min_views": 10000},
        }
        subscription.keywords = ["Python"]
        assert _apply_filters(video_data, subscription) is True

        # Fail one filter
        subscription.filters["views"]["min_views"] = 100000
        assert _apply_filters(video_data, subscription) is False


# NOTE: Integration tests for process_pubsub_notification and renew_pubsub_leases
# require a real database session. These are tested via the API endpoint tests
# (test_webhooks.py) which provide full integration coverage.
#
# The unit tests above cover the core filter logic and duration parsing.
# For full integration testing, run the complete test suite with a test database.
