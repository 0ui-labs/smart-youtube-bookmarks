"""Durable ARQ entry point. PostgreSQL serializes delivery and provider work."""

from collections.abc import Awaitable, Callable
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncEngine

from app.core.database import AsyncSessionLocal
from app.models.job_outbox import JobOutbox
from app.services.job_dispatch_service import dispatch_jobs


def job_handlers() -> dict[str, Callable[..., Awaitable[Any]]]:
    from app.workers.enrichment_worker import enrich_video
    from app.workers.subscription_worker import (
        poll_subscription,
        process_pubsub_notification,
    )
    from app.workers.video_processor import process_video, process_video_list

    return {
        handler.__name__: handler
        for handler in (
            enrich_video,
            poll_subscription,
            process_pubsub_notification,
            process_video,
            process_video_list,
        )
    }


async def dispatch_outbox(ctx: dict[str, Any]) -> int:
    sessions = ctx.get("outbox_session_factory", AsyncSessionLocal)
    async with sessions() as db:
        return await dispatch_jobs(db, ctx["redis"])


async def run_durable_job(ctx: dict[str, Any], operation_id: str) -> Any:
    sessions = ctx.get("outbox_session_factory", AsyncSessionLocal)
    async with sessions() as db:
        operation = await db.get(JobOutbox, UUID(operation_id))
        if operation is None or operation.status in {"completed", "failed"}:
            return {"status": "ignored"}
        # A session-level advisory lock remains held across the durable claim's
        # commit and all handler commits. Expiring a lease cannot run a second
        # handler while the original process still holds its database connection.
        lock_key = f"outbox:{operation.kind}:{operation.target_id}"
        bind = db.bind
        if not isinstance(bind, AsyncEngine):
            raise RuntimeError("Durable handlers require an async engine")
        async with bind.connect() as lock_connection:
            acquired = await lock_connection.scalar(
                text("SELECT pg_try_advisory_lock(hashtextextended(:key, 0))"),
                {"key": lock_key},
            )
            if not acquired:
                return {"status": "busy"}
            try:
                operation = (
                    await db.execute(
                        select(JobOutbox)
                        .where(JobOutbox.id == operation.id)
                        .with_for_update()
                        .execution_options(populate_existing=True)
                    )
                ).scalar_one()
                if operation.status in {"completed", "failed"}:
                    return {"status": "ignored"}
                if (
                    operation.payload_version != 1
                    or operation.kind not in job_handlers()
                ):
                    operation.status = "failed"
                    operation.last_error = "UnsupportedPayload"
                    await db.commit()
                    return {"status": "failed"}
                operation.status = "running"
                operation.lease_until = datetime.now(UTC) + timedelta(minutes=20)
                await db.commit()
                try:
                    result = await job_handlers()[operation.kind](
                        ctx, *operation.payload["args"], **operation.payload["kwargs"]
                    )
                except Exception as error:
                    if ctx.get("db") is not None:
                        await ctx["db"].rollback()
                    operation.status = "pending"
                    operation.last_error = type(error).__name__
                    operation.next_attempt_at = datetime.now(UTC) + timedelta(minutes=1)
                    operation.lease_until = None
                    await db.commit()
                    raise
                if ctx.get("db") is not None:
                    await ctx["db"].commit()
                operation.status = (
                    "failed"
                    if isinstance(result, dict)
                    and result.get("status") in {"failed", "error"}
                    else "completed"
                )
                operation.lease_until = None
                await db.commit()
                return result
            finally:
                await lock_connection.execute(
                    text("SELECT pg_advisory_unlock(hashtextextended(:key, 0))"),
                    {"key": lock_key},
                )
