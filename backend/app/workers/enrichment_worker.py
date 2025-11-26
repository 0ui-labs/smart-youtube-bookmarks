"""ARQ worker for video enrichment processing."""
import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.video import Video
from app.services.enrichment.enrichment_service import EnrichmentService

logger = logging.getLogger(__name__)


async def enrich_video(ctx: dict, video_id: str) -> dict:
    """
    Enrich a single video with captions, chapters, and thumbnails.

    Args:
        ctx: ARQ job context (contains db session)
        video_id: UUID of video to enrich

    Returns:
        dict: Processing result with status and message
    """
    db: AsyncSession = ctx['db']

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

        # Run enrichment
        service = EnrichmentService(db)
        enrichment = await service.enrich_video(UUID(video_id))

        logger.info(
            f"Enrichment completed for video {video_id} with status {enrichment.status}"
        )

        return {
            "status": enrichment.status,
            "video_id": video_id,
            "enrichment_id": str(enrichment.id)
        }

    except Exception as e:
        logger.exception(f"Error enriching video {video_id}: {e}")
        return {
            "status": "error",
            "message": str(e),
            "video_id": video_id
        }
