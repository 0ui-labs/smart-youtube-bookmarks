"""WebSocket handshake grants never accept legacy tokens or a default user."""

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.core.ticket_redaction import TicketRedactionMiddleware
from app.main import app


@pytest.mark.parametrize(
    "query", ["", "?token=legacy", "?ticket=missing", "?ticket=a&ticket=b"]
)
def test_websocket_rejects_missing_or_invalid_ticket(query):
    with patch("app.api.deps.get_redis_client", new=AsyncMock()) as get_redis:
        get_redis.return_value.getdel.return_value = None
        with pytest.raises(WebSocketDisconnect) as error:
            with TestClient(app).websocket_connect(f"/api/ws/progress{query}"):
                pytest.fail("Handshake must not succeed")
        assert error.value.code == 1008


async def test_ticket_is_removed_from_logging_scope():
    observed = []

    async def endpoint(scope, receive, send):
        observed.append(dict(scope))

    middleware = TicketRedactionMiddleware(endpoint)
    scope = {"type": "websocket", "query_string": b"ticket=synthetic-value"}
    await middleware(scope, AsyncMock(), AsyncMock())
    assert observed[0]["connection_ticket"] == "synthetic-value"
    assert scope["query_string"] == b"ticket=redacted"


async def test_authenticated_socket_routes_own_channel_and_stops_on_disconnect():
    import asyncio
    from types import SimpleNamespace
    from unittest.mock import MagicMock
    from uuid import uuid4

    user = SimpleNamespace(id=uuid4())
    socket = AsyncMock()
    socket.scope = {"connection_ticket": "synthetic-ticket"}
    socket.client_state = SimpleNamespace(name="CONNECTED")
    socket.receive_json.side_effect = [{"type": "ping"}, WebSocketDisconnect(1000)]
    pubsub = AsyncMock()

    async def messages():
        await asyncio.Event().wait()
        yield {}

    pubsub.listen = messages
    redis = MagicMock()
    redis.pubsub.return_value = pubsub
    from app.api.websocket import websocket_progress_endpoint

    with (
        patch(
            "app.api.websocket.get_current_ws_user", new=AsyncMock(return_value=user)
        ),
        patch("app.api.websocket.get_redis_client", new=AsyncMock(return_value=redis)),
    ):
        await asyncio.wait_for(websocket_progress_endpoint(socket), timeout=1)
    socket.accept.assert_awaited_once()
    socket.send_json.assert_any_await(
        {"type": "auth_confirmed", "authenticated": True, "user_id": str(user.id)}
    )
    socket.send_json.assert_any_await({"type": "pong"})
    pubsub.subscribe.assert_awaited_once_with(f"progress:user:{user.id}")
    pubsub.unsubscribe.assert_awaited_once_with(f"progress:user:{user.id}")
