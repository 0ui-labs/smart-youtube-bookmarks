from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import BookmarkList, Video, ProcessingJob
from app.schemas.job import JobResponse, JobStatus

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
