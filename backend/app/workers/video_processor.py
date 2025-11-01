"""ARQ worker for processing YouTube videos."""
from uuid import UUID
from arq import Retry
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import Video, ProcessingJob
import logging

logger = logging.getLogger(__name__)


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
            return {"status": "error", "message": "Video not found"}

        # Idempotency check - skip if already completed
        if video.processing_status == "completed":
            logger.info(f"Video {video_id} already processed")
            return {"status": "already_completed", "video_id": video_id}

        # Mark as processing
        video.processing_status = "processing"
        await db.flush()

        # TODO: Implement actual processing
        # - Fetch YouTube metadata
        # - Get transcript
        # - Extract via Gemini
        # For now, just mark as completed (stub)

        video.processing_status = "completed"
        await db.flush()

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
