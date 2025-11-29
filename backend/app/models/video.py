from datetime import datetime
from typing import TYPE_CHECKING, Any, Optional
from uuid import UUID as PyUUID

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import BaseModel
from .tag import video_tags

if TYPE_CHECKING:
    from .channel import Channel
    from .video_enrichment import VideoEnrichment


class Video(BaseModel):
    """
    Represents a YouTube video within a bookmark list.

    Stores video metadata and extracted data according to the associated
    bookmark list's schema. Tracks processing status for async operations.
    """

    __tablename__ = "videos"

    list_id: Mapped[UUID] = mapped_column(
        ForeignKey("bookmarks_lists.id", ondelete="CASCADE"), nullable=False
    )
    # Channel relationship (optional - videos can exist without channel initially)
    channel_id: Mapped[PyUUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("channels.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    youtube_id: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    channel: Mapped[str | None] = mapped_column(String(255), nullable=True)
    duration: Mapped[int | None] = mapped_column(Integer, nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    thumbnail_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Extended YouTube metadata (snippet)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    youtube_tags: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)
    youtube_category_id: Mapped[str | None] = mapped_column(String(10), nullable=True)
    default_language: Mapped[str | None] = mapped_column(String(10), nullable=True)

    # Content details
    dimension: Mapped[str | None] = mapped_column(String(5), nullable=True)  # 2d/3d
    definition: Mapped[str | None] = mapped_column(String(5), nullable=True)  # hd/sd
    has_captions: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    region_restriction: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB, nullable=True
    )

    # Statistics
    view_count: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    like_count: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    comment_count: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    # Status
    privacy_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    is_embeddable: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    extracted_data: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    processing_status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending"
    )
    error_message: Mapped[str | None] = mapped_column(String, nullable=True)

    # Import progress tracking (for two-phase import)
    import_progress: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    import_stage: Mapped[str] = mapped_column(
        String(20), nullable=False, default="created"
    )

    # Watch progress tracking (for video player integration)
    watch_position: Mapped[int | None] = mapped_column(Integer, nullable=True)
    watch_position_updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    list: Mapped["BookmarkList"] = relationship("BookmarkList", back_populates="videos")
    channel_ref: Mapped[Optional["Channel"]] = relationship(
        "Channel", back_populates="videos", lazy="raise"
    )
    tags: Mapped[list["Tag"]] = relationship(
        "Tag",
        secondary=video_tags,
        back_populates="videos",
        uselist=True,  # Explicitly ensure list relationship
    )
    field_values: Mapped[list["VideoFieldValue"]] = relationship(
        "VideoFieldValue",
        back_populates="video",
        cascade="all, delete-orphan",
        passive_deletes=True,  # Trust DB CASCADE (REF MCP, consistent with CustomField)
        uselist=True,  # Explicit list relationship (unique constraint may confuse SQLAlchemy)
    )
    enrichment: Mapped[Optional["VideoEnrichment"]] = relationship(
        "VideoEnrichment",
        back_populates="video",
        uselist=False,
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    __table_args__ = (
        Index("idx_videos_list_id", "list_id"),
        Index("idx_videos_status", "processing_status"),
        Index("idx_videos_list_youtube", "list_id", "youtube_id", unique=True),
    )

    def __repr__(self) -> str:
        return f"<Video(id={self.id}, youtube_id={self.youtube_id!r}, title={self.title!r})>"
