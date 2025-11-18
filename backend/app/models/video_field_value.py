from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, Numeric, Boolean, ForeignKey, Text, UniqueConstraint, CheckConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from uuid import UUID as PyUUID

from .base import BaseModel

if TYPE_CHECKING:
    from .custom_field import CustomField
    from .video import Video


class VideoFieldValue(BaseModel):
    """
    Stores actual field values for videos with typed columns for performance.

    This model stores the user-assigned values for custom fields on videos.
    Unlike SchemaField (which defines structure), VideoFieldValue stores
    actual data and requires audit trail via timestamps and auto-generated id.

    IMPORTANT: Migration omits created_at column (only id and updated_at).
    Model overrides BaseModel.created_at to match database schema.
    REF: Migration 1a6e18578c31 lines 76-86 - no created_at column.

    Typed Value Columns Pattern:
        Each VideoFieldValue row has 3 nullable value columns:
        - value_text: For 'text' and 'select' field types
        - value_numeric: For 'rating' field types (1-5 scale)
        - value_boolean: For 'boolean' field types

        Only ONE column will be populated based on the field's field_type.
        This design enables efficient filtering via composite indexes:
        - "Show videos where Rating >= 4" → Uses idx_video_field_values_field_numeric
        - "Show videos where Presentation = 'great'" → Uses idx_video_field_values_field_text

    UNIQUE Constraint:
        (video_id, field_id) ensures one value per field per video.
        Prevents duplicate entries and enables efficient upsert operations.

    Cascade Behavior:
        - ON DELETE CASCADE from videos (values deleted when video deleted)
        - ON DELETE CASCADE from custom_fields (values deleted when field deleted)
        - passive_deletes=True on both relationships (trusts DB CASCADE for performance)

    Examples:
        >>> # Rating field value (value_numeric populated)
        >>> value = VideoFieldValue(
        ...     video_id=video_uuid,
        ...     field_id=rating_field_uuid,
        ...     value_numeric=4.5
        ... )

        >>> # Select field value (value_text populated)
        >>> value = VideoFieldValue(
        ...     video_id=video_uuid,
        ...     field_id=presentation_field_uuid,
        ...     value_text="great"
        ... )

        >>> # Boolean field value (value_boolean populated)
        >>> value = VideoFieldValue(
        ...     video_id=video_uuid,
        ...     field_id=recommended_field_uuid,
        ...     value_boolean=True
        ... )

    Performance Notes:
        - Composite indexes enable efficient filtering: (field_id, value_numeric), (field_id, value_text)
        - UNIQUE constraint index enables fast upsert: (video_id, field_id)
        - passive_deletes=True avoids SELECT before CASCADE DELETE (REF MCP Task #59)
    """
    __tablename__ = "video_field_values"

    # Override: Exclude created_at from BaseModel (migration omits this column)
    created_at = None

    # Foreign Key Columns
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

    # Typed Value Columns (only one populated based on field_type)
    value_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    value_numeric: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    value_boolean: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)

    # Relationships
    video: Mapped["Video"] = relationship(
        "Video",
        back_populates="field_values"
    )
    field: Mapped["CustomField"] = relationship(
        "CustomField",
        back_populates="video_field_values"
    )

    # Constraints and Indexes
    __table_args__ = (
        UniqueConstraint('video_id', 'field_id', name='uq_video_field_values_video_field'),
        CheckConstraint(
            "((value_text IS NOT NULL)::int + (value_numeric IS NOT NULL)::int + (value_boolean IS NOT NULL)::int) = 1",
            name="ck_video_field_values_exactly_one_value"
        ),
        # Performance indexes from migration 1a6e18578c31 (lines 93-99)
        # Index 1: Filter by field + numeric value (e.g., "Rating >= 4")
        Index('idx_video_field_values_field_numeric', 'field_id', 'value_numeric'),
        # Index 2: Filter by field + text value (e.g., "Presentation = 'great'")
        Index('idx_video_field_values_field_text', 'field_id', 'value_text'),
        # Index 3: Lookup all field values for a video (most common query)
        Index('idx_video_field_values_video_field', 'video_id', 'field_id'),
    )

    def __repr__(self) -> str:
        return f"<VideoFieldValue(video_id={self.video_id}, field_id={self.field_id})>"
