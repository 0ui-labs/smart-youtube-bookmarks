"""Bounded dependency checks, separate from process liveness."""

import asyncio
from collections.abc import Awaitable
from typing import Any

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.redis import get_redis_client
from app.models.job_outbox import JobOutbox

WORKER_HEARTBEAT_KEY = "syb:worker:heartbeat"
WORKER_HEARTBEAT_TTL = 60


async def mark_worker_ready(redis: Any) -> None:
    await redis.set(WORKER_HEARTBEAT_KEY, "ready", ex=WORKER_HEARTBEAT_TTL)


async def _database_ready() -> bool:
    async with AsyncSessionLocal() as db:
        # Existence of the durable queue table matters as well as connectivity.
        await db.execute(select(JobOutbox.id).limit(1))
        return True


async def _queue_ready() -> bool:
    return bool(await (await get_redis_client()).ping())


async def _worker_ready() -> bool:
    return bool(await (await get_redis_client()).get(WORKER_HEARTBEAT_KEY))


async def readiness_status() -> dict[str, bool]:
    async def bounded(check: Awaitable[bool]) -> bool:
        try:
            return await asyncio.wait_for(check, timeout=2)
        except Exception:
            return False

    values = await asyncio.gather(
        bounded(_database_ready()), bounded(_queue_ready()), bounded(_worker_ready())
    )
    return dict(zip(("database", "queue", "worker"), values, strict=True))
