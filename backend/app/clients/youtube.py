"""YouTube Data API v3 Client using aiogoogle"""
import asyncio
import json
import random
from typing import Optional
from aiogoogle import Aiogoogle
from redis.asyncio import Redis
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import (
    NoTranscriptFound,
    TranscriptsDisabled,
    VideoUnavailable
)


class YouTubeClient:
    """Async YouTube Data API v3 client with Redis caching"""

    def __init__(self, api_key: str, redis_client: Optional[Redis] = None):
        self.api_key = api_key
        self.redis = redis_client

    async def get_video_metadata(self, video_id: str) -> dict:
        """
        Fetch video metadata from YouTube Data API v3 with caching (7-day TTL)

        Args:
            video_id: YouTube video ID

        Returns:
            Dictionary with video metadata

        Raises:
            ValueError: If video not found
        """
        # Try cache first
        if self.redis:
            cache_key = f"youtube:video:{video_id}"
            cached = await self.redis.get(cache_key)
            if cached:
                return json.loads(cached)

        # Cache miss - fetch from API
        async with Aiogoogle(api_key=self.api_key) as aiogoogle:
            youtube_v3 = await aiogoogle.discover("youtube", "v3")

            request = youtube_v3.videos.list(
                part="snippet,contentDetails",
                id=video_id
            )

            response = await aiogoogle.as_api_key(request)

            # Check if video found
            if not response.get("items"):
                raise ValueError(f"Video not found: {video_id}")

            item = response["items"][0]
            snippet = item["snippet"]
            content_details = item["contentDetails"]

            metadata = {
                "video_id": video_id,
                "title": snippet["title"],
                "channel": snippet["channelTitle"],
                "published_at": snippet["publishedAt"],
                "thumbnail_url": snippet["thumbnails"]["default"]["url"],
                "duration": content_details["duration"]
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
            cache_key = f"youtube:transcript:{video_id}"
            cached = await self.redis.get(cache_key)
            if cached:
                return cached if cached != "null" else None

        # Cache miss - fetch transcript
        try:
            # Use asyncio.to_thread for sync API
            transcript_list = await asyncio.to_thread(
                YouTubeTranscriptApi.get_transcript,
                video_id,
                languages=['en']
            )

            # Concatenate text segments
            transcript_text = " ".join(
                segment["text"] for segment in transcript_list
            )

            # Store in cache with TTL (30 days)
            if self.redis:
                ttl = 30 * 24 * 3600
                await self.redis.setex(cache_key, ttl, transcript_text)

            return transcript_text

        except (NoTranscriptFound, TranscriptsDisabled, VideoUnavailable):
            # Cache the "not found" result to avoid repeated attempts
            if self.redis:
                await self.redis.setex(f"youtube:transcript:{video_id}", 3600, "null")
            return None
