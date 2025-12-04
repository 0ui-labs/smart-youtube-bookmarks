"""
ARQ worker functions for subscription-related background tasks.

Handles:
- PubSubHubbub notifications (new video from channel)
- Lease renewals for PubSubHubbub subscriptions
"""

import logging
from datetime import datetime, timedelta
from typing import Any
from uuid import UUID

from isodate import parse_duration
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.clients.youtube import YouTubeClient
from app.core.config import settings
from app.core.redis import get_redis_client
from app.models import Video
from app.models.subscription import Subscription, SubscriptionMatch
from app.services.channel_service import get_or_create_channel
from app.services.pubsub_service import PubSubHubbubService

logger = logging.getLogger(__name__)


def _parse_duration_to_seconds(iso_duration: str | None) -> int | None:
    """Parse ISO 8601 duration to seconds."""
    if not iso_duration:
        return None
    try:
        duration_obj = parse_duration(iso_duration)
        return int(duration_obj.total_seconds())
    except Exception as e:
        logger.debug(f"Invalid duration format '{iso_duration}': {e}")
        return None


async def process_pubsub_notification(
    ctx: dict,
    video_id: str,
    channel_id: str,
) -> dict[str, Any]:
    """
    Process a PubSubHubbub notification for a new video.

    When YouTube notifies us of a new video via PubSubHubbub:
    1. Find all active subscriptions matching this channel
    2. Fetch video details from YouTube API
    3. Apply subscription filters (duration, views, keywords)
    4. Create video in target list if filters pass
    5. Create SubscriptionMatch record

    Args:
        ctx: ARQ context with db session
        video_id: YouTube video ID
        channel_id: YouTube channel ID

    Returns:
        Status dict with created count
    """
    db: AsyncSession = ctx["db"]

    logger.info(f"Processing PubSub notification: video={video_id}, channel={channel_id}")

    # Find subscriptions matching this channel
    query = select(Subscription).where(
        Subscription.is_active == True,  # noqa: E712
        Subscription.channel_ids.contains([channel_id]),
    )
    result = await db.execute(query)
    subscriptions = result.scalars().all()

    if not subscriptions:
        logger.debug(f"No subscriptions match channel {channel_id}")
        return {"status": "no_matching_subscriptions", "created": 0}

    logger.info(f"Found {len(subscriptions)} subscriptions matching channel {channel_id}")

    # Fetch video details from YouTube
    try:
        redis_client = await get_redis_client()
        youtube = YouTubeClient(settings.youtube_api_key, redis_client)
        video_data = await youtube.get_video_metadata(video_id)
    except ValueError as e:
        logger.warning(f"Video {video_id} not found on YouTube: {e}")
        return {"status": "video_not_found", "created": 0}
    except Exception as e:
        logger.error(f"Failed to fetch video {video_id}: {e}")
        raise

    # Process each matching subscription
    created_count = 0
    for subscription in subscriptions:
        try:
            created = await _process_subscription_match(
                db, subscription, video_id, video_data
            )
            if created:
                created_count += 1
        except Exception as e:
            logger.error(
                f"Failed to process subscription {subscription.id} for video {video_id}: {e}"
            )

    await db.commit()

    logger.info(f"PubSub notification processed: created {created_count} videos")
    return {"status": "ok", "created": created_count}


async def _process_subscription_match(
    db: AsyncSession,
    subscription: Subscription,
    video_id: str,
    video_data: dict[str, Any],
) -> bool:
    """
    Process a single subscription match for a video.

    Returns True if video was created, False otherwise.
    """
    # Check if video already exists in this list
    existing = await db.execute(
        select(Video).where(
            Video.youtube_id == video_id,
            Video.list_id == subscription.list_id,
        )
    )
    if existing.scalar_one_or_none():
        logger.debug(
            f"Video {video_id} already exists in list {subscription.list_id}"
        )
        return False

    # Apply subscription filters
    if not _apply_filters(video_data, subscription):
        logger.debug(
            f"Video {video_id} did not pass filters for subscription {subscription.id}"
        )
        return False

    # Get or create channel
    channel = await get_or_create_channel(
        db,
        channel_id=video_data.get("channel_id", ""),
        channel_name=video_data.get("channel", "Unknown"),
    )

    # Parse duration
    duration_seconds = _parse_duration_to_seconds(video_data.get("duration"))

    # Parse published_at
    published_at = None
    if video_data.get("published_at"):
        try:
            published_at = datetime.fromisoformat(
                video_data["published_at"].replace("Z", "+00:00")
            )
        except (ValueError, AttributeError):
            pass

    # Create video
    video = Video(
        list_id=subscription.list_id,
        youtube_id=video_id,
        title=video_data.get("title", ""),
        description=video_data.get("description", ""),
        channel_id=channel.id,
        thumbnail_url=video_data.get("thumbnail_url", ""),
        published_at=published_at,
        duration_seconds=duration_seconds,
        view_count=video_data.get("view_count"),
        like_count=video_data.get("like_count"),
        comment_count=video_data.get("comment_count"),
        youtube_category_id=video_data.get("youtube_category_id"),
        youtube_tags=video_data.get("youtube_tags", []),
        processing_status="completed",
        source="subscription",
    )
    db.add(video)
    await db.flush()  # Get video.id

    # Create match record
    match = SubscriptionMatch(
        subscription_id=subscription.id,
        video_id=video.id,
        source="pubsub",
    )
    db.add(match)

    # Update subscription stats
    subscription.match_count += 1

    logger.info(
        f"Created video {video_id} in list {subscription.list_id} "
        f"from subscription {subscription.id}"
    )

    return True


def _apply_filters(video_data: dict[str, Any], subscription: Subscription) -> bool:
    """
    Check if video passes subscription filters.

    Filters include:
    - duration: min/max seconds
    - views: minimum view count
    - keywords: must match in title or description (if subscription has keywords)

    Returns True if video passes all filters.
    """
    filters = subscription.filters or {}

    # Duration filter
    if duration_filter := filters.get("duration"):
        duration_seconds = _parse_duration_to_seconds(video_data.get("duration"))
        if duration_seconds is not None:
            min_seconds = duration_filter.get("min_seconds")
            max_seconds = duration_filter.get("max_seconds")

            if min_seconds and duration_seconds < min_seconds:
                return False
            if max_seconds and duration_seconds > max_seconds:
                return False

    # Views filter
    if views_filter := filters.get("views"):
        view_count = video_data.get("view_count", 0)
        min_views = views_filter.get("min_views")

        if min_views and view_count < min_views:
            return False

    # YouTube category filter
    if category_filter := filters.get("youtube_category"):
        video_category = video_data.get("youtube_category_id")
        allowed_categories = category_filter.get("category_ids", [])

        if allowed_categories and video_category not in allowed_categories:
            return False

    # Keyword filter (for channel subscriptions that also have keywords)
    if subscription.keywords:
        title = video_data.get("title", "").lower()
        description = video_data.get("description", "").lower()

        if not any(
            kw.lower() in title or kw.lower() in description
            for kw in subscription.keywords
        ):
            return False

    return True


async def renew_pubsub_leases(ctx: dict) -> dict[str, Any]:
    """
    Renew PubSubHubbub leases that are expiring soon.

    PubSubHubbub subscriptions have a lease duration (default 10 days).
    This job finds subscriptions expiring within 24 hours and renews them.

    Should be run as a cron job every 12 hours.

    Args:
        ctx: ARQ context with db session

    Returns:
        Status dict with renewed count
    """
    db: AsyncSession = ctx["db"]

    logger.info("Starting PubSubHubbub lease renewal check")

    # Find subscriptions with expiring leases (within 24 hours)
    threshold = datetime.utcnow() + timedelta(hours=24)

    query = select(Subscription).where(
        Subscription.is_active == True,  # noqa: E712
        Subscription.pubsub_expires_at < threshold,
        Subscription.channel_ids != None,  # noqa: E711
    )
    result = await db.execute(query)
    subscriptions = result.scalars().all()

    if not subscriptions:
        logger.debug("No PubSubHubbub leases need renewal")
        return {"status": "ok", "renewed": 0}

    logger.info(f"Found {len(subscriptions)} subscriptions with expiring leases")

    renewed_count = 0
    async with PubSubHubbubService() as pubsub:
        for subscription in subscriptions:
            channel_ids = subscription.channel_ids or []

            for channel_id in channel_ids:
                try:
                    success = await pubsub.subscribe(channel_id)

                    if success:
                        renewed_count += 1
                        logger.info(
                            f"Renewed lease for channel {channel_id} "
                            f"(subscription {subscription.id})"
                        )
                    else:
                        logger.warning(
                            f"Failed to renew lease for channel {channel_id}"
                        )
                except Exception as e:
                    logger.error(
                        f"Error renewing lease for channel {channel_id}: {e}"
                    )

            # Update expiry timestamp (10 days from now)
            subscription.pubsub_expires_at = datetime.utcnow() + timedelta(days=10)

    await db.commit()

    logger.info(f"PubSubHubbub lease renewal complete: renewed {renewed_count} leases")
    return {"status": "ok", "renewed": renewed_count}
