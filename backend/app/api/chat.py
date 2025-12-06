"""
Chat API endpoints for AI-assisted subscription creation.

Provides endpoints for natural language subscription configuration
using Gemini Function Calling.
"""

import logging
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User
from app.schemas.subscription import (
    SubscriptionCreate,
    SubscriptionFilters,
    SubscriptionResponse,
)
from app.services.channel_resolver_service import ChannelResolverService
from app.services.subscription_chat_service import SubscriptionChatService
from app.services.subscription_service import SubscriptionService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["chat"])


# ============================================================================
# User Helper (same pattern as subscriptions.py)
# ============================================================================


async def get_user_for_testing(
    db: AsyncSession,
    user_id: UUID | None = Query(
        None,
        description="[TESTING ONLY] User ID - defaults to first user if not provided",
    ),
) -> User:
    """
    Get user for testing purposes.

    SECURITY WARNING: This is a temporary solution for local development.
    Production deployments MUST implement proper JWT authentication.
    """
    if settings.env == "production":
        logger.error(
            "get_user_for_testing() called in PRODUCTION environment - security risk!"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Testing helper not available in production environment",
        )

    if user_id:
        stmt = select(User).where(User.id == user_id)
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(
                status_code=404, detail=f"User with ID {user_id} not found"
            )
    else:
        result = await db.execute(select(User))
        user = result.scalars().first()
        if not user:
            raise HTTPException(status_code=400, detail="No user found in database")

    return user


# ============================================================================
# Request/Response Schemas
# ============================================================================


class ChatMessage(BaseModel):
    """A single message in the conversation."""

    role: str = Field(description="Message role: 'user' or 'assistant'")
    content: str = Field(description="Message content")


class ChatRequest(BaseModel):
    """Request for subscription chat endpoint."""

    message: str = Field(description="User's message")
    list_id: UUID = Field(description="Target list for the subscription")
    current_config: dict[str, Any] = Field(
        default_factory=dict, description="Current subscription configuration"
    )
    conversation_history: list[ChatMessage] = Field(
        default_factory=list, description="Previous messages in conversation"
    )


class ChatResponseSchema(BaseModel):
    """Response from subscription chat endpoint."""

    message: str = Field(description="Assistant's response message")
    subscription_preview: dict[str, Any] = Field(
        description="Current subscription configuration"
    )
    ready_to_create: bool = Field(
        description="Whether subscription has enough info to be created"
    )
    conversation_history: list[ChatMessage] = Field(
        description="Full conversation history including new messages"
    )


class CreateFromChatRequest(BaseModel):
    """Request to create subscription from chat configuration."""

    list_id: UUID = Field(description="Target list for the subscription")
    config: dict[str, Any] = Field(description="Configuration built from chat")


# ============================================================================
# Endpoints
# ============================================================================


@router.post("/subscription", response_model=ChatResponseSchema)
async def chat_subscription(request: ChatRequest) -> ChatResponseSchema:
    """
    Process a chat message for subscription creation.

    Uses Gemini AI to interpret natural language requests and build
    subscription configurations incrementally.

    Args:
        request: Chat request with message and current config

    Returns:
        Updated configuration and assistant response

    Example:
        >>> request = ChatRequest(
        ...     message="Ich möchte alle FastAPI Videos von Fireship",
        ...     list_id="uuid-here",
        ...     current_config={},
        ...     conversation_history=[]
        ... )
        >>> response = await chat_subscription(request)
        >>> print(response.subscription_preview)
        {"keywords": ["FastAPI"], "channel_names": ["Fireship"]}
    """
    # Check if Gemini API key is configured
    if not settings.gemini_api_key:
        raise HTTPException(
            status_code=503,
            detail="Chat feature unavailable: Gemini API key not configured",
        )

    service = SubscriptionChatService()

    # Convert history to dict format
    history = [
        {"role": msg.role, "content": msg.content}
        for msg in request.conversation_history
    ]

    result = await service.process_message(
        message=request.message,
        current_config=request.current_config,
        list_id=request.list_id,
        conversation_history=history,
    )

    return ChatResponseSchema(
        message=result.message,
        subscription_preview=result.subscription_preview,
        ready_to_create=result.ready_to_create,
        conversation_history=[
            ChatMessage(role=m["role"], content=m["content"])
            for m in result.conversation_history
        ],
    )


@router.post(
    "/subscription/create",
    response_model=SubscriptionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_subscription_from_chat(
    request: CreateFromChatRequest,
    db: AsyncSession = Depends(get_db),
    user_id: UUID | None = Query(None, description="[TESTING ONLY] User ID"),
) -> SubscriptionResponse:
    """
    Create a subscription from chat configuration.

    Takes the final configuration built through the chat interface
    and creates an actual subscription.

    Resolves channel names to channel IDs automatically.
    """
    current_user = await get_user_for_testing(db, user_id)
    config = request.config

    # Resolve channel names to IDs if present
    channel_ids: list[str] | None = None
    if channel_names := config.get("channel_names"):
        resolver = ChannelResolverService()
        resolved = await resolver.resolve_channel_names(channel_names)

        # Filter out None values (unresolved channels)
        channel_ids = [cid for cid in resolved.values() if cid is not None]

        # Log unresolved channels
        unresolved = [name for name, cid in resolved.items() if cid is None]
        if unresolved:
            logger.warning(f"Could not resolve channels: {unresolved}")

    # Build filters from config
    filters_dict = config.get("filters", {})
    filters = (
        SubscriptionFilters(**filters_dict) if filters_dict else SubscriptionFilters()
    )

    # Build SubscriptionCreate
    create_data = SubscriptionCreate(
        list_id=request.list_id,
        name=config.get("name", "Neues Abo"),
        channel_ids=channel_ids,
        keywords=config.get("keywords"),
        filters=filters,
        poll_interval=config.get("poll_interval", "daily"),
    )

    # Create via service
    service = SubscriptionService(db, current_user.id)

    try:
        subscription = await service.create_subscription(create_data)
        return subscription
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
