"""Video job service."""

import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.job import ProcessingJob
from app.models.list import BookmarkList
from app.models.video import Video
from app.models.video_enrichment import EnrichmentStatus, VideoEnrichment
from app.services.job_dispatch_service import DurableJobQueue

logger = logging.getLogger(__name__)


async def _enqueue_enrichment(video_id: UUID, db: AsyncSession) -> None:
    """
    Enqueue enrichment job for a video if auto-trigger is enabled.

    Records enrichment and its durable delivery intent in the caller transaction.
    Skips only when enrichment is disabled; acceptance does not require Redis.
    """
    if not settings.enrichment_enabled or not settings.enrichment_auto_trigger:
        return

    # Create pending enrichment record (not yet flushed)
    enrichment = VideoEnrichment(
        video_id=video_id, status=EnrichmentStatus.pending.value
    )
    db.add(enrichment)

    await DurableJobQueue(db).enqueue_job("enrich_video", str(video_id))
    await db.flush()


async def _enqueue_video_processing(
    db: AsyncSession,
    list_id: UUID,
    total_videos: int,
    video_ids: list[str] | None = None,
) -> ProcessingJob | None:
    """
    Helper to create ProcessingJob and enqueue ARQ task.

    CRITICAL: Fetches schema from list and passes it to worker for Gemini extraction.
    """
    if total_videos == 0:
        return None

    # Fetch list with schema (eager load)
    result = await db.execute(select(BookmarkList).where(BookmarkList.id == list_id))
    bookmark_list = result.scalar_one_or_none()

    if not bookmark_list:
        raise ValueError(f"List {list_id} not found")

    # Fetch schema fields if list has schema
    schema_fields = None
    if bookmark_list.schema_id:
        from app.models.schema import Schema

        result = await db.execute(
            select(Schema).where(Schema.id == bookmark_list.schema_id)
        )
        schema = result.scalar_one_or_none()
        if schema:
            schema_fields = schema.fields  # JSONB dict

    # Create processing job
    job = ProcessingJob(list_id=list_id, total_videos=total_videos, status="running")
    db.add(job)
    await db.flush()

    if video_ids is None:
        result = await db.execute(
            select(Video.id).where(
                Video.list_id == list_id, Video.processing_status == "pending"
            )
        )
        video_ids = [str(video_id) for video_id in result.scalars().all()]
    # Each video has its own durable target claim, shared with manual processing
    # and recovery. A CSV import only schedules its newly created pending videos.
    for video_id in video_ids:
        await DurableJobQueue(db).enqueue_job(
            "process_video", video_id, str(list_id), schema_fields, str(job.id)
        )

    return job
