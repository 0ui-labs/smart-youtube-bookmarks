"""Real PostgreSQL -> Redis -> ARQ transport; provider work remains synthetic."""

import os
from unittest.mock import patch
from urllib.parse import urlparse

from arq import create_pool
from arq.connections import RedisSettings
from arq.worker import Worker, func
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.services.job_dispatch_service import dispatch_jobs, record_job
from app.workers.outbox_dispatcher import run_durable_job


async def test_real_redis_dispatch_and_worker_completion(test_db, test_engine):
    target = os.environ.get("TEST_REDIS_URL", "")
    parsed = urlparse(target)
    if (
        parsed.hostname not in {"localhost", "127.0.0.1"}
        or parsed.port != 56388
        or parsed.path != "/3"
    ):
        raise ValueError(
            "TEST_REDIS_URL must explicitly name isolated compose Redis on port 56388 database 3"
        )
    queue = await create_pool(RedisSettings.from_dsn(target))
    operation = await record_job(
        test_db, "enrich_video", "synthetic-transport", ["synthetic-transport"]
    )
    await test_db.commit()
    calls = []

    async def handler(ctx, video_id):
        calls.append(video_id)
        return {"status": "completed"}

    try:
        assert await dispatch_jobs(test_db, queue) == 1
        worker = Worker(
            functions=[func(run_durable_job, keep_result=0)],
            redis_pool=queue,
            burst=True,
            handle_signals=False,
            ctx={
                "outbox_session_factory": async_sessionmaker(
                    test_engine, expire_on_commit=False
                ),
                "db": test_db,
            },
        )
        with patch(
            "app.workers.outbox_dispatcher.job_handlers",
            return_value={"enrich_video": handler},
        ):
            await worker.async_run()
        await test_db.refresh(operation)
        assert operation.status == "completed"
        assert calls == ["synthetic-transport"]
        await worker.close()
    finally:
        await queue.close(close_connection_pool=True)
