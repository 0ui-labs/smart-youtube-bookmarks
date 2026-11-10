"""Processing job API and progress history."""

import logging
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models import BookmarkList, ProcessingJob, Schema, Video
from app.models.job_progress import JobProgressEvent
from app.schemas.job import JobResponse, JobStatus
from app.schemas.job_progress import JobProgressEventRead
from app.services.job_dispatch_service import DurableJobQueue

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["processing"])


@router.post("/lists/{list_id}/process", response_model=JobResponse, status_code=201)
async def start_processing(list_id: UUID, db: AsyncSession = Depends(get_db)):
    try:
        # Verify list exists
        result = await db.execute(
            select(BookmarkList)
            .where(BookmarkList.id == list_id)
            .with_for_update(of=BookmarkList)
        )
        list_obj = result.scalar_one_or_none()
        if not list_obj:
            raise HTTPException(status_code=404, detail="List not found")

        active_job = (
            await db.execute(
                select(ProcessingJob.id)
                .where(
                    ProcessingJob.list_id == list_id,
                    ProcessingJob.status.in_(["running", "paused"]),
                )
                .limit(1)
            )
        ).scalar_one_or_none()
        if active_job is not None:
            raise HTTPException(
                status_code=409, detail="A processing job is already active"
            )

        # Count pending videos efficiently
        count_result = await db.execute(
            select(func.count(Video.id)).where(
                Video.list_id == list_id, Video.processing_status == "pending"
            )
        )
        pending_count = count_result.scalar_one()

        if pending_count == 0:
            raise HTTPException(status_code=400, detail="No pending videos to process")

        # Persist job and all delivery intents in the same transaction.
        job = ProcessingJob(
            list_id=list_id, total_videos=pending_count, status="running"
        )
        db.add(job)
        await db.flush()

        # No dispatcher can observe these intents before the final commit.
        try:
            # Fetch schema for Gemini extraction (if list has one)
            schema_fields = {}
            if list_obj.schema_id:
                schema_result = await db.execute(
                    select(Schema).where(Schema.id == list_obj.schema_id)
                )
                schema = schema_result.scalar_one_or_none()
                if schema:
                    schema_fields = schema.fields

            # Get pending videos for enqueueing
            videos_result = await db.execute(
                select(Video).where(
                    Video.list_id == list_id, Video.processing_status == "pending"
                )
            )
            pending_videos = videos_result.scalars().all()

            for video in pending_videos:
                await DurableJobQueue(db).enqueue_job(
                    "process_video",
                    str(video.id),
                    str(list_id),
                    schema_fields,
                    str(job.id),
                )
            await db.commit()
            logger.info(
                f"Enqueued {len(pending_videos)} videos for processing (job {job.id})"
            )

        except Exception as e:
            await db.rollback()
            logger.exception(
                "Failed to persist processing intents for list %s", list_id
            )
            raise HTTPException(
                status_code=500, detail="Failed to accept processing job"
            ) from e

        return JobResponse(
            job_id=job.id,
            total_videos=pending_count,
            estimated_duration_seconds=pending_count * 30,  # 30s per video estimate
        )
    except HTTPException:
        raise
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Database error occurred")


@router.get("/jobs/{job_id}", response_model=JobStatus)
async def get_job_status(job_id: UUID, db: AsyncSession = Depends(get_db)):
    try:
        result = await db.execute(
            select(ProcessingJob).where(ProcessingJob.id == job_id)
        )
        job = result.scalar_one_or_none()

        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        return job
    except HTTPException:
        raise
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Database error occurred")


@router.post("/jobs/{job_id}/pause", status_code=204)
async def pause_job(job_id: UUID, db: AsyncSession = Depends(get_db)):
    try:
        result = await db.execute(
            select(ProcessingJob).where(ProcessingJob.id == job_id)
        )
        job = result.scalar_one_or_none()

        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        if job.status != "running":
            raise HTTPException(
                status_code=400,
                detail=f"Cannot pause job with status '{job.status}'. Only running jobs can be paused.",
            )

        job.status = "paused"
        await db.commit()
        return None
    except HTTPException:
        raise
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Database error occurred")


@router.get(
    "/jobs/{job_id}/progress-history", response_model=list[JobProgressEventRead]
)
async def get_progress_history(
    job_id: UUID,
    user_id: UUID = Query(
        ..., description="User ID for authentication (temporary mock auth)"
    ),
    since: datetime | None = Query(
        None, description="Return events after this timestamp"
    ),
    offset: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, gt=0, le=100, description="Maximum records to return"),
    db: AsyncSession = Depends(get_db),
):

    try:
        # Verify job exists and load list relationship (with eager loading)
        stmt = (
            select(ProcessingJob)
            .where(ProcessingJob.id == job_id)
            .options(selectinload(ProcessingJob.list))
        )

        result = await db.execute(stmt)
        job = result.scalar_one_or_none()

        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        # Authorization: Check ownership via job -> list -> user relationship
        if job.list.user_id != user_id:
            raise HTTPException(
                status_code=403, detail="Not authorized to access this job"
            )

        # Query progress events with filters and pagination
        query = select(JobProgressEvent).where(JobProgressEvent.job_id == job_id)

        # Apply since filter if provided (inclusive to avoid missing events on reconnect)
        if since:
            query = query.where(JobProgressEvent.created_at >= since)

        # Order chronologically and apply pagination
        query = (
            query.order_by(JobProgressEvent.created_at, JobProgressEvent.id)
            .offset(offset)
            .limit(limit)
        )

        result = await db.execute(query)
        events = result.scalars().all()

        return events
    except HTTPException:
        raise
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Database error occurred")
