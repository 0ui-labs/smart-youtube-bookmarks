"""ARQ worker for processing YouTube videos."""
from uuid import UUID
from arq import Retry
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import Video, ProcessingJob
from app.models.list import BookmarkList
from app.models.job_progress import JobProgressEvent
from app.clients.youtube import YouTubeClient
from app.services.channel_service import get_or_create_channel
from app.core.config import settings
from app.core.redis import get_redis_client, get_arq_pool
from app.models.video_enrichment import VideoEnrichment, EnrichmentStatus
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
            return {"status": "error", "message": "Video not found", "video_id": video_id}

        # Idempotency check - skip if already completed
        if video.processing_status == "completed":
            logger.info(f"Video {video_id} already processed")
            return {"status": "already_completed", "video_id": video_id}

        # Mark as processing
        video.processing_status = "processing"
        await db.flush()

        # Fetch YouTube metadata
        # Use redis from context if available (for testing), otherwise get singleton
        redis_client = ctx.get('redis') or await get_redis_client()
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

            # Extended YouTube metadata (snippet)
            video.description = metadata.get("description")
            video.youtube_tags = metadata.get("youtube_tags")
            video.youtube_category_id = metadata.get("youtube_category_id")
            video.default_language = metadata.get("default_language")

            # Content details
            video.dimension = metadata.get("dimension")
            video.definition = metadata.get("definition")
            video.has_captions = metadata.get("has_captions")
            video.region_restriction = metadata.get("region_restriction")

            # Statistics
            video.view_count = metadata.get("view_count")
            video.like_count = metadata.get("like_count")
            video.comment_count = metadata.get("comment_count")

            # Status
            video.privacy_status = metadata.get("privacy_status")
            video.is_embeddable = metadata.get("is_embeddable")

            # Create or get channel if channel_id is available
            youtube_channel_id = metadata.get("channel_id")
            if youtube_channel_id:
                # Get user_id from the video's list
                list_result = await db.execute(
                    select(BookmarkList.user_id).where(BookmarkList.id == video.list_id)
                )
                user_id = list_result.scalar_one_or_none()

                if user_id:
                    # Fetch channel info (thumbnail + description, cached for 30 days)
                    channel_info = await youtube_client.get_channel_info(youtube_channel_id)

                    channel = await get_or_create_channel(
                        db=db,
                        user_id=user_id,
                        youtube_channel_id=youtube_channel_id,
                        channel_name=metadata.get("channel", "Unknown Channel"),
                        channel_thumbnail=channel_info.get("thumbnail_url"),
                        channel_description=channel_info.get("description")
                    )
                    video.channel_id = channel.id

            # TODO: Get transcript and extract via Gemini
            # For now, just store YouTube metadata

            video.processing_status = "completed"
            video.error_message = None  # Clear error from previous failed attempts
            await db.flush()

            # Trigger enrichment if enabled
            if settings.enrichment_enabled and settings.enrichment_auto_trigger:
                try:
                    enrichment = VideoEnrichment(
                        video_id=video.id,
                        status=EnrichmentStatus.pending.value
                    )
                    db.add(enrichment)
                    await db.flush()

                    arq_pool = await get_arq_pool()
                    await arq_pool.enqueue_job("enrich_video", str(video.id))
                    logger.info(f"Enqueued enrichment job for video {video_id}")
                except Exception as e:
                    logger.warning(f"Failed to enqueue enrichment for video {video_id}: {e}")

            # Publish WebSocket update for instant UI refresh
            # Skip for large batches to avoid overwhelming Redis (rely on progress updates instead)
            # Note: job_id can be used to determine if this is a batch job
            # For now, we'll rely on progress updates for batch jobs

        except Exception as e:
            logger.exception(f"Failed to fetch YouTube metadata for video {video_id}")
            raise

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

    # Create initial progress event (0%)
    initial_event = JobProgressEvent(
        job_id=UUID(job_id),
        progress_data={
            "progress": 0,
            "processed": 0,
            "failed": 0,
            "total": len(video_ids),
            "status": "started"
        }
    )
    db.add(initial_event)
    await db.flush()

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

            # Track success/failure and update job progress
            redis_client = ctx.get('redis')
            if result['status'] in ('success', 'already_completed'):
                processed_count += 1
                await _update_job_progress(db, job_id, success=True, redis_client=redis_client)
            elif result['status'] == 'error':
                failed_count += 1
                await _update_job_progress(db, job_id, success=False, redis_client=redis_client)
            else:
                failed_count += 1
                await _update_job_progress(db, job_id, success=False, redis_client=redis_client)

        except Exception as e:
            logger.exception(f"Failed to process video {video_id} in batch")
            failed_count += 1
            # Update progress for failed video (process_video might not have run)
            redis_client = ctx.get('redis')
            await _update_job_progress(db, job_id, success=False, redis_client=redis_client)
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


async def _update_job_progress(db: AsyncSession, job_id: str, success: bool, redis_client=None) -> None:
    """
    Update parent ProcessingJob progress counters and create progress event.

    Args:
        db: Database session
        job_id: UUID of ProcessingJob
        success: Whether video processing succeeded
        redis_client: Optional Redis client for publishing progress (from ctx)
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

        # Calculate progress percentage
        total_processed = parent_job.processed_count + parent_job.failed_count
        progress_percentage = int((total_processed / parent_job.total_videos) * 100) if parent_job.total_videos > 0 else 0

        # Determine status
        if total_processed >= parent_job.total_videos:
            # Job complete
            event_status = "completed"
        elif success:
            event_status = "success"
        else:
            event_status = "error"

        # Throttling: Only create DB events for significant progress changes (for large batches)
        # For small batches (<= 20 videos), create event for every video
        # For large batches, create event on: 0%, every 5%, and 100%
        if parent_job.total_videos <= 20:
            should_create_event = True  # Every update for small batches
        else:
            should_create_event = (
                progress_percentage == 0 or  # Initial
                progress_percentage == 100 or  # Final
                progress_percentage % 5 == 0  # Every 5%
            )

        # Create progress event (with error handling to not block Redis publish)
        if should_create_event:
            try:
                progress_event = JobProgressEvent(
                    job_id=UUID(job_id),
                    progress_data={
                        "progress": progress_percentage,
                        "processed": parent_job.processed_count,
                        "failed": parent_job.failed_count,
                        "total": parent_job.total_videos,
                        "status": event_status
                    }
                )
                db.add(progress_event)
            except Exception as e:
                logger.warning(f"Failed to create progress event: {e}")
                # Continue to Redis publish even if DB write fails

        # Publish progress to Redis (with throttling for large batches)
        # For small batches (<= 20 videos), publish every update
        # For large batches, publish on: 0%, every 5%, and 100%
        if parent_job.total_videos <= 20:
            should_publish = True
        else:
            should_publish = (
                progress_percentage == 0 or  # Initial
                progress_percentage == 100 or  # Final
                progress_percentage % 5 == 0  # Every 5%
            )

        if should_publish and redis_client:
            try:
                import json
                from app.models.list import BookmarkList

                # Get user_id for channel routing
                list_result = await db.execute(
                    select(BookmarkList.user_id).where(BookmarkList.id == parent_job.list_id)
                )
                user_id = list_result.scalar_one_or_none()

                if user_id:
                    progress_message = {
                        "job_id": str(job_id),
                        "progress": progress_percentage,
                        "processed": parent_job.processed_count,
                        "failed": parent_job.failed_count,
                        "total": parent_job.total_videos,
                        "status": event_status
                    }
                    channel = f"progress:user:{user_id}"
                    await redis_client.publish(channel, json.dumps(progress_message))
            except Exception as e:
                logger.warning(f"Failed to publish progress to Redis: {e}")
                # Don't fail job if Redis publish fails

        # Auto-complete job when all videos processed
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
