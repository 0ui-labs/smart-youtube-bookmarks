from uuid import UUID
from datetime import datetime
from typing import Annotated, List, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models import BookmarkList, Video, ProcessingJob, User
from app.models.job_progress import JobProgressEvent
from app.schemas.job import JobResponse, JobStatus
from app.schemas.job_progress import JobProgressEventRead

router = APIRouter(prefix="/api", tags=["processing"])


@router.post("/lists/{list_id}/process", response_model=JobResponse, status_code=201)
async def start_processing(
    list_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    try:
        # Verify list exists
        result = await db.execute(
            select(BookmarkList).where(BookmarkList.id == list_id)
        )
        list_obj = result.scalar_one_or_none()
        if not list_obj:
            raise HTTPException(status_code=404, detail="List not found")

        # Count pending videos efficiently
        count_result = await db.execute(
            select(func.count(Video.id)).where(
                Video.list_id == list_id,
                Video.processing_status == "pending"
            )
        )
        pending_count = count_result.scalar_one()

        if pending_count == 0:
            raise HTTPException(status_code=400, detail="No pending videos to process")

        # Create job
        job = ProcessingJob(
            list_id=list_id,
            total_videos=pending_count,
            status="running"
        )
        db.add(job)
        await db.flush()
        await db.refresh(job)
        await db.commit()

        # TODO: Enqueue ARQ tasks

        return JobResponse(
            job_id=job.id,
            total_videos=pending_count,
            estimated_duration_seconds=pending_count * 30  # 30s per video estimate
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
                detail=f"Cannot pause job with status '{job.status}'. Only running jobs can be paused."
            )

        job.status = "paused"
        await db.commit()
        return None
    except HTTPException:
        raise
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Database error occurred")


@router.get("/jobs/{job_id}/progress-history", response_model=List[JobProgressEventRead])
async def get_progress_history(
    job_id: UUID,
    user_id: UUID = Query(..., description="User ID for authentication (temporary mock auth)"),
    since: Optional[datetime] = Query(None, description="Return events after this timestamp"),
    offset: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, gt=0, le=100, description="Maximum records to return"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get progress history for a job with pagination and filtering.

    Supports:
    - Filtering by 'since' timestamp for efficient reconnection
    - Pagination with offset/limit (max 100 per request)
    - Authorization: user can only access their own jobs

    Note: Uses user_id query param for temporary mock authentication.
    This will be replaced with proper JWT authentication later.
    """
    try:
        # Verify job exists and load list relationship (with eager loading)
        stmt = select(ProcessingJob).where(
            ProcessingJob.id == job_id
        ).options(selectinload(ProcessingJob.list))

        result = await db.execute(stmt)
        job = result.scalar_one_or_none()

        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        # Authorization: Check ownership via job -> list -> user relationship
        if job.list.user_id != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to access this job")

        # Query progress events with filters and pagination
        query = select(JobProgressEvent).where(
            JobProgressEvent.job_id == job_id
        )

        # Apply since filter if provided
        if since:
            query = query.where(JobProgressEvent.created_at > since)

        # Order chronologically and apply pagination
        query = query.order_by(JobProgressEvent.created_at).offset(offset).limit(limit)

        result = await db.execute(query)
        events = result.scalars().all()

        return events
    except HTTPException:
        raise
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Database error occurred")
