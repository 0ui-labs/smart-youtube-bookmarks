"""
Subscription service for managing automatic video imports.

Provides CRUD operations and sync functionality for subscriptions.
"""

from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.list import BookmarkList
from app.models.subscription import Subscription, SubscriptionMatch
from app.schemas.subscription import (
    SubscriptionCreate,
    SubscriptionFilters,
    SubscriptionUpdate,
)


class SubscriptionService:
    """
    Service for subscription management.

    Encapsulates all subscription-related database operations
    for use in API routes and background workers.
    """

    def __init__(self, db: AsyncSession, user_id: UUID):
        """
        Initialize service with database session and user context.

        Args:
            db: Async database session
            user_id: Current user's ID for scoping queries
        """
        self.db = db
        self.user_id = user_id

    async def list_subscriptions(
        self,
        *,
        skip: int = 0,
        limit: int = 50,
        list_id: UUID | None = None,
        is_active: bool | None = None,
    ) -> list[Subscription]:
        """
        List subscriptions for the current user.

        Args:
            skip: Number of records to skip (pagination)
            limit: Maximum number of records to return
            list_id: Optional filter by target list
            is_active: Optional filter by active status

        Returns:
            List of subscriptions matching the filters
        """
        stmt = select(Subscription).where(Subscription.user_id == self.user_id)

        if list_id is not None:
            stmt = stmt.where(Subscription.list_id == list_id)
        if is_active is not None:
            stmt = stmt.where(Subscription.is_active == is_active)

        stmt = stmt.order_by(Subscription.created_at.desc()).offset(skip).limit(limit)

        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_subscription(self, subscription_id: UUID) -> Subscription | None:
        """
        Get a single subscription by ID.

        Args:
            subscription_id: The subscription's UUID

        Returns:
            Subscription if found and owned by user, None otherwise
        """
        stmt = select(Subscription).where(
            Subscription.id == subscription_id,
            Subscription.user_id == self.user_id,
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def create_subscription(self, data: SubscriptionCreate) -> Subscription:
        """
        Create a new subscription.

        Args:
            data: Subscription creation data

        Returns:
            The created subscription

        Raises:
            ValueError: If target list doesn't exist or doesn't belong to user
        """
        # Validate that list exists and belongs to user
        list_stmt = select(BookmarkList).where(
            BookmarkList.id == data.list_id,
            BookmarkList.user_id == self.user_id,
        )
        list_result = await self.db.execute(list_stmt)
        if not list_result.scalar_one_or_none():
            raise ValueError(f"List {data.list_id} not found or access denied")

        # Calculate next poll time
        next_poll = self._calculate_next_poll(data.poll_interval)

        subscription = Subscription(
            user_id=self.user_id,
            list_id=data.list_id,
            name=data.name,
            channel_ids=data.channel_ids,
            keywords=data.keywords,
            filters=data.filters.model_dump() if data.filters else {},
            poll_interval=data.poll_interval,
            next_poll_at=next_poll,
        )
        self.db.add(subscription)
        await self.db.commit()
        await self.db.refresh(subscription)
        return subscription

    async def update_subscription(
        self, subscription_id: UUID, data: SubscriptionUpdate
    ) -> Subscription | None:
        """
        Update an existing subscription.

        Args:
            subscription_id: ID of subscription to update
            data: Fields to update

        Returns:
            Updated subscription, or None if not found
        """
        subscription = await self.get_subscription(subscription_id)
        if not subscription:
            return None

        update_data = data.model_dump(exclude_unset=True)

        # Handle list_id change (validate ownership)
        if "list_id" in update_data and update_data["list_id"] is not None:
            list_stmt = select(BookmarkList).where(
                BookmarkList.id == update_data["list_id"],
                BookmarkList.user_id == self.user_id,
            )
            list_result = await self.db.execute(list_stmt)
            if not list_result.scalar_one_or_none():
                raise ValueError(
                    f"List {update_data['list_id']} not found or access denied"
                )

        # Handle filters (convert Pydantic model to dict)
        if "filters" in update_data and update_data["filters"] is not None:
            if isinstance(update_data["filters"], SubscriptionFilters):
                update_data["filters"] = update_data["filters"].model_dump()

        # Update poll schedule if interval changed
        if "poll_interval" in update_data:
            update_data["next_poll_at"] = self._calculate_next_poll(
                update_data["poll_interval"]
            )

        for field, value in update_data.items():
            setattr(subscription, field, value)

        await self.db.commit()
        await self.db.refresh(subscription)
        return subscription

    async def delete_subscription(self, subscription_id: UUID) -> bool:
        """
        Delete a subscription.

        Args:
            subscription_id: ID of subscription to delete

        Returns:
            True if deleted, False if not found
        """
        subscription = await self.get_subscription(subscription_id)
        if not subscription:
            return False

        await self.db.delete(subscription)
        await self.db.commit()
        return True

    async def sync_subscription(self, subscription_id: UUID) -> int:
        """
        Manually trigger sync for a subscription.

        This is a stub implementation. Full implementation will be in
        Etappe 2 with the polling worker.

        Args:
            subscription_id: ID of subscription to sync

        Returns:
            Number of new videos imported (0 for stub)

        Raises:
            ValueError: If subscription not found
        """
        subscription = await self.get_subscription(subscription_id)
        if not subscription:
            raise ValueError(f"Subscription {subscription_id} not found")

        # TODO: Implement actual sync logic in Etappe 2
        # - Fetch videos from YouTube API based on channel_ids/keywords
        # - Apply filters
        # - Import new videos to target list
        # - Create SubscriptionMatch records
        # - Update last_polled_at and next_poll_at

        # For now, just update timestamps
        subscription.last_polled_at = datetime.utcnow()
        subscription.next_poll_at = self._calculate_next_poll(
            subscription.poll_interval
        )
        await self.db.commit()

        return 0  # Stub: no videos imported yet

    async def get_matches(
        self, subscription_id: UUID, *, skip: int = 0, limit: int = 50
    ) -> list[SubscriptionMatch]:
        """
        Get match history for a subscription.

        Args:
            subscription_id: ID of subscription
            skip: Pagination offset
            limit: Maximum records to return

        Returns:
            List of matches
        """
        # First verify user owns subscription
        subscription = await self.get_subscription(subscription_id)
        if not subscription:
            return []

        stmt = (
            select(SubscriptionMatch)
            .where(SubscriptionMatch.subscription_id == subscription_id)
            .order_by(SubscriptionMatch.matched_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    def _calculate_next_poll(self, interval: str) -> datetime:
        """
        Calculate next poll time based on interval.

        Args:
            interval: Poll interval ('daily' or 'twice_daily')

        Returns:
            DateTime for next poll
        """
        now = datetime.utcnow()
        if interval == "twice_daily":
            return now + timedelta(hours=12)
        else:  # daily
            return now + timedelta(hours=24)
