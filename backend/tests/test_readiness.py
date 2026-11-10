from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.parametrize(
    "database,queue,worker,code",
    [
        (True, True, True, 200),
        (False, True, True, 503),
        (True, False, False, 503),
        (True, True, False, 503),
    ],
)
async def test_liveness_and_readiness_have_distinct_contracts(
    monkeypatch, database, queue, worker, code
):
    for name, value in [("database", database), ("queue", queue), ("worker", worker)]:
        monkeypatch.setattr(
            f"app.core.readiness._{name}_ready", AsyncMock(return_value=value)
        )
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        assert (await client.get("/api/health")).json() == {"status": "ok"}
        result = await client.get("/api/ready")
    assert result.status_code == code
    assert result.json() == {"database": database, "queue": queue, "worker": worker}


async def test_dependency_error_is_redacted_and_returns_unready(monkeypatch):
    from app.core.readiness import readiness_status

    monkeypatch.setattr(
        "app.core.readiness._database_ready",
        AsyncMock(side_effect=OSError("private URL")),
    )
    monkeypatch.setattr("app.core.readiness._queue_ready", AsyncMock(return_value=True))
    monkeypatch.setattr(
        "app.core.readiness._worker_ready", AsyncMock(return_value=True)
    )
    assert await readiness_status() == {
        "database": False,
        "queue": True,
        "worker": True,
    }
