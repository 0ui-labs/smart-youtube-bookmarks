"""
Tests for SubscriptionChatService.

Tests the AI-powered subscription creation chat service,
including function calling and config building.

Note: We test _apply_function_call and helper methods directly
to avoid needing to mock the entire Gemini SDK. Integration tests
for the full process_message flow are covered in API tests.
"""

from unittest.mock import MagicMock, patch

import pytest

# ============================================================================
# _apply_function_call Tests
# ============================================================================


@pytest.mark.asyncio
async def test_apply_function_call_set_channels():
    """Test that set_channels function call updates config."""
    from app.services.subscription_chat_service import SubscriptionChatService

    with patch.object(SubscriptionChatService, "__init__", return_value=None):
        service = SubscriptionChatService.__new__(SubscriptionChatService)

        mock_function_call = MagicMock()
        mock_function_call.name = "set_channels"
        mock_function_call.args = {"channel_names": ["Fireship", "@lexfridman"]}

        config = service._apply_function_call({}, mock_function_call)

        assert config["channel_names"] == ["Fireship", "@lexfridman"]


@pytest.mark.asyncio
async def test_apply_function_call_set_keywords():
    """Test that set_keywords function call updates config."""
    from app.services.subscription_chat_service import SubscriptionChatService

    with patch.object(SubscriptionChatService, "__init__", return_value=None):
        service = SubscriptionChatService.__new__(SubscriptionChatService)

        mock_function_call = MagicMock()
        mock_function_call.name = "set_keywords"
        mock_function_call.args = {"keywords": ["Python", "FastAPI"]}

        config = service._apply_function_call({}, mock_function_call)

        assert config["keywords"] == ["Python", "FastAPI"]


@pytest.mark.asyncio
async def test_apply_function_call_set_duration_filter():
    """Test that set_duration_filter function call updates config."""
    from app.services.subscription_chat_service import SubscriptionChatService

    with patch.object(SubscriptionChatService, "__init__", return_value=None):
        service = SubscriptionChatService.__new__(SubscriptionChatService)

        mock_function_call = MagicMock()
        mock_function_call.name = "set_duration_filter"
        mock_function_call.args = {"min_minutes": 10, "max_minutes": 30}

        config = service._apply_function_call({}, mock_function_call)

        assert config["filters"]["duration"]["min_seconds"] == 600
        assert config["filters"]["duration"]["max_seconds"] == 1800


@pytest.mark.asyncio
async def test_apply_function_call_set_duration_filter_min_only():
    """Test duration filter with only minimum specified."""
    from app.services.subscription_chat_service import SubscriptionChatService

    with patch.object(SubscriptionChatService, "__init__", return_value=None):
        service = SubscriptionChatService.__new__(SubscriptionChatService)

        mock_function_call = MagicMock()
        mock_function_call.name = "set_duration_filter"
        mock_function_call.args = {"min_minutes": 5}

        config = service._apply_function_call({}, mock_function_call)

        assert config["filters"]["duration"]["min_seconds"] == 300
        assert config["filters"]["duration"]["max_seconds"] is None


@pytest.mark.asyncio
async def test_apply_function_call_set_views_filter():
    """Test that set_views_filter function call updates config."""
    from app.services.subscription_chat_service import SubscriptionChatService

    with patch.object(SubscriptionChatService, "__init__", return_value=None):
        service = SubscriptionChatService.__new__(SubscriptionChatService)

        mock_function_call = MagicMock()
        mock_function_call.name = "set_views_filter"
        mock_function_call.args = {"min_views": 10000}

        config = service._apply_function_call({}, mock_function_call)

        assert config["filters"]["views"]["min_views"] == 10000


@pytest.mark.asyncio
async def test_apply_function_call_set_quality_filter():
    """Test that set_quality_filter function call updates config."""
    from app.services.subscription_chat_service import SubscriptionChatService

    with patch.object(SubscriptionChatService, "__init__", return_value=None):
        service = SubscriptionChatService.__new__(SubscriptionChatService)

        mock_function_call = MagicMock()
        mock_function_call.name = "set_quality_filter"
        mock_function_call.args = {
            "min_quality_score": 7,
            "filter_clickbait": True,
        }

        config = service._apply_function_call({}, mock_function_call)

        assert config["filters"]["ai_filter"]["enabled"] is True
        assert config["filters"]["ai_filter"]["min_quality_score"] == 7
        assert config["filters"]["ai_filter"]["filter_clickbait"] is True


@pytest.mark.asyncio
async def test_apply_function_call_set_quality_filter_defaults():
    """Test quality filter uses defaults when not specified."""
    from app.services.subscription_chat_service import SubscriptionChatService

    with patch.object(SubscriptionChatService, "__init__", return_value=None):
        service = SubscriptionChatService.__new__(SubscriptionChatService)

        mock_function_call = MagicMock()
        mock_function_call.name = "set_quality_filter"
        mock_function_call.args = {}

        config = service._apply_function_call({}, mock_function_call)

        assert config["filters"]["ai_filter"]["enabled"] is True
        assert config["filters"]["ai_filter"]["min_quality_score"] == 5  # Default
        assert config["filters"]["ai_filter"]["filter_clickbait"] is True  # Default


@pytest.mark.asyncio
async def test_apply_function_call_set_name():
    """Test that set_name function call updates config."""
    from app.services.subscription_chat_service import SubscriptionChatService

    with patch.object(SubscriptionChatService, "__init__", return_value=None):
        service = SubscriptionChatService.__new__(SubscriptionChatService)

        mock_function_call = MagicMock()
        mock_function_call.name = "set_name"
        mock_function_call.args = {"name": "Meine Python Videos"}

        config = service._apply_function_call({}, mock_function_call)

        assert config["name"] == "Meine Python Videos"


@pytest.mark.asyncio
async def test_apply_function_call_set_poll_interval():
    """Test that set_poll_interval function call updates config."""
    from app.services.subscription_chat_service import SubscriptionChatService

    with patch.object(SubscriptionChatService, "__init__", return_value=None):
        service = SubscriptionChatService.__new__(SubscriptionChatService)

        mock_function_call = MagicMock()
        mock_function_call.name = "set_poll_interval"
        mock_function_call.args = {"interval": "hourly"}

        config = service._apply_function_call({}, mock_function_call)

        assert config["poll_interval"] == "hourly"


@pytest.mark.asyncio
async def test_apply_function_call_confirm_subscription():
    """Test that confirm_subscription function call updates config."""
    from app.services.subscription_chat_service import SubscriptionChatService

    with patch.object(SubscriptionChatService, "__init__", return_value=None):
        service = SubscriptionChatService.__new__(SubscriptionChatService)

        mock_function_call = MagicMock()
        mock_function_call.name = "confirm_subscription"
        mock_function_call.args = {"ready": True}

        config = service._apply_function_call({}, mock_function_call)

        assert config["confirmed"] is True


@pytest.mark.asyncio
async def test_apply_function_call_preserves_existing_config():
    """Test that function calls preserve existing config values."""
    from app.services.subscription_chat_service import SubscriptionChatService

    with patch.object(SubscriptionChatService, "__init__", return_value=None):
        service = SubscriptionChatService.__new__(SubscriptionChatService)

        existing_config = {
            "name": "Existing Name",
            "keywords": ["Existing"],
        }

        mock_function_call = MagicMock()
        mock_function_call.name = "set_channels"
        mock_function_call.args = {"channel_names": ["NewChannel"]}

        config = service._apply_function_call(existing_config, mock_function_call)

        # New value added
        assert config["channel_names"] == ["NewChannel"]
        # Existing values preserved
        assert config["name"] == "Existing Name"
        assert config["keywords"] == ["Existing"]


# ============================================================================
# _is_ready Tests
# ============================================================================


@pytest.mark.asyncio
async def test_is_ready_with_name_and_channels():
    """Test that subscription is ready when name and channels are set."""
    from app.services.subscription_chat_service import SubscriptionChatService

    with patch.object(SubscriptionChatService, "__init__", return_value=None):
        service = SubscriptionChatService.__new__(SubscriptionChatService)

        config = {
            "name": "Test Subscription",
            "channel_names": ["Fireship"],
        }

        assert service._is_ready(config) is True


@pytest.mark.asyncio
async def test_is_ready_with_name_and_keywords():
    """Test that subscription is ready when name and keywords are set."""
    from app.services.subscription_chat_service import SubscriptionChatService

    with patch.object(SubscriptionChatService, "__init__", return_value=None):
        service = SubscriptionChatService.__new__(SubscriptionChatService)

        config = {
            "name": "Test Subscription",
            "keywords": ["Python"],
        }

        assert service._is_ready(config) is True


@pytest.mark.asyncio
async def test_is_ready_without_name():
    """Test that subscription is not ready without a name."""
    from app.services.subscription_chat_service import SubscriptionChatService

    with patch.object(SubscriptionChatService, "__init__", return_value=None):
        service = SubscriptionChatService.__new__(SubscriptionChatService)

        config = {
            "channel_names": ["Fireship"],
        }

        assert service._is_ready(config) is False


@pytest.mark.asyncio
async def test_is_ready_without_source():
    """Test that subscription is not ready without channels or keywords."""
    from app.services.subscription_chat_service import SubscriptionChatService

    with patch.object(SubscriptionChatService, "__init__", return_value=None):
        service = SubscriptionChatService.__new__(SubscriptionChatService)

        config = {
            "name": "Test Subscription",
        }

        # Returns falsy value (None, empty list, or False)
        assert not service._is_ready(config)


@pytest.mark.asyncio
async def test_is_ready_empty_config():
    """Test that empty config is not ready."""
    from app.services.subscription_chat_service import SubscriptionChatService

    with patch.object(SubscriptionChatService, "__init__", return_value=None):
        service = SubscriptionChatService.__new__(SubscriptionChatService)

        # Returns falsy value
        assert not service._is_ready({})


@pytest.mark.asyncio
async def test_is_ready_with_empty_channels():
    """Test that empty channels list is not considered a source."""
    from app.services.subscription_chat_service import SubscriptionChatService

    with patch.object(SubscriptionChatService, "__init__", return_value=None):
        service = SubscriptionChatService.__new__(SubscriptionChatService)

        config = {
            "name": "Test",
            "channel_names": [],  # Empty list
        }

        # Returns falsy value
        assert not service._is_ready(config)


# ============================================================================
# _generate_summary Tests
# ============================================================================


@pytest.mark.asyncio
async def test_generate_summary_with_all_fields():
    """Test summary generation with all fields populated."""
    from app.services.subscription_chat_service import SubscriptionChatService

    with patch.object(SubscriptionChatService, "__init__", return_value=None):
        service = SubscriptionChatService.__new__(SubscriptionChatService)

        config = {
            "name": "Test Sub",
            "channel_names": ["Fireship", "Theo"],
            "keywords": ["Python", "TypeScript"],
            "filters": {
                "duration": {"min_seconds": 600, "max_seconds": 1800},
                "views": {"min_views": 5000},
            },
        }

        summary = service._generate_summary(config)

        assert "Test Sub" in summary
        assert "Fireship" in summary
        assert "Theo" in summary
        assert "Python" in summary
        assert "TypeScript" in summary
        assert "10 Minuten" in summary  # 600 / 60
        assert "30 Minuten" in summary  # 1800 / 60
        assert "5,000" in summary or "5000" in summary


@pytest.mark.asyncio
async def test_generate_summary_minimal():
    """Test summary with minimal config."""
    from app.services.subscription_chat_service import SubscriptionChatService

    with patch.object(SubscriptionChatService, "__init__", return_value=None):
        service = SubscriptionChatService.__new__(SubscriptionChatService)

        config = {}

        summary = service._generate_summary(config)

        assert "Fehlt noch" in summary
        assert "Name" in summary


@pytest.mark.asyncio
async def test_generate_summary_ready_message():
    """Test that ready message appears when subscription is complete."""
    from app.services.subscription_chat_service import SubscriptionChatService

    with patch.object(SubscriptionChatService, "__init__", return_value=None):
        service = SubscriptionChatService.__new__(SubscriptionChatService)

        config = {
            "name": "Ready Sub",
            "keywords": ["Test"],
        }

        summary = service._generate_summary(config)

        assert "bereit" in summary.lower()


@pytest.mark.asyncio
async def test_generate_summary_with_duration_min_only():
    """Test summary with only minimum duration."""
    from app.services.subscription_chat_service import SubscriptionChatService

    with patch.object(SubscriptionChatService, "__init__", return_value=None):
        service = SubscriptionChatService.__new__(SubscriptionChatService)

        config = {
            "name": "Test",
            "keywords": ["Test"],
            "filters": {
                "duration": {"min_seconds": 300, "max_seconds": None},
            },
        }

        summary = service._generate_summary(config)

        assert "Mindestdauer" in summary
        assert "5 Minuten" in summary


# ============================================================================
# Function Definitions Tests
# ============================================================================


def test_subscription_functions_defined():
    """Test that all required functions are defined."""
    from app.services.subscription_chat_service import SUBSCRIPTION_FUNCTIONS

    function_names = [f["name"] for f in SUBSCRIPTION_FUNCTIONS]

    assert "set_channels" in function_names
    assert "set_keywords" in function_names
    assert "set_duration_filter" in function_names
    assert "set_views_filter" in function_names
    assert "set_quality_filter" in function_names
    assert "set_name" in function_names
    assert "set_poll_interval" in function_names
    assert "confirm_subscription" in function_names


def test_subscription_functions_have_descriptions():
    """Test that all functions have descriptions."""
    from app.services.subscription_chat_service import SUBSCRIPTION_FUNCTIONS

    for func in SUBSCRIPTION_FUNCTIONS:
        assert "description" in func, f"Function {func['name']} missing description"
        assert len(func["description"]) > 0


def test_subscription_functions_have_parameters():
    """Test that all functions have parameter definitions."""
    from app.services.subscription_chat_service import SUBSCRIPTION_FUNCTIONS

    for func in SUBSCRIPTION_FUNCTIONS:
        assert "parameters" in func, f"Function {func['name']} missing parameters"
        assert func["parameters"]["type"] == "object"


# ============================================================================
# ChatResponse Tests
# ============================================================================


def test_chat_response_dataclass():
    """Test ChatResponse dataclass creation."""
    from app.services.subscription_chat_service import ChatResponse

    response = ChatResponse(
        message="Test message",
        subscription_preview={"name": "Test"},
        ready_to_create=True,
        conversation_history=[{"role": "user", "content": "Hi"}],
    )

    assert response.message == "Test message"
    assert response.subscription_preview == {"name": "Test"}
    assert response.ready_to_create is True
    assert len(response.conversation_history) == 1
