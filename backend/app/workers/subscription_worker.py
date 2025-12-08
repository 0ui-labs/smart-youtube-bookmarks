"""
ARQ worker functions for subscription-related background tasks.

Handles:
- PubSubHubbub notifications (new video from channel)
- Lease renewals for PubSubHubbub subscriptions
- YouTube Search polling for keyword-based subscriptions (Etappe 3)
"""

import logging
from datetime import datetime, timedelta
from typing import Any
from uuid import UUID

from isodate import parse_duration
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.clients.youtube import VideoMetadata, VideoSearchResult, YouTubeClient
from app.core.config import settings
from app.core.redis import get_redis_client
from app.models import Video
from app.models.subscription import Subscription, SubscriptionMatch
from app.services.channel_service import get_or_create_channel
from app.services.comments_service import CommentsService
from app.services.pubsub_service import PubSubHubbubService
from app.services.quota_service import QuotaService
from app.services.video_pre_filter_service import VideoPreFilterService

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
    ctx: dict[str, Any],
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

    logger.info(
        f"Processing PubSub notification: video={video_id}, channel={channel_id}"
    )

    # Find subscriptions matching this channel
    query = select(Subscription).where(
        Subscription.is_active == True,
        Subscription.channel_ids.contains([channel_id]),
    )
    result = await db.execute(query)
    subscriptions = result.scalars().all()

    if not subscriptions:
        logger.debug(f"No subscriptions match channel {channel_id}")
        return {"status": "no_matching_subscriptions", "created": 0}

    logger.info(
        f"Found {len(subscriptions)} subscriptions matching channel {channel_id}"
    )

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
    video_data: VideoMetadata,
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
        logger.debug(f"Video {video_id} already exists in list {subscription.list_id}")
        return False

    # Apply subscription filters
    if not _apply_filters(video_data, subscription):
        logger.debug(
            f"Video {video_id} did not pass filters for subscription {subscription.id}"
        )
        return False

    # Apply AI filter if enabled
    ai_filter_settings = (subscription.filters or {}).get("ai_filter", {})
    if ai_filter_settings.get("enabled", True):
        # Create VideoSearchResult for AI analysis
        video_result = VideoSearchResult(
            youtube_id=video_id,
            title=video_data.get("title", ""),
            description=video_data.get("description", ""),
            channel_id=video_data.get("channel_id", ""),
            channel_name=video_data.get("channel", "Unknown"),
            thumbnail_url=video_data.get("thumbnail_url", ""),
            published_at=datetime.fromisoformat(
                video_data.get("published_at", "2024-01-01T00:00:00Z").replace(
                    "Z", "+00:00"
                )
            ),
        )

        pre_filter = VideoPreFilterService()
        filtered = await pre_filter.filter_videos([video_result], subscription)

        if not filtered:
            logger.info(
                f"Video {video_id} filtered out by AI for subscription {subscription.id}"
            )
            return False

    # Get or create channel
    channel = await get_or_create_channel(
        db,
        user_id=subscription.user_id,
        youtube_channel_id=video_data.get("channel_id", ""),
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


def _apply_filters(video_data: VideoMetadata, subscription: Subscription) -> bool:
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


async def renew_pubsub_leases(ctx: dict[str, Any]) -> dict[str, Any]:
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
        Subscription.is_active == True,
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
                    logger.error(f"Error renewing lease for channel {channel_id}: {e}")

            # Update expiry timestamp (10 days from now)
            subscription.pubsub_expires_at = datetime.utcnow() + timedelta(days=10)

    await db.commit()

    logger.info(f"PubSubHubbub lease renewal complete: renewed {renewed_count} leases")
    return {"status": "ok", "renewed": renewed_count}


async def poll_due_subscriptions(ctx: dict[str, Any]) -> dict[str, Any]:
    """
    Find and enqueue subscriptions that need polling.

    This cron job runs every 15 minutes and finds keyword-based
    subscriptions where next_poll_at < now().

    Channel-only subscriptions are handled by PubSubHubbub, not polling.

    Args:
        ctx: ARQ context with db session and redis

    Returns:
        Status dict with number of enqueued jobs
    """
    db: AsyncSession = ctx["db"]
    redis = ctx["redis"]

    logger.info("Starting poll_due_subscriptions check")

    # Check quota first
    redis_client = await get_redis_client()
    quota = QuotaService(redis_client=redis_client)

    if not await quota.is_quota_available(100):
        logger.warning("Quota exhausted, skipping subscription polling")
        return {"status": "quota_exhausted", "enqueued": 0}

    now = datetime.utcnow()

    # Find due subscriptions with keywords (channel-only handled by PubSub)
    query = (
        select(Subscription)
        .where(
            Subscription.is_active == True,
            Subscription.next_poll_at <= now,
            Subscription.keywords != None,  # noqa: E711 - Must have keywords
        )
        .limit(10)  # Batch size to avoid overwhelming the system
    )

    result = await db.execute(query)
    subscriptions = result.scalars().all()

    if not subscriptions:
        logger.debug("No subscriptions due for polling")
        return {"status": "ok", "enqueued": 0}

    logger.info(f"Found {len(subscriptions)} subscriptions due for polling")

    # Enqueue individual poll jobs
    enqueued = 0
    for sub in subscriptions:
        try:
            await redis.enqueue_job("poll_subscription", subscription_id=str(sub.id))
            enqueued += 1
            logger.debug(f"Enqueued poll_subscription for {sub.id}")
        except Exception as e:
            logger.error(f"Failed to enqueue poll_subscription for {sub.id}: {e}")

    logger.info(f"poll_due_subscriptions complete: enqueued {enqueued} jobs")
    return {"status": "ok", "enqueued": enqueued}


async def poll_subscription(
    ctx: dict[str, Any], subscription_id: str
) -> dict[str, Any]:
    """
    Poll a single subscription for new videos using YouTube Search API.

    This worker:
    1. Fetches videos matching keywords from YouTube Search
    2. Applies subscription filters (duration, views, etc.)
    3. Creates Video records for new matches
    4. Creates SubscriptionMatch records
    5. Updates subscription timestamps

    Args:
        ctx: ARQ context with db session
        subscription_id: UUID of subscription to poll

    Returns:
        Status dict with number of new videos created
    """
    db: AsyncSession = ctx["db"]

    logger.info(f"Polling subscription {subscription_id}")

    # Get subscription
    try:
        sub_uuid = UUID(subscription_id)
    except ValueError:
        return {"status": "invalid_id"}

    result = await db.execute(
        select(Subscription).where(
            Subscription.id == sub_uuid,
            Subscription.is_active == True,
        )
    )
    sub = result.scalar_one_or_none()

    if not sub:
        logger.warning(f"Subscription {subscription_id} not found or inactive")
        return {"status": "not_found_or_inactive"}

    # Check quota
    redis_client = await get_redis_client()
    quota = QuotaService(redis_client=redis_client)

    if not await quota.is_quota_available(100):
        # Set error and schedule retry for later
        sub.error_message = "YouTube API Quota exhausted"
        sub.next_poll_at = datetime.utcnow() + timedelta(hours=24)
        await db.commit()
        logger.warning(f"Quota exhausted, deferring subscription {subscription_id}")
        return {"status": "quota_exhausted"}

    try:
        youtube = YouTubeClient(
            api_key=settings.youtube_api_key, redis_client=redis_client
        )

        # Search for videos with keywords
        search_results = await youtube.search_videos(
            keywords=sub.keywords or [],
            published_after=sub.last_polled_at,
            max_results=25,
        )

        # Track quota usage (Search API = 100 units)
        await quota.track_usage(100)

        if not search_results:
            await _update_poll_times(db, sub)
            await db.commit()
            return {"status": "no_results", "new_videos": 0}

        # Apply filters to search results
        filtered = _apply_search_filters(search_results, sub)

        # Apply channel filter if both keywords AND channels specified
        if sub.channel_ids:
            filtered = [v for v in filtered if v.channel_id in sub.channel_ids]

        # Apply AI filter if enabled
        ai_filter_settings = (sub.filters or {}).get("ai_filter", {})
        if ai_filter_settings.get("enabled", True) and filtered:
            pre_filter = VideoPreFilterService()
            filtered = await pre_filter.filter_videos(filtered, sub)

            logger.info(
                f"AI filter applied: {len(filtered)} videos passed "
                f"for subscription {sub.id}"
            )

            # Optional: Detail analysis with transcript for remaining videos
            if ai_filter_settings.get("use_transcript", False) and filtered:
                comments_service = CommentsService(quota_service=quota)
                final_filtered = []

                for video in filtered:
                    # Get transcript (already cached in YouTubeClient)
                    transcript = await youtube.get_video_transcript(video.youtube_id)

                    # Get comments if enabled
                    comments = None
                    if ai_filter_settings.get("use_comments", False):
                        comments = await comments_service.get_top_comments(
                            video.youtube_id, limit=10
                        )

                    # Perform detail analysis
                    result = await pre_filter.analyze_with_transcript(
                        video, sub, transcript, comments
                    )

                    if result.recommendation == "IMPORT":
                        final_filtered.append(video)
                    else:
                        logger.debug(
                            f"Video {video.youtube_id} skipped by detail analysis: "
                            f"{result.reasoning}"
                        )

                filtered = final_filtered
                logger.info(f"Detail analysis complete: {len(filtered)} videos passed")

        # Create videos for filtered results
        created = 0
        for video_result in filtered:
            # Check if video already exists in this list
            existing = await db.execute(
                select(Video).where(
                    Video.youtube_id == video_result.youtube_id,
                    Video.list_id == sub.list_id,
                )
            )
            if existing.scalar_one_or_none():
                continue

            # Get or create channel
            channel = await get_or_create_channel(
                db,
                user_id=sub.user_id,
                youtube_channel_id=video_result.channel_id,
                channel_name=video_result.channel_name,
            )

            # Create video
            video = Video(
                list_id=sub.list_id,
                youtube_id=video_result.youtube_id,
                title=video_result.title,
                description=video_result.description,
                channel_id=channel.id,
                thumbnail_url=video_result.thumbnail_url,
                published_at=video_result.published_at,
                duration_seconds=video_result.duration_seconds,
                view_count=video_result.view_count,
                processing_status="completed",
                source="subscription",
            )
            db.add(video)
            await db.flush()  # Get video.id

            # Create match record
            match = SubscriptionMatch(
                subscription_id=sub.id,
                video_id=video.id,
                source="search",
            )
            db.add(match)
            created += 1

        # Update subscription stats
        sub.match_count += created
        sub.error_message = None
        await _update_poll_times(db, sub)

        await db.commit()

        logger.info(
            f"Subscription {subscription_id} polled: created {created} videos "
            f"from {len(search_results)} search results"
        )
        return {"status": "ok", "new_videos": created}

    except Exception as e:
        sub.error_message = str(e)
        await db.commit()
        logger.error(f"Failed to poll subscription {subscription_id}: {e}")
        raise


async def _update_poll_times(db: AsyncSession, subscription: Subscription) -> None:
    """
    Update poll timestamps based on subscription interval.

    Args:
        db: Database session
        subscription: Subscription to update
    """
    subscription.last_polled_at = datetime.utcnow()

    intervals = {
        "hourly": timedelta(hours=1),
        "daily": timedelta(days=1),
        "twice_daily": timedelta(hours=12),
    }
    delta = intervals.get(subscription.poll_interval, timedelta(days=1))
    subscription.next_poll_at = datetime.utcnow() + delta


def _apply_search_filters(
    videos: list[VideoSearchResult], subscription: Subscription
) -> list[VideoSearchResult]:
    """
    Apply subscription filters to search results.

    Args:
        videos: List of search results
        subscription: Subscription with filter config

    Returns:
        Filtered list of videos
    """
    filters = subscription.filters or {}
    result = videos

    # Duration filter
    if duration := filters.get("duration"):
        min_sec = duration.get("min_seconds", 0)
        max_sec = duration.get("max_seconds", float("inf"))
        result = [
            v
            for v in result
            if v.duration_seconds is not None
            and min_sec <= v.duration_seconds <= max_sec
        ]

    # Views filter
    if views := filters.get("views"):
        min_views = views.get("min_views", 0)
        result = [v for v in result if (v.view_count or 0) >= min_views]

    return result
