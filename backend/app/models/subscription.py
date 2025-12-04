"""
Subscription models for automatic video import.

Subscriptions allow users to define channel/keyword combinations
that automatically import new videos into their lists.
"""

from datetime import datetime
from typing import TYPE_CHECKING, Any
from uuid import UUID as PyUUID

from sqlalchemy import ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import BaseModel

if TYPE_CHECKING:
    from .list import BookmarkList
    from .user import User
    from .video import Video


class Subscription(BaseModel):
    """
    Represents a subscription for automatic video import.

    A subscription defines channel/keyword filters that are periodically
    polled to find new videos matching the criteria.
    """

    __tablename__ = "subscriptions"

    # Foreign keys
    user_id: Mapped[PyUUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    list_id: Mapped[PyUUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("bookmarks_lists.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # Basic info
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)

    # Source filters (what to search for)
    channel_ids: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)
    keywords: Mapped[list[str] | None] = mapped_column(ARRAY(Text), nullable=True)

    # Meta filters (which videos match)
    filters: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default={})

    # Polling configuration
    poll_interval: Mapped[str] = mapped_column(
        String(20), nullable=False, default="daily"
    )
    last_polled_at: Mapped[datetime | None] = mapped_column(nullable=True)
    next_poll_at: Mapped[datetime | None] = mapped_column(nullable=True)

    # PubSubHubbub (for channel subscriptions)
    pubsub_callback_ids: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default={}
    )
    pubsub_expires_at: Mapped[datetime | None] = mapped_column(nullable=True)

    # Statistics
    match_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="subscriptions")
    list: Mapped["BookmarkList"] = relationship(
        "BookmarkList", back_populates="subscriptions"
    )
    matches: Mapped[list["SubscriptionMatch"]] = relationship(
        "SubscriptionMatch",
        back_populates="subscription",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    __table_args__ = (
        Index(
            "idx_subscriptions_active_poll",
            "is_active",
            "next_poll_at",
            postgresql_where=(is_active == True),
        ),
    )

    def __repr__(self) -> str:
        return f"<Subscription(id={self.id}, name={self.name!r}, is_active={self.is_active})>"


class SubscriptionMatch(BaseModel):
    """
    Tracks which videos were imported by which subscription.

    This provides an audit trail and allows displaying
    match history in the subscription details.
    """

    __tablename__ = "subscription_matches"

    subscription_id: Mapped[PyUUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("subscriptions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    video_id: Mapped[PyUUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("videos.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    matched_at: Mapped[datetime] = mapped_column(
        nullable=False,
        default=datetime.utcnow,
    )
    source: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )  # 'pubsub', 'poll', 'manual_sync'

    # Relationships
    subscription: Mapped["Subscription"] = relationship(
        "Subscription", back_populates="matches"
    )
    video: Mapped["Video"] = relationship("Video")

    __table_args__ = (
        Index(
            "idx_subscription_matches_unique",
            "subscription_id",
            "video_id",
            unique=True,
        ),
    )

    def __repr__(self) -> str:
        return f"<SubscriptionMatch(subscription_id={self.subscription_id}, video_id={self.video_id})>"
