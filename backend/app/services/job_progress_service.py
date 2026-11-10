"""Persist counters, history and publication intent in the caller's transaction."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.job import ProcessingJob
from app.models.job_progress import JobProgressEvent
from app.services.job_dispatch_service import record_job


async def advance_job_progress(db: AsyncSession, job_id: UUID, success: bool) -> None:
    job = (
        await db.execute(
            select(ProcessingJob)
            .where(ProcessingJob.id == job_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
    ).scalar_one_or_none()
    if job is None:
        return
    if success:
        job.processed_count += 1
    else:
        job.failed_count += 1
    processed = job.processed_count + job.failed_count
    progress = int(processed / job.total_videos * 100) if job.total_videos else 0
    if processed >= job.total_videos:
        job.status = "completed_with_errors" if job.failed_count else "completed"
    if job.total_videos <= 20 or progress % 5 == 0:
        event = JobProgressEvent(
            job_id=job_id,
            progress_data={
                "progress": progress,
                "processed": job.processed_count,
                "failed": job.failed_count,
                "total": job.total_videos,
                "status": job.status if processed >= job.total_videos else "processing",
            },
        )
        db.add(event)
        await db.flush()
        await record_job(db, "publish_job_progress", str(event.id), [str(event.id)])
    await db.flush()
