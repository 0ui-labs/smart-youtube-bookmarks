from datetime import datetime
from typing import Optional, Dict, Any, TYPE_CHECKING
from uuid import UUID as PyUUID

from sqlalchemy import String, Integer, BigInteger, DateTime, ForeignKey, Index, Boolean, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY

from .base import BaseModel
from .tag import video_tags

if TYPE_CHECKING:
    from .channel import Channel


class Video(BaseModel):
    """
    Represents a YouTube video within a bookmark list.

    Stores video metadata and extracted data according to the associated
    bookmark list's schema. Tracks processing status for async operations.
    """
    __tablename__ = "videos"

    list_id: Mapped[UUID] = mapped_column(
        ForeignKey("bookmarks_lists.id", ondelete="CASCADE"),
        nullable=False
    )
    # Channel relationship (optional - videos can exist without channel initially)
    channel_id: Mapped[Optional[PyUUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("channels.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    youtube_id: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    channel: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    duration: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    thumbnail_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Extended YouTube metadata (snippet)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    youtube_tags: Mapped[Optional[list[str]]] = mapped_column(ARRAY(String), nullable=True)
    youtube_category_id: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    default_language: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)

    # Content details
    dimension: Mapped[Optional[str]] = mapped_column(String(5), nullable=True)  # 2d/3d
    definition: Mapped[Optional[str]] = mapped_column(String(5), nullable=True)  # hd/sd
    has_captions: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    region_restriction: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, nullable=True)

    # Statistics
    view_count: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    like_count: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    comment_count: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)

    # Status
    privacy_status: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    is_embeddable: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)

    extracted_data: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    processing_status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="pending"
    )
    error_message: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # Relationships
    list: Mapped["BookmarkList"] = relationship("BookmarkList", back_populates="videos")
    channel_ref: Mapped[Optional["Channel"]] = relationship(
        "Channel",
        back_populates="videos",
        lazy="raise"
    )
    tags: Mapped[list["Tag"]] = relationship(
        "Tag",
        secondary=video_tags,
        back_populates="videos",
        uselist=True  # Explicitly ensure list relationship
    )
    field_values: Mapped[list["VideoFieldValue"]] = relationship(
        "VideoFieldValue",
        back_populates="video",
        cascade="all, delete-orphan",
        passive_deletes=True,  # Trust DB CASCADE (REF MCP, consistent with CustomField)
        uselist=True  # Explicit list relationship (unique constraint may confuse SQLAlchemy)
    )

    __table_args__ = (
        Index("idx_videos_list_id", "list_id"),
        Index("idx_videos_status", "processing_status"),
        Index("idx_videos_list_youtube", "list_id", "youtube_id", unique=True),
    )

    def __repr__(self) -> str:
        return f"<Video(id={self.id}, youtube_id={self.youtube_id!r}, title={self.title!r})>"
