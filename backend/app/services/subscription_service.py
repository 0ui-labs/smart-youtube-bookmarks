"""
Subscription service for managing automatic video imports.

Provides CRUD operations and sync functionality for subscriptions.
Integrates with PubSubHubbub for real-time YouTube channel notifications.
"""

import logging
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
from app.services.pubsub_service import PubSubHubbubService

logger = logging.getLogger(__name__)


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
        await self.db.flush()  # Get subscription.id before PubSub

        # Subscribe to PubSubHubbub for channel subscriptions
        if data.channel_ids:
            await self._subscribe_channels(subscription, data.channel_ids)

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

        # Handle channel_ids changes - update PubSub subscriptions
        if "channel_ids" in update_data:
            await self._update_channel_subscriptions(
                subscription,
                old_channels=subscription.channel_ids or [],
                new_channels=update_data["channel_ids"] or [],
            )

        for field, value in update_data.items():
            setattr(subscription, field, value)

        await self.db.commit()
        await self.db.refresh(subscription)
        return subscription

    async def delete_subscription(self, subscription_id: UUID) -> bool:
        """
        Delete a subscription.

        Also unsubscribes from PubSubHubbub for any channel subscriptions.

        Args:
            subscription_id: ID of subscription to delete

        Returns:
            True if deleted, False if not found
        """
        subscription = await self.get_subscription(subscription_id)
        if not subscription:
            return False

        # Unsubscribe from PubSubHubbub for channel subscriptions
        if subscription.channel_ids:
            await self._unsubscribe_channels(subscription.channel_ids)

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

    async def _subscribe_channels(
        self, subscription: Subscription, channel_ids: list[str]
    ) -> None:
        """
        Subscribe to PubSubHubbub for a list of channels.

        Updates the subscription's pubsub_expires_at on success.

        Args:
            subscription: The subscription to update
            channel_ids: List of YouTube channel IDs to subscribe to
        """
        if not channel_ids:
            return

        async with PubSubHubbubService() as pubsub:
            results = await pubsub.subscribe_channels(channel_ids)

            success_count = sum(1 for success in results.values() if success)
            if success_count > 0:
                # Set expiry to 10 days from now
                subscription.pubsub_expires_at = datetime.utcnow() + timedelta(days=10)
                logger.info(
                    f"Subscribed to {success_count}/{len(channel_ids)} channels "
                    f"for subscription {subscription.id}"
                )
            else:
                logger.warning(
                    f"Failed to subscribe to any channels for subscription {subscription.id}"
                )

    async def _unsubscribe_channels(self, channel_ids: list[str]) -> None:
        """
        Unsubscribe from PubSubHubbub for a list of channels.

        Args:
            channel_ids: List of YouTube channel IDs to unsubscribe from
        """
        if not channel_ids:
            return

        async with PubSubHubbubService() as pubsub:
            results = await pubsub.unsubscribe_channels(channel_ids)

            success_count = sum(1 for success in results.values() if success)
            logger.info(
                f"Unsubscribed from {success_count}/{len(channel_ids)} channels"
            )

    async def _update_channel_subscriptions(
        self,
        subscription: Subscription,
        old_channels: list[str],
        new_channels: list[str],
    ) -> None:
        """
        Update PubSubHubbub subscriptions when channel list changes.

        Subscribes to newly added channels and unsubscribes from removed ones.

        Args:
            subscription: The subscription being updated
            old_channels: Previous list of channel IDs
            new_channels: New list of channel IDs
        """
        old_set = set(old_channels)
        new_set = set(new_channels)

        # Channels to add (in new but not in old)
        to_add = list(new_set - old_set)
        # Channels to remove (in old but not in new)
        to_remove = list(old_set - new_set)

        if to_add:
            await self._subscribe_channels(subscription, to_add)

        if to_remove:
            await self._unsubscribe_channels(to_remove)
