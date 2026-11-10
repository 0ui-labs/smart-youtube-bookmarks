"""Operator-only diagnostics and maintenance; never exposed as an HTTP router.

The caller owns the transaction. Payloads and provider exception text are never
included in diagnostic output. Accepted transport failures remain retryable.
"""

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import String, delete, exists, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.job_outbox import JobOutbox
from app.models.video import Video
from app.services.job_dispatch_service import DurableJobQueue

ACTIVE = ("pending", "dispatching", "queued", "running")


async def inspect_operations(db: AsyncSession, limit: int = 100) -> dict[str, Any]:
    if not 1 <= limit <= 100:
        raise ValueError("Diagnostic limit must be between 1 and 100")
    now = datetime.now(UTC)
    counts: dict[str, int] = {}
    for status, count in (
        await db.execute(
            select(JobOutbox.status, func.count()).group_by(JobOutbox.status)
        )
    ).all():
        counts[status] = count
    operations = (
        await db.scalars(
            select(JobOutbox)
            .where(JobOutbox.status != "completed")
            .order_by(JobOutbox.created_at, JobOutbox.id)
            .limit(limit)
        )
    ).all()
    active_processing = exists(
        select(JobOutbox.id).where(
            JobOutbox.kind == "process_video",
            JobOutbox.target_id == func.cast(Video.id, String),
            JobOutbox.status.in_(ACTIVE),
        )
    )
    orphans = (
        await db.scalars(
            select(Video.id)
            .where(Video.processing_status == "pending", ~active_processing)
            .order_by(Video.id)
            .limit(limit)
        )
    ).all()
    return {
        "counts": counts,
        "operations": [
            {
                "id": str(op.id),
                "kind": op.kind,
                "target_id": op.target_id,
                "status": op.status,
                "attempts": op.attempts,
                "error_type": op.last_error,
                "expired_lease": op.lease_until is not None and op.lease_until <= now,
                "retry_of": op.payload.get("retry_of"),
            }
            for op in operations
        ],
        "orphan_pending_video_ids": [str(id_) for id_ in orphans],
        "limit": limit,
    }


async def retry_failed_operation(db: AsyncSession, operation_id: UUID) -> JobOutbox:
    old = await db.get(JobOutbox, operation_id)
    if old is None or old.status != "failed":
        raise ValueError("Only an existing failed operation can be retried")
    await db.execute(
        text("SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))"),
        {"key": f"retry:{operation_id}"},
    )
    # Repeated/concurrent operator requests reuse the same retry operation.
    previous = await db.scalar(
        select(JobOutbox)
        .where(JobOutbox.payload["retry_of"].astext == str(operation_id))
        .order_by(JobOutbox.created_at)
        .limit(1)
    )
    if previous is not None:
        return previous
    operation = await DurableJobQueue(db).enqueue_job(
        old.kind, *old.payload["args"], **old.payload["kwargs"]
    )
    if operation is old:
        raise ValueError("Retry must create a distinct operation")
    operation.payload = {**operation.payload, "retry_of": str(old.id)}
    await db.flush()
    return operation


async def prune_completed_operations(db: AsyncSession, limit: int = 100) -> int:
    if not 1 <= limit <= 100:
        raise ValueError("Cleanup limit must be between 1 and 100")
    ids = (
        await db.scalars(
            select(JobOutbox.id)
            .where(
                JobOutbox.status == "completed",
                JobOutbox.updated_at < datetime.now(UTC) - timedelta(days=30),
            )
            .order_by(JobOutbox.updated_at, JobOutbox.id)
            .limit(limit)
            .with_for_update(skip_locked=True)
        )
    ).all()
    if ids:
        await db.execute(delete(JobOutbox).where(JobOutbox.id.in_(ids)))
    return len(ids)
