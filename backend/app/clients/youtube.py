"""YouTube Data API v3 Client using aiogoogle"""
import asyncio
import json
import random
import logging
from typing import Optional, TypedDict
from aiogoogle import Aiogoogle
from aiogoogle.excs import HTTPError
from redis.asyncio import Redis
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import (
    NoTranscriptFound,
    TranscriptsDisabled,
    VideoUnavailable
)
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    retry_if_exception
)
import httpx

logger = logging.getLogger(__name__)

# Network errors that should trigger retry
TRANSIENT_ERRORS = (
    httpx.ConnectError,
    httpx.TimeoutException,
    httpx.NetworkError,
)


def _should_retry(exception: Exception) -> bool:
    """Check if exception should trigger retry (transient errors or HTTP 429)"""
    # Retry on transient network errors
    if isinstance(exception, TRANSIENT_ERRORS):
        return True
    # Retry on HTTP 429 (rate limiting)
    if isinstance(exception, HTTPError) and exception.res.status_code == 429:
        return True
    return False


class ChannelInfo(TypedDict, total=False):
    """Type definition for YouTube channel info"""
    thumbnail_url: str | None
    description: str | None


class VideoMetadata(TypedDict, total=False):
    """Type definition for YouTube video metadata"""
    video_id: str
    title: str
    channel: str
    channel_id: str  # YouTube channel ID (e.g., UCX6OQ3DkcsbYNE6H8uQQuVA)
    published_at: str
    thumbnail_url: str
    duration: str
    # Extended metadata (snippet)
    description: str
    youtube_tags: list[str]
    youtube_category_id: str
    default_language: str
    # Content details
    dimension: str
    definition: str
    has_captions: bool
    region_restriction: dict
    # Statistics
    view_count: int
    like_count: int
    comment_count: int
    # Status
    privacy_status: str
    is_embeddable: bool


class YouTubeClient:
    """Async YouTube Data API v3 client with Redis caching"""

    def __init__(self, api_key: str, redis_client: Optional[Redis] = None):
        if not api_key or not api_key.strip():
            raise ValueError("YouTube API key is required and cannot be empty")
        self.api_key = api_key
        self.redis = redis_client

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception(_should_retry),
        reraise=True
    )
    async def get_video_metadata(self, video_id: str) -> VideoMetadata:
        """
        Fetch video metadata from YouTube Data API v3 with caching (7-day TTL)

        Args:
            video_id: YouTube video ID (e.g., "dQw4w9WgXcQ")

        Returns:
            Dictionary with video metadata

        Raises:
            ValueError: If video not found or API quota exceeded

        Example:
            >>> client = YouTubeClient(api_key="...")
            >>> metadata = await client.get_video_metadata("dQw4w9WgXcQ")
            >>> print(metadata["title"])
            'Never Gonna Give You Up'
        """
        # Try cache first
        if self.redis:
            cache_key = f"youtube:v1:video:{video_id}"
            cached = await self.redis.get(cache_key)
            if cached:
                logger.debug(f"Cache HIT for video metadata: {video_id}")
                return json.loads(cached)
            logger.debug(f"Cache MISS for video metadata: {video_id}")

        # Cache miss - fetch from API
        try:
            async with Aiogoogle(api_key=self.api_key) as aiogoogle:
                youtube_v3 = await aiogoogle.discover("youtube", "v3")

                request = youtube_v3.videos.list(
                    part="snippet,contentDetails,statistics,status",
                    id=video_id
                )

                response = await aiogoogle.as_api_key(request)

                # Check if video found
                if not response.get("items"):
                    raise ValueError(f"Video not found: {video_id}")

                item = response["items"][0]
                snippet = item["snippet"]
                content_details = item["contentDetails"]
                statistics = item.get("statistics", {})
                status = item.get("status", {})

                # Get highest quality thumbnail available
                # YouTube provides: maxres (1280x720), standard (640x480), high (480x360), medium (320x180), default (120x90)
                thumbnails = snippet["thumbnails"]
                thumbnail_url = (
                    thumbnails.get("maxres", {}).get("url") or
                    thumbnails.get("standard", {}).get("url") or
                    thumbnails.get("high", {}).get("url") or
                    thumbnails.get("medium", {}).get("url") or
                    thumbnails.get("default", {}).get("url")
                )

                metadata: VideoMetadata = {
                    "video_id": video_id,
                    "title": snippet["title"],
                    "channel": snippet["channelTitle"],
                    "channel_id": snippet.get("channelId"),  # YouTube channel ID
                    "published_at": snippet["publishedAt"],
                    "thumbnail_url": thumbnail_url,
                    "duration": content_details["duration"],
                    # Extended snippet
                    "description": snippet.get("description", ""),
                    "youtube_tags": snippet.get("tags", []),
                    "youtube_category_id": snippet.get("categoryId"),
                    "default_language": snippet.get("defaultLanguage"),
                    # Content details
                    "dimension": content_details.get("dimension"),
                    "definition": content_details.get("definition"),
                    "has_captions": content_details.get("caption") == "true",
                    "region_restriction": content_details.get("regionRestriction"),
                    # Statistics
                    "view_count": int(statistics.get("viewCount", 0)) if statistics.get("viewCount") else None,
                    "like_count": int(statistics.get("likeCount", 0)) if statistics.get("likeCount") else None,
                    "comment_count": int(statistics.get("commentCount", 0)) if statistics.get("commentCount") else None,
                    # Status
                    "privacy_status": status.get("privacyStatus"),
                    "is_embeddable": status.get("embeddable"),
                }

                # Store in cache with TTL + jitter (7 days)
                if self.redis:
                    ttl = 7 * 24 * 3600 + random.randint(0, 3600)  # Add jitter
                    await self.redis.setex(
                        cache_key,
                        ttl,
                        json.dumps(metadata)
                    )

                return metadata

        except HTTPError as e:
            if e.res.status_code == 403:
                # Quota exceeded or forbidden - don't retry
                error_body = e.res.json if isinstance(e.res.json, dict) else (e.res.json() if callable(e.res.json) else {})
                reason = error_body.get('error', {}).get('errors', [{}])[0].get('reason', 'unknown')
                if reason == 'quotaExceeded':
                    raise ValueError(f"YouTube API quota exceeded for video {video_id}")
                else:
                    raise ValueError(f"YouTube API access forbidden: {reason}")
            elif e.res.status_code == 429:
                # Rate limited - retry handled by tenacity
                raise
            raise  # Re-raise other HTTP errors

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception(_should_retry),
        reraise=True
    )
    async def get_channel_info(self, channel_id: str) -> ChannelInfo:
        """
        Fetch channel info (thumbnail + description) from YouTube Data API v3 with caching (30-day TTL).

        Uses the Channels API to get the channel's profile picture/thumbnail and description.

        Args:
            channel_id: YouTube channel ID (e.g., "UCX6OQ3DkcsbYNE6H8uQQuVA")

        Returns:
            ChannelInfo dict with thumbnail_url and description

        Example:
            >>> client = YouTubeClient(api_key="...")
            >>> info = await client.get_channel_info("UCX6OQ3DkcsbYNE6H8uQQuVA")
            >>> print(info["thumbnail_url"])
            'https://yt3.ggpht.com/...'
            >>> print(info["description"])
            'Tech tutorials and reviews...'
        """
        if not channel_id:
            return {"thumbnail_url": None, "description": None}

        # Try cache first
        logger.info(f"get_channel_info called for: {channel_id}")
        if self.redis:
            cache_key = f"youtube:v3:channel_info:{channel_id}"
            cached = await self.redis.get(cache_key)
            if cached:
                logger.info(f"Cache HIT for channel info: {channel_id}")
                return json.loads(cached)
            logger.info(f"Cache MISS for channel info: {channel_id}")

        try:
            async with Aiogoogle(api_key=self.api_key) as aiogoogle:
                youtube_v3 = await aiogoogle.discover("youtube", "v3")

                request = youtube_v3.channels.list(
                    part="snippet",
                    id=channel_id
                )

                response = await aiogoogle.as_api_key(request)

                # Check if channel found
                if not response.get("items"):
                    logger.warning(f"Channel not found: {channel_id}")
                    return {"thumbnail_url": None, "description": None}

                item = response["items"][0]
                snippet = item.get("snippet", {})
                thumbnails = snippet.get("thumbnails", {})

                # Get highest quality thumbnail available
                thumbnail_url = (
                    thumbnails.get("high", {}).get("url") or
                    thumbnails.get("medium", {}).get("url") or
                    thumbnails.get("default", {}).get("url")
                )

                # Get channel description
                description = snippet.get("description")

                channel_info: ChannelInfo = {
                    "thumbnail_url": thumbnail_url,
                    "description": description
                }

                # Store in cache with TTL (30 days - channel info rarely changes)
                if self.redis:
                    ttl = 30 * 24 * 3600
                    await self.redis.setex(cache_key, ttl, json.dumps(channel_info))

                return channel_info

        except HTTPError as e:
            logger.warning(f"Failed to fetch channel info for {channel_id}: {e}")
            return {"thumbnail_url": None, "description": None}

    # Backward compatibility alias
    async def get_channel_thumbnail(self, channel_id: str) -> Optional[str]:
        """Backward compatibility wrapper for get_channel_info."""
        info = await self.get_channel_info(channel_id)
        return info.get("thumbnail_url")

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception(_should_retry),
        reraise=True
    )
    async def get_video_transcript(self, video_id: str) -> Optional[str]:
        """
        Fetch video transcript (captions) with caching (30-day TTL)

        Args:
            video_id: YouTube video ID

        Returns:
            Transcript text as string, or None if not available
        """
        # Try cache first
        if self.redis:
            cache_key = f"youtube:v1:transcript:{video_id}"
            cached = await self.redis.get(cache_key)
            if cached:
                logger.debug(f"Cache HIT for transcript: {video_id}")
                return json.loads(cached) if cached else None
            logger.debug(f"Cache MISS for transcript: {video_id}")

        # Try multiple languages with fallback
        languages_to_try = ['en', 'de', 'es', 'fr', 'it', 'pt', 'ja', 'ko']

        for language in languages_to_try:
            try:
                # Use asyncio.to_thread for sync API
                transcript_list = await asyncio.to_thread(
                    YouTubeTranscriptApi.get_transcript,
                    video_id,
                    languages=[language]
                )

                # Concatenate text segments
                transcript_text = " ".join(
                    segment["text"] for segment in transcript_list
                )

                # Store in cache with TTL (30 days)
                if self.redis:
                    ttl = 30 * 24 * 3600
                    await self.redis.setex(cache_key, ttl, json.dumps(transcript_text))

                return transcript_text

            except NoTranscriptFound:
                continue  # Try next language
            except (TranscriptsDisabled, VideoUnavailable) as e:
                # Permanent failures - don't try other languages
                logger.debug(f"Transcript unavailable for {video_id}: {type(e).__name__}")
                break  # Exit loop and return None

        # No transcript in any language - cache the miss
        if self.redis:
            await self.redis.setex(cache_key, 3600, json.dumps(None))

        return None

    async def get_batch_metadata(
        self,
        video_ids: list[str]
    ) -> list[dict]:
        """
        Fetch metadata for multiple videos in one API call.

        YouTube API allows fetching up to 50 videos per request.
        This method automatically batches requests if more than 50 videos.

        Args:
            video_ids: List of YouTube video IDs (max 50 per batch)

        Returns:
            List of metadata dicts, one per video. Format matches get_video_metadata().
            Videos not found are omitted from results.

        Example:
            >>> results = await client.get_batch_metadata(["VIDEO_1", "VIDEO_2"])
            >>> print(results[0]["title"])
            "Python Tutorial"
        """
        if not video_ids:
            return []

        # YouTube API limit: 50 videos per request
        BATCH_SIZE = 50
        all_results = []

        # Process in batches of 50
        for i in range(0, len(video_ids), BATCH_SIZE):
            batch = video_ids[i:i + BATCH_SIZE]

            # Check Redis cache for each video
            cached_results = []
            uncached_ids = []

            if self.redis:
                for video_id in batch:
                    cache_key = f"youtube:v1:video:{video_id}"
                    cached = await self.redis.get(cache_key)

                    if cached:
                        try:
                            cached_data = json.loads(cached)
                            # Convert from old format (video_id) to new format (youtube_id)
                            if "video_id" in cached_data:
                                cached_data["youtube_id"] = cached_data.pop("video_id")
                            cached_results.append(cached_data)
                            logger.info(f"Cache HIT for video {video_id}")
                        except json.JSONDecodeError:
                            # Cache corrupted, fetch fresh
                            uncached_ids.append(video_id)
                    else:
                        uncached_ids.append(video_id)
            else:
                # No Redis, fetch all
                uncached_ids = batch

            # Add cached results
            all_results.extend(cached_results)

            # Fetch uncached videos from API
            if uncached_ids:
                try:
                    # Join video IDs with comma for batch request
                    ids_param = ",".join(uncached_ids)

                    url = "https://www.googleapis.com/youtube/v3/videos"
                    params = {
                        "part": "snippet,contentDetails,statistics,status",
                        "id": ids_param,
                        "key": self.api_key,
                    }

                    async with httpx.AsyncClient(timeout=30.0) as client:
                        response = await client.get(url, params=params)
                        response.raise_for_status()
                        data = response.json()

                    # Parse each video in response
                    for item in data.get("items", []):
                        video_id = item["id"]
                        snippet = item.get("snippet", {})
                        content_details = item.get("contentDetails", {})
                        statistics = item.get("statistics", {})
                        status = item.get("status", {})

                        # Get highest quality thumbnail available (same as get_video_metadata)
                        thumbnails = snippet.get("thumbnails", {})
                        thumbnail_url = (
                            thumbnails.get("maxres", {}).get("url") or
                            thumbnails.get("standard", {}).get("url") or
                            thumbnails.get("high", {}).get("url") or
                            thumbnails.get("medium", {}).get("url") or
                            thumbnails.get("default", {}).get("url", "")
                        )

                        metadata = {
                            "youtube_id": video_id,
                            "title": snippet.get("title", "Unknown Title"),
                            "channel": snippet.get("channelTitle", "Unknown Channel"),
                            "channel_id": snippet.get("channelId"),  # YouTube channel ID
                            "published_at": snippet.get("publishedAt"),
                            "duration": content_details.get("duration", "PT0S"),
                            "thumbnail_url": thumbnail_url,
                            # Extended snippet
                            "description": snippet.get("description", ""),
                            "youtube_tags": snippet.get("tags", []),
                            "youtube_category_id": snippet.get("categoryId"),
                            "default_language": snippet.get("defaultLanguage"),
                            # Content details
                            "dimension": content_details.get("dimension"),
                            "definition": content_details.get("definition"),
                            "has_captions": content_details.get("caption") == "true",
                            "region_restriction": content_details.get("regionRestriction"),
                            # Statistics
                            "view_count": int(statistics.get("viewCount", 0)) if statistics.get("viewCount") else None,
                            "like_count": int(statistics.get("likeCount", 0)) if statistics.get("likeCount") else None,
                            "comment_count": int(statistics.get("commentCount", 0)) if statistics.get("commentCount") else None,
                            # Status
                            "privacy_status": status.get("privacyStatus"),
                            "is_embeddable": status.get("embeddable"),
                        }

                        # Cache for 7 days (same as get_video_metadata)
                        if self.redis:
                            cache_key = f"youtube:v1:video:{video_id}"
                            ttl = 7 * 24 * 3600 + random.randint(0, 3600)  # Add jitter
                            # Store with old format key for compatibility
                            cache_data = {**metadata, "video_id": video_id}
                            await self.redis.setex(
                                cache_key,
                                ttl,
                                json.dumps(cache_data)
                            )

                        all_results.append(metadata)

                    logger.info(
                        f"Fetched {len(data.get('items', []))} videos from YouTube API "
                        f"(batch of {len(uncached_ids)})"
                    )

                except httpx.HTTPError as e:
                    logger.error(f"YouTube API batch request failed: {e}")
                    # Continue with partial results rather than failing completely

        return all_results
