"""Resolve WebSocket identity only from a consumed session-bound ticket."""

from fastapi import WebSocket

from app.core.database import AsyncSessionLocal
from app.core.redis import get_redis_client
from app.models.user import User
from app.services.connection_ticket_service import consume_ticket


async def get_current_ws_user(websocket: WebSocket, ticket: str | None) -> User | None:
    try:
        user_id = await consume_ticket(await get_redis_client(), ticket)
        if user_id is not None:
            async with AsyncSessionLocal() as db:
                user = await db.get(User, user_id)
                if user is not None and user.is_active:
                    return user
    except Exception:
        pass  # Fail closed; credentials and transport details are never logged.
    await websocket.close(code=1008)
    return None
