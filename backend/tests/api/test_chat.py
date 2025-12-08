"""
Tests for Chat API endpoints.

Tests the AI-powered subscription creation chat endpoints
with mocked Gemini and YouTube services.
"""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient


async def create_test_list(client: AsyncClient) -> dict:
    """Helper to create a test list."""
    response = await client.post(
        "/api/lists",
        json={
            "name": f"Chat Test List {uuid.uuid4().hex[:8]}",
            "description": "For chat testing",
        },
    )
    return response.json()


@pytest.fixture
def mock_chat_response():
    """Create a mock ChatResponse dataclass."""
    from dataclasses import dataclass

    @dataclass
    class MockChatResponse:
        message: str
        subscription_preview: dict
        ready_to_create: bool
        conversation_history: list

    return MockChatResponse


# ============================================================================
# Chat Subscription Endpoint Tests
# ============================================================================


@pytest.mark.asyncio
async def test_chat_subscription_basic(client: AsyncClient, mock_chat_response):
    """Test basic chat message processing."""
    test_list = await create_test_list(client)
    list_id = test_list["id"]

    mock_response = mock_chat_response(
        message="Ich habe verstanden, du möchtest Python Videos.",
        subscription_preview={"keywords": ["Python"]},
        ready_to_create=False,
        conversation_history=[
            {"role": "user", "content": "Ich möchte Python Videos"},
            {"role": "assistant", "content": "Ich habe verstanden..."},
        ],
    )

    with patch("app.api.chat.SubscriptionChatService") as mock_service_class:
        mock_service = MagicMock()
        mock_service.process_message = AsyncMock(return_value=mock_response)
        mock_service_class.return_value = mock_service

        response = await client.post(
            "/api/chat/subscription",
            json={
                "message": "Ich möchte Python Videos",
                "list_id": list_id,
                "current_config": {},
                "conversation_history": [],
            },
        )

    assert response.status_code == 200
    data = response.json()
    assert "Python" in data["subscription_preview"]["keywords"]
    assert data["ready_to_create"] is False
    assert len(data["conversation_history"]) == 2


@pytest.mark.asyncio
async def test_chat_subscription_with_existing_config(
    client: AsyncClient, mock_chat_response
):
    """Test chat with existing configuration."""
    test_list = await create_test_list(client)
    list_id = test_list["id"]

    mock_response = mock_chat_response(
        message="Name hinzugefügt!",
        subscription_preview={
            "keywords": ["Python"],
            "name": "Python Tutorials",
        },
        ready_to_create=True,
        conversation_history=[
            {"role": "user", "content": "Erste Nachricht"},
            {"role": "assistant", "content": "Erste Antwort"},
            {"role": "user", "content": "Nenne es Python Tutorials"},
            {"role": "assistant", "content": "Name hinzugefügt!"},
        ],
    )

    with patch("app.api.chat.SubscriptionChatService") as mock_service_class:
        mock_service = MagicMock()
        mock_service.process_message = AsyncMock(return_value=mock_response)
        mock_service_class.return_value = mock_service

        response = await client.post(
            "/api/chat/subscription",
            json={
                "message": "Nenne es Python Tutorials",
                "list_id": list_id,
                "current_config": {"keywords": ["Python"]},
                "conversation_history": [
                    {"role": "user", "content": "Erste Nachricht"},
                    {"role": "assistant", "content": "Erste Antwort"},
                ],
            },
        )

    assert response.status_code == 200
    data = response.json()
    assert data["subscription_preview"]["name"] == "Python Tutorials"
    assert data["ready_to_create"] is True


@pytest.mark.asyncio
async def test_chat_subscription_without_gemini_key(client: AsyncClient):
    """Test that chat fails gracefully without Gemini API key."""
    test_list = await create_test_list(client)
    list_id = test_list["id"]

    with patch("app.api.chat.settings") as mock_settings:
        mock_settings.gemini_api_key = None
        mock_settings.env = "development"

        response = await client.post(
            "/api/chat/subscription",
            json={
                "message": "Test",
                "list_id": list_id,
            },
        )

    assert response.status_code == 503
    assert "Gemini" in response.json()["detail"]


# ============================================================================
# Create Subscription from Chat Tests
# ============================================================================


@pytest.mark.asyncio
async def test_create_subscription_from_chat_minimal(client: AsyncClient):
    """Test creating a subscription from chat config."""
    test_list = await create_test_list(client)
    list_id = test_list["id"]

    with patch("app.api.chat.ChannelResolverService") as mock_resolver_class:
        mock_resolver = MagicMock()
        mock_resolver.resolve_channel_names = AsyncMock(return_value={})
        mock_resolver_class.return_value = mock_resolver

        response = await client.post(
            "/api/chat/subscription/create",
            json={
                "list_id": list_id,
                "config": {
                    "name": "Test Chat Sub",
                    "keywords": ["Python"],
                },
            },
        )

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test Chat Sub"
    assert data["keywords"] == ["Python"]
    assert data["list_id"] == list_id


@pytest.mark.asyncio
async def test_create_subscription_from_chat_with_channels(client: AsyncClient):
    """Test creating subscription with channel name resolution."""
    test_list = await create_test_list(client)
    list_id = test_list["id"]

    with patch("app.api.chat.ChannelResolverService") as mock_resolver_class:
        mock_resolver = MagicMock()
        mock_resolver.resolve_channel_names = AsyncMock(
            return_value={
                "Fireship": "UCsBjURrPoezykLs9EqgamOA",
                "@lexfridman": "UCSHZKyawb77ixDdsGog4iWA",
            }
        )
        mock_resolver_class.return_value = mock_resolver

        response = await client.post(
            "/api/chat/subscription/create",
            json={
                "list_id": list_id,
                "config": {
                    "name": "Channel Sub",
                    "channel_names": ["Fireship", "@lexfridman"],
                },
            },
        )

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Channel Sub"
    assert "UCsBjURrPoezykLs9EqgamOA" in data["channel_ids"]
    assert "UCSHZKyawb77ixDdsGog4iWA" in data["channel_ids"]


@pytest.mark.asyncio
async def test_create_subscription_from_chat_with_filters(client: AsyncClient):
    """Test creating subscription with filters from chat."""
    test_list = await create_test_list(client)
    list_id = test_list["id"]

    with patch("app.api.chat.ChannelResolverService") as mock_resolver_class:
        mock_resolver = MagicMock()
        mock_resolver.resolve_channel_names = AsyncMock(return_value={})
        mock_resolver_class.return_value = mock_resolver

        response = await client.post(
            "/api/chat/subscription/create",
            json={
                "list_id": list_id,
                "config": {
                    "name": "Filtered Sub",
                    "keywords": ["Tutorial"],
                    "filters": {
                        "duration": {"min_seconds": 600, "max_seconds": 3600},
                        "views": {"min_views": 1000},
                    },
                    "poll_interval": "twice_daily",
                },
            },
        )

    assert response.status_code == 201
    data = response.json()
    assert data["filters"]["duration"]["min_seconds"] == 600
    assert data["filters"]["views"]["min_views"] == 1000
    assert data["poll_interval"] == "twice_daily"


@pytest.mark.asyncio
async def test_create_subscription_from_chat_default_name(client: AsyncClient):
    """Test that default name is used if not provided."""
    test_list = await create_test_list(client)
    list_id = test_list["id"]

    with patch("app.api.chat.ChannelResolverService") as mock_resolver_class:
        mock_resolver = MagicMock()
        mock_resolver.resolve_channel_names = AsyncMock(return_value={})
        mock_resolver_class.return_value = mock_resolver

        response = await client.post(
            "/api/chat/subscription/create",
            json={
                "list_id": list_id,
                "config": {
                    "keywords": ["Python"],  # No name
                },
            },
        )

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Neues Abo"  # Default name


@pytest.mark.asyncio
async def test_create_subscription_from_chat_invalid_list(client: AsyncClient):
    """Test that creating with invalid list fails."""
    fake_list_id = str(uuid.uuid4())

    with patch("app.api.chat.ChannelResolverService") as mock_resolver_class:
        mock_resolver = MagicMock()
        mock_resolver.resolve_channel_names = AsyncMock(return_value={})
        mock_resolver_class.return_value = mock_resolver

        response = await client.post(
            "/api/chat/subscription/create",
            json={
                "list_id": fake_list_id,
                "config": {
                    "name": "Test",
                    "keywords": ["Python"],
                },
            },
        )

    assert response.status_code == 400


@pytest.mark.asyncio
async def test_create_subscription_from_chat_unresolved_channels(client: AsyncClient):
    """Test handling of channels that couldn't be resolved."""
    test_list = await create_test_list(client)
    list_id = test_list["id"]

    with patch("app.api.chat.ChannelResolverService") as mock_resolver_class:
        mock_resolver = MagicMock()
        mock_resolver.resolve_channel_names = AsyncMock(
            return_value={
                "Fireship": "UCsBjURrPoezykLs9EqgamOA",
                "@unknownchannel": None,  # Not found
            }
        )
        mock_resolver_class.return_value = mock_resolver

        response = await client.post(
            "/api/chat/subscription/create",
            json={
                "list_id": list_id,
                "config": {
                    "name": "Partial Channel Sub",
                    "channel_names": ["Fireship", "@unknownchannel"],
                },
            },
        )

    assert response.status_code == 201
    data = response.json()
    # Only the resolved channel should be included
    assert data["channel_ids"] == ["UCsBjURrPoezykLs9EqgamOA"]


@pytest.mark.asyncio
async def test_create_subscription_from_chat_with_ai_filter(client: AsyncClient):
    """Test creating subscription with AI quality filter."""
    test_list = await create_test_list(client)
    list_id = test_list["id"]

    with patch("app.api.chat.ChannelResolverService") as mock_resolver_class:
        mock_resolver = MagicMock()
        mock_resolver.resolve_channel_names = AsyncMock(return_value={})
        mock_resolver_class.return_value = mock_resolver

        response = await client.post(
            "/api/chat/subscription/create",
            json={
                "list_id": list_id,
                "config": {
                    "name": "Quality Sub",
                    "keywords": ["Tutorial"],
                    "filters": {
                        "ai_filter": {
                            "enabled": True,
                            "min_quality_score": 7,
                            "filter_clickbait": True,
                        },
                    },
                },
            },
        )

    assert response.status_code == 201
    data = response.json()
    assert data["filters"]["ai_filter"]["enabled"] is True
