"""Outbox acceptance and bounded, concurrent-safe delivery to ARQ.

Callers own the business transaction. Recording never commits it. Redis delivery
is at least once; workers claim operations durably before invoking handlers.
"""

from datetime import UTC, datetime, timedelta
from typing import Any

from arq.connections import ArqRedis
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.job_outbox import JobOutbox

JOB_KINDS = frozenset(
    {
        "publish_job_progress",
        "process_video",
        "process_video_list",
        "enrich_video",
        "poll_subscription",
        "process_pubsub_notification",
    }
)


async def record_job(
    db: AsyncSession,
    kind: str,
    target_id: str,
    args: list[Any],
    kwargs: dict[str, Any] | None = None,
) -> JobOutbox:
    if kind not in JOB_KINDS:
        raise ValueError("Unsupported durable job kind")
    operation = JobOutbox(
        kind=kind,
        target_id=str(target_id),
        payload={"args": args, "kwargs": kwargs or {}},
    )
    db.add(operation)
    await db.flush()
    return operation


async def dispatch_jobs(db: AsyncSession, queue: ArqRedis, batch_size: int = 50) -> int:
    if not 1 <= batch_size <= 100:
        raise ValueError("Outbox batch size must be between 1 and 100")
    now = datetime.now(UTC)
    rows = (
        (
            await db.execute(
                select(JobOutbox)
                .where(
                    or_(
                        and_(
                            JobOutbox.status == "pending",
                            JobOutbox.next_attempt_at <= now,
                        ),
                        and_(
                            JobOutbox.status.in_(["dispatching", "queued", "running"]),
                            JobOutbox.lease_until <= now,
                        ),
                    )
                )
                .order_by(JobOutbox.created_at, JobOutbox.id)
                .limit(batch_size)
                .with_for_update(skip_locked=True)
            )
        )
        .scalars()
        .all()
    )
    ids = []
    for row in rows:
        row.status = "dispatching"
        row.attempts += 1
        row.lease_until = now + timedelta(minutes=20)
        ids.append(row.id)
    await (
        db.commit()
    )  # Lease only committed intents; never call from a business transaction.
    delivered = 0
    for operation_id in ids:
        maybe_row = await db.get(JobOutbox, operation_id)
        if maybe_row is None:
            continue
        row = maybe_row
        try:
            await queue.enqueue_job(
                "run_durable_job", str(operation_id), _job_id=f"outbox:{operation_id}"
            )
        except Exception as error:
            # Keep the intent on every transport failure. Do not persist payload/error text.
            row = (
                await db.execute(
                    select(JobOutbox)
                    .where(JobOutbox.id == operation_id)
                    .with_for_update()
                    .execution_options(populate_existing=True)
                )
            ).scalar_one()
            if row.status == "dispatching":
                row.status = "pending"
                row.last_error = type(error).__name__
                row.next_attempt_at = now + timedelta(
                    seconds=min(300, 2 ** min(row.attempts, 8))
                )
                row.lease_until = None
        else:
            row = (
                await db.execute(
                    select(JobOutbox)
                    .where(JobOutbox.id == operation_id)
                    .with_for_update()
                    .execution_options(populate_existing=True)
                )
            ).scalar_one()
            if row.status == "dispatching":
                row.status = "queued"
                row.last_error = None
            delivered += 1
        await db.commit()
    return delivered


class DurableJobQueue:
    """Transaction-bound adapter for existing producer call signatures."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def enqueue_job(self, kind: str, *args: Any, **kwargs: Any) -> JobOutbox:
        from sqlalchemy import text

        target = str(
            args[0]
            if args
            else kwargs.get("video_id")
            or kwargs.get("subscription_id")
            or kwargs.get("channel_id")
        )
        if target == "None":
            raise ValueError("Durable jobs require an explicit target")
        await self.db.execute(
            text("SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))"),
            {"key": f"intent:{kind}:{target}"},
        )
        active = (
            await self.db.execute(
                select(JobOutbox)
                .where(
                    JobOutbox.kind == kind,
                    JobOutbox.target_id == target,
                    JobOutbox.status.in_(
                        ["pending", "dispatching", "queued", "running"]
                    ),
                )
                .limit(1)
            )
        ).scalar_one_or_none()
        if active is not None:
            return active
        return await record_job(self.db, kind, target, list(args), kwargs)
