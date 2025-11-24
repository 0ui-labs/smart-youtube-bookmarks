"""
Channel model for YouTube channels.

Channels are automatically created when videos are added.
Each user has their own set of channels (user-scoped).
"""
from typing import Optional, TYPE_CHECKING
from uuid import UUID as PyUUID

from sqlalchemy import String, Boolean, ForeignKey, Index, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import BaseModel

if TYPE_CHECKING:
    from .user import User
    from .video import Video


class Channel(BaseModel):
    """
    Represents a YouTube channel that videos belong to.

    Channels are automatically created when videos are added.
    Each user has their own set of channels (user-scoped).
    """
    __tablename__ = 'channels'

    user_id: Mapped[PyUUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey('users.id', ondelete='CASCADE'),
        nullable=False
    )
    youtube_channel_id: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="YouTube's channel ID (e.g., UCX6OQ3DkcsbYNE6H8uQQuVA)"
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Channel display name from YouTube"
    )
    thumbnail_url: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
        comment="Channel avatar URL from YouTube"
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Channel description from YouTube"
    )
    is_hidden: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default='false',
        comment="Hidden channels don't appear in sidebar"
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="channels")
    videos: Mapped[list["Video"]] = relationship(
        "Video",
        back_populates="channel_ref",
        lazy="raise"
    )

    __table_args__ = (
        Index("idx_channels_user_id", "user_id"),
        Index("idx_channels_user_youtube", "user_id", "youtube_channel_id", unique=True),
    )

    def __repr__(self) -> str:
        return f"<Channel(id={self.id}, name={self.name!r})>"
