"""ARQ worker for video enrichment processing with progress tracking.

This worker handles video enrichment (captions, chapters) with:
- Progress stage tracking (50% captions, 75% chapters, 100% complete)
- WebSocket broadcast for real-time UI updates
- Rate limiting via AdaptiveRateLimiter
"""
import json
import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.video import Video
from app.models.list import BookmarkList
from app.services.enrichment.enrichment_service import EnrichmentService
from app.services.rate_limiter import AdaptiveRateLimiter

logger = logging.getLogger(__name__)

# Module-level rate limiter for enrichment requests
# Limits concurrent YouTube API calls to prevent 429 errors
_enrichment_rate_limiter = AdaptiveRateLimiter(
    max_concurrent=3,
    base_delay=2.0,
    max_delay=60.0,
    failure_threshold=5
)


async def update_stage(db: AsyncSession, video: Video, stage: str, progress: int) -> None:
    """
    Update video import stage and progress.

    Args:
        db: Database session
        video: Video model instance
        stage: New import stage (created, metadata, captions, chapters, complete, error)
        progress: Progress percentage (0-100)
    """
    video.import_stage = stage
    video.import_progress = progress
    await db.flush()


async def publish_progress(redis, user_id: str, video_id: str, progress: int, stage: str) -> None:
    """
    Publish import progress update via Redis Pub/Sub.

    Args:
        redis: Redis client instance
        user_id: UUID of user (for channel routing)
        video_id: UUID of video
        progress: Progress percentage (0-100)
        stage: Current import stage
    """
    message = {
        "type": "import_progress",
        "video_id": video_id,
        "progress": progress,
        "stage": stage
    }

    channel = f"progress:user:{user_id}"
    try:
        # ARQ's ArqRedis supports publish via the underlying redis connection
        await redis.publish(channel, json.dumps(message))
        logger.warning(f"✓ Published progress: video={video_id[:8]}... {progress}% ({stage}) -> channel={channel}")
    except Exception as e:
        logger.error(f"✗ Failed to publish progress: {e}")


async def enrich_video(ctx: dict, video_id: str) -> dict:
    """
    Enrich a single video with captions, chapters, and thumbnails.

    Updates import_stage/import_progress and broadcasts via WebSocket:
    - 50%: captions stage
    - 75%: chapters stage
    - 100%: complete/error

    Args:
        ctx: ARQ job context (contains db session and redis)
        video_id: UUID of video to enrich

    Returns:
        dict: Processing result with status and message
    """
    db: AsyncSession = ctx['db']
    redis = ctx.get('redis')

    # Log context info for debugging WebSocket publishing
    logger.warning(f"[enrich_video] Starting enrichment for {video_id}, redis available: {redis is not None}")

    try:
        # Fetch video from database
        result = await db.execute(
            select(Video).where(Video.id == UUID(video_id))
        )
        video = result.scalar_one_or_none()

        if not video:
            logger.error(f"Video {video_id} not found for enrichment")
            return {
                "status": "error",
                "message": f"Video {video_id} not found"
            }

        # Get user_id for WebSocket broadcasting
        list_result = await db.execute(
            select(BookmarkList.user_id).where(BookmarkList.id == video.list_id)
        )
        user_id = list_result.scalar_one_or_none()

        # Stage: Captions (50%)
        await update_stage(db, video, "captions", 50)
        if redis and user_id:
            await publish_progress(redis, str(user_id), video_id, 50, "captions")

        # Run enrichment service with rate limiting
        async with _enrichment_rate_limiter.acquire():
            service = EnrichmentService(db)
            try:
                enrichment = await service.enrich_video(UUID(video_id))
                _enrichment_rate_limiter.on_success()
            except Exception as e:
                # Check if it's a rate limit error (429)
                is_rate_limit = "429" in str(e) or "rate limit" in str(e).lower()
                _enrichment_rate_limiter.on_failure(is_rate_limit=is_rate_limit)
                raise

        # Stage: Chapters (75%)
        await update_stage(db, video, "chapters", 75)
        if redis and user_id:
            await publish_progress(redis, str(user_id), video_id, 75, "chapters")

        # Determine final stage based on enrichment status
        from app.models.video_enrichment import EnrichmentStatus

        if enrichment.status == EnrichmentStatus.failed:
            # Stage: Error (100%)
            await update_stage(db, video, "error", 100)
            if redis and user_id:
                await publish_progress(redis, str(user_id), video_id, 100, "error")
        else:
            # Stage: Complete (100%)
            await update_stage(db, video, "complete", 100)
            if redis and user_id:
                await publish_progress(redis, str(user_id), video_id, 100, "complete")

        await db.commit()

        logger.info(
            f"Enrichment completed for video {video_id} with status {enrichment.status}"
        )

        return {
            "status": enrichment.status.value if hasattr(enrichment.status, 'value') else str(enrichment.status),
            "video_id": video_id,
            "enrichment_id": str(enrichment.id) if enrichment.id else None
        }

    except Exception as e:
        logger.exception(f"Error enriching video {video_id}")

        # Try to set error state
        try:
            video = await db.get(Video, UUID(video_id))
            if video:
                await update_stage(db, video, "error", 100)

                # Broadcast error state
                if redis:
                    list_result = await db.execute(
                        select(BookmarkList.user_id).where(BookmarkList.id == video.list_id)
                    )
                    user_id = list_result.scalar_one_or_none()
                    if user_id:
                        await publish_progress(redis, str(user_id), video_id, 100, "error")

                await db.commit()
        except Exception:
            pass

        return {
            "status": "error",
            "message": str(e),
            "video_id": video_id
        }
