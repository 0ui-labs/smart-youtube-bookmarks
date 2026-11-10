"""Deliver only committed progress events. Replays keep their original identity."""

import json
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.job import ProcessingJob
from app.models.job_progress import JobProgressEvent
from app.models.list import BookmarkList


async def publish_job_progress(ctx: dict[str, Any], event_id: str) -> None:
    db: AsyncSession = ctx["db"]
    row = (
        await db.execute(
            select(JobProgressEvent, BookmarkList.user_id)
            .join(ProcessingJob, JobProgressEvent.job_id == ProcessingJob.id)
            .join(BookmarkList, ProcessingJob.list_id == BookmarkList.id)
            .where(JobProgressEvent.id == UUID(event_id))
        )
    ).one_or_none()
    if row is None:
        return  # The parent may have been deleted after scheduling.
    event, user_id = row
    message = {
        **event.progress_data,
        "job_id": str(event.job_id),
        "event_id": str(event.id),
        "created_at": event.created_at.isoformat(),
    }
    await ctx["redis"].publish(f"progress:user:{user_id}", json.dumps(message))
