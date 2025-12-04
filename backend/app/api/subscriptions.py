"""
FastAPI router for subscription endpoints.

Provides CRUD operations for managing video subscriptions
that automatically import new videos from YouTube channels and topics.
"""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.redis import get_redis_client
from app.models.user import User
from app.schemas.subscription import (
    QuotaStatusResponse,
    SubscriptionCreate,
    SubscriptionMatchResponse,
    SubscriptionResponse,
    SubscriptionUpdate,
    SyncResponse,
)
from app.services.quota_service import QuotaService
from app.services.subscription_service import SubscriptionService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/subscriptions", tags=["subscriptions"])


# ============================================================================
# SECURITY WARNING: Temporary User Access Helper
# ============================================================================
# Same pattern as other routers - will be replaced with JWT auth
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

    logger.warning(
        f"get_user_for_testing() called with user_id={user_id or 'None (defaulting)'}"
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


@router.get("", response_model=list[SubscriptionResponse])
async def list_subscriptions(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(50, ge=1, le=100, description="Max records to return"),
    list_id: UUID | None = Query(None, description="Filter by target list"),
    is_active: bool | None = Query(None, description="Filter by active status"),
    db: AsyncSession = Depends(get_db),
    user_id: UUID | None = Query(None, description="[TESTING ONLY] User ID"),
):
    """
    List all subscriptions for the current user.

    Supports filtering by target list and active status.
    Results are ordered by creation date (newest first).
    """
    current_user = await get_user_for_testing(db, user_id)
    service = SubscriptionService(db, current_user.id)
    subscriptions = await service.list_subscriptions(
        skip=skip, limit=limit, list_id=list_id, is_active=is_active
    )
    return subscriptions


@router.get("/quota", response_model=QuotaStatusResponse)
async def get_quota_status():
    """
    Get current YouTube API quota status.

    Returns the daily usage, remaining quota, and percentage used.
    YouTube API has a default daily limit of 10,000 units.

    Common API costs:
    - Search API: 100 units per request
    - Videos list: 1 unit per request
    """
    redis_client = await get_redis_client()
    quota = QuotaService(redis_client=redis_client)
    return await quota.get_quota_status()


@router.post(
    "", response_model=SubscriptionResponse, status_code=status.HTTP_201_CREATED
)
async def create_subscription(
    data: SubscriptionCreate,
    db: AsyncSession = Depends(get_db),
    user_id: UUID | None = Query(None, description="[TESTING ONLY] User ID"),
):
    """
    Create a new subscription.

    A subscription monitors YouTube channels and/or keywords for new videos
    and automatically imports matching videos to the specified list.
    """
    current_user = await get_user_for_testing(db, user_id)
    service = SubscriptionService(db, current_user.id)

    try:
        subscription = await service.create_subscription(data)
        return subscription
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{subscription_id}", response_model=SubscriptionResponse)
async def get_subscription(
    subscription_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: UUID | None = Query(None, description="[TESTING ONLY] User ID"),
):
    """Get a single subscription by ID."""
    current_user = await get_user_for_testing(db, user_id)
    service = SubscriptionService(db, current_user.id)

    subscription = await service.get_subscription(subscription_id)
    if not subscription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found"
        )
    return subscription


@router.put("/{subscription_id}", response_model=SubscriptionResponse)
async def update_subscription(
    subscription_id: UUID,
    data: SubscriptionUpdate,
    db: AsyncSession = Depends(get_db),
    user_id: UUID | None = Query(None, description="[TESTING ONLY] User ID"),
):
    """
    Update a subscription.

    Can modify name, active status, channels, keywords, filters, and poll interval.
    """
    current_user = await get_user_for_testing(db, user_id)
    service = SubscriptionService(db, current_user.id)

    try:
        subscription = await service.update_subscription(subscription_id, data)
        if not subscription:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found"
            )
        return subscription
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{subscription_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_subscription(
    subscription_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: UUID | None = Query(None, description="[TESTING ONLY] User ID"),
):
    """Delete a subscription."""
    current_user = await get_user_for_testing(db, user_id)
    service = SubscriptionService(db, current_user.id)

    deleted = await service.delete_subscription(subscription_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found"
        )
    return None


@router.post("/{subscription_id}/sync", response_model=SyncResponse)
async def sync_subscription(
    subscription_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: UUID | None = Query(None, description="[TESTING ONLY] User ID"),
):
    """
    Manually trigger sync for a subscription.

    Checks for new videos matching the subscription criteria
    and imports them to the target list.

    Note: This is currently a stub. Full implementation in Etappe 2.
    """
    current_user = await get_user_for_testing(db, user_id)
    service = SubscriptionService(db, current_user.id)

    try:
        new_videos = await service.sync_subscription(subscription_id)
        return SyncResponse(new_videos=new_videos)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get(
    "/{subscription_id}/matches", response_model=list[SubscriptionMatchResponse]
)
async def get_subscription_matches(
    subscription_id: UUID,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user_id: UUID | None = Query(None, description="[TESTING ONLY] User ID"),
):
    """
    Get match history for a subscription.

    Returns the list of videos that were imported by this subscription.
    """
    current_user = await get_user_for_testing(db, user_id)
    service = SubscriptionService(db, current_user.id)

    # Verify subscription exists
    subscription = await service.get_subscription(subscription_id)
    if not subscription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found"
        )

    matches = await service.get_matches(subscription_id, skip=skip, limit=limit)
    return matches
