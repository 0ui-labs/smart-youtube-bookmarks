"""
Tests for CommentsService.

TDD RED Phase - tests for fetching YouTube video comments.
"""

from unittest.mock import AsyncMock, MagicMock, patch


class TestGetTopComments:
    """Test fetching top comments from YouTube API."""

    async def test_get_top_comments_returns_list(self):
        """Should return list of comment texts."""
        from app.services.comments_service import CommentsService

        # Mock YouTube API response
        mock_response = {
            "items": [
                {
                    "snippet": {
                        "topLevelComment": {
                            "snippet": {
                                "textDisplay": "Great tutorial!",
                            }
                        }
                    }
                },
                {
                    "snippet": {
                        "topLevelComment": {
                            "snippet": {
                                "textDisplay": "Very helpful, thanks!",
                            }
                        }
                    }
                },
            ]
        }

        with patch("app.services.comments_service.httpx.AsyncClient") as mock_client:
            mock_response_obj = MagicMock()
            mock_response_obj.json.return_value = mock_response
            mock_response_obj.raise_for_status = MagicMock()

            mock_client_instance = AsyncMock()
            mock_client_instance.get = AsyncMock(return_value=mock_response_obj)
            mock_client_instance.__aenter__ = AsyncMock(
                return_value=mock_client_instance
            )
            mock_client_instance.__aexit__ = AsyncMock(return_value=None)
            mock_client.return_value = mock_client_instance

            # Mock quota service
            mock_quota = AsyncMock()
            mock_quota.is_quota_available = AsyncMock(return_value=True)
            mock_quota.track_usage = AsyncMock()

            service = CommentsService(quota_service=mock_quota)
            comments = await service.get_top_comments("video123", limit=10)

        assert len(comments) == 2
        assert comments[0] == "Great tutorial!"
        assert comments[1] == "Very helpful, thanks!"

    async def test_get_top_comments_respects_limit(self):
        """Should respect the limit parameter."""
        from app.services.comments_service import CommentsService

        mock_response = {
            "items": [
                {
                    "snippet": {
                        "topLevelComment": {"snippet": {"textDisplay": f"Comment {i}"}}
                    }
                }
                for i in range(10)
            ]
        }

        with patch("app.services.comments_service.httpx.AsyncClient") as mock_client:
            mock_response_obj = MagicMock()
            mock_response_obj.json.return_value = mock_response
            mock_response_obj.raise_for_status = MagicMock()

            mock_client_instance = AsyncMock()
            mock_client_instance.get = AsyncMock(return_value=mock_response_obj)
            mock_client_instance.__aenter__ = AsyncMock(
                return_value=mock_client_instance
            )
            mock_client_instance.__aexit__ = AsyncMock(return_value=None)
            mock_client.return_value = mock_client_instance

            mock_quota = AsyncMock()
            mock_quota.is_quota_available = AsyncMock(return_value=True)
            mock_quota.track_usage = AsyncMock()

            service = CommentsService(quota_service=mock_quota)
            comments = await service.get_top_comments("video123", limit=5)

        # Should have called API with limit=5
        call_args = mock_client_instance.get.call_args
        assert call_args[1]["params"]["maxResults"] == 5

    async def test_get_top_comments_truncates_long_comments(self):
        """Should truncate comments longer than 500 characters."""
        from app.services.comments_service import CommentsService

        long_comment = "x" * 1000  # 1000 characters
        mock_response = {
            "items": [
                {
                    "snippet": {
                        "topLevelComment": {
                            "snippet": {
                                "textDisplay": long_comment,
                            }
                        }
                    }
                }
            ]
        }

        with patch("app.services.comments_service.httpx.AsyncClient") as mock_client:
            mock_response_obj = MagicMock()
            mock_response_obj.json.return_value = mock_response
            mock_response_obj.raise_for_status = MagicMock()

            mock_client_instance = AsyncMock()
            mock_client_instance.get = AsyncMock(return_value=mock_response_obj)
            mock_client_instance.__aenter__ = AsyncMock(
                return_value=mock_client_instance
            )
            mock_client_instance.__aexit__ = AsyncMock(return_value=None)
            mock_client.return_value = mock_client_instance

            mock_quota = AsyncMock()
            mock_quota.is_quota_available = AsyncMock(return_value=True)
            mock_quota.track_usage = AsyncMock()

            service = CommentsService(quota_service=mock_quota)
            comments = await service.get_top_comments("video123")

        assert len(comments[0]) == 500

    async def test_get_top_comments_returns_empty_when_quota_exhausted(self):
        """Should return empty list when quota is exhausted."""
        from app.services.comments_service import CommentsService

        mock_quota = AsyncMock()
        mock_quota.is_quota_available = AsyncMock(return_value=False)

        service = CommentsService(quota_service=mock_quota)
        comments = await service.get_top_comments("video123")

        assert comments == []

    async def test_get_top_comments_tracks_quota_usage(self):
        """Should track 1 quota unit after successful fetch."""
        from app.services.comments_service import CommentsService

        mock_response = {"items": []}

        with patch("app.services.comments_service.httpx.AsyncClient") as mock_client:
            mock_response_obj = MagicMock()
            mock_response_obj.json.return_value = mock_response
            mock_response_obj.raise_for_status = MagicMock()

            mock_client_instance = AsyncMock()
            mock_client_instance.get = AsyncMock(return_value=mock_response_obj)
            mock_client_instance.__aenter__ = AsyncMock(
                return_value=mock_client_instance
            )
            mock_client_instance.__aexit__ = AsyncMock(return_value=None)
            mock_client.return_value = mock_client_instance

            mock_quota = AsyncMock()
            mock_quota.is_quota_available = AsyncMock(return_value=True)
            mock_quota.track_usage = AsyncMock()

            service = CommentsService(quota_service=mock_quota)
            await service.get_top_comments("video123")

        # Should track 1 unit for commentThreads API
        mock_quota.track_usage.assert_called_once_with(1)

    async def test_get_top_comments_handles_api_error(self):
        """Should return empty list on API error."""
        from app.services.comments_service import CommentsService

        with patch("app.services.comments_service.httpx.AsyncClient") as mock_client:
            mock_client_instance = AsyncMock()
            mock_client_instance.get = AsyncMock(side_effect=Exception("API Error"))
            mock_client_instance.__aenter__ = AsyncMock(
                return_value=mock_client_instance
            )
            mock_client_instance.__aexit__ = AsyncMock(return_value=None)
            mock_client.return_value = mock_client_instance

            mock_quota = AsyncMock()
            mock_quota.is_quota_available = AsyncMock(return_value=True)
            mock_quota.track_usage = AsyncMock()

            service = CommentsService(quota_service=mock_quota)
            comments = await service.get_top_comments("video123")

        assert comments == []

    async def test_get_top_comments_skips_empty_comments(self):
        """Should skip comments with empty text."""
        from app.services.comments_service import CommentsService

        mock_response = {
            "items": [
                {
                    "snippet": {
                        "topLevelComment": {
                            "snippet": {
                                "textDisplay": "Valid comment",
                            }
                        }
                    }
                },
                {
                    "snippet": {
                        "topLevelComment": {
                            "snippet": {
                                "textDisplay": "",  # Empty
                            }
                        }
                    }
                },
                {
                    "snippet": {
                        "topLevelComment": {
                            "snippet": {
                                "textDisplay": "Another valid",
                            }
                        }
                    }
                },
            ]
        }

        with patch("app.services.comments_service.httpx.AsyncClient") as mock_client:
            mock_response_obj = MagicMock()
            mock_response_obj.json.return_value = mock_response
            mock_response_obj.raise_for_status = MagicMock()

            mock_client_instance = AsyncMock()
            mock_client_instance.get = AsyncMock(return_value=mock_response_obj)
            mock_client_instance.__aenter__ = AsyncMock(
                return_value=mock_client_instance
            )
            mock_client_instance.__aexit__ = AsyncMock(return_value=None)
            mock_client.return_value = mock_client_instance

            mock_quota = AsyncMock()
            mock_quota.is_quota_available = AsyncMock(return_value=True)
            mock_quota.track_usage = AsyncMock()

            service = CommentsService(quota_service=mock_quota)
            comments = await service.get_top_comments("video123")

        assert len(comments) == 2
        assert "Valid comment" in comments
        assert "Another valid" in comments
