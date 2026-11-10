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


async def test_expired_dispatch_lease_reuses_operation_id(test_db):
    from datetime import UTC, datetime, timedelta

    operation = await record_job(
        test_db, "enrich_video", "synthetic-video", ["synthetic-video"]
    )
    operation.status = "dispatching"
    operation.lease_until = datetime.now(UTC) - timedelta(seconds=1)
    await test_db.commit()
    queue = AsyncMock()
    await dispatch_jobs(test_db, queue)
    assert queue.enqueue_job.call_args.kwargs["_job_id"] == f"outbox:{operation.id}"
    await test_db.refresh(operation)
    assert operation.status == "queued"


async def test_active_intents_deduplicate_concurrent_recovery(test_db):
    from app.services.job_dispatch_service import DurableJobQueue

    first = await DurableJobQueue(test_db).enqueue_job(
        "enrich_video", "synthetic-video"
    )
    second = await DurableJobQueue(test_db).enqueue_job(
        "enrich_video", "synthetic-video"
    )
    assert first.id == second.id
    first.status = "failed"
    await test_db.flush()
    retry = await DurableJobQueue(test_db).enqueue_job(
        "enrich_video", "synthetic-video"
    )
    assert retry.id != first.id


async def test_worker_commits_business_data_before_marking_operation_complete(
    test_db, test_engine, test_user
):
    from unittest.mock import patch

    from sqlalchemy import func

    from app.models.list import BookmarkList
    from app.workers.outbox_dispatcher import run_durable_job

    operation = await record_job(
        test_db, "enrich_video", "synthetic-video", ["synthetic-video"]
    )
    await test_db.commit()
    sessions = async_sessionmaker(test_engine, expire_on_commit=False)
    async with sessions() as business:

        async def handler(ctx, video_id):
            ctx["db"].add(
                BookmarkList(name="Durable business probe", user_id=test_user.id)
            )
            await ctx["db"].flush()
            return {"status": "completed"}

        with patch(
            "app.workers.outbox_dispatcher.job_handlers",
            return_value={"enrich_video": handler},
        ):
            await run_durable_job(
                {"outbox_session_factory": sessions, "db": business}, str(operation.id)
            )
        await business.rollback()
    async with sessions() as observer:
        assert (
            await observer.execute(
                select(func.count())
                .select_from(BookmarkList)
                .where(BookmarkList.name == "Durable business probe")
            )
        ).scalar_one() == 1


async def test_parallel_processing_requests_do_not_create_orphan_parent_jobs(
    test_db, test_engine, test_video, test_list
):
    import asyncio

    from fastapi import HTTPException
    from sqlalchemy import func

    from app.api.processing import start_processing
    from app.models.job import ProcessingJob

    sessions = async_sessionmaker(test_engine, expire_on_commit=False)

    async def start():
        async with sessions() as db:
            try:
                return await start_processing(test_list.id, db)
            except HTTPException as error:
                await db.rollback()
                return error

    results = await asyncio.gather(start(), start())
    assert (
        sum(
            isinstance(result, HTTPException) and result.status_code == 409
            for result in results
        )
        == 1
    )
    assert (
        await test_db.execute(select(func.count()).select_from(ProcessingJob))
    ).scalar_one() == 1
    assert (
        await test_db.execute(select(func.count()).select_from(JobOutbox))
    ).scalar_one() == 1


async def test_individual_video_delivery_advances_parent_once(
    test_db, test_engine, test_list
):
    from unittest.mock import patch

    from app.models.job import ProcessingJob
    from app.workers.outbox_dispatcher import run_durable_job

    job = ProcessingJob(list_id=test_list.id, total_videos=1, status="running")
    test_db.add(job)
    await test_db.flush()
    operation = await record_job(
        test_db,
        "process_video",
        "synthetic-video",
        ["synthetic-video", str(test_list.id), {}, str(job.id)],
    )
    await test_db.commit()
    sessions = async_sessionmaker(test_engine, expire_on_commit=False)

    async def handler(ctx, *args):
        return {"status": "success"}

    async with sessions() as business:
        with patch(
            "app.workers.outbox_dispatcher.job_handlers",
            return_value={"process_video": handler},
        ):
            ctx = {"outbox_session_factory": sessions, "db": business}
            await run_durable_job(ctx, str(operation.id))
            assert await run_durable_job(ctx, str(operation.id)) == {
                "status": "ignored"
            }
    await test_db.refresh(job)
    assert (job.processed_count, job.status) == (1, "completed")
