"""One-use WebSocket tickets: only digests are stored, for at most 60 seconds."""

import hashlib
import secrets
from uuid import UUID

from redis.asyncio import Redis


def ticket_key(ticket: str) -> str:
    return f"syb:ws-ticket:{hashlib.sha256(ticket.encode()).hexdigest()}"


async def issue_ticket(redis: Redis, user_id: UUID) -> str:
    ticket = secrets.token_urlsafe(32)
    if not await redis.set(ticket_key(ticket), str(user_id), ex=60, nx=True):
        raise RuntimeError("Unable to issue connection ticket")
    return ticket


async def consume_ticket(redis: Redis, ticket: str | None) -> UUID | None:
    if not ticket or len(ticket) > 128:
        return None
    identity = await redis.getdel(ticket_key(ticket))
    if identity is None:
        return None
    try:
        return UUID(identity.decode() if isinstance(identity, bytes) else identity)
    except (ValueError, TypeError):
        return None
