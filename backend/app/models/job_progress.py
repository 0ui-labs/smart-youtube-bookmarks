from datetime import datetime
from uuid import uuid4, UUID
from sqlalchemy import Column, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB
from sqlalchemy.orm import relationship
from .base import Base

class JobProgressEvent(Base):
    """Stores progress updates for video processing jobs"""
    __tablename__ = "job_progress_events"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    job_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("processing_jobs.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    progress_data = Column(JSONB, nullable=False)

    # Relationship to ProcessingJob (optional, for eager loading)
    job = relationship("ProcessingJob", back_populates="progress_events")

    def __repr__(self):
        return f"<JobProgressEvent(id={self.id}, job_id={self.job_id}, progress={self.progress_data.get('progress')}%)>"
