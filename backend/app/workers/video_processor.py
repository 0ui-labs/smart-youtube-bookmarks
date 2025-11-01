"""ARQ worker for processing YouTube videos."""
from uuid import UUID
from arq import Retry
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Video
import logging

logger = logging.getLogger(__name__)


async def process_video(
    ctx: dict,
    video_id: str,
    list_id: str,
    schema: dict
) -> dict:
    """
    Process a single video:
    1. Fetch YouTube metadata
    2. Get transcript
    3. Extract data via Gemini
    4. Update database

    Args:
        ctx: ARQ job context (contains db session)
        video_id: UUID of video to process
        list_id: UUID of parent list
        schema: Extraction schema for Gemini

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
