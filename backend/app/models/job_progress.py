from typing import Any
from uuid import UUID
from sqlalchemy import ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import BaseModel

class JobProgressEvent(BaseModel):
    """Stores progress updates for video processing jobs"""
    __tablename__ = "job_progress_events"

    job_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("processing_jobs.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    progress_data: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)

    # Relationship to ProcessingJob (optional, for eager loading)
    job: Mapped["ProcessingJob"] = relationship(back_populates="progress_events")

    __table_args__ = (
        Index("idx_job_progress_job_created", "job_id", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<JobProgressEvent(id={self.id}, job_id={self.job_id}, progress={self.progress_data.get('progress')}%)>"
