"""One-use connection grants against the isolated real Redis instance."""

import asyncio
import os
from uuid import uuid4

import pytest
from redis.asyncio import Redis

from app.services.connection_ticket_service import (
    consume_ticket,
    issue_ticket,
    ticket_key,
)


@pytest.fixture
async def ticket_redis():
    target = os.environ.get("TEST_REDIS_URL")
    if target != "redis://localhost:56388/3":
        raise ValueError("Explicit isolated TEST_REDIS_URL required")
    client = Redis.from_url(target)
    yield client
    await client.aclose()


async def test_ticket_bound_to_user_and_consumed_atomically(ticket_redis):
    user_id = uuid4()
    ticket = await issue_ticket(ticket_redis, user_id)
    assert ticket not in ticket_key(ticket)
    assert 0 < await ticket_redis.ttl(ticket_key(ticket)) <= 60
    results = await asyncio.gather(
        *[consume_ticket(ticket_redis, ticket) for _ in range(4)]
    )
    assert results.count(user_id) == 1
    assert results.count(None) == 3


async def test_missing_unknown_and_expired_tickets_fail_closed(ticket_redis):
    assert await consume_ticket(ticket_redis, None) is None
    assert await consume_ticket(ticket_redis, "unknown-synthetic-ticket") is None
    ticket = await issue_ticket(ticket_redis, uuid4())
    await ticket_redis.pexpire(ticket_key(ticket), 0)
    assert await consume_ticket(ticket_redis, ticket) is None
