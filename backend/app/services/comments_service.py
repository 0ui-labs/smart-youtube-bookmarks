"""
YouTube Comments Service.

Fetches top comments for videos using the YouTube Data API v3.
Used by VideoPreFilterService for detailed video analysis.
"""

import logging

import httpx

from app.core.config import settings
from app.services.quota_service import QuotaService

logger = logging.getLogger(__name__)

# YouTube API endpoint for comment threads
COMMENTS_API_URL = "https://www.googleapis.com/youtube/v3/commentThreads"

# Comment text length limit
MAX_COMMENT_LENGTH = 500


class CommentsService:
    """
    Service for fetching YouTube video comments.

    Uses the YouTube Data API v3 commentThreads endpoint to fetch
    top comments sorted by relevance. Integrates with QuotaService
    to track API usage (1 unit per request).

    Example:
        >>> quota = QuotaService(redis_client=redis)
        >>> service = CommentsService(quota_service=quota)
        >>> comments = await service.get_top_comments("dQw4w9WgXcQ", limit=10)
        >>> for comment in comments:
        ...     print(comment)
    """

    def __init__(self, quota_service: QuotaService):
        """
        Initialize CommentsService.

        Args:
            quota_service: QuotaService instance for tracking API usage
        """
        self.quota = quota_service
        self.api_key = settings.youtube_api_key

    async def get_top_comments(
        self,
        video_id: str,
        limit: int = 10,
    ) -> list[str]:
        """
        Fetch top comments for a video.

        Retrieves comments sorted by relevance (likes, engagement).
        Each call costs 1 YouTube API quota unit.

        Args:
            video_id: YouTube video ID
            limit: Maximum number of comments to return (default 10)

        Returns:
            List of comment text strings, truncated to MAX_COMMENT_LENGTH

        Example:
            >>> comments = await service.get_top_comments("dQw4w9WgXcQ", limit=5)
            >>> len(comments) <= 5
            True
        """
        # Check quota before making request
        if not await self.quota.is_quota_available(1):
            logger.warning(f"Quota exhausted, skipping comments for {video_id}")
            return []

        params: dict[str, str | int] = {
            "part": "snippet",
            "videoId": video_id,
            "maxResults": limit,
            "order": "relevance",
            "textFormat": "plainText",
            "key": self.api_key,
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(COMMENTS_API_URL, params=params)
                response.raise_for_status()
                data = response.json()

            # Track quota usage (commentThreads = 1 unit)
            await self.quota.track_usage(1)

            # Extract comment texts
            comments = []
            for item in data.get("items", []):
                snippet = (
                    item.get("snippet", {})
                    .get("topLevelComment", {})
                    .get("snippet", {})
                )
                text = snippet.get("textDisplay", "")

                if text:
                    # Truncate long comments
                    comments.append(text[:MAX_COMMENT_LENGTH])

            logger.debug(f"Fetched {len(comments)} comments for video {video_id}")

            return comments

        except httpx.HTTPStatusError as e:
            if e.response.status_code == 403:
                logger.warning(f"Comments disabled or forbidden for video {video_id}")
            else:
                logger.warning(f"HTTP error fetching comments for {video_id}: {e}")
            return []

        except Exception as e:
            logger.warning(f"Could not get comments for {video_id}: {e}")
            return []
