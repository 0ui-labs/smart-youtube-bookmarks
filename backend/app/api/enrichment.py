"""Video Enrichment API endpoints.

Implements:
- GET /api/videos/{video_id}/enrichment - Get enrichment data
- POST /api/videos/{video_id}/enrichment/retry - Retry enrichment
"""
import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.redis import get_arq_pool
from app.models.video import Video
from app.models.video_enrichment import VideoEnrichment, EnrichmentStatus
from app.schemas.enrichment import (
    EnrichmentResponse,
    EnrichmentRetryResponse,
    ChapterSchema,
    EnrichmentStatus as SchemaEnrichmentStatus,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/videos", tags=["enrichment"])


def _enrichment_to_response(enrichment: VideoEnrichment) -> EnrichmentResponse:
    """Convert VideoEnrichment model to response schema."""
    # Convert chapters_json to ChapterSchema list
    chapters = None
    if enrichment.chapters_json:
        chapters = [
            ChapterSchema(
                title=ch.get("title", ""),
                start=ch.get("start", 0.0),
                end=ch.get("end", 0.0)
            )
            for ch in enrichment.chapters_json
        ]

    return EnrichmentResponse(
        id=enrichment.id,
        video_id=enrichment.video_id,
        status=SchemaEnrichmentStatus(enrichment.status),
        captions_vtt=enrichment.captions_vtt,
        captions_language=enrichment.captions_language,
        captions_source=enrichment.captions_source,
        transcript_text=enrichment.transcript_text,
        chapters=chapters,
        chapters_vtt=enrichment.chapters_vtt,
        chapters_source=enrichment.chapters_source,
        thumbnails_vtt_url=enrichment.thumbnails_vtt_url,
        error_message=enrichment.error_message,
        retry_count=enrichment.retry_count,
        progress_message=enrichment.progress_message,
        created_at=enrichment.created_at,
        updated_at=enrichment.updated_at,
        processed_at=enrichment.processed_at,
    )


@router.get(
    "/{video_id}/enrichment",
    response_model=EnrichmentResponse,
    responses={
        404: {"description": "Video or enrichment not found"}
    }
)
async def get_enrichment(
    video_id: UUID,
    db: AsyncSession = Depends(get_db)
) -> EnrichmentResponse:
    """Get enrichment data for a video.

    Args:
        video_id: Video UUID

    Returns:
        EnrichmentResponse with captions, chapters, etc.

    Raises:
        404: If video or enrichment doesn't exist
    """
    # Check video exists
    video_stmt = select(Video).where(Video.id == video_id)
    video_result = await db.execute(video_stmt)
    video = video_result.scalar_one_or_none()

    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video not found"
        )

    # Get enrichment
    stmt = select(VideoEnrichment).where(VideoEnrichment.video_id == video_id)
    result = await db.execute(stmt)
    enrichment = result.scalar_one_or_none()

    if not enrichment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Enrichment not found for this video"
        )

    return _enrichment_to_response(enrichment)


@router.post(
    "/{video_id}/enrichment/retry",
    response_model=EnrichmentRetryResponse,
    responses={
        404: {"description": "Video not found"},
        409: {"description": "Enrichment already processing"}
    }
)
async def retry_enrichment(
    video_id: UUID,
    db: AsyncSession = Depends(get_db)
) -> EnrichmentRetryResponse:
    """Retry enrichment for a video.

    Creates a new enrichment record if none exists, or resets
    a failed enrichment to pending status.

    Args:
        video_id: Video UUID

    Returns:
        EnrichmentRetryResponse with message and enrichment data

    Raises:
        404: If video doesn't exist
        409: If enrichment is already processing
    """
    # Check video exists
    video_stmt = select(Video).where(Video.id == video_id)
    video_result = await db.execute(video_stmt)
    video = video_result.scalar_one_or_none()

    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video not found"
        )

    # Get or create enrichment
    stmt = select(VideoEnrichment).where(VideoEnrichment.video_id == video_id)
    result = await db.execute(stmt)
    enrichment = result.scalar_one_or_none()

    if enrichment:
        # Check if already processing
        if enrichment.status == EnrichmentStatus.processing.value:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Enrichment is already processing"
            )

        # Reset to pending
        enrichment.status = EnrichmentStatus.pending.value
        enrichment.error_message = None
        enrichment.retry_count += 1
    else:
        # Create new enrichment
        enrichment = VideoEnrichment(
            video_id=video_id,
            status=EnrichmentStatus.pending.value
        )
        db.add(enrichment)

    await db.commit()
    await db.refresh(enrichment)

    # Enqueue job
    try:
        arq_pool = await get_arq_pool()
        await arq_pool.enqueue_job("enrich_video", str(video_id))
        logger.info(f"Enqueued enrichment job for video {video_id}")
    except Exception as e:
        logger.warning(f"Failed to enqueue enrichment job: {e}")

    return EnrichmentRetryResponse(
        message="Enrichment retry started",
        enrichment=_enrichment_to_response(enrichment)
    )
