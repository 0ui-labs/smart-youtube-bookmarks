"""Real PostgreSQL progress persistence; Redis transport is deliberately mocked."""

import json
from unittest.mock import AsyncMock

import pytest
from sqlalchemy import select

from app.models.job import ProcessingJob
from app.models.job_outbox import JobOutbox
from app.models.job_progress import JobProgressEvent
from app.workers.video_processor import _update_job_progress


@pytest.mark.asyncio
async def test_progress_publication_waits_for_business_commit(test_db, test_list):
    job = ProcessingJob(list_id=test_list.id, total_videos=2, status="running")
    test_db.add(job)
    await test_db.commit()
    redis = AsyncMock()
    await _update_job_progress(test_db, str(job.id), True, redis)
    redis.publish.assert_not_awaited()
    event = (await test_db.execute(select(JobProgressEvent))).scalar_one()
    intent = (await test_db.execute(select(JobOutbox))).scalar_one()
    assert intent.kind == "publish_job_progress"
    assert intent.payload["args"] == [str(event.id)]
    await test_db.rollback()
    assert (await test_db.execute(select(JobProgressEvent))).scalars().all() == []
    assert (await test_db.execute(select(JobOutbox))).scalars().all() == []


@pytest.mark.asyncio
async def test_live_delivery_has_same_identity_as_history(test_db, test_list):
    from app.workers.progress_delivery import publish_job_progress

    job = ProcessingJob(list_id=test_list.id, total_videos=1, status="running")
    test_db.add(job)
    await test_db.commit()
    redis = AsyncMock()
    await _update_job_progress(test_db, str(job.id), False, redis)
    await test_db.commit()
    event = (await test_db.execute(select(JobProgressEvent))).scalar_one()
    await publish_job_progress({"db": test_db, "redis": redis}, str(event.id))
    channel, payload = redis.publish.call_args.args
    message = json.loads(payload)
    assert channel == f"progress:user:{test_list.user_id}"
    assert message["event_id"] == str(event.id)
    assert message["created_at"] == event.created_at.isoformat()
    assert message["status"] == "completed_with_errors"
    assert message["failed"] == 1


@pytest.mark.asyncio
async def test_parallel_progress_updates_preserve_all_counters(
    test_db, test_engine, test_list
):
    import asyncio

    from sqlalchemy.ext.asyncio import async_sessionmaker

    job = ProcessingJob(list_id=test_list.id, total_videos=4, status="running")
    test_db.add(job)
    await test_db.commit()
    job_id = job.id
    sessions = async_sessionmaker(test_engine, expire_on_commit=False)

    async def advance(success):
        async with sessions() as db:
            await _update_job_progress(db, str(job_id), success)
            await db.commit()

    await asyncio.gather(advance(True), advance(False), advance(True), advance(True))
    await test_db.refresh(job)
    assert (job.processed_count, job.failed_count, job.status) == (
        3,
        1,
        "completed_with_errors",
    )
    events = (
        (
            await test_db.execute(
                select(JobProgressEvent).order_by(
                    JobProgressEvent.created_at, JobProgressEvent.id
                )
            )
        )
        .scalars()
        .all()
    )
    assert [event.progress_data["progress"] for event in events] == [25, 50, 75, 100]
    assert len((await test_db.execute(select(JobOutbox))).scalars().all()) == 4


@pytest.mark.asyncio
async def test_failed_live_transport_replays_the_committed_event(test_db, test_list):
    from app.workers.progress_delivery import publish_job_progress

    job = ProcessingJob(list_id=test_list.id, total_videos=1, status="running")
    test_db.add(job)
    await test_db.commit()
    await _update_job_progress(test_db, str(job.id), True)
    await test_db.commit()
    event = (await test_db.execute(select(JobProgressEvent))).scalar_one()
    redis = AsyncMock()
    redis.publish.side_effect = [ConnectionError("offline"), None, None]
    ctx = {"db": test_db, "redis": redis}
    with pytest.raises(ConnectionError):
        await publish_job_progress(ctx, str(event.id))
    await publish_job_progress(ctx, str(event.id))
    await publish_job_progress(ctx, str(event.id))
    assert len({call.args[1] for call in redis.publish.call_args_list}) == 1
    assert (await test_db.execute(select(JobProgressEvent))).scalar_one().id == event.id
