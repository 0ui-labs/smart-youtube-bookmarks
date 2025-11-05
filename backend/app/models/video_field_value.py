from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, Numeric, Boolean, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from uuid import UUID as PyUUID

from .base import BaseModel

if TYPE_CHECKING:
    from .custom_field import CustomField
    from .video import Video


class VideoFieldValue(BaseModel):
    """
    Stores the actual field values for videos.

    NOTE: This is a placeholder for Task #62. Full implementation coming soon.
    """
    __tablename__ = "video_field_values"

    video_id: Mapped[PyUUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("videos.id", ondelete="CASCADE"),
        nullable=False
    )
    field_id: Mapped[PyUUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("custom_fields.id", ondelete="CASCADE"),
        nullable=False
    )

    # Typed value columns (one will be populated based on field_type)
    value_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    value_numeric: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    value_boolean: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)

    # Relationships (placeholder)
    video: Mapped["Video"] = relationship("Video", back_populates="field_values")
    field: Mapped["CustomField"] = relationship("CustomField", back_populates="video_field_values")

    __table_args__ = (
        UniqueConstraint('video_id', 'field_id', name='uq_video_field_values_video_field'),
    )

    def __repr__(self) -> str:
        return f"<VideoFieldValue(video_id={self.video_id}, field_id={self.field_id})>"
