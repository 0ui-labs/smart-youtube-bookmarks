"""ARQ worker for processing YouTube videos."""
from uuid import UUID
from arq import Retry
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import Video, ProcessingJob
from app.clients.youtube import YouTubeClient
from app.core.config import settings
from app.core.redis import get_redis_client
from datetime import datetime
from isodate import parse_duration
import logging

logger = logging.getLogger(__name__)


def _parse_duration(iso_duration: str | None) -> int | None:
    """Parse ISO 8601 duration to seconds."""
    if not iso_duration:
        return None
    try:
        duration_obj = parse_duration(iso_duration)
        return int(duration_obj.total_seconds())
    except Exception as e:
        logger.debug(f"Invalid duration format '{iso_duration}': {e}")
        return None


def _parse_timestamp(timestamp: str | None) -> datetime | None:
    """Parse YouTube API timestamp to timezone-aware datetime."""
    if not timestamp:
        return None
    try:
        return datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
    except (ValueError, AttributeError) as e:
        logger.debug(f"Invalid timestamp format '{timestamp}': {e}")
        return None


async def process_video(
    ctx: dict,
    video_id: str,
    list_id: str,
    schema: dict,
    job_id: str
) -> dict:
    """
    Process a single video:
    1. Fetch YouTube metadata
    2. Get transcript
    3. Extract data via Gemini
    4. Update database
    5. Update parent job progress

    Args:
        ctx: ARQ job context (contains db session)
        video_id: UUID of video to process
        list_id: UUID of parent list
        schema: Extraction schema for Gemini
        job_id: UUID of parent ProcessingJob for progress tracking

    Returns:
        dict: Processing result with status
    """
    db: AsyncSession = ctx['db']

    video = None
    try:
        # Fetch video from database
        video = await db.get(Video, UUID(video_id))
        if not video:
            logger.error(f"Video {video_id} not found")
            await _update_job_progress(db, job_id, success=False)
            return {"status": "error", "message": "Video not found"}

        # Idempotency check - skip if already completed
        if video.processing_status == "completed":
            logger.info(f"Video {video_id} already processed")
            await _update_job_progress(db, job_id, success=True)
            return {"status": "already_completed", "video_id": video_id}

        # Mark as processing
        video.processing_status = "processing"
        await db.flush()

        # Fetch YouTube metadata
        redis_client = await get_redis_client()
        youtube_client = YouTubeClient(
            api_key=settings.youtube_api_key,
            redis_client=redis_client
        )

        try:
            metadata = await youtube_client.get_video_metadata(video.youtube_id)

            # Update video with metadata
            video.title = metadata.get("title")
            video.channel = metadata.get("channel")
            video.thumbnail_url = metadata.get("thumbnail_url")
            video.duration = _parse_duration(metadata.get("duration"))
            video.published_at = _parse_timestamp(metadata.get("published_at"))

            # TODO: Get transcript and extract via Gemini
            # For now, just store YouTube metadata

            video.processing_status = "completed"
            video.error_message = None  # Clear error from previous failed attempts
            await db.flush()

            # Get user_id for WebSocket publishing
            from app.models.list import BookmarkList
            list_result = await db.execute(
                select(BookmarkList.user_id).where(BookmarkList.id == video.list_id)
            )
            user_id = list_result.scalar_one_or_none()

            # Publish WebSocket update for instant UI refresh
            if user_id:
                await _publish_video_update(redis_client, video, job_id, str(user_id))
            else:
                logger.warning(f"Cannot publish update: no user_id for video {video.id}")

        except Exception as e:
            logger.exception(f"Failed to fetch YouTube metadata for video {video_id}")
            raise

        # Update parent job progress (successful processing)
        await _update_job_progress(db, job_id, success=True)

        return {"status": "success", "video_id": video_id}

    except Retry:
        # Let ARQ handle retry
        raise
    except Exception as e:
        logger.error(f"Error processing video {video_id}: {e}")
        # Mark as failed (only if video was fetched)
        if video:
            video.processing_status = "failed"
            video.error_message = str(e)
            await db.flush()

        # Update parent job progress (failed processing)
        await _update_job_progress(db, job_id, success=False)

        raise


async def process_video_list(
    ctx: dict,
    job_id: str,
    list_id: str,
    video_ids: list[str],
    schema: dict
) -> dict:
    """
    Process a list of videos in batch (for CSV bulk upload).

    This worker processes multiple videos sequentially, calling process_video
    for each one. It's designed for bulk CSV uploads.

    Args:
        ctx: ARQ job context (contains db session)
        job_id: UUID of ProcessingJob for progress tracking
        list_id: UUID of parent list
        video_ids: List of video UUIDs to process
        schema: Extraction schema for Gemini

    Returns:
        dict: Processing result with status and counts
    """
    db: AsyncSession = ctx['db']

    logger.info(f"Processing video list job {job_id} with {len(video_ids)} videos")

    processed_count = 0
    failed_count = 0

    for video_id in video_ids:
        try:
            # Process each video individually
            result = await process_video(
                ctx,
                video_id,
                list_id,
                schema,
                job_id
            )

            if result['status'] in ('success', 'already_completed'):
                processed_count += 1
            else:
                failed_count += 1

        except Exception as e:
            logger.exception(f"Failed to process video {video_id} in batch")
            failed_count += 1
            # Continue processing other videos

    logger.info(
        f"Batch job {job_id} completed: {processed_count} succeeded, "
        f"{failed_count} failed out of {len(video_ids)} total"
    )

    return {
        "status": "success",
        "processed": processed_count,
        "failed": failed_count,
        "total": len(video_ids)
    }


async def _publish_video_update(redis_client, video, job_id: str, user_id: str) -> None:
    """
    Publish WebSocket update when video processing completes.

    Sends instant notification to frontend via Redis Pub/Sub.

    Args:
        redis_client: Redis client instance
        video: Processed Video object
        job_id: UUID of parent ProcessingJob
        user_id: UUID of user who owns the video's list
    """
    try:
        import json

        # Prepare progress update message
        update_message = {
            "job_id": job_id,
            "video_id": str(video.id),
            "status": video.processing_status,
            "title": video.title,
            "channel": video.channel,
            "thumbnail_url": video.thumbnail_url,
            "message": f"Video '{video.title}' processed successfully"
        }

        # Publish to user-specific channel
        channel = f"progress:user:{user_id}"
        await redis_client.publish(channel, json.dumps(update_message))
        logger.info(f"Published WebSocket update for video {video.id} to {channel}")

    except Exception as e:
        # Don't fail processing if WebSocket publish fails
        logger.exception("Failed to publish WebSocket update")


async def _update_job_progress(db: AsyncSession, job_id: str, success: bool) -> None:
    """
    Update parent ProcessingJob progress counters.

    Args:
        db: Database session
        job_id: UUID of ProcessingJob
        success: Whether video processing succeeded
    """
    try:
        result = await db.execute(
            select(ProcessingJob).where(ProcessingJob.id == UUID(job_id))
        )
        parent_job = result.scalar_one_or_none()

        if not parent_job:
            logger.warning(f"Parent job {job_id} not found for progress update")
            return

        # Increment counters
        if success:
            parent_job.processed_count += 1
        else:
            parent_job.failed_count += 1

        # Auto-complete job when all videos processed
        total_processed = parent_job.processed_count + parent_job.failed_count
        if total_processed >= parent_job.total_videos:
            if parent_job.failed_count == 0:
                parent_job.status = "completed"
            else:
                parent_job.status = "completed_with_errors"
            logger.info(
                f"Job {job_id} completed: {parent_job.processed_count}/{parent_job.total_videos} succeeded, "
                f"{parent_job.failed_count} failed"
            )

        await db.flush()

    except Exception as e:
        logger.error(f"Failed to update job progress for job {job_id}: {e}")
        # Don't raise - progress update failure shouldn't fail video processing
