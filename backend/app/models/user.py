"""
User model for authentication.

This is a minimal implementation to support WebSocket authentication.
Can be expanded later with full user management features.
"""

from typing import TYPE_CHECKING

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class User(BaseModel):
    """
    User model for authentication.

    Minimal implementation for WebSocket auth.
    """

    __tablename__ = "users"

    clerk_id: Mapped[str | None] = mapped_column(String(255), unique=True, index=True)

    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)

    # Relationships
    lists: Mapped[list["BookmarkList"]] = relationship(
        "BookmarkList", back_populates="user"
    )
    tags: Mapped[list["Tag"]] = relationship("Tag", back_populates="user")
    channels: Mapped[list["Channel"]] = relationship(
        "Channel", back_populates="user", cascade="all, delete-orphan"
    )
    subscriptions: Mapped[list["Subscription"]] = relationship(
        "Subscription", back_populates="user", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email={self.email})>"


if TYPE_CHECKING:
    from .channel import Channel
    from .list import BookmarkList
    from .subscription import Subscription
    from .tag import Tag
