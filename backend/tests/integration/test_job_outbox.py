from unittest.mock import AsyncMock

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.models.job_outbox import JobOutbox
from app.services.job_dispatch_service import dispatch_jobs, record_job


async def test_intent_rolls_back_with_business_transaction(test_db):
    await record_job(test_db, "enrich_video", "synthetic-video", ["synthetic-video"])
    await test_db.rollback()
    assert (await test_db.execute(select(JobOutbox))).scalars().all() == []


async def test_redis_failure_preserves_intent_for_retry(test_db):
    operation = await record_job(
        test_db, "enrich_video", "synthetic-video", ["synthetic-video"]
    )
    await test_db.commit()
    queue = AsyncMock()
    queue.enqueue_job.side_effect = OSError("Redis unavailable")
    await dispatch_jobs(test_db, queue)
    await test_db.refresh(operation)
    assert operation.status == "pending"
    assert operation.attempts == 1
    assert operation.last_error == "OSError"


async def test_only_committed_intents_are_dispatched(test_db, test_engine):
    sessions = async_sessionmaker(test_engine, expire_on_commit=False)
    await record_job(test_db, "enrich_video", "synthetic-video", ["synthetic-video"])
    queue = AsyncMock()
    async with sessions() as other:
        await dispatch_jobs(other, queue)
    queue.enqueue_job.assert_not_called()
    await test_db.commit()
    await dispatch_jobs(test_db, queue)
    queue.enqueue_job.assert_called_once()
    operation = (await test_db.execute(select(JobOutbox))).scalar_one()
    assert queue.enqueue_job.call_args.kwargs["_job_id"] == f"outbox:{operation.id}"


async def test_duplicate_delivery_never_runs_handlers_in_parallel(test_db, test_engine):
    import asyncio
    from unittest.mock import patch

    from app.workers.outbox_dispatcher import run_durable_job

    operation = await record_job(
        test_db, "enrich_video", "synthetic-video", ["synthetic-video"]
    )
    await test_db.commit()
    sessions = async_sessionmaker(test_engine, expire_on_commit=False)
    started, release = asyncio.Event(), asyncio.Event()
    calls = []

    async def handler(ctx, video_id):
        calls.append(video_id)
        started.set()
        await release.wait()
        return {"status": "completed"}

    with patch(
        "app.workers.outbox_dispatcher.job_handlers",
        return_value={"enrich_video": handler},
    ):
        first = asyncio.create_task(
            run_durable_job({"outbox_session_factory": sessions}, str(operation.id))
        )
        await asyncio.wait_for(started.wait(), timeout=3)
        duplicate = await run_durable_job(
            {"outbox_session_factory": sessions}, str(operation.id)
        )
        assert duplicate == {"status": "busy"}
        release.set()
        await first
        assert await run_durable_job(
            {"outbox_session_factory": sessions}, str(operation.id)
        ) == {"status": "ignored"}
    assert calls == ["synthetic-video"]
