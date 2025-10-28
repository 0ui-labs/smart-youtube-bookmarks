from sqlalchemy import String, Integer, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from .base import BaseModel


class ProcessingJob(BaseModel):
    """
    Tracks the progress of bulk video processing operations.

    Each job is associated with a bookmark list and tracks the number
    of videos processed, failed, and the overall job status.
    """
    __tablename__ = "processing_jobs"

    list_id: Mapped[UUID] = mapped_column(
        ForeignKey("bookmarks_lists.id", ondelete="CASCADE"),
        nullable=False
    )
    total_videos: Mapped[int] = mapped_column(Integer, nullable=False)
    processed_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    failed_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="running"
    )

    # Relationships
    list: Mapped["BookmarkList"] = relationship("BookmarkList", back_populates="jobs")
    progress_events = relationship("JobProgressEvent", back_populates="job", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_jobs_list_id", "list_id"),
        Index("idx_jobs_status", "status"),
    )

    def __repr__(self) -> str:
        return f"<ProcessingJob(id={self.id}, status={self.status!r}, processed={self.processed_count}/{self.total_videos})>"
