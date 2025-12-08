"""VideoEnrichment model for storing video captions, chapters, and transcripts."""

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Any
from uuid import UUID as PyUUID

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import BaseModel

if TYPE_CHECKING:
    from .video import Video


class EnrichmentStatus(str, Enum):
    """Status of video enrichment processing."""

    pending = "pending"
    processing = "processing"
    completed = "completed"
    partial = "partial"
    failed = "failed"


class VideoEnrichment(BaseModel):
    """
    Stores enrichment data for a video including captions, chapters, and transcripts.

    Each video can have at most one enrichment record. The enrichment process
    extracts captions from YouTube or generates them via Groq Whisper, and
    extracts chapters from YouTube metadata or video description.
    """

    __tablename__ = "video_enrichments"

    video_id: Mapped[PyUUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("videos.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )

    # Use String to match existing DB schema (VARCHAR(20))
    status: Mapped[str] = mapped_column(
        String(20), default=EnrichmentStatus.pending.value, nullable=False
    )

    # Captions (VTT format)
    captions_vtt: Mapped[str | None] = mapped_column(Text, nullable=True)
    captions_language: Mapped[str | None] = mapped_column(String(50), nullable=True)
    captions_source: Mapped[str | None] = mapped_column(
        String(30), nullable=True
    )  # Match existing DB

    # Transcript (plain text for search)
    transcript_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Chapters (VTT + JSON)
    chapters_vtt: Mapped[str | None] = mapped_column(Text, nullable=True)
    chapters_json: Mapped[list[dict[str, Any]] | None] = mapped_column(
        JSONB, nullable=True
    )
    chapters_source: Mapped[str | None] = mapped_column(
        String(30), nullable=True
    )  # Match existing DB

    # Thumbnails (sprite sheet VTT URL)
    thumbnails_vtt_url: Mapped[str | None] = mapped_column(
        String(500), nullable=True
    )  # Match existing DB

    # Processing state
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    progress_message: Mapped[str | None] = mapped_column(String(100), nullable=True)
    processed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationship
    video: Mapped["Video"] = relationship(
        "Video", back_populates="enrichment", lazy="joined"
    )

    def __repr__(self) -> str:
        return f"<VideoEnrichment(id={self.id}, video_id={self.video_id}, status={self.status.value})>"
