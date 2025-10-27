from datetime import datetime
from typing import Optional, Dict, Any

from sqlalchemy import String, Integer, DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB

from .base import BaseModel


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
    youtube_id: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    channel: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    duration: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    thumbnail_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    extracted_data: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    processing_status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="pending"
    )
    error_message: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # Relationships
    list: Mapped["BookmarkList"] = relationship("BookmarkList", back_populates="videos")

    __table_args__ = (
        Index("idx_videos_list_id", "list_id"),
        Index("idx_videos_status", "processing_status"),
        Index("idx_videos_list_youtube", "list_id", "youtube_id", unique=True),
    )

    def __repr__(self) -> str:
        return f"<Video(id={self.id}, youtube_id={self.youtube_id!r}, title={self.title!r})>"
