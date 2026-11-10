"""
Tests for WebSocket progress endpoint.

These tests verify WebSocket authentication and message delivery.
"""

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.main import app


def test_websocket_rejects_development_connection_without_a_user():
    """Test that WebSocket endpoint exists and requires token parameter"""
    client = TestClient(app)

    # Without token parameter, should get 403 or connection rejection
    with patch("app.api.websocket.get_default_user", new=AsyncMock(return_value=None)):
        with pytest.raises(WebSocketDisconnect):
            with client.websocket_connect("/api/ws/progress"):
                pass


def test_websocket_rejects_invalid_token():
    """Test that WebSocket rejects invalid/expired tokens"""
    client = TestClient(app)

    # Connect with invalid token - should reject during auth
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/api/ws/progress?token=invalid_token_here"):
            pass


@pytest.mark.asyncio
async def test_websocket_accepts_valid_token():
    """Test WebSocket accepts valid token and establishes connection"""
    # TODO: This test requires:
    # 1. User model creation
    # 2. JWT token generation
    # 3. Test fixture for authenticated user
    # Will implement in a follow-up task
    pytest.skip(
        "Requires full user authentication system - implement after basic endpoint is working"
    )
