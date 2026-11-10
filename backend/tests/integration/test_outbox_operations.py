from datetime import UTC, datetime, timedelta
from uuid import uuid4

from sqlalchemy import select

from app.models.job_outbox import JobOutbox
from app.services.job_dispatch_service import record_job
from app.services.outbox_operations import (
    inspect_operations,
    prune_completed_operations,
    retry_failed_operation,
)


async def test_diagnostics_redact_payload_and_show_failed_and_expired(test_db):
    op = await record_job(
        test_db, "enrich_video", str(uuid4()), ["credential-like-value"]
    )
    op.status = "failed"
    op.last_error = "ProviderUnavailable"
    expired = await record_job(test_db, "enrich_video", str(uuid4()), [])
    expired.status = "queued"
    expired.lease_until = datetime.now(UTC) - timedelta(seconds=1)
    await test_db.flush()
    result = await inspect_operations(test_db)
    assert result["counts"] == {"failed": 1, "queued": 1}
    assert "credential-like-value" not in str(result)
    assert next(row for row in result["operations"] if row["id"] == str(expired.id))[
        "expired_lease"
    ]


async def test_retry_has_new_identity_and_keeps_original_for_audit(test_db):
    original = await record_job(test_db, "enrich_video", str(uuid4()), ["video"])
    original.status = "failed"
    await test_db.flush()
    retry = await retry_failed_operation(test_db, original.id)
    assert retry.id != original.id
    assert retry.payload["retry_of"] == str(original.id)
    assert retry.status == "pending"
    assert (await retry_failed_operation(test_db, original.id)).id == retry.id
    assert original.status == "failed"


async def test_retention_keeps_recent_completed_and_every_unfinished_status(test_db):
    for status in ["completed", "pending", "queued", "running", "failed"]:
        op = await record_job(test_db, "enrich_video", str(uuid4()), [])
        op.status = status
        op.updated_at = datetime.now(UTC) - timedelta(days=31)
    recent = await record_job(test_db, "enrich_video", str(uuid4()), [])
    recent.status = "completed"
    await test_db.flush()
    assert await prune_completed_operations(test_db, limit=1) == 1
    remaining = (await test_db.scalars(select(JobOutbox))).all()
    assert len(remaining) == 5
    assert sorted(op.status for op in remaining) == [
        "completed",
        "failed",
        "pending",
        "queued",
        "running",
    ]


async def test_repeated_handler_failure_becomes_visible_and_explicit_retry_resets_budget(
    test_db, test_engine, monkeypatch
):
    from unittest.mock import AsyncMock

    import pytest
    from sqlalchemy.ext.asyncio import async_sessionmaker

    from app.workers.outbox_dispatcher import run_durable_job

    operation = await record_job(test_db, "enrich_video", str(uuid4()), ["video"])
    await test_db.commit()
    handler = AsyncMock(side_effect=OSError("private provider details"))
    monkeypatch.setattr(
        "app.workers.outbox_dispatcher.job_handlers", lambda: {"enrich_video": handler}
    )
    sessions = async_sessionmaker(test_engine, expire_on_commit=False)
    for _ in range(5):
        with pytest.raises(OSError):
            await run_durable_job(
                {"outbox_session_factory": sessions}, str(operation.id)
            )
    await test_db.refresh(operation)
    assert operation.status == "failed"
    assert operation.last_error == "OSError"
    assert operation.payload["execution_attempts"] == 5
    assert await run_durable_job(
        {"outbox_session_factory": sessions}, str(operation.id)
    ) == {"status": "ignored"}
    retry = await retry_failed_operation(test_db, operation.id)
    assert retry.payload.get("execution_attempts", 0) == 0
    assert "private provider details" not in str(await inspect_operations(test_db))


async def test_renewal_records_intents_without_advancing_expiry(
    test_db, test_user, test_list
):
    from app.models.subscription import Subscription
    from app.workers.subscription_worker import renew_pubsub_leases

    sub = Subscription(
        user_id=test_user.id,
        list_id=test_list.id,
        name="renewal",
        channel_ids=["UCsynthetic"],
        is_active=True,
        pubsub_expires_at=None,
    )
    test_db.add(sub)
    await test_db.commit()
    result = await renew_pubsub_leases({"db": test_db})
    assert result["queued"] == 1
    assert sub.pubsub_expires_at is None
    assert (await test_db.scalar(select(JobOutbox))).kind == "sync_pubsub_channel"


async def test_concurrent_explicit_retries_share_one_successor(test_db, test_engine):
    import asyncio

    from sqlalchemy.ext.asyncio import async_sessionmaker

    original = await record_job(test_db, "enrich_video", str(uuid4()), ["video"])
    original.status = "failed"
    await test_db.commit()
    sessions = async_sessionmaker(test_engine, expire_on_commit=False)

    async def retry():
        async with sessions() as db:
            next_ = await retry_failed_operation(db, original.id)
            await db.commit()
            return next_.id

    results = await asyncio.gather(retry(), retry())
    assert results[0] == results[1]
    assert len((await test_db.scalars(select(JobOutbox))).all()) == 2
